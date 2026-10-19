package controller

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	stratusBonusStartRUB int64 = 100
	stratusBonusFullRUB  int64 = 25000
	stratusMaxBonusPct   int64 = 50
	stratusLargeBonusPct int64 = 70
	stratusUSDToRUB      int64 = 89
)

var (
	stratusRubPerMillion = decimal.New(1157, -2)
	stratusSafeInteger   = decimal.NewFromInt(9007199254740991)
)

func stratusTokenBonusPercent(amountRUB decimal.Decimal) decimal.Decimal {
	start := decimal.NewFromInt(stratusBonusStartRUB)
	full := decimal.NewFromInt(stratusBonusFullRUB)
	if amountRUB.LessThanOrEqual(start) {
		return decimal.Zero
	}
	if amountRUB.GreaterThan(full) {
		return decimal.NewFromInt(stratusLargeBonusPct)
	}
	if amountRUB.Equal(full) {
		return decimal.NewFromInt(stratusMaxBonusPct)
	}
	return amountRUB.Sub(start).Mul(decimal.NewFromInt(stratusMaxBonusPct)).Div(full.Sub(start))
}

func stratusMethodMinAmountRUB(method stratusPaymentMethod) int64 {
	minimum := decimal.NewFromFloat(method.minMoney)
	if method.currency == "USD" {
		minimum = minimum.Mul(decimal.NewFromInt(stratusUSDToRUB))
	}
	return max(stratusBonusStartRUB, minimum.Ceil().IntPart())
}

func stratusQuotaForRUBAmount(amountRUB decimal.Decimal, ratio float64) (int64, error) {
	if !amountRUB.IsPositive() || math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
		return 0, fmt.Errorf("Некорректная сумма или коэффициент группы.")
	}
	bonus := stratusTokenBonusPercent(amountRUB)
	quota := amountRUB.Div(stratusRubPerMillion).
		Div(decimal.NewFromFloat(ratio)).
		Mul(decimal.NewFromInt(model.StratusPackQuota)).
		Mul(decimal.NewFromInt(100).Add(bonus).Div(decimal.NewFromInt(100))).
		Truncate(0)
	if !quota.IsPositive() || quota.GreaterThan(stratusSafeInteger) {
		return 0, fmt.Errorf("Начисление выходит за допустимый диапазон.")
	}
	return quota.IntPart(), nil
}

func stratusBonusSummary(amountRUB decimal.Decimal, quota int64) gin.H {
	bonus := stratusTokenBonusPercent(amountRUB)
	creditedTokensInMillions := decimal.NewFromInt(quota).Div(decimal.NewFromInt(model.StratusPackQuota))
	effectiveRate := amountRUB.Mul(decimal.NewFromInt(model.StratusPackQuota)).Div(decimal.NewFromInt(quota))
	equivalent := creditedTokensInMillions.Mul(stratusRubPerMillion)
	return gin.H{
		"bonus_percent":      bonus.InexactFloat64(),
		"equivalent_rub":     equivalent.InexactFloat64(),
		"effective_rate_rub": effectiveRate.InexactFloat64(),
	}
}

func stratusRubAmountQuote(methodID string, amountRUB int64, group string) (gin.H, *stratusPaymentMethod, error) {
	if amountRUB < stratusBonusStartRUB || !decimal.NewFromInt(amountRUB).LessThanOrEqual(stratusSafeInteger) {
		return nil, nil, fmt.Errorf("Сумма должна быть не меньше %d ₽ и укладываться в безопасный диапазон.", stratusBonusStartRUB)
	}
	for _, method := range stratusPackMethods() {
		if method.ID != methodID {
			continue
		}
		if method.DisabledReason != "" {
			return nil, nil, fmt.Errorf("%s", method.DisabledReason)
		}
		if method.currency != "RUB" && method.currency != "USD" {
			return nil, nil, fmt.Errorf("Для бонусных пакетов доступны только способы оплаты в RUB или USD.")
		}
		ratio := common.GetTopupGroupRatio(group)
		if ratio == 0 {
			ratio = 1
		}
		amount := decimal.NewFromInt(amountRUB)
		money := amount
		if method.currency == "USD" {
			money = amount.Div(decimal.NewFromInt(stratusUSDToRUB)).Round(2)
		}
		if !money.IsPositive() || money.LessThan(decimal.NewFromFloat(method.minMoney)) ||
			money.Mul(decimal.NewFromInt(100)).GreaterThan(stratusSafeInteger) {
			return nil, nil, fmt.Errorf("Минимум этого способа оплаты — %s %s.", decimal.NewFromFloat(method.minMoney).StringFixed(2), method.currency)
		}
		actualRUB := money
		if method.currency == "USD" {
			actualRUB = money.Mul(decimal.NewFromInt(stratusUSDToRUB))
		}
		// The slider defines the bonus tier in RUB; FX rounding must not move a
		// selected amount across the user's threshold.
		bonusBasisRUB := amount
		quota, err := stratusQuotaForRUBAmount(bonusBasisRUB, ratio)
		if err != nil {
			return nil, nil, err
		}
		formatted := money.StringFixed(2)
		summary := stratusBonusSummary(bonusBasisRUB, quota)
		payload := gin.H{
			"method": methodID, "amount_rub": amountRUB,
			"expected_money": formatted, "expected_currency": method.currency,
			"expected_quota": quota,
		}
		return gin.H{
			"money": formatted, "currency": method.currency, "credited_quota": quota,
			"pay_path": "/api/user/topup/stratus/pay", "notice": method.Notice,
			"amount_rub": amountRUB, "payment_rub": actualRUB.InexactFloat64(),
			"payload":            payload,
			"bonus_percent":      summary["bonus_percent"],
			"equivalent_rub":     summary["equivalent_rub"],
			"effective_rate_rub": summary["effective_rate_rub"],
		}, &method, nil
	}
	return nil, nil, fmt.Errorf("Способ покупки токенов недоступен. Обновите список.")
}
