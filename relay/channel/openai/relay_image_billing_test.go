package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func imageBillingContext(body, contentType string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *common.RelayInfo) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{"Content-Type": []string{contentType}}}
	info := &common.RelayInfo{ChannelMeta: &common.ChannelMeta{}}
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 3)
	return ctx, recorder, resp, info
}

func TestImageBillingJSONPayloadAndUsage(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		count      float64
		events     int
	}{
		{"object", `{"data":{"url":"https://example.com/image.png","b64_json":"image"}}`, 1, 1},
		{"mixed formats are two images", `{"data":[{"url":"https://example.com/image.png"},{"b64_json":"image"},{"revised_prompt":"not an image"}]}`, 2, 2},
		{"array", `{"data":[{"b64_json":"one"},{"b64_json":"two"}],"usage":{"input_tokens":15,"output_tokens":1352,"total_tokens":1367,"input_tokens_details":{"text_tokens":10,"image_tokens":5},"output_tokens_details":{"image_tokens":1120,"text_tokens":232}}}`, 2, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, stream := range []bool{false, true} {
				ctx, recorder, resp, info := imageBillingContext(tc.body, "application/json")
				var imageTokens int
				if stream {
					usage, err := OpenaiImageStreamHandler(ctx, info, resp)
					require.Nil(t, err)
					if usage != nil {
						imageTokens = usage.CompletionTokenDetails.ImageTokens
					}
					require.Equal(t, tc.events, strings.Count(recorder.Body.String(), "event: image_generation.completed"))
				} else {
					usage, err := OpenaiImageHandler(ctx, info, resp)
					require.Nil(t, err)
					if usage != nil {
						imageTokens = usage.CompletionTokenDetails.ImageTokens
					}
				}
				require.Equal(t, tc.count, info.PriceData.OtherRatios()["n"])
				require.Equal(t, tc.count*40, info.PriceData.ApplyOtherRatiosToFloat(40), "settlement must charge for each delivered image")
				if tc.name == "array" {
					require.Equal(t, 1120, imageTokens)
				}
			}
		})
	}
}

func TestImageBillingRejectsEmptyAndErroredResponses(t *testing.T) {
	for _, body := range []string{
		`{"data":[]}`, `{"data":[{"revised_prompt":"only text"}]}`,
		`{"error":{"type":"upstream_error","message":"failed"}}`,
	} {
		for _, stream := range []bool{false, true} {
			ctx, recorder, resp, info := imageBillingContext(body, "application/json")
			if stream {
				_, err := OpenaiImageStreamHandler(ctx, info, resp)
				require.NotNil(t, err)
			} else {
				_, err := OpenaiImageHandler(ctx, info, resp)
				require.NotNil(t, err)
			}
			require.Empty(t, recorder.Body.String())
			require.Equal(t, 3.0, info.PriceData.OtherRatios()["n"])
		}
	}
}

func TestImageBillingSSECompletedCountAndOutputUsage(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	body := "data: {\"type\":\"image_generation.partial_image\",\"b64_json\":\"preview\"}\n\n" +
		"data: {\"type\":\"image_generation.completed\",\"b64_json\":\"image\",\"usage\":{\"input_tokens\":15,\"output_tokens\":1352,\"total_tokens\":1367,\"output_tokens_details\":{\"image_tokens\":1120,\"text_tokens\":232}}}\n\n" +
		"data: [DONE]\n\n"
	ctx, recorder, resp, info := imageBillingContext(body, "text/event-stream")
	usage, err := OpenaiImageStreamHandler(ctx, info, resp)
	require.Nil(t, err)
	require.Equal(t, 1.0, info.PriceData.OtherRatios()["n"])
	require.Equal(t, 1120, usage.CompletionTokenDetails.ImageTokens)
	require.Equal(t, 232, usage.CompletionTokenDetails.TextTokens)
	require.Contains(t, recorder.Body.String(), "data: [DONE]")
}

func TestImageBillingSSEErrorRefundsReservation(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, body := range []string{
		"data: [DONE]\n\n",
		"data: {\"type\":\"upstream_error\",\"error\":{\"message\":\"failed\"}}\n\n",
	} {
		ctx, _, resp, info := imageBillingContext(body, "text/event-stream")
		usage, err := OpenaiImageStreamHandler(ctx, info, resp)
		require.Nil(t, usage)
		require.NotNil(t, err) // caller refunds the pre-consumed billing session
		require.Equal(t, 3.0, info.PriceData.OtherRatios()["n"])
	}
}
