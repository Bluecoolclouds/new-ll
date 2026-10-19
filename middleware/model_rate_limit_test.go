package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

var modelLimitTestUser atomic.Int64

func modelLimitRouter(handler gin.HandlerFunc, entered, release chan struct{}, calls *atomic.Int32) *gin.Engine {
	router := gin.New()
	user := int(modelLimitTestUser.Add(1)) + 900000
	router.GET("/:outcome", func(c *gin.Context) { c.Set("id", user) }, handler, func(c *gin.Context) {
		calls.Add(1)
		if c.Param("outcome") == "waiting" {
			close(entered)
			<-release
		}
		if c.Param("outcome") == "waiting" || c.Param("outcome") == "failed" {
			status := relaycommon.NewStreamStatus()
			status.SetEndReason(relaycommon.StreamEndReasonScannerErr, fmt.Errorf("upstream failed"))
			common.SetContextKey(c, constant.ContextKeyResponseStreamStatus, status)
		}
		c.Status(http.StatusOK)
	})
	return router
}

func modelLimitRequest(router *gin.Engine, path string) int {
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Code
}

func testModelLimitRedis(t *testing.T) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	previous := common.RDB
	common.RDB = client
	t.Cleanup(func() {
		common.RDB = previous
		_ = client.Close()
	})
}

func TestModelLimitConcurrentReservationAndStreamFailure(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			if backend == "redis" {
				testModelLimitRedis(t)
			}
			var calls atomic.Int32
			entered, release := make(chan struct{}), make(chan struct{})
			handler := memoryRateLimitHandler(60, 0, 1)
			if backend == "redis" {
				handler = redisRateLimitHandler(60, 0, 1)
			}
			router := modelLimitRouter(handler, entered, release, &calls)
			done := make(chan int, 1)
			go func() { done <- modelLimitRequest(router, "/waiting") }()
			<-entered
			if got := modelLimitRequest(router, "/success"); got != http.StatusTooManyRequests {
				t.Fatalf("in-flight admission: got %d", got)
			}
			close(release)
			if got := <-done; got != http.StatusOK {
				t.Fatalf("failed stream status: got %d", got)
			}
			if got := modelLimitRequest(router, "/success"); got != http.StatusOK {
				t.Fatalf("failure must free slot: got %d", got)
			}
			if got := modelLimitRequest(router, "/success"); got != http.StatusTooManyRequests {
				t.Fatalf("successful response must consume slot: got %d", got)
			}
			if calls.Load() != 2 {
				t.Fatalf("downstream called %d times, want 2", calls.Load())
			}
		})
	}
}

func TestModelLimitUnlimitedSuccessAndTotalDenial(t *testing.T) {
	for _, backend := range []string{"memory"} {
		t.Run(backend, func(t *testing.T) {
			if backend == "redis" {
				testModelLimitRedis(t)
			}
			var calls atomic.Int32
			handler := memoryRateLimitHandler(60, 1, 0)
			if backend == "redis" {
				handler = redisRateLimitHandler(60, 1, 0)
			}
			router := modelLimitRouter(handler, nil, nil, &calls)
			if got := modelLimitRequest(router, "/failed"); got != http.StatusOK {
				t.Fatalf("initial request: %d", got)
			}
			if got := modelLimitRequest(router, "/success"); got != http.StatusTooManyRequests {
				t.Fatalf("total limit denial: %d", got)
			}
			if calls.Load() != 1 {
				t.Fatalf("downstream ran on denied request: %d", calls.Load())
			}
		})
	}
}

func TestModelRedisReservationSettlesOnlyOnce(t *testing.T) {
	testModelLimitRedis(t)
	key := "rateLimit:MRRLS:once"
	first, allowed, err := reserveRedisRequest(context.Background(), common.RDB, key, 1, 60)
	if err != nil || !allowed {
		t.Fatalf("reserve: allowed=%v err=%v", allowed, err)
	}
	if err := first.Complete(true, 60); err != nil {
		t.Fatal(err)
	}
	if err := first.Complete(true, 60); err != nil {
		t.Fatal(err)
	}
	n, err := common.RDB.LLen(context.Background(), key).Result()
	if err != nil || n != 1 {
		t.Fatalf("duplicate settlement: count=%d err=%v", n, err)
	}
	_, allowed, err = reserveRedisRequest(context.Background(), common.RDB, key, 1, 60)
	if err != nil || allowed {
		t.Fatalf("success window not enforced: allowed=%v err=%v", allowed, err)
	}
}

func TestModelRedisZeroSuccessLimitIsUnlimited(t *testing.T) {
	testModelLimitRedis(t)
	var calls atomic.Int32
	router := modelLimitRouter(redisRateLimitHandler(60, 0, 0), nil, nil, &calls)
	for i := 0; i < 3; i++ {
		if got := modelLimitRequest(router, "/success"); got != http.StatusOK {
			t.Fatalf("request %d rejected: %d", i, got)
		}
	}
	if calls.Load() != 3 {
		t.Fatalf("downstream called %d times", calls.Load())
	}
}

func TestModelRedisTotalDenialReleasesSuccessReservation(t *testing.T) {
	testModelLimitRedis(t)
	var calls atomic.Int32
	router := modelLimitRouter(redisRateLimitHandler(60, 1, 2), nil, nil, &calls)
	if got := modelLimitRequest(router, "/failed"); got != http.StatusOK {
		t.Fatalf("first request: %d", got)
	}
	if got := modelLimitRequest(router, "/success"); got != http.StatusTooManyRequests {
		t.Fatalf("total denial: %d", got)
	}
	if calls.Load() != 1 {
		t.Fatal("downstream ran on total denial")
	}
	// The rejected second request must not leave a success reservation behind.
	key := fmt.Sprintf("rateLimit:%s:%d", ModelRequestRateLimitSuccessCountMark, 900000+modelLimitTestUser.Load())
	n, err := common.RDB.ZCard(context.Background(), key+":inflight").Result()
	if err != nil || n != 0 {
		t.Fatalf("leaked success reservation: %d, %v", n, err)
	}
}
