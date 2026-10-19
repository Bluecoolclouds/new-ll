package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type tgBotPendingSession struct {
	Status    string
	ExpiresAt time.Time
	User      *model.User
}

var tgBotSessionStore sync.Map

func init() {
	go func() {
		for {
			time.Sleep(2 * time.Minute)
			tgBotSessionStore.Range(func(k, v any) bool {
				if sess, ok := v.(*tgBotPendingSession); ok && time.Now().After(sess.ExpiresAt) {
					tgBotSessionStore.Delete(k)
				}
				return true
			})
		}
	}()
}

func TgBotInitSession(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Telegram login is not enabled"})
		return
	}
	if common.TelegramBotName == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Telegram bot is not configured"})
		return
	}
	token := uuid.New().String()
	tgBotSessionStore.Store(token, &tgBotPendingSession{
		Status:    "pending",
		ExpiresAt: time.Now().Add(5 * time.Minute),
	})
	botLink := fmt.Sprintf("https://t.me/%s?start=%s", common.TelegramBotName, token)
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"token":    token,
		"bot_link": botLink,
		"bot_name": common.TelegramBotName,
	})
}

func TgBotConfirmSession(c *gin.Context) {
	var req struct {
		Token      string `json:"token"`
		TelegramId string `json:"telegram_id"`
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		Username   string `json:"username"`
		Secret     string `json:"secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Token == "" || req.TelegramId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if common.TelegramBotSecret == "" || req.Secret != common.TelegramBotSecret {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	val, ok := tgBotSessionStore.Load(req.Token)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "token not found or expired"})
		return
	}
	sess := val.(*tgBotPendingSession)
	if time.Now().After(sess.ExpiresAt) {
		tgBotSessionStore.Delete(req.Token)
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "token expired"})
		return
	}

	user := &model.User{TelegramId: req.TelegramId}
	if model.IsTelegramIdAlreadyTaken(req.TelegramId) {
		if err := user.FillUserByTelegramId(); err != nil || user.Id == 0 {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "user not found"})
			return
		}
	} else {
		if !common.RegisterEnabled {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "registration is disabled"})
			return
		}
		baseUsername := req.Username
		if baseUsername == "" {
			baseUsername = "tg" + req.TelegramId
		}
		if len(baseUsername) > model.UserNameMaxLength {
			baseUsername = baseUsername[:model.UserNameMaxLength]
		}
		username := baseUsername
		if exists, _ := model.CheckUserExistOrDeleted(username, ""); exists {
			username = "tg" + strconv.Itoa(model.GetMaxUserId()+1)
		}
		displayName := req.FirstName
		if req.LastName != "" {
			displayName += " " + req.LastName
		}
		if displayName == "" {
			displayName = username
		}
		user = &model.User{
			Username:    username,
			DisplayName: displayName,
			TelegramId:  req.TelegramId,
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
		}
		if err := user.Insert(0); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "account is disabled"})
		return
	}

	sess.Status = "confirmed"
	sess.User = user
	tgBotSessionStore.Store(req.Token, sess)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "login confirmed"})
}

func TgBotPollSession(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "status": "error"})
		return
	}
	val, ok := tgBotSessionStore.Load(token)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": true, "status": "expired"})
		return
	}
	sess := val.(*tgBotPendingSession)
	if time.Now().After(sess.ExpiresAt) {
		tgBotSessionStore.Delete(token)
		c.JSON(http.StatusOK, gin.H{"success": true, "status": "expired"})
		return
	}
	if sess.Status == "confirmed" && sess.User != nil {
		tgBotSessionStore.Delete(token)
		user := sess.User
		model.UpdateUserLastLoginAt(user.Id)
		session := sessions.Default(c)
		session.Set("id", user.Id)
		session.Set("username", user.Username)
		session.Set("role", user.Role)
		session.Set("status", user.Status)
		session.Set("group", user.Group)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "status": "error", "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"status":  "confirmed",
			"data": map[string]any{
				"id":           user.Id,
				"username":     user.Username,
				"display_name": user.DisplayName,
				"role":         user.Role,
				"status":       user.Status,
				"group":        user.Group,
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "status": "pending"})
}
