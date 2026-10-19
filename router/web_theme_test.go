package router

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestStratusFrontendRoutes(t *testing.T) {
	previous := common.GetTheme()
	t.Cleanup(func() { common.SetTheme(previous) })
	for _, theme := range []string{"default", "classic", "stratus"} {
		common.SetTheme(theme)
		for _, path := range []string{"/stratus", "/stratus/", "/stratus/docs", "/stratus/dashboard", "/stratus/settings", "/stratus/settings/profile", "/stratus/settings/security", "/stratus/settings/history", "/stratus/settings/gateway", "/stratus/wallet"} {
			if !useStratusFrontend(path) {
				t.Errorf("%s must allow preview route %s", theme, path)
			}
		}
		for _, path := range []string{"/", "/dashboard", "/settings", "/settings/profile", "/settings/profile/", "/settings/security", "/settings/security/", "/settings/history", "/settings/history/", "/settings/gateway", "/settings/gateway/", "/docs", "/docs/quickstart", "/wallet", "/wallet/", "/playground", "/playground/", "/playground/chat", "/playground/images", "/console/topup", "/console/log", "/usage-logs", "/usage-logs/"} {
			if got := useStratusFrontend(path); got != (theme == "stratus") {
				t.Errorf("theme=%s path=%s selected Stratus=%v", theme, path, got)
			}
		}
		authRoutes := []string{
			"/sign-in", "/sign-in/", "/sign-up", "/login", "/register",
			"/forgot-password", "/reset", "/user/reset", "/reset-password-confirm",
			"/otp", "/oauth", "/oauth/", "/oauth/github", "/oauth/discord",
			"/oauth/oidc", "/oauth/linuxdo", "/oauth/custom-provider",
		}
		for _, path := range authRoutes {
			if got := useStratusFrontend(path); got != (theme == "stratus") {
				t.Errorf("theme=%s auth path=%s selected Stratus=%v", theme, path, got)
			}
		}
for _, path := range []string{"/system-settings", "/system-settings/site/system-info", "/users", "/setup", "/tokens", "/api/user/self", "/oauth/provider/nested", "/stratus-other"} {
			if useStratusFrontend(path) {
				t.Errorf("theme=%s must preserve shared route %s", theme, path)
			}
		}
	}
}

func TestStratusCheckoutActualReturnRoutes(t *testing.T) {
previous := common.GetTheme()
t.Cleanup(func() { common.SetTheme(previous) })
for _, theme := range []string{"default", "classic", "stratus"} {
common.SetTheme(theme)
for _, legacy := range []string{"/console/log", "/console/topup"} {
actual := common.ThemeAwarePath(legacy)
if got := useStratusFrontend(actual); got != (theme == "stratus") {
t.Errorf("theme=%s checkout returns %s via %s, Stratus selected=%v", theme, actual, legacy, got)
}
}
}
}
