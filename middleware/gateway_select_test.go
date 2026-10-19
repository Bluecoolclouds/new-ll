package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestGatewayRequestCapabilitiesAndFallback(t *testing.T) {
	tests := []struct {
		name, body        string
		want              gatewayFeatures
		primary, fallback string
	}{
		{"vision", `{"model":"auto","messages":[{"role":"user","content":[{"type":"text","text":"describe"},{"type":"image_url","image_url":{"url":"https://example.com/a.png"}}]}]}`, gatewayVision, "gpt-4o", "deepseek-chat"},
		{"tools", `{"model":"auto","messages":[{"role":"user","content":"hi"}],"tools":[{"type":"function","function":{"name":"search"}}]}`, gatewayTools, "gpt-4o", "deepseek-reasoner"},
		{"tool result", `{"model":"auto","messages":[{"role":"tool","tool_call_id":"call_1","content":"done"}]}`, gatewayTools, "gpt-4o", "deepseek-reasoner"},
		{"stream", `{"model":"auto","stream":true,"messages":[{"role":"user","content":"hi"}]}`, gatewayStream, "gpt-4o", "unverified-model"},
		{"schema", `{"model":"auto","response_format":{"type":"json_schema","json_schema":{"name":"answer","schema":{}}}}`, gatewaySchema, "gpt-4o", "claude-sonnet-4-20250514"},
		{"reasoning", `{"model":"auto","reasoning_effort":"high"}`, gatewayReasoning, "gpt-5", "gpt-4o"},
		{"audio", `{"model":"auto","messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":"abc","format":"wav"}}]}]}`, gatewayAudio, "", "gpt-4o"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")
			got, err := gatewayRequestFeatures(c)
			if err != nil || got != tt.want {
				t.Fatalf("features = %s, error = %v; want %s", got, err, tt.want)
			}
			primary := &model.Channel{Type: 1}
			if tt.primary != "" && !gatewaySupports(primary, tt.primary, got) {
				t.Fatalf("compatible primary %s was excluded", tt.primary)
			}
			if gatewaySupports(primary, tt.fallback, got) {
				t.Fatalf("incompatible fallback %s was selected for %s", tt.fallback, got)
			}
			// The body is still available to the relay after capability detection.
			var again struct {
				Model string `json:"model"`
			}
			if err := common.UnmarshalBodyReusable(c, &again); err != nil || again.Model != "auto" {
				t.Fatalf("request body lost: %+v %v", again, err)
			}
		})
	}
}

func TestGatewayChannelAndMappingCapabilities(t *testing.T) {
	mapping := `{"safe-alias":"deepseek-chat"}`
	if gatewaySupports(&model.Channel{Type: 1, ModelMapping: &mapping}, "safe-alias", gatewayVision) {
		t.Fatal("alias must use upstream capabilities")
	}
	if gatewaySupports(&model.Channel{Type: 8}, "gpt-4o", gatewayStream|gatewayTools) {
		t.Fatal("custom adapter must not be assumed to preserve streaming tools")
	}
	if gatewaySupports(&model.Channel{Type: 43}, "gpt-4o", gatewayVision) {
		t.Fatal("provider adapter must not accept another provider's model")
	}
}

func TestGatewayMappedAliasSurvivesInitialRelayChannel(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions",
		strings.NewReader(`{"model":"auto","stream":true,"messages":[{"role":"user","content":"hello"}]}`))
	c.Request.Header.Set("Content-Type", "application/json")
	needed, err := gatewayRequestFeatures(c)
	if err != nil || needed != gatewayStream {
		t.Fatalf("request features = %s: %v", needed, err)
	}
	c.Set("gateway_features", needed)
	mapping := `{"my-chat-alias":"gpt-4o"}`
	selected := &model.Channel{Id: 42, Type: 1, ModelMapping: &mapping}
	if !GatewayChannelCompatible(c, selected, "my-chat-alias") {
		t.Fatal("selector must accept mapped alias on full channel")
	}
	// getChannel returns this synthetic channel when ChannelMeta is nil.
	firstAttempt := &model.Channel{Id: 42, Type: 1}
	if !GatewayAttemptCompatible(c, firstAttempt, "my-chat-alias", 0) {
		t.Fatal("first relay attempt lost the already validated model mapping")
	}
	if GatewayAttemptCompatible(c, firstAttempt, "my-chat-alias", 1) {
		t.Fatal("a retry with incomplete channel metadata must not be assumed compatible")
	}
}

func testGatewayChoice(name string, id int, priority int64, weight uint, score float64) gatewayChoice {
	return gatewayChoice{
		candidate: gatewayCandidate{name: name},
		channel:   &model.Channel{Id: id, Priority: &priority, Weight: &weight},
		group:     "default",
		score:     score,
	}
}

func TestGatewaySelectionPreservesPriorityAndWeightedExploration(t *testing.T) {
	choices := []gatewayChoice{
		testGatewayChoice("primary", 1, 10, 1, 0),
		testGatewayChoice("primary", 2, 10, 9, 0),
		testGatewayChoice("primary", 3, 5, 100, 0),
		testGatewayChoice("backup", 4, 10, 10, 0),
	}
	first := func(n int) int { return 0 }
	last := func(n int) int { return n - 1 }
	for _, profile := range []string{"ordered", "cost"} {
		if selected := selectGatewayChoice(choices, profile, first); selected.channel.Id != 1 {
			t.Fatalf("%s ignored first weighted channel: %d", profile, selected.channel.Id)
		}
		if selected := selectGatewayChoice(choices, profile, last); selected.channel.Id != 2 {
			t.Fatalf("%s ignored second weighted channel: %d", profile, selected.channel.Id)
		}
	}
	// Even cold adaptive routes can be sampled; never demote a healthy
	// high-priority tier in favor of a lower-priority one.
	if selected := selectGatewayChoice(choices, "speed", last); selected.channel.Id != 2 {
		t.Fatalf("cold weighted adaptive selection = %d", selected.channel.Id)
	}
	if selected := selectGatewayChoice(choices, "speed", first); selected.channel.Id != 1 {
		t.Fatalf("cold exploration = %d", selected.channel.Id)
	}
	// Fallback uses the same channel weight policy once the primary model
	// has been removed from its allowed candidates.
	fallback := []gatewayChoice{
		testGatewayChoice("backup", 5, 10, 1, 0),
		testGatewayChoice("backup", 6, 10, 9, 0),
	}
	if selected := selectGatewayChoice(fallback, "reliable", last); selected.channel.Id != 6 {
		t.Fatalf("fallback weight was ignored: %d", selected.channel.Id)
	}
}

func TestGatewaySelectionUsesStrongEvidenceAndExcludesCooldown(t *testing.T) {
	choices := []gatewayChoice{
		testGatewayChoice("primary", 1, 10, 5, 0.1),
		testGatewayChoice("primary", 2, 10, 5, 0.7),
	}
	normal := func(n int) int { return 1 }
	if selected := selectGatewayChoice(choices, "speed", normal); selected.channel.Id != 2 {
		t.Fatalf("fast healthy channel not preferred: %d", selected.channel.Id)
	}
	if selected := selectGatewayChoice(choices, "reliable", normal); selected.channel.Id != 2 {
		t.Fatalf("reliable healthy channel not preferred: %d", selected.channel.Id)
	}
	id := 987654323
	defer func() {
		gatewayHealthStore.Lock()
		delete(gatewayHealthStore.channels, id)
		gatewayHealthStore.Unlock()
	}()
	for i := 0; i < 3; i++ {
		RecordGatewayChannel(id, false, 100, 0)
	}
	choices[1].channel.Id = id
	available := choices[:0]
	for _, c := range choices {
		_, _, blocked := gatewayChannelScore(c.channel.Id, "speed")
		if !blocked {
			available = append(available, c)
		}
	}
	if selected := selectGatewayChoice(available, "speed", normal); selected.channel.Id != 1 {
		t.Fatalf("cooldown channel was selected: %d", selected.channel.Id)
	}
}

func TestGatewayKeyRequiresExplicitModels(t *testing.T) {
	tests := []struct {
		name  string
		token model.Token
		valid bool
	}{
		{"ordinary key", model.Token{}, true},
		{"gateway without limits", model.Token{GatewayEnabled: true}, false},
		{"gateway with empty model", model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: ""}, false},
		{"gateway with auto candidate", model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: "auto"}, false},
		{"gateway with duplicate candidates", model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: "gpt-4o,gpt-4o"}, false},
		{"gateway with unknown preference", model.Token{GatewayEnabled: true, GatewayProfile: "unknown", ModelLimitsEnabled: true, ModelLimits: "gpt-4o"}, false},
		{"gateway with speed preference", model.Token{GatewayEnabled: true, GatewayProfile: "speed", ModelLimitsEnabled: true, ModelLimits: "gpt-4o"}, true},
		{"gateway with allowed model", model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: "gpt-4o"}, true},
		{"gateway with spaces", model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: "gpt-4o, gpt-4o-mini"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.token.ValidateGatewaySettings()
			if (err == nil) != tt.valid {
				t.Fatalf("ValidateGatewaySettings() error=%v, valid=%v", err, tt.valid)
			}
		})
	}
}

func TestGatewayFallbackCannotRevisitOrExpandTokenModels(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set("gateway_models", []string{"gpt-4o", "gpt-4o-mini"})
	c.Set("token_model_limit", map[string]bool{"gpt-4o": true})
	// The only permitted model has already failed; the other configured
	// candidate cannot be used after its token permission is removed.
	name, channel, _, err := selectGatewayModelExcluding(c, "default", map[string]bool{"gpt-4o": true})
	if err == nil || name != "" || channel != nil {
		t.Fatalf("unauthorized fallback selected: %q %v %v", name, channel, err)
	}
}

func TestGatewayModelsAreCanonical(t *testing.T) {
	token := model.Token{GatewayEnabled: true, ModelLimitsEnabled: true, ModelLimits: "gpt-4o, gpt-4o-mini"}
	if err := token.ValidateGatewaySettings(); err != nil {
		t.Fatal(err)
	}
	if token.ModelLimits != "gpt-4o,gpt-4o-mini" || !token.GetModelLimitsMap()["gpt-4o-mini"] {
		t.Fatalf("model authorization mismatch after normalization: %q", token.ModelLimits)
	}
}

func TestGatewayOrderPreservesConfiguredCandidates(t *testing.T) {
	candidates := orderGatewayCandidates([]string{"gpt-4o", "gpt-4o-mini"}, "ordered")
	if len(candidates) != 2 || candidates[0].name != "gpt-4o" || candidates[1].name != "gpt-4o-mini" {
		t.Fatalf("unexpected ordered candidates: %#v", candidates)
	}
}
