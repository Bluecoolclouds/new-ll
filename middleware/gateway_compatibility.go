package middleware

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// Gateway capabilities are deliberately conservative: an advertised model name
// alone does not prove that a provider's chat adapter can preserve its features.
type gatewayFeatures uint16

const (
	gatewayStream gatewayFeatures = 1 << iota
	gatewayTools
	gatewaySchema
	gatewayReasoning
	gatewayVision
	gatewayAudio
	gatewayVideo
	gatewayFile
)

func (f gatewayFeatures) String() string {
	var names []string
	for _, item := range []struct {
		bit  gatewayFeatures
		name string
	}{
		{gatewayStream, "streaming"}, {gatewayTools, "tools"}, {gatewaySchema, "JSON schema"},
		{gatewayReasoning, "reasoning"}, {gatewayVision, "vision"}, {gatewayAudio, "audio"},
		{gatewayVideo, "video"}, {gatewayFile, "files"},
	} {
		if f&item.bit != 0 {
			names = append(names, item.name)
		}
	}
	return strings.Join(names, ", ")
}

// Read the original body before routing. UnmarshalBodyReusable keeps it intact
// for the relay and for all subsequent fallback attempts.
func gatewayRequestFeatures(c *gin.Context) (gatewayFeatures, error) {
	if !strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		return 0, fmt.Errorf("AI Gateway chat requests require application/json")
	}
	var req struct {
		Stream         bool            `json:"stream"`
		Tools          json.RawMessage `json:"tools"`
		Functions      json.RawMessage `json:"functions"`
		ToolChoice     json.RawMessage `json:"tool_choice"`
		FunctionCall   json.RawMessage `json:"function_call"`
		ResponseFormat struct {
			Type string `json:"type"`
		} `json:"response_format"`
		ReasoningEffort string          `json:"reasoning_effort"`
		Reasoning       json.RawMessage `json:"reasoning"`
		Modalities      json.RawMessage `json:"modalities"`
		Audio           json.RawMessage `json:"audio"`
		EnableThinking  json.RawMessage `json:"enable_thinking"`
		Think           json.RawMessage `json:"think"`
		Thinking        json.RawMessage `json:"thinking"`
		Messages        []struct {
			Role             string          `json:"role"`
			Content          json.RawMessage `json:"content"`
			ToolCalls        json.RawMessage `json:"tool_calls"`
			ToolCallID       string          `json:"tool_call_id"`
			ReasoningContent json.RawMessage `json:"reasoning_content"`
		} `json:"messages"`
	}
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return 0, err
	}
	var needed gatewayFeatures
	if req.Stream {
		needed |= gatewayStream
	}
	if present(req.Tools) || present(req.Functions) || present(req.ToolChoice) || present(req.FunctionCall) {
		needed |= gatewayTools
	}
	if req.ResponseFormat.Type == "json_schema" {
		needed |= gatewaySchema
	}
	if req.ReasoningEffort != "" || present(req.Reasoning) || present(req.EnableThinking) || present(req.Think) || present(req.Thinking) {
		needed |= gatewayReasoning
	}
	if present(req.Audio) || strings.Contains(string(req.Modalities), `"audio"`) {
		needed |= gatewayAudio
	}
	for _, msg := range req.Messages {
		if msg.Role == "tool" || msg.ToolCallID != "" || present(msg.ToolCalls) {
			needed |= gatewayTools
		}
		if present(msg.ReasoningContent) {
			needed |= gatewayReasoning
		}
		var parts []struct {
			Type string `json:"type"`
		}
		if len(msg.Content) > 0 && msg.Content[0] == '[' {
			if err := json.Unmarshal(msg.Content, &parts); err != nil {
				return 0, fmt.Errorf("invalid chat message content: %w", err)
			}
			for _, part := range parts {
				switch part.Type {
				case "image_url":
					needed |= gatewayVision
				case "input_audio", "audio":
					needed |= gatewayAudio
				case "video_url":
					needed |= gatewayVideo
				case "file":
					needed |= gatewayFile
				case "text":
				default:
					// Unknown content must never silently become text in a fallback.
					return 0, fmt.Errorf("unsupported Gateway message content type %q", part.Type)
				}
			}
		}
	}
	return needed, nil
}

func present(raw json.RawMessage) bool {
	s := strings.TrimSpace(string(raw))
	return s != "" && s != "null" && s != "false" && s != "[]"
}

// GatewayChannelCompatible protects retries that bypass the initial selector.
func GatewayChannelCompatible(c *gin.Context, channel *model.Channel, name string) bool {
	needed, _ := c.Value("gateway_features").(gatewayFeatures)
	return gatewaySupports(channel, name, needed)
}

// On the first attempt the selector already validated the full channel, while
// getChannel may return a synthetic channel without its model mapping. Only
// revalidate channels obtained by the regular retry selector.
func GatewayAttemptCompatible(c *gin.Context, channel *model.Channel, name string, retryIndex int) bool {
	return retryIndex == 0 || GatewayChannelCompatible(c, channel, name)
}

func gatewaySupports(channel *model.Channel, name string, needed gatewayFeatures) bool {
	if needed == 0 {
		return true
	}
	// Model mapping changes what actually reaches the provider. Never infer
	// support from the public alias when the upstream name is unknown.
	if mapping := channel.GetModelMapping(); mapping != "" {
		var mapped map[string]string
		if json.Unmarshal([]byte(mapping), &mapped) != nil {
			return false
		}
		if upstream, ok := mapped[name]; ok {
			name = upstream
		}
	}
	name = strings.ToLower(name)
	var supported gatewayFeatures
	switch {
	case strings.HasPrefix(name, "gpt-4o"), strings.HasPrefix(name, "gpt-4.1"),
		strings.HasPrefix(name, "gpt-5"), strings.HasPrefix(name, "gpt-4-turbo"):
		supported = gatewayStream | gatewayTools | gatewaySchema | gatewayVision
		if strings.HasPrefix(name, "gpt-4-turbo") {
			supported &^= gatewaySchema
		}
		if strings.HasPrefix(name, "gpt-5") {
			supported |= gatewayReasoning
		}
		if strings.Contains(name, "-pro") || strings.Contains(name, "deep-research") {
			supported &^= gatewayStream
		}
	case strings.HasPrefix(name, "o1"), strings.HasPrefix(name, "o3"), strings.HasPrefix(name, "o4"):
		supported = gatewayTools | gatewaySchema | gatewayReasoning | gatewayVision
		// Some reasoning variants do not stream; do not assume they do.
	case strings.HasPrefix(name, "claude-3"), strings.HasPrefix(name, "claude-sonnet-4"),
		strings.HasPrefix(name, "claude-opus-4"), strings.HasPrefix(name, "claude-haiku-4"):
		supported = gatewayStream | gatewayTools | gatewayVision
		if strings.Contains(name, "thinking") {
			supported |= gatewayReasoning
		}
	case strings.HasPrefix(name, "gemini-1.5"), strings.HasPrefix(name, "gemini-2"),
		strings.HasPrefix(name, "gemini-3"):
		supported = gatewayStream | gatewayTools | gatewaySchema | gatewayVision
		if strings.HasPrefix(name, "gemini-2.5") || strings.HasPrefix(name, "gemini-3") {
			supported |= gatewayReasoning
		}
	case strings.HasPrefix(name, "deepseek-chat"):
		supported = gatewayStream | gatewayTools
	case strings.HasPrefix(name, "deepseek-reasoner"):
		supported = gatewayStream | gatewayReasoning
	default:
		return false
	}
	// Only adapters known to preserve these features are eligible. Proxies and
	// custom channels may advertise arbitrary aliases without honoring them.
	switch channel.Type {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeAzure, constant.ChannelTypeOpenRouter:
		// OpenAI-compatible upstreams can use the known model capabilities.
	case constant.ChannelTypeAnthropic:
		if !strings.HasPrefix(name, "claude-") {
			return false
		}
		supported &^= gatewaySchema
	case constant.ChannelTypeGemini:
		if !strings.HasPrefix(name, "gemini-") {
			return false
		}
	case constant.ChannelTypeDeepSeek:
		if !strings.HasPrefix(name, "deepseek-") {
			return false
		}
	default:
		return false
	}
	return supported&needed == needed
}
