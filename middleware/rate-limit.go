package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
"github.com/go-redis/redis/v8"
)

var timeFormat = "2006-01-02T15:04:05.000Z"

var inMemoryRateLimiter common.InMemoryRateLimiter

var defNext = func(c *gin.Context) {
	c.Next()
}

// The list stores newest timestamps first. Check and consume a slot in one
// Redis operation so concurrent requests (including on different instances)
// cannot all observe the same free slot.
var admitRedisRateRequest = redis.NewScript(`
local key, max, now, cutoff, ttl = KEYS[1], tonumber(ARGV[1]), ARGV[2], ARGV[3], tonumber(ARGV[4])
local length = redis.call('LLEN', key)
if length >= max then
  local oldest = redis.call('LINDEX', key, -1)
  if not oldest or not string.match(oldest, '^%d%d%d%d%-%d%d%-%d%dT%d%d:%d%d:%d%d%.%d%d%dZ$') then
    return redis.error_reply('invalid rate limit timestamp')
  end
  if oldest > cutoff then
    redis.call('PEXPIRE', key, ttl)
    return 0
  end
end
redis.call('LPUSH', key, now)
if length >= max then redis.call('LTRIM', key, 0, max - 1) end
redis.call('PEXPIRE', key, ttl)
return 1
`)

func redisRateLimitKey(c *gin.Context, maxRequestNum int, duration int64, key string) {
if maxRequestNum <= 0 {
c.Status(http.StatusInternalServerError)
c.Abort()
return
}
now := time.Now()
allowed, err := admitRedisRateRequest.Run(c.Request.Context(), common.RDB, []string{key},
maxRequestNum, now.Format(timeFormat),
now.Add(-time.Duration(duration)*time.Second).Format(timeFormat),
common.RateLimitKeyExpirationDuration.Milliseconds()).Int()
if err != nil {
fmt.Println(err)
c.Status(http.StatusInternalServerError)
c.Abort()
return
}
if allowed != 1 {
c.Status(http.StatusTooManyRequests)
c.Abort()
}
}

func redisRateLimiter(c *gin.Context, maxRequestNum int, duration int64, mark string) {
redisRateLimitKey(c, maxRequestNum, duration, "rateLimit:"+mark+c.ClientIP())
}

func memoryRateLimiter(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	key := mark + c.ClientIP()
	if !inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
		c.Status(http.StatusTooManyRequests)
		c.Abort()
		return
	}
}

func rateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	if common.RedisEnabled {
		return func(c *gin.Context) {
			redisRateLimiter(c, maxRequestNum, duration, mark)
		}
	} else {
		// It's safe to call multi times.
		inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
		return func(c *gin.Context) {
			memoryRateLimiter(c, maxRequestNum, duration, mark)
		}
	}
}

func GlobalWebRateLimit() func(c *gin.Context) {
	if common.GlobalWebRateLimitEnable {
		return rateLimitFactory(common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration, "GW")
	}
	return defNext
}

func GlobalAPIRateLimit() func(c *gin.Context) {
	if common.GlobalApiRateLimitEnable {
		return rateLimitFactory(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "GA")
	}
	return defNext
}

func CriticalRateLimit() func(c *gin.Context) {
	if common.CriticalRateLimitEnable {
		return rateLimitFactory(common.CriticalRateLimitNum, common.CriticalRateLimitDuration, "CT")
	}
	return defNext
}

func DownloadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.DownloadRateLimitNum, common.DownloadRateLimitDuration, "DW")
}

func UploadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.UploadRateLimitNum, common.UploadRateLimitDuration, "UP")
}

// userRateLimitFactory creates a rate limiter keyed by authenticated user ID
// instead of client IP, making it resistant to proxy rotation attacks.
// Must be used AFTER authentication middleware (UserAuth).
func userRateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	if common.RedisEnabled {
		return func(c *gin.Context) {
			userId := c.GetInt("id")
			if userId == 0 {
				c.Status(http.StatusUnauthorized)
				c.Abort()
				return
			}
			key := fmt.Sprintf("rateLimit:%s:user:%d", mark, userId)
			userRedisRateLimiter(c, maxRequestNum, duration, key)
		}
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		if userId == 0 {
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}
		key := fmt.Sprintf("%s:user:%d", mark, userId)
		if !inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
			c.Status(http.StatusTooManyRequests)
			c.Abort()
			return
		}
	}
}

func userRedisRateLimiter(c *gin.Context, maxRequestNum int, duration int64, key string) {
redisRateLimitKey(c, maxRequestNum, duration, key)
}

// SearchRateLimit returns a per-user rate limiter for search endpoints.
// Configurable via SEARCH_RATE_LIMIT_ENABLE / SEARCH_RATE_LIMIT / SEARCH_RATE_LIMIT_DURATION.
func SearchRateLimit() func(c *gin.Context) {
	if !common.SearchRateLimitEnable {
		return defNext
	}
	return userRateLimitFactory(common.SearchRateLimitNum, common.SearchRateLimitDuration, "SR")
}
