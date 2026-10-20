package model

import "testing"

func TestDefaultUserTokenNameUsesSupportedLanguages(t *testing.T) {
	tests := []struct {
		language string
		want     string
	}{
		{language: "ru", want: "Qwerty33 — начальный API-ключ"},
		{language: "ru-RU,ru;q=0.9,en;q=0.8", want: "Qwerty33 — начальный API-ключ"},
		{language: "en", want: "Qwerty33 — initial API key"},
		{language: "zh-CN", want: "Qwerty33 — initial API key"},
		{language: "", want: "Qwerty33 — initial API key"},
	}

	for _, test := range tests {
		if got := DefaultUserTokenName("Qwerty33", test.language); got != test.want {
			t.Errorf("DefaultUserTokenName(%q) = %q, want %q", test.language, got, test.want)
		}
	}
}

func TestLocalizeLegacyDefaultTokenName(t *testing.T) {
	const legacyName = "Qwerty33的初始令牌"
	if got := LocalizeLegacyDefaultTokenName(legacyName, "ru"); got != "Qwerty33 — начальный API-ключ" {
		t.Errorf("Russian legacy name = %q", got)
	}
	if got := LocalizeLegacyDefaultTokenName(legacyName, "en"); got != "Qwerty33 — initial API key" {
		t.Errorf("English legacy name = %q", got)
	}
	if got := LocalizeLegacyDefaultTokenName("production", "ru"); got != "production" {
		t.Errorf("custom key name changed to %q", got)
	}
}
