package common

import (
	"io"
	"net/http"
	"testing"
	"testing/fstest"
)

func TestFrontendThemeSelection(t *testing.T) {
	previous := GetTheme()
	t.Cleanup(func() { SetTheme(previous) })
	for _, theme := range []string{"default", "classic", "stratus"} {
		SetTheme(theme)
		if GetTheme() != theme {
			t.Fatalf("theme %q was not selected", theme)
		}
	}
	SetTheme("invalid")
	if GetTheme() != "stratus" {
		t.Fatal("invalid theme replaced the selected theme")
	}
}

func TestThirdThemeAssetsDoNotBreakSharedScreens(t *testing.T) {
	previous := GetTheme()
	t.Cleanup(func() { SetTheme(previous) })
	defaultFS := &embedFileSystem{FileSystem: http.FS(fstest.MapFS{
		"static/default.js": &fstest.MapFile{Data: []byte("default")},
		"shared.txt":        &fstest.MapFile{Data: []byte("default")},
	})}
	classicFS := &embedFileSystem{FileSystem: http.FS(fstest.MapFS{
		"shared.txt": &fstest.MapFile{Data: []byte("classic")},
	})}
	stratusFS := &embedFileSystem{FileSystem: http.FS(fstest.MapFS{
		"stratus-assets/app.js":   &fstest.MapFile{Data: []byte("stratus")},
		"stratus-images/hero.png": &fstest.MapFile{Data: []byte("image")},
		"shared.txt":              &fstest.MapFile{Data: []byte("stratus")},
	})}
	assets := NewThemeAwareFS(defaultFS, classicFS, stratusFS)
	for _, theme := range []string{"default", "classic", "stratus"} {
		SetTheme(theme)
		for path, want := range map[string]string{
			"/stratus-assets/app.js":   "stratus",
			"/stratus-images/hero.png": "image",
			"/shared.txt":              theme,
		} {
			if !assets.Exists("/", path) {
				t.Fatalf("%s: missing %s", theme, path)
			}
			file, err := assets.Open(path)
			if err != nil {
				t.Fatal(err)
			}
			content, err := io.ReadAll(file)
			file.Close()
			if err != nil || string(content) != want {
				t.Fatalf("%s: %s got %q, want %q; err=%v", theme, path, content, want, err)
			}
		}
	}
	SetTheme("stratus")
	if !assets.Exists("/", "/static/default.js") {
		t.Fatal("Stratus must retain default assets used by auth, admin and wallet")
	}
	if assets.Exists("/", "/stratus-assets/missing.js") {
		t.Fatal("missing assets must not resolve to an index page")
	}
	if assets.Exists("/", "/") {
		t.Fatal("root must use the router's theme-specific index response")
	}
}

func TestStratusLegacyWalletRedirect(t *testing.T) {
	previous := GetTheme()
	t.Cleanup(func() { SetTheme(previous) })
	SetTheme("stratus")
	if got := ThemeAwarePath("/console/topup?amount=10"); got != "/wallet?amount=10" {
		t.Fatalf("wallet redirect = %q", got)
	}
	SetTheme("classic")
	if got := ThemeAwarePath("/console/topup"); got != "/console/topup" {
		t.Fatalf("classic redirect changed: %q", got)
	}
}
