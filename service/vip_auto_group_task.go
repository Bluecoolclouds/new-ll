package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	vipAutoGroupTickInterval = 1 * time.Hour
	vipAutoGroupBatchSize    = 300
)

var (
	vipAutoGroupOnce    sync.Once
	vipAutoGroupRunning atomic.Bool
)

func StartVipAutoGroupTask() {
	vipAutoGroupOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("vip auto group task started: tick=%s", vipAutoGroupTickInterval))
			ticker := time.NewTicker(vipAutoGroupTickInterval)
			defer ticker.Stop()

			runVipAutoGroupOnce()
			for range ticker.C {
				runVipAutoGroupOnce()
			}
		})
	})
}

func runVipAutoGroupOnce() {
	if !vipAutoGroupRunning.CompareAndSwap(false, true) {
		return
	}
	defer vipAutoGroupRunning.Store(false)

	ctx := context.Background()
	quotaPerUnit := common.QuotaPerUnit
	threshold := 100 * quotaPerUnit

	offset := 0
	totalDowngraded := 0
	for {
		users, err := model.GetUsersByGroup("svip", vipAutoGroupBatchSize, offset)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("vip auto group task: failed to fetch svip users: %v", err))
			return
		}
		if len(users) == 0 {
			break
		}
		for _, u := range users {
			yq, err := getUserYesterdayQuota(u.Id)
			if err != nil {
				continue
			}
			if float64(yq) < threshold {
				if err := model.UpdateUserGroup(u.Id, "vip"); err != nil {
					logger.LogWarn(ctx, fmt.Sprintf("vip auto group task: failed to downgrade user %d: %v", u.Id, err))
				} else {
					totalDowngraded++
				}
			}
		}
		if len(users) < vipAutoGroupBatchSize {
			break
		}
		offset += vipAutoGroupBatchSize
	}

	if common.DebugEnabled && totalDowngraded > 0 {
		logger.LogDebug(ctx, fmt.Sprintf("vip auto group task: downgraded %d svip users to vip", totalDowngraded))
	}
}
