package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

// Keep the existing Redis list of successful requests, but serialize admission
// with an in-flight sorted set. Stale reservations are reclaimed after a day;
// normal completion removes them immediately.
var reserveRedisModelRequest = redis.NewScript(`
local successes, inflight = KEYS[1], KEYS[2]
local cutoff, now, max, id, expiry, ttl = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3]), ARGV[4], tonumber(ARGV[5]), tonumber(ARGV[6])
redis.call('ZREMRANGEBYSCORE', inflight, '-inf', now)
while redis.call('LLEN', successes) > 0 do
  local oldest = redis.call('LINDEX', successes, -1)
  if oldest > cutoff then break end
  redis.call('RPOP', successes)
end
if redis.call('LLEN', successes) + redis.call('ZCARD', inflight) >= max then return 0 end
redis.call('ZADD', inflight, expiry, id)
redis.call('EXPIRE', inflight, ttl)
return 1
`)

var completeRedisModelRequest = redis.NewScript(`
if redis.call('ZREM', KEYS[2], ARGV[1]) == 0 then return 0 end
if ARGV[2] == '1' then
  redis.call('LPUSH', KEYS[1], ARGV[3])
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
end
return 1
`)

type redisModelReservation struct {
	rdb *redis.Client
	key string
	id  string
}

func reserveRedisRequest(ctx context.Context, rdb *redis.Client, key string, maxCount int, duration int64) (*redisModelReservation, bool, error) {
	if maxCount <= 0 {
		return nil, true, nil
	}
	now := time.Now()
	id := uuid.NewString()
	// Longer than the window so a long-running stream normally keeps its slot.
	lease := int64(24 * time.Hour / time.Second)
	if duration > lease {
		lease = duration
	}
	allowed, err := reserveRedisModelRequest.Run(ctx, rdb, []string{key, key + ":inflight"},
		now.Add(-time.Duration(duration)*time.Second).Format(timeFormat), now.Unix(),
		maxCount, id, now.Unix()+lease, lease).Int()
	if err != nil || allowed == 0 {
		return nil, allowed == 1, err
	}
	return &redisModelReservation{rdb: rdb, key: key, id: id}, true, nil
}

func (r *redisModelReservation) Complete(success bool, duration int64) error {
	if r == nil {
		return nil
	}
	record := "0"
	if success {
		record = "1"
	}
	// Never use the canceled client request context for settlement.
	return completeRedisModelRequest.Run(context.Background(), r.rdb, []string{r.key, r.key + ":inflight"},
		r.id, record, time.Now().Format(timeFormat), duration).Err()
}

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"
)

// Redis限流处理器
func redisRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := strconv.Itoa(c.GetInt("id"))
		ctx := context.Background()
		rdb := common.RDB

		// Redis checks success admission before charging the total bucket, as
		// before: a success-limit rejection does not consume the total limit.
		// 1. 检查成功请求数限制
		successKey := fmt.Sprintf("rateLimit:%s:%s", ModelRequestRateLimitSuccessCountMark, userId)
		reservation, allowed, err := reserveRedisRequest(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查成功请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount))
			return
		}
		// The total limit still charges unsuccessful attempts. The success limit
		// only charges completed responses; release on denial or panic.
		success := false
		defer func() {
			if err := reservation.Complete(success, duration); err != nil {
				common.SysLog(fmt.Sprintf("model rate limit settlement failed: %v", err))
			}
		}()

		//2.检查总请求数限制并记录总请求（当totalMaxCount为0时会自动跳过，使用令牌桶限流器
		if totalMaxCount > 0 {
			totalKey := fmt.Sprintf("rateLimit:%s", userId)
			// 初始化
			tb := limiter.New(ctx, rdb)
			allowed, err = tb.Allow(
				ctx,
				totalKey,
				limiter.WithCapacity(int64(totalMaxCount)*duration),
				limiter.WithRate(int64(totalMaxCount)),
				limiter.WithRequested(duration),
			)

			if err != nil {
				fmt.Println("检查总请求数限制失败:", err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}

			if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount))
				return
			}
		}

		// 4. 处理请求
		c.Next()

		// 5. Completion and release happen once after the final response outcome.
		success = modelRequestSucceeded(c)
	}
}

// 内存限流处理器
func memoryRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)

	return func(c *gin.Context) {
		userId := strconv.Itoa(c.GetInt("id"))
		totalKey := ModelRequestRateLimitCountMark + userId
		successKey := ModelRequestRateLimitSuccessCountMark + userId

		// The memory backend charges the total limit before checking success
		// admission, preserving its existing failed-attempt policy.
		// 1. 检查总请求数限制（当totalMaxCount为0时跳过）
		if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
			c.Status(http.StatusTooManyRequests)
			c.Abort()
			return
		}

		var reservation *common.RateLimitReservation
		if successMaxCount > 0 {
			reservation = inMemoryRateLimiter.Reserve(successKey, successMaxCount, duration)
			if reservation == nil {
				c.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
			defer reservation.Complete(false)
		}

		// 3. 处理请求
		c.Next()

		// 4. 如果请求成功，记录到实际的成功请求计数中
		reservation.Complete(modelRequestSucceeded(c))
	}
}

func modelRequestSucceeded(c *gin.Context) bool {
	if c.Writer.Status() >= 400 || len(c.Errors) > 0 {
		return false
	}
	status, ok := common.GetContextKeyType[*relaycommon.StreamStatus](c, constant.ContextKeyResponseStreamStatus)
	return !ok || status == nil || (status.IsNormalEnd() && !status.HasErrors() && status.EndError == nil)
}

// ModelRequestRateLimit 模型请求限流中间件
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 在每个请求时检查是否启用限流
		if !setting.ModelRequestRateLimitEnabled {
			c.Next()
			return
		}

		// 计算限流参数
		duration := int64(setting.ModelRequestRateLimitDurationMinutes * 60)
		totalMaxCount := setting.ModelRequestRateLimitCount
		successMaxCount := setting.ModelRequestRateLimitSuccessCount

		// 获取分组
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}

		//获取分组的限流配置
		groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(group)
		if found {
			totalMaxCount = groupTotalCount
			successMaxCount = groupSuccessCount
		}

		// 根据存储类型选择并执行限流处理器
		if common.RedisEnabled {
			redisRateLimitHandler(duration, totalMaxCount, successMaxCount)(c)
		} else {
			memoryRateLimitHandler(duration, totalMaxCount, successMaxCount)(c)
		}
	}
}
