package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeToOpenAIRequestHoistsToolResultImages(t *testing.T) {
	var request dto.ClaudeRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-test",
		"messages":[
			{"role":"assistant","content":[
				{"type":"tool_use","id":"call_1","name":"lookup","input":{}},
				{"type":"tool_use","id":"call_2","name":"lookup","input":{}}
			]},
			{"role":"user","content":[
				{"type":"tool_result","tool_use_id":"call_1","content":[
					{"type":"text","text":"found"},
					{"type":"image","source":{"type":"base64","media_type":"image/png","data":"aGVsbG8="}}
				]},
				{"type":"tool_result","tool_use_id":"call_2","content":[
					{"type":"image","source":{"type":"url","url":"https://example.test/b.png"}}
				]}
			]}
		]}`), &request))

	got, err := ClaudeToOpenAIRequest(request, &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	require.Len(t, got.Messages, 4)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Equal(t, "tool", got.Messages[1].Role)
	assert.Equal(t, "call_1", got.Messages[1].ToolCallId)
	assert.Equal(t, "found", got.Messages[1].StringContent())
	assert.Equal(t, "tool", got.Messages[2].Role)
	assert.Equal(t, "call_2", got.Messages[2].ToolCallId)
	assert.Equal(t, "[image]", got.Messages[2].StringContent())
	assert.Equal(t, "user", got.Messages[3].Role)
	parts := got.Messages[3].ParseContent()
	require.Len(t, parts, 2)
	assert.Equal(t, "data:image/png;base64,aGVsbG8=", parts[0].GetImageMedia().Url)
	assert.Equal(t, "https://example.test/b.png", parts[1].GetImageMedia().Url)
}

func TestClaudeToOpenAIRequestKeepsQuestionAfterToolImage(t *testing.T) {
	var request dto.ClaudeRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-test",
		"messages":[
			{"role":"assistant","content":[{"type":"tool_use","id":"call_1","name":"lookup","input":{}}]},
			{"role":"user","content":[
				{"type":"tool_result","tool_use_id":"call_1","content":[
					{"type":"image","source":{"type":"base64","media_type":"image/png","data":"aGVsbG8="}}
				]},
				{"type":"text","text":"What is in this image?"}
			]}
		]}`), &request))

	got, err := ClaudeToOpenAIRequest(request, &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	require.Len(t, got.Messages, 3)
	assert.Equal(t, "tool", got.Messages[1].Role)
	assert.Equal(t, "[image]", got.Messages[1].StringContent())
	assert.Equal(t, "user", got.Messages[2].Role)
	parts := got.Messages[2].ParseContent()
	require.Len(t, parts, 2)
	assert.Equal(t, "data:image/png;base64,aGVsbG8=", parts[0].GetImageMedia().Url)
	assert.Equal(t, "text", parts[1].Type)
	assert.Equal(t, "What is in this image?", parts[1].Text)
}

func TestClaudeToOpenAIRequestKeepsUnsupportedToolResultBlocks(t *testing.T) {
	var request dto.ClaudeRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-test",
		"messages":[{"role":"user","content":[
			{"type":"tool_result","tool_use_id":"call_1","content":[
				{"type":"text","text":"found"},
				{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"abc"}}
			]},
			{"type":"tool_result","tool_use_id":"call_2","content":"plain string"}
		]}]
	}`), &request))
	got, err := ClaudeToOpenAIRequest(request, &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "tool", got.Messages[0].Role)
	assert.Contains(t, got.Messages[0].StringContent(), `"type":"document"`)
	assert.Equal(t, "tool", got.Messages[1].Role)
	assert.Equal(t, "plain string", got.Messages[1].StringContent())
}
