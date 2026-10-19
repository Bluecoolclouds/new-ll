package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	PaymentMethodFreeKassa = "freekassa"
	PaymentMethodHeleket   = "heleket"
	PaymentMethodPally     = "pally"

	PaymentMethodPlategal     = "plategal"
	PaymentMethodPlategalSBP  = "plategal_sbp"
	PaymentMethodPlategalCard = "plategal_card"
	PaymentMethodPlategalIntl = "plategal_intl"

	PaymentProviderFreeKassa = "freekassa"
	PaymentProviderHeleket   = "heleket"
	PaymentProviderPally     = "pally"
	PaymentProviderPlategal  = "plategal"
)

func RechargeEpay(tradeNo, paymentMethod, callerIp string) error {
	return completePendingTopUp(tradeNo, PaymentProviderEpay, callerIp, "Epay", paymentMethod)
}

func RechargeHeleket(tradeNo string, callerIp string) error {
	return completePendingTopUp(tradeNo, PaymentProviderHeleket, callerIp, "Heleket")
}

func RechargePally(tradeNo string, callerIp string) error {
	return completePendingTopUp(tradeNo, PaymentProviderPally, callerIp, "Pally")
}

func RechargePlategal(tradeNo string, callerIp string) error {
	return completePendingTopUp(tradeNo, PaymentProviderPlategal, callerIp, "Plategal")
}

func RechargeFreeKassa(tradeNo string, callerIp string) error {
	return completePendingTopUp(tradeNo, PaymentProviderFreeKassa, callerIp, "FreeKassa")
}

// Custom gateways persist whole internal USD, never wallet tokens or raw quota.
// The safe-integer limit also keeps Stratus quotes exact.
func CustomTopUpQuota(amount int64) (int64, error) {
	if amount <= 0 || common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		return 0, errors.New("invalid topup amount or quota unit")
	}
	q := decimal.NewFromInt(amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	if !q.Equal(q.Truncate(0)) || q.GreaterThan(decimal.NewFromInt(9007199254740991)) || q.LessThan(decimal.NewFromInt(1)) {
		return 0, errors.New("topup quota is not an exact safe integer")
	}
	return q.IntPart(), nil
}

// Wallet packs v1: 1 million tokens = 11.57 RUB = 0.13 internal USD.
// Freeze the final credited quota in the order; later settings must not reprice it.
const StratusPackQuota int64 = 65000
const StratusMaxPacks int64 = 9007199254 // keeps wallet tokens safe in JavaScript

func (topUp *TopUp) CustomCreditedQuota() (int64, error) {
	if topUp.WalletPacks == 0 && topUp.WalletQuota == 0 {
		return CustomTopUpQuota(topUp.Amount)
	}
	switch topUp.PaymentProvider {
	case PaymentProviderFreeKassa, PaymentProviderHeleket, PaymentProviderPally, PaymentProviderPlategal:
	default:
		return 0, errors.New("wallet packs not supported by this provider")
	}
	if topUp.Amount != 0 || topUp.WalletQuota <= 0 || topUp.WalletQuota > 9007199254740991 {
		return 0, errors.New("invalid wallet pack snapshot")
	}
	if topUp.WalletPacks == 0 {
		if topUp.Money <= 0 || topUp.PaymentCurrency != "RUB" && topUp.PaymentCurrency != "USD" {
			return 0, errors.New("invalid amount-based wallet snapshot")
		}
		return topUp.WalletQuota, nil
	}
	if topUp.WalletPacks < 0 || topUp.WalletPacks > StratusMaxPacks {
		return 0, errors.New("invalid wallet pack snapshot")
	}
	baseQuota := topUp.WalletPacks * StratusPackQuota
	maxQuotaWithBonus := decimal.NewFromInt(baseQuota).Mul(decimal.NewFromFloat(1.5)).Truncate(0).IntPart()
	if topUp.WalletQuota < baseQuota || topUp.WalletQuota > maxQuotaWithBonus {
		return 0, errors.New("invalid wallet pack snapshot")
	}
	return topUp.WalletQuota, nil
}

func completePendingTopUp(tradeNo string, provider string, callerIp string, providerName string, paymentMethodOverride ...string) error {
	var topUp TopUp
	var quota int64
	var credited bool
	var inviterID int
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&topUp).Error; err != nil {
			return err
		}
		if topUp.PaymentProvider != provider {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}
		var err error
		quota, err = topUp.CustomCreditedQuota()
		if err != nil {
			return err
		}
		// CAS is necessary even on databases without row-level locks.
		updates := map[string]interface{}{"status": common.TopUpStatusSuccess, "complete_time": common.GetTimestamp()}
		if provider == PaymentProviderEpay && len(paymentMethodOverride) > 0 && paymentMethodOverride[0] != "" {
			topUp.PaymentMethod = paymentMethodOverride[0]
			updates["payment_method"] = topUp.PaymentMethod
		}
		result := tx.Model(&TopUp{}).Where("id = ? AND status = ?", topUp.Id, common.TopUpStatusPending).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrTopUpStatusInvalid
		}
		result = tx.Model(&User{}).Where("id = ? AND quota <= ?", topUp.UserId, int64(math.MaxInt64)-quota).
			Update("quota", gorm.Expr("quota + ?", quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("topup user missing or balance overflow")
		}
		inviterID, err = rewardTopUpReferral(tx, topUp.UserId, quota)
		if err != nil {
			return err
		}
		credited = true
		return nil
	})
	if err != nil {
		return err
	}
	if credited {
		// Never mutate a cache before the credit transaction commits.
		invalidateTopUpCreditCaches(topUp.UserId, inviterID)
		RecordTopupLog(topUp.UserId, fmt.Sprintf("%s topup: quota=%d, money=%g", providerName, quota, topUp.Money), callerIp, topUp.PaymentMethod, provider)
	}
	return nil
}
