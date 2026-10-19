package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newResponsesChatTestContext(t *testing.T, body string, isStream bool) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "responses-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		IsStream:           isStream,
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		DisablePing:        true,
	}
	return c, recorder, resp, info
}

func TestOaiResponsesToChatStreamHandlerConvertsSSEOrderAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1","model":"gpt-test","created_at":1710000000}}`,
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		`data: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"lookup"}}`,
		`data: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\"q\":\"x\"}"}`,
		`data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Contains(t, got, `"role":"assistant"`)
	require.Contains(t, got, `"content":"hello"`)
	require.Contains(t, got, `"name":"lookup"`)
	require.Contains(t, got, `"arguments":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `"finish_reason":"tool_calls"`)
	require.Contains(t, got, `"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5`)
	require.Contains(t, got, `data: [DONE]`)
	requireOrderedSubstrings(t, got,
		`"role":"assistant"`,
		`"content":"hello"`,
		`"name":"lookup"`,
		`"arguments":"{\"q\":\"x\"}"`,
		`"finish_reason":"tool_calls"`,
		`"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5`,
		`data: [DONE]`,
	)
}

func TestResponsesToChatInterruptedStreamAccounting(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	tests := []struct {
		name       string
		events     []string
		wantError  bool
		wantPrompt int
		wantOutput bool
		wantDone   bool
	}{
		{"created only", []string{
			`{"type":"response.created","response":{"id":"resp_1"}}`,
		}, false, 12, false, false},
		{"text delta", []string{
			`{"type":"response.created"}`,
			`{"type":"response.output_text.delta","delta":"hello world"}`,
		}, false, 12, true, false},
		{"tool and reasoning deltas", []string{
			`{"type":"response.created"}`,
			`{"type":"response.reasoning_text.delta","delta":"thinking about this"}`,
			`{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"c1","name":"lookup"}}`,
			`{"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"city\":\"Paris\"}"}`,
		}, false, 12, true, false},
		{"explicit failure", []string{
			`{"type":"response.created"}`,
			`{"type":"response.failed","response":{"error":{"type":"upstream_error","message":"failed"}}}`,
		}, true, 0, false, false},
		{"failure with reported usage", []string{
			`{"type":"response.created"}`,
			`{"type":"response.failed","response":{"usage":{"input_tokens":4,"output_tokens":2,"total_tokens":6}}}`,
		}, false, 4, true, false},
		{"clean completion", []string{
			`{"type":"response.created"}`,
			`{"type":"response.output_text.delta","delta":"hello"}`,
			`{"type":"response.completed","response":{"usage":{"input_tokens":4,"output_tokens":2,"total_tokens":6}}}`,
			`[DONE]`,
		}, false, 4, true, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body := "data: " + strings.Join(tc.events, "\n\ndata: ") + "\n\n"
			c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
			info.SetEstimatePromptTokens(12)
			usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
			if tc.wantError {
				require.NotNil(t, err)
				require.Nil(t, usage)
				return
			}
			require.Nil(t, err)
			require.NotNil(t, usage)
			require.Equal(t, tc.wantPrompt, usage.PromptTokens)
			if tc.wantOutput {
				require.Positive(t, usage.CompletionTokens)
			} else {
				require.Zero(t, usage.CompletionTokens)
			}
			require.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
			require.Equal(t, tc.wantDone, strings.Contains(recorder.Body.String(), "data: [DONE]"))
		})
	}
}

func TestBufferedResponsesInterruptedToolUsage(t *testing.T) {
	body := `data: {"type":"response.created"}` + "\n\n" +
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"c1","name":"lookup"}}` + "\n\n" +
		`data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"city\":\"Paris\"}"}` + "\n\n"
	c, recorder, resp, info := newResponsesChatTestContext(t, body, false)
	info.SetEstimatePromptTokens(9)
	usage, err := OaiResponsesToChatBufferedStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 9, usage.PromptTokens)
	require.Positive(t, usage.CompletionTokens)
	require.Contains(t, recorder.Body.String(), `"finish_reason":"length"`)
	require.Contains(t, recorder.Body.String(), `"name":"lookup"`)
}

func TestBufferedResponsesFailureWithReportedUsageReturnsErrorAndSettles(t *testing.T) {
	body := `data: {"type":"response.created"}` + "\n\n" +
		`data: {"type":"response.failed","response":{"error":{"type":"upstream_error","message":"provider failed"},"usage":{"input_tokens":4,"output_tokens":2,"total_tokens":6}}}` + "\n\n"
	c, recorder, resp, info := newResponsesChatTestContext(t, body, false)
	usage, err := OaiResponsesToChatBufferedStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 6, usage.TotalTokens)
	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"message":"provider failed"`)
	require.NotContains(t, recorder.Body.String(), `"finish_reason"`)
}

func TestNativeResponsesInterruptedStreamAccounting(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	tests := []struct {
		name       string
		events     []string
		wantPrompt int
		wantOutput bool
		wantError  bool
	}{
		{"created only", []string{`{"type":"response.created"}`}, 11, false, false},
		{"tool and reasoning", []string{
			`{"type":"response.created"}`,
			`{"type":"response.reasoning_text.delta","delta":"working through it"}`,
			`{"type":"response.function_call_arguments.delta","delta":"{\"city\":\"Paris\"}"}`,
		}, 11, true, false},
		{"explicit failure", []string{
			`{"type":"response.created"}`,
			`{"type":"response.failed","response":{"error":{"type":"upstream_error","message":"failed"}}}`,
		}, 0, false, true},
		{"reported usage and cache", []string{
			`{"type":"response.created"}`,
			`{"type":"response.completed","response":{"usage":{"input_tokens":20,"output_tokens":2,"input_tokens_details":{"cached_tokens":5,"cached_creation_tokens":3}}}}`,
		}, 20, true, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body := "data: " + strings.Join(tc.events, "\n\ndata: ") + "\n\n"
			c, _, resp, info := newResponsesChatTestContext(t, body, true)
			info.SetEstimatePromptTokens(11)
			usage, err := OaiResponsesStreamHandler(c, info, resp)
			if tc.wantError {
				require.NotNil(t, err)
				require.Nil(t, usage)
				return
			}
			require.Nil(t, err)
			require.Equal(t, tc.wantPrompt, usage.PromptTokens)
			if tc.wantOutput {
				require.Positive(t, usage.CompletionTokens)
			} else {
				require.Zero(t, usage.CompletionTokens)
			}
			if tc.name == "reported usage and cache" {
				require.Equal(t, 5, usage.PromptTokensDetails.CachedTokens)
				require.Equal(t, 3, usage.PromptTokensDetails.CachedCreationTokens)
			}
		})
	}
}

func TestGeminiConversionRequestsStreamUsageWhenSupported(t *testing.T) {
	adaptor := &Adaptor{}
	c, _, _, info := newResponsesChatTestContext(t, "", true)
	info.ChannelType = constant.ChannelTypeOpenAI
	info.SupportStreamOptions = true
	converted, err := adaptor.ConvertGeminiRequest(c, info, &dto.GeminiChatRequest{})
	require.NoError(t, err)
	require.True(t, converted.(*dto.GeneralOpenAIRequest).StreamOptions.IncludeUsage)
	info.SupportStreamOptions = false
	converted, err = adaptor.ConvertGeminiRequest(c, info, &dto.GeminiChatRequest{})
	require.NoError(t, err)
	require.Nil(t, converted.(*dto.GeneralOpenAIRequest).StreamOptions)
}

func TestOaiResponsesToChatBufferedStreamHandlerReturnsJSONFromSSE(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"buffered text"}`,
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"lookup"}}`,
		`data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"q\":\"x\"}"}`,
		`data: {"type":"response.done","response":{"model":"gpt-test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, false)

	usage, err := OaiResponsesToChatBufferedStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 3, usage.TotalTokens)

	got := recorder.Body.String()
	require.NotContains(t, got, `data:`)
	require.Contains(t, got, `"object":"chat.completion"`)
	require.Contains(t, got, `"content":"buffered text"`)
	require.Contains(t, got, `"name":"lookup"`)
	require.Contains(t, got, `"arguments":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `"finish_reason":"tool_calls"`)
}

func TestOaiChatToResponsesStreamHandlerConvertsSSEOrderAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":\"x\"}"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	usage, err := OaiChatToResponsesStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Contains(t, got, `event: response.created`)
	require.Contains(t, got, `event: response.output_text.delta`)
	require.Contains(t, got, `"delta":"hello"`)
	require.Contains(t, got, `event: response.function_call_arguments.delta`)
	require.Contains(t, got, `"delta":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `event: response.completed`)
	require.Contains(t, got, `"input_tokens":2`)
	require.Contains(t, got, `"output_tokens":3`)
	requireOrderedSubstrings(t, got,
		`event: response.created`,
		`event: response.output_item.added`,
		`event: response.output_text.delta`,
		`event: response.output_item.added`,
		`event: response.function_call_arguments.delta`,
		`event: response.output_text.done`,
		`event: response.function_call_arguments.done`,
		`event: response.completed`,
	)
}

func requireOrderedSubstrings(t *testing.T, s string, parts ...string) {
	t.Helper()

	offset := 0
	for _, part := range parts {
		idx := strings.Index(s[offset:], part)
		require.NotEqualf(t, -1, idx, "missing %q after byte offset %d", part, offset)
		offset += idx + len(part)
	}
}
