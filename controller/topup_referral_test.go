package controller

import (
	"math"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestTopUpReferralFivePercentAllSettlements(t *testing.T) {
	require.Equal(t, 5, model.TopUpReferralPercent)
	for _, provider := range []string{
		model.PaymentProviderFreeKassa, model.PaymentProviderHeleket,
		model.PaymentProviderPally, model.PaymentProviderPlategal,
		model.PaymentProviderEpay, model.PaymentProviderStripe,
		model.PaymentProviderCreem, model.PaymentProviderWaffo,
		model.PaymentProviderWaffoPancake, "manual",
	} {
		t.Run(provider, func(t *testing.T) {
			db, buyer := setupCustomPayments(t)
			parent := model.User{Username: "parent", Quota: 999, AffCode: "parent"}
			require.NoError(t, db.Create(&parent).Error)
			inviter := model.User{Username: "inviter", Quota: 103, AffQuota: 100, AffHistoryQuota: 200, AffCode: "inviter", InviterId: parent.Id}
			require.NoError(t, db.Create(&inviter).Error)
			require.NoError(t, db.Model(buyer).Update("inviter_id", inviter.Id).Error)
			order := model.TopUp{UserId: buyer.Id, Amount: 2, Money: 2, TradeNo: "referral-order", PaymentProvider: provider, PaymentMethod: provider, Status: common.TopUpStatusPending}
			credited := 1000000
			switch provider {
			case model.PaymentProviderFreeKassa, model.PaymentProviderHeleket, model.PaymentProviderPally, model.PaymentProviderPlategal, "manual":
				order.Amount, order.WalletPacks, order.WalletQuota = 0, 2, 2*model.StratusPackQuota
				credited = int(order.WalletQuota)
				if provider == "manual" {
					order.PaymentProvider = model.PaymentProviderHeleket
				}
			case model.PaymentProviderCreem:
				// Creem stores raw credited quota, not internal USD.
				order.Amount = 65000
				credited = 65000
			}
			require.NoError(t, db.Create(&order).Error)
			settle := func() error {
				switch provider {
				case model.PaymentProviderFreeKassa:
					return model.RechargeFreeKassa(order.TradeNo, "")
				case model.PaymentProviderHeleket:
					return model.RechargeHeleket(order.TradeNo, "")
				case model.PaymentProviderPally:
					return model.RechargePally(order.TradeNo, "")
				case model.PaymentProviderPlategal:
					return model.RechargePlategal(order.TradeNo, "")
				case model.PaymentProviderEpay:
					return model.RechargeEpay(order.TradeNo, "alipay", "")
				case model.PaymentProviderStripe:
					return model.Recharge(order.TradeNo, "fixture-customer", "")
				case model.PaymentProviderCreem:
					return model.RechargeCreem(order.TradeNo, "", "", "")
				case model.PaymentProviderWaffo:
					return model.RechargeWaffo(order.TradeNo, "")
				case model.PaymentProviderWaffoPancake:
					return model.RechargeWaffoPancake(order.TradeNo)
				default:
					return model.ManualCompleteTopUp(order.TradeNo, "")
				}
			}
			require.NoError(t, settle())
			// Legacy Stripe/Creem may reject a duplicate; neither may pay twice.
			_ = settle()
			require.NoError(t, model.ManualCompleteTopUp(order.TradeNo, ""))
			require.NoError(t, db.First(buyer, buyer.Id).Error)
			require.NoError(t, db.First(&inviter, inviter.Id).Error)
			require.NoError(t, db.First(&parent, parent.Id).Error)
			require.NoError(t, db.First(&order, order.Id).Error)
			require.Equal(t, 731+credited, buyer.Quota)
			require.Equal(t, 103+credited/20, inviter.Quota)
			require.Equal(t, 200+credited/20, inviter.AffHistoryQuota)
			require.Equal(t, 100, inviter.AffQuota, "direct rewards must not be transferable a second time")
			require.Equal(t, 999, parent.Quota, "only the direct inviter earns a reward")
			require.Equal(t, common.TopUpStatusSuccess, order.Status)
			if provider == model.PaymentProviderEpay {
				require.Equal(t, "alipay", order.PaymentMethod)
			}
		})
	}
}

func TestTopUpReferralRollbackOnInviterOverflow(t *testing.T) {
	for _, column := range []string{"quota", "aff_history"} {
		t.Run(column, func(t *testing.T) {
			db, buyer := setupCustomPayments(t)
			inviter := model.User{Username: "inviter", Quota: 103, AffCode: "inviter"}
			require.NoError(t, db.Create(&inviter).Error)
			require.NoError(t, db.Model(&inviter).Update(column, int64(math.MaxInt64)).Error)
			require.NoError(t, db.Model(buyer).Update("inviter_id", inviter.Id).Error)
			order := model.TopUp{UserId: buyer.Id, Amount: 2, TradeNo: "overflow-order", PaymentProvider: model.PaymentProviderHeleket, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&order).Error)
			require.Error(t, model.RechargeHeleket(order.TradeNo, ""))
			require.NoError(t, db.First(buyer, buyer.Id).Error)
			require.NoError(t, db.First(&order, order.Id).Error)
			require.Equal(t, 731, buyer.Quota)
			require.Equal(t, common.TopUpStatusPending, order.Status)
			// Once repaired, a retry credits both parties exactly once.
			require.NoError(t, db.Model(&inviter).Update(column, 0).Error)
			require.NoError(t, model.RechargeHeleket(order.TradeNo, ""))
			require.NoError(t, model.RechargeHeleket(order.TradeNo, ""))
			require.NoError(t, db.First(buyer, buyer.Id).Error)
			require.NoError(t, db.First(&inviter, inviter.Id).Error)
			require.Equal(t, 1000731, buyer.Quota)
			require.Equal(t, 50000, inviter.AffHistoryQuota)
		})
	}
}

func TestTopUpReferralOnlySuccessfulOrders(t *testing.T) {
	for _, status := range []string{"expired", "failed", common.TopUpStatusSuccess} {
		t.Run(status, func(t *testing.T) {
			db, buyer := setupCustomPayments(t)
			inviter := model.User{Username: "inviter", Quota: 103, AffCode: "inviter"}
			require.NoError(t, db.Create(&inviter).Error)
			require.NoError(t, db.Model(buyer).Update("inviter_id", inviter.Id).Error)
			order := model.TopUp{UserId: buyer.Id, Amount: 2, TradeNo: "not-pending", PaymentProvider: model.PaymentProviderHeleket, Status: status}
			require.NoError(t, db.Create(&order).Error)
			_ = model.RechargeHeleket(order.TradeNo, "")
			require.NoError(t, db.First(buyer, buyer.Id).Error)
			require.NoError(t, db.First(&inviter, inviter.Id).Error)
			require.Equal(t, 731, buyer.Quota)
			require.Equal(t, 103, inviter.Quota)
			require.Zero(t, inviter.AffHistoryQuota)
		})
	}
}

func TestTopUpReferralNoInviterAndSelfReferral(t *testing.T) {
	for _, relation := range []string{"none", "self", "missing", "deleted"} {
		t.Run(relation, func(t *testing.T) {
			db, buyer := setupCustomPayments(t)
			switch relation {
			case "self":
				require.NoError(t, db.Model(buyer).Update("inviter_id", buyer.Id).Error)
			case "missing":
				require.NoError(t, db.Model(buyer).Update("inviter_id", 99999).Error)
			case "deleted":
				inviter := model.User{Username: "deleted-inviter", AffCode: "deleted"}
				require.NoError(t, db.Create(&inviter).Error)
				require.NoError(t, db.Model(buyer).Update("inviter_id", inviter.Id).Error)
				require.NoError(t, db.Delete(&inviter).Error)
			}
			order := model.TopUp{UserId: buyer.Id, Amount: 2, TradeNo: "no-inviter", PaymentProvider: model.PaymentProviderHeleket, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&order).Error)
			require.NoError(t, model.RechargeHeleket(order.TradeNo, ""))
			require.NoError(t, db.First(buyer, buyer.Id).Error)
			require.Equal(t, 1000731, buyer.Quota)
			require.Zero(t, buyer.AffHistoryQuota)
		})
	}
}

func TestTopUpReferralQuotaRounding(t *testing.T) {
	for _, quota := range []int64{1, 19, 20, 99, 100, 65001} {
		t.Run(strconv.FormatInt(quota, 10), func(t *testing.T) {
			db, buyer := setupCustomPayments(t)
			inviter := model.User{Username: "inviter", Quota: 103, AffCode: "inviter"}
			require.NoError(t, db.Create(&inviter).Error)
			require.NoError(t, db.Model(buyer).Update("inviter_id", inviter.Id).Error)
			order := model.TopUp{UserId: buyer.Id, Amount: quota, TradeNo: "rounding-order", PaymentProvider: model.PaymentProviderCreem, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&order).Error)
			require.NoError(t, model.RechargeCreem(order.TradeNo, "", "", ""))
			require.NoError(t, db.First(&inviter, inviter.Id).Error)
			require.Equal(t, 103+int(quota/20), inviter.Quota)
			require.Equal(t, int(quota/20), inviter.AffHistoryQuota)
		})
	}
}
