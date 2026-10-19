package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestGatewayFallbackOnlyBeforeResponse(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		write  bool
		want   bool
	}{
		{"upstream unavailable before first byte", 503, false, true},
		{"upstream rate limit before first byte", 429, false, true},
		{"upstream failure after stream started", 503, true, false},
		{"quota refusal", 403, false, false},
		{"invalid request", 400, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			if tc.write {
				_, _ = c.Writer.Write([]byte("data: partial\n\n"))
			}
			err := types.NewErrorWithStatusCode(errors.New("provider failed"), types.ErrorCodeBadResponseStatusCode, tc.status)
			if got := gatewayCanFallback(c, err); got != tc.want {
				t.Fatalf("fallback=%v, want %v", got, tc.want)
			}
			if tc.write && shouldRetry(c, err, 2) {
				t.Fatal("channel retry must not replay a partial response")
			}
		})
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	internal := types.NewErrorWithStatusCode(errors.New("local failure"), types.ErrorCodeModelPriceError, 503)
	if gatewayCanFallback(c, internal) {
		t.Fatal("a local failure must not trigger another upstream request")
	}
	cancelled, cancel := context.WithCancel(c.Request.Context())
	cancel()
	c.Request = c.Request.WithContext(cancelled)
	upstream := types.NewErrorWithStatusCode(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, 503)
	if gatewayCanFallback(c, upstream) {
		t.Fatal("a cancelled request must not be replayed")
	}
}

func TestGatewayAttemptsKeepRepeatedChannelRetries(t *testing.T) {
	attempts := []map[string]interface{}{
		gatewayAttempt("primary", 1, "error", 503),
		gatewayAttempt("primary", 2, "error", 502),
		gatewayAttempt("backup", 3, "success", 0),
	}
	if len(attempts) != 3 || attempts[0]["model"] != attempts[1]["model"] ||
		attempts[2]["model"] == attempts[1]["model"] ||
		attempts[1]["channel_id"] == attempts[0]["channel_id"] {
		t.Fatalf("lost channel retry or model transition: %#v", attempts)
	}
}

func TestGatewayExhaustedRetryChannelKeepsProviderFailure(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	providerErr := types.NewErrorWithStatusCode(errors.New("upstream unavailable"),
		types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)
	noRetryChannel := types.NewErrorWithStatusCode(errors.New("no channel at next retry priority"),
		types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
	if got := gatewayRetryChannelError(c, true, providerErr, noRetryChannel); got != providerErr ||
		!gatewayCanFallback(c, got) {
		t.Fatal("exhausted same-model retry must allow selecting a backup model")
	}
	if got := gatewayRetryChannelError(c, false, providerErr, noRetryChannel); got != noRetryChannel {
		t.Fatal("ordinary tokens must retain their channel error")
	}
	_, _ = c.Writer.Write([]byte("data: partial\n\n"))
	if got := gatewayRetryChannelError(c, true, providerErr, noRetryChannel); got != noRetryChannel {
		t.Fatal("a response already sent to the client must never be replayed")
	}
}
