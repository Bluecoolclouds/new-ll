package controller

import (
	"crypto/subtle"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

func paymentSignatureEqual(actual, expected string) bool {
	return subtle.ConstantTimeCompare([]byte(strings.ToLower(actual)), []byte(strings.ToLower(expected))) == 1
}

func customTopUpAmountValid(c *gin.Context, amount int64) bool {
	if _, err := model.CustomTopUpQuota(amount); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "Invalid whole internal USD amount"})
		return false
	}
	return true
}

func freeKassaInternalUSD(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		return amount
	}
	if common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		return 0
	}
	usd := decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit))
	if !usd.Equal(usd.Truncate(0)) {
		return 0
	}
	return usd.IntPart()
}

func customTopUpMoneyValid(c *gin.Context, money float64) bool {
	if money <= 0 || math.IsNaN(money) || math.IsInf(money, 0) {
		c.JSON(200, gin.H{"message": "error", "data": "Invalid payment price"})
		return false
	}
	return true
}

func paymentMoneyMatches(actual string, expected float64, precision int32) bool {
	value, err := decimal.NewFromString(actual)
	return err == nil && value.IsPositive() && !math.IsNaN(expected) && !math.IsInf(expected, 0) &&
		value.Equal(decimal.NewFromFloat(expected).Round(precision))
}

func paymentCurrency(topUp *model.TopUp, fallback string) string {
	if topUp.PaymentCurrency != "" {
		return topUp.PaymentCurrency
	}
	// Pre-repair pending orders did not store a currency.
	return fallback
}
