package router

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCustomPaymentRoutesRegisteredAndProtected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("isolated-route-test"))))
	require.NotPanics(t, func() { SetApiRouter(engine) })
	routes := map[string]string{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = route.Handler
	}
	for provider, handler := range map[string]string{"freekassa": "FreeKassa", "heleket": "Heleket", "pally": "Pally", "plategal": "Plategal"} {
		for _, suffix := range []string{"pay", "amount"} {
			path := "/api/user/" + provider + "/" + suffix
			require.Contains(t, routes, "POST "+path)
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, httptest.NewRequest("POST", path, nil))
			require.Equal(t, 401, rec.Code, "order endpoints require a signed-in user")
		}
		path := "/api/" + provider + "/webhook"
		expected := handler + "Webhook"
		if provider == "freekassa" {
			path = "/api/freekassa/notify"
			expected = "FreeKassaNotify"
		}
		require.Contains(t, routes["POST "+path], expected)
	}
	require.Contains(t, routes["GET /api/freekassa/notify"], "FreeKassaNotify")
}
