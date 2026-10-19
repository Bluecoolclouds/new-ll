package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func rateLimitTestRouter(handler gin.HandlerFunc, userID int, calls *atomic.Int32) *gin.Engine {
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		if userID != 0 {
			c.Set("id", userID)
		}
	}, handler, func(c *gin.Context) {
		calls.Add(1)
		c.Status(http.StatusOK)
	})
	return router
}

func rateLimitTestRequest(router *gin.Engine) int {
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = "192.0.2.10:54321"
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder.Code
}

func TestRedisRateLimitConcurrentAdmission(t *testing.T) {
	for _, tc := range []struct {
		name    string
		handler func() gin.HandlerFunc
		userID  int
		key     string
	}{
		{"global web", func() gin.HandlerFunc { return rateLimitFactory(3, 60, "GW") }, 0, "rateLimit:GW192.0.2.10"},
		{"global API", func() gin.HandlerFunc { return rateLimitFactory(3, 60, "GA") }, 0, "rateLimit:GA192.0.2.10"},
		{"critical", func() gin.HandlerFunc { return rateLimitFactory(3, 60, "CT") }, 0, "rateLimit:CT192.0.2.10"},
		{"download", func() gin.HandlerFunc { return rateLimitFactory(3, 60, "DW") }, 0, "rateLimit:DW192.0.2.10"},
		{"upload", func() gin.HandlerFunc { return rateLimitFactory(3, 60, "UP") }, 0, "rateLimit:UP192.0.2.10"},
		{"search", func() gin.HandlerFunc { return userRateLimitFactory(3, 60, "SR") }, 123, "rateLimit:SR:user:123"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			testModelLimitRedis(t)
			oldEnabled := common.RedisEnabled
			common.RedisEnabled = true
			t.Cleanup(func() { common.RedisEnabled = oldEnabled })

			var calls atomic.Int32
			router := rateLimitTestRouter(tc.handler(), tc.userID, &calls)
			const concurrent = 32
			start := make(chan struct{})
			results := make(chan int, concurrent)
			var wg sync.WaitGroup
			for i := 0; i < concurrent; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					<-start
					results <- rateLimitTestRequest(router)
				}()
			}
			close(start)
			wg.Wait()
			close(results)
			accepted, rejected := 0, 0
			for status := range results {
				switch status {
				case http.StatusOK:
					accepted++
				case http.StatusTooManyRequests:
					rejected++
				default:
					t.Fatalf("unexpected status: %d", status)
				}
			}
			if accepted != 3 || rejected != concurrent-3 || calls.Load() != 3 {
				t.Fatalf("accepted=%d rejected=%d downstream=%d", accepted, rejected, calls.Load())
			}
			values, err := common.RDB.LRange(context.Background(), tc.key, 0, -1).Result()
			if err != nil || len(values) != 3 {
				t.Fatalf("list length=%d error=%v", len(values), err)
			}
			if ttl := common.RDB.PTTL(context.Background(), tc.key).Val(); ttl <= 0 || ttl > common.RateLimitKeyExpirationDuration {
				t.Fatalf("unexpected key expiration: %s", ttl)
			}
		})
	}
}

func TestRedisRateLimitWindowAndFailure(t *testing.T) {
	testModelLimitRedis(t)
	key := "rateLimit:SR:user:456"
	var calls atomic.Int32
	router := rateLimitTestRouter(func(c *gin.Context) {
		userRedisRateLimiter(c, 2, 60, key)
	}, 456, &calls)
	ctx := context.Background()

	// The oldest request expires from the rolling window, but the list
	// retains the newer request and is trimmed to the configured size.
	old := time.Now().Add(-61 * time.Second).Format(timeFormat)
	recent := time.Now().Format(timeFormat)
	if err := common.RDB.RPush(ctx, key, recent, old).Err(); err != nil {
		t.Fatal(err)
	}
	if got := rateLimitTestRequest(router); got != http.StatusOK {
		t.Fatalf("expired oldest request: %d", got)
	}
	values, err := common.RDB.LRange(ctx, key, 0, -1).Result()
	if err != nil || len(values) != 2 || values[1] != recent {
		t.Fatalf("rolling list: %v, %v", values, err)
	}
	if got := rateLimitTestRequest(router); got != http.StatusTooManyRequests {
		t.Fatalf("denial: %d", got)
	}
	if calls.Load() != 1 {
		t.Fatalf("downstream ran after denial: %d", calls.Load())
	}

	// Bad Redis data or a failed Redis operation must not admit a request.
	if err := common.RDB.LSet(ctx, key, 1, "invalid").Err(); err != nil {
		t.Fatal(err)
	}
	if got := rateLimitTestRequest(router); got != http.StatusInternalServerError {
		t.Fatalf("corrupt timestamp: %d", got)
	}
	if calls.Load() != 1 {
		t.Fatalf("downstream ran after Redis error: %d", calls.Load())
	}
	if err := common.RDB.Close(); err != nil {
		t.Fatal(err)
	}
	if got := rateLimitTestRequest(router); got != http.StatusInternalServerError {
		t.Fatalf("Redis unavailable: %d", got)
	}
	if calls.Load() != 1 {
		t.Fatalf("downstream ran after Redis outage: %d", calls.Load())
	}
}

func TestSearchRateLimitUnauthenticatedAborts(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("redis=%t", enabled), func(t *testing.T) {
			oldEnabled := common.RedisEnabled
			common.RedisEnabled = enabled
			t.Cleanup(func() { common.RedisEnabled = oldEnabled })
			var calls atomic.Int32
			router := rateLimitTestRouter(userRateLimitFactory(2, 60, "SR"), 0, &calls)
			if got := rateLimitTestRequest(router); got != http.StatusUnauthorized || calls.Load() != 0 {
				t.Fatalf("unauthenticated request: status=%d downstream=%d", got, calls.Load())
			}
		})
	}
}