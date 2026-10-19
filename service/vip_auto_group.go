package service

import (
        "fmt"
        "strconv"
        "time"

        "github.com/QuantumNous/new-api/common"
        "github.com/QuantumNous/new-api/model"
)

func userDailyQuotaKey(userId int, date time.Time) string {
        return fmt.Sprintf("user_daily_quota:%d:%s", userId, date.UTC().Format("2006-01-02"))
}

func IncrUserDailyQuota(userId int, quota int) {
        if quota <= 0 || !common.RedisEnabled {
                return
        }
        key := userDailyQuotaKey(userId, time.Now())
        if _, err := common.RedisIncrByWithTTL(key, int64(quota), 48*time.Hour); err != nil {
                common.SysLog(fmt.Sprintf("failed to incr daily quota for user %d: %v", userId, err))
        }
}

func GetTodayQuotaForUser(userId int) (int, error) {
        if common.RedisEnabled {
                key := userDailyQuotaKey(userId, time.Now())
                val, err := common.RedisGet(key)
                if err == nil {
                        q, err2 := strconv.ParseInt(val, 10, 64)
                        if err2 == nil {
                                return int(q), nil
                        }
                }
        }
        now := time.Now().UTC()
        start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
        return model.GetUserDailyQuotaFromDB(userId, start.Unix(), start.Add(24*time.Hour).Unix())
}

func getUserYesterdayQuota(userId int) (int, error) {
        yesterday := time.Now().UTC().AddDate(0, 0, -1)
        if common.RedisEnabled {
                key := userDailyQuotaKey(userId, yesterday)
                val, err := common.RedisGet(key)
                if err == nil {
                        q, err2 := strconv.ParseInt(val, 10, 64)
                        if err2 == nil {
                                return int(q), nil
                        }
                }
        }
        start := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, time.UTC)
        return model.GetUserDailyQuotaFromDB(userId, start.Unix(), start.Add(24*time.Hour).Unix())
}

func GetTodayQuotaForUserSafe(userId int) int {
        q, _ := GetTodayQuotaForUser(userId)
        return q
}

func CheckVipAutoUpgrade(userId int, userGroup string) {
        quotaPerUnit := common.QuotaPerUnit
        switch userGroup {
        case "default":
                usedQuota, err := model.GetUserUsedQuota(userId)
                if err != nil {
                        return
                }
                if float64(usedQuota)/quotaPerUnit >= 1000 {
                        if err := model.UpdateUserGroup(userId, "vip"); err != nil {
                                common.SysLog(fmt.Sprintf("failed to upgrade user %d to vip: %v", userId, err))
                        }
                }
        case "vip":
                todayQuota, err := GetTodayQuotaForUser(userId)
                if err != nil {
                        return
                }
                if float64(todayQuota)/quotaPerUnit >= 100 {
                        if err := model.UpdateUserGroup(userId, "svip"); err != nil {
                                common.SysLog(fmt.Sprintf("failed to upgrade user %d to svip: %v", userId, err))
                        }
                }
        }
}
