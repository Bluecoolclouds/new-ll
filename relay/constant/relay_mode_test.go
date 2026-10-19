package constant

import "testing"

func TestPath2RelayModeImageGenerationRoutes(t *testing.T) {
	for _, path := range []string{"/v1/images/generations", "/pg/images/generations"} {
		if got := Path2RelayMode(path); got != RelayModeImagesGenerations {
			t.Errorf("Path2RelayMode(%q) = %d, want %d", path, got, RelayModeImagesGenerations)
		}
	}
}
