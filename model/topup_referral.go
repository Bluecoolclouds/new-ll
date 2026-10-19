package model

import (
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Rewards are a share of credited wallet quota, not money paid or model usage.
const TopUpReferralPercent = 5

// rewardTopUpReferral must run in the transaction that changes a pending order
// to successful and credits the buyer. Replayed successful orders never call it.
// The reward goes directly to spendable quota; aff_quota is NOT also credited,
// otherwise the legacy referral-transfer endpoint could pay it a second time.
func rewardTopUpReferral(tx *gorm.DB, userID int, creditedQuota int64) (int, error) {
	if creditedQuota <= 0 {
		return 0, errors.New("invalid credited quota for referral reward")
	}
	var buyer User
	if err := tx.Select("id", "inviter_id").First(&buyer, userID).Error; err != nil {
		return 0, err
	}
	if buyer.InviterId <= 0 || buyer.InviterId == userID {
		return 0, nil
	}
	// Integer arithmetic, rounded down to the smallest quota unit, without
	// overflowing even for large credited quotas.
	reward := creditedQuota/100*TopUpReferralPercent + creditedQuota%100*TopUpReferralPercent/100
	if reward == 0 {
		return 0, nil
	}
	result := tx.Model(&User{}).
		Where("id = ? AND quota <= ? AND aff_history <= ?", buyer.InviterId, int64(math.MaxInt64)-reward, int64(math.MaxInt64)-reward).
		Updates(map[string]interface{}{
			"quota":       gorm.Expr("quota + ?", reward),
			"aff_history": gorm.Expr("aff_history + ?", reward),
		})
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := tx.Model(&User{}).Where("id = ?", buyer.InviterId).Count(&count).Error; err != nil {
			return 0, err
		}
		// A deleted/nonexistent inviter must not block the buyer's payment.
		if count == 0 {
			return 0, nil
		}
		return 0, errors.New("referral reward balance or history overflow")
	}
	return buyer.InviterId, nil
}

func invalidateTopUpCreditCaches(userID, inviterID int) {
	for _, id := range []int{userID, inviterID} {
		if id <= 0 {
			continue
		}
		if err := invalidateUserCache(id); err != nil {
			common.SysError("topup/referral cache invalidation failed: " + err.Error())
		}
	}
}
