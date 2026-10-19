package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/require"
)

// Exercise the frontend's actual HTTP contracts against an isolated SQLite
// database, with real session and New-Api-User authentication.
func TestStratusProfileSecurityContracts(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedis := common.RedisEnabled
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedis
		common.SetDatabaseTypes(oldMainType, oldLogType)
	})
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.TwoFA{}, &model.TwoFABackupCode{}, &model.PasskeyCredential{}))
	hash, err := common.Password2Hash("OriginalPass123")
	require.NoError(t, err)
	user := model.User{
		Username: "stratus-test", DisplayName: "Original", Password: hash,
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default",
	}
	require.NoError(t, db.Create(&user).Error)

	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("isolated-stratus-test-session"))))
	// Establish only the disposable test account's real signed session.
	engine.GET("/test-session", func(c *gin.Context) { setupLogin(&user, c) })
	protected := engine.Group("/api", middleware.UserAuth())
	protected.GET("/user/self", GetSelf)
	protected.PUT("/user/self", UpdateSelf)
	protected.GET("/user/2fa/status", Get2FAStatus)
	protected.POST("/user/2fa/setup", Setup2FA)
	protected.POST("/user/2fa/enable", Enable2FA)
	protected.POST("/user/2fa/disable", Disable2FA)
	protected.POST("/user/2fa/backup_codes", RegenerateBackupCodes)
	protected.POST("/verify", UniversalVerify)
	protected.POST("/oauth/email/bind", EmailBind)
	login := httptest.NewRecorder()
	engine.ServeHTTP(login, httptest.NewRequest("GET", "/test-session", nil))
	require.Equal(t, http.StatusOK, login.Code)
	cookies := login.Result().Cookies()
	require.NotEmpty(t, cookies)

	call := func(method, path string, payload any, uid string) map[string]any {
		t.Helper()
		body, err := common.Marshal(payload)
		require.NoError(t, err)
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if uid != "" {
			req.Header.Set("New-Api-User", uid)
		}
		for _, c := range cookies {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		var result map[string]any
		require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &result))
		return result
	}
	uid := fmt.Sprint(user.Id)
	ok := func(result map[string]any) map[string]any {
		t.Helper()
		require.Equal(t, true, result["success"], "%v", result["message"])
		data, _ := result["data"].(map[string]any)
		return data
	}
	bad := func(result map[string]any) {
		t.Helper()
		require.Equal(t, false, result["success"])
		require.NotEmpty(t, result["message"])
	}

	// A session cookie alone is insufficient; account identity must match too.
	bad(call("GET", "/api/user/self", nil, ""))
	bad(call("GET", "/api/user/self", nil, fmt.Sprint(user.Id+1)))
	ok(call("PUT", "/api/user/self", map[string]any{
		"username": "stratus-renamed", "display_name": "Saved name",
	}, uid))
	data := ok(call("GET", "/api/user/self", nil, uid))
	require.Equal(t, "stratus-renamed", data["username"])
	require.Equal(t, "Saved name", data["display_name"])
	passwordPayload := map[string]any{
		"username": "stratus-renamed", "display_name": "Saved name",
		"password": "ChangedPass123", "original_password": "wrong-password",
	}
	bad(call("PUT", "/api/user/self", passwordPayload, uid))
	passwordPayload["original_password"] = "OriginalPass123"
	ok(call("PUT", "/api/user/self", passwordPayload, uid))
	stored, err := model.GetUserById(user.Id, true)
	require.NoError(t, err)
	require.True(t, common.ValidatePasswordAndHash("ChangedPass123", stored.Password))
	require.False(t, common.ValidatePasswordAndHash("OriginalPass123", stored.Password))
	// Login's own validation rejects the previous password and accepts the new one.
	oldLogin := model.User{Username: "stratus-renamed", Password: "OriginalPass123"}
	require.Error(t, oldLogin.ValidateAndFill())
	newLogin := model.User{Username: "stratus-renamed", Password: "ChangedPass123"}
	require.NoError(t, newLogin.ValidateAndFill())

	// Verify binding persistence without sending mail or using any live address.
	common.RegisterVerificationCodeWithKey("stratus@example.test", "123456", common.EmailVerificationPurpose)
	bad(call("POST", "/api/oauth/email/bind", map[string]string{"email": "stratus@example.test", "code": "invalid"}, uid))
	common.RegisterVerificationCodeWithKey("stratus@example.test", "123456", common.EmailVerificationPurpose)
	ok(call("POST", "/api/oauth/email/bind", map[string]string{"email": "stratus@example.test", "code": "123456"}, uid))
	require.Equal(t, "stratus@example.test", ok(call("GET", "/api/user/self", nil, uid))["email"])

	require.Equal(t, false, ok(call("GET", "/api/user/2fa/status", nil, uid))["enabled"])
	setup := ok(call("POST", "/api/user/2fa/setup", nil, uid))
	secret, valid := setup["secret"].(string)
	require.True(t, valid)
	require.NotEmpty(t, secret)
	backups := setup["backup_codes"].([]any)
	require.NotEmpty(t, backups)
	// Initial setup does not enable 2FA before authenticator confirmation.
	require.Equal(t, false, ok(call("GET", "/api/user/2fa/status", nil, uid))["enabled"])
	bad(call("POST", "/api/user/2fa/enable", map[string]string{"code": "invalid"}, uid))
	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)
	ok(call("POST", "/api/user/2fa/enable", map[string]string{"code": code}, uid))
	status := ok(call("GET", "/api/user/2fa/status", nil, uid))
	require.Equal(t, true, status["enabled"])
	require.Equal(t, float64(len(backups)), status["backup_codes_remaining"])
	bad(call("POST", "/api/user/2fa/disable", map[string]string{"code": "invalid"}, uid))
	bad(call("POST", "/api/user/2fa/backup_codes", map[string]string{"code": "invalid"}, uid))
	regenerated := ok(call("POST", "/api/user/2fa/backup_codes", map[string]string{"code": code}, uid))
	newBackups := regenerated["backup_codes"].([]any)
	require.NotEmpty(t, newBackups)
	// Regeneration invalidates all previous recovery codes.
	bad(call("POST", "/api/user/2fa/disable", map[string]any{"code": backups[0]}, uid))
	ok(call("POST", "/api/verify", map[string]any{"method": "2fa", "code": newBackups[0]}, uid))
	require.Equal(t, float64(len(newBackups)-1), ok(call("GET", "/api/user/2fa/status", nil, uid))["backup_codes_remaining"])
	ok(call("POST", "/api/user/2fa/disable", map[string]any{"code": newBackups[1]}, uid))
	require.Equal(t, false, ok(call("GET", "/api/user/2fa/status", nil, uid))["enabled"])
}
