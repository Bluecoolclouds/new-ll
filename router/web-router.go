package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// ThemeAssets holds the embedded frontend assets for all registered themes.
type ThemeAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
	StratusBuildFS   embed.FS
	StratusIndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	stratusFS := common.EmbedFolder(assets.StratusBuildFS, "web/stratus/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS, stratusFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", themeFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/v1") || strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/assets") || strings.HasPrefix(path, "/stratus-assets/") || strings.HasPrefix(path, "/stratus-images/") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		if useStratusFrontend(path) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.StratusIndexPage)
		} else if common.GetTheme() == "classic" {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.ClassicIndexPage)
		} else {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.DefaultIndexPage)
		}
	})
}

func useStratusFrontend(path string) bool {
	// A separate entry point lets administrators inspect the design before enabling it.
	if path == "/stratus" || strings.HasPrefix(path, "/stratus/") {
		return true
	}
	if common.GetTheme() != "stratus" {
		return false
	}
	if isStratusAuthRoute(path) {
		return true
	}
	switch path {
	case "/", "/dashboard", "/dashboard/", "/settings", "/settings/", "/docs", "/docs/", "/wallet", "/wallet/", "/playground", "/playground/", "/console/topup", "/console/topup/", "/console/log", "/console/log/", "/usage-logs", "/usage-logs/":
		return true
	case "/settings/profile", "/settings/profile/",
		"/settings/security", "/settings/security/",
		"/settings/history", "/settings/history/",
		"/settings/gateway", "/settings/gateway/":
return true
	default:
		return strings.HasPrefix(path, "/docs/") || strings.HasPrefix(path, "/playground/")
	}
}

func isStratusAuthRoute(path string) bool {
	path = strings.TrimSuffix(path, "/")
	switch path {
	case "/sign-in", "/sign-up", "/login", "/register",
		"/forgot-password", "/reset", "/user/reset", "/reset-password-confirm",
		"/otp", "/oauth":
		return true
	}
	if !strings.HasPrefix(path, "/oauth/") {
		return false
	}
	provider := strings.TrimPrefix(path, "/oauth/")
	return provider != "" && !strings.Contains(provider, "/")
}
