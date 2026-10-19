package model

import (
        "github.com/QuantumNous/new-api/common"
)

func GetUserDailyQuotaFromDB(userId int, startTime int64, endTime int64) (int, error) {
        var total int64
        err := LOG_DB.Model(&Log{}).
                Where("user_id = ? AND created_at >= ? AND created_at < ? AND type = ?", userId, startTime, endTime, LogTypeConsume).
                Select("COALESCE(SUM(quota), 0)").
                Scan(&total).Error
        return int(total), err
}

func GetUsersByGroup(group string, limit int, offset int) ([]*User, error) {
        var users []*User
        err := DB.Where("group = ?", group).Limit(limit).Offset(offset).Find(&users).Error
        return users, err
}

func UpdateUserGroup(userId int, group string) error {
        err := DB.Model(&User{}).Where("id = ?", userId).Update("group", group).Error
        if err != nil {
                return err
        }
        if common.RedisEnabled {
                if err2 := UpdateUserGroupCache(userId, group); err2 != nil {
                        common.SysLog("failed to update user group cache: " + err2.Error())
                }
        }
        return nil
}
