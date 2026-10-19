package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ReserveGatewayQuota atomically debits the wallet and/or finite token for a
// model switch. A failed second debit rolls back the first within the same DB
// transaction. Gateway reservations cannot use the deferred batch updater:
// its pending writes are not visible to a conditional SQL debit.
func ReserveGatewayQuota(userID, tokenID int, tokenKey string, delta int, wallet, tokenUnlimited bool) error {
	if delta <= 0 {
		return errors.New("gateway reservation must be positive")
	}
	if common.BatchUpdateEnabled {
		return errors.New("atomic gateway reservation unavailable with batch quota updates")
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if wallet {
			result := tx.Model(&User{}).Where("id = ? AND quota >= ?", userID, delta).
				Update("quota", gorm.Expr("quota - ?", delta))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return fmt.Errorf("insufficient wallet quota for gateway reservation")
			}
		}
		query := tx.Model(&Token{}).Where("id = ?", tokenID).Where(&Token{Key: tokenKey})
		if !tokenUnlimited {
			query = query.Where("remain_quota >= ?", delta)
		}
		result := query.Updates(map[string]interface{}{
			"remain_quota":  gorm.Expr("remain_quota - ?", delta),
			"used_quota":    gorm.Expr("used_quota + ?", delta),
			"accessed_time": common.GetTimestamp(),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("insufficient token quota for gateway reservation")
		}
		return nil
	}); err != nil {
		return err
	}
	if common.RedisEnabled {
		// Invalidate rather than writing a value read before the transaction:
		// another concurrent reservation may have committed in the meantime.
		if wallet {
			if err := invalidateUserCache(userID); err != nil {
				common.SysLog("failed to invalidate gateway wallet cache: " + err.Error())
			}
		}
		if err := cacheDeleteToken(tokenKey); err != nil {
			common.SysLog("failed to invalidate gateway token cache: " + err.Error())
		}
	}
	return nil
}
