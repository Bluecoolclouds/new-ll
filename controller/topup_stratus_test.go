package controller

import (
"net/http"
"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestStratusTopUpInfoMethodsAreAlwaysAnArray(t *testing.T) {
for _, configured := range []bool{false, true} {
name := "unconfigured"
if configured {
name = "configured"
}
t.Run(name, func(t *testing.T) {
setupStratusWalletContracts(t)
if !configured {
operation_setting.PayMethods = nil
setting.StripeApiSecret = ""
setting.WaffoPancakeMerchantID = ""
setting.CreemApiKey = ""
}
response := httptest.NewRecorder()
context, _ := gin.CreateTestContext(response)
GetStratusTopUpInfo(context)
require.Equal(t, http.StatusOK, response.Code)
var body struct {
Success bool `json:"success"`
Data struct {
Methods []struct {
ID string `json:"id"`
AmountOptions []int64 `json:"amount_options"`
} `json:"methods"`
} `json:"data"`
}
require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
require.True(t, body.Success)
require.NotNil(t, body.Data.Methods, "empty methods must be [] rather than null")
if configured {
require.NotEmpty(t, body.Data.Methods)
for _, method := range body.Data.Methods {
require.NotEmpty(t, method.ID)
require.NotNil(t, method.AmountOptions)
}
} else {
require.Empty(t, body.Data.Methods)
}
})
}
}

func setupStratusWalletContracts(t *testing.T) {
	t.Helper()
	confirmPaymentComplianceForTest(t)
	oldUnit := common.QuotaPerUnit
	oldDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	oldPayment := *operation_setting.GetPaymentSetting()
	oldAddress, oldID, oldKey := operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey
	oldMethods, oldMin, oldPrice := operation_setting.PayMethods, operation_setting.MinTopUp, operation_setting.Price
	oldGroup := common.TopupGroupRatio2JSONString()
	oldPancakeMerchant, oldPancakeKey, oldPancakeProduct := setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID
	oldPancakePrice, oldPancakeMin := setting.WaffoPancakeUnitPrice, setting.WaffoPancakeMinTopUp
	oldCreemKey, oldCreemProducts := setting.CreemApiKey, setting.CreemProducts
oldCreemWebhook := setting.CreemWebhookSecret
	oldStripeAPI, oldStripeWebhook, oldStripePrice := setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId
	oldStripeUnit, oldStripeMin := setting.StripeUnitPrice, setting.StripeMinTopUp
	t.Cleanup(func() {
		common.QuotaPerUnit = oldUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplay
		*operation_setting.GetPaymentSetting() = oldPayment
		operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey = oldAddress, oldID, oldKey
		operation_setting.PayMethods, operation_setting.MinTopUp, operation_setting.Price = oldMethods, oldMin, oldPrice
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(oldGroup))
		setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID = oldPancakeMerchant, oldPancakeKey, oldPancakeProduct
		setting.WaffoPancakeUnitPrice, setting.WaffoPancakeMinTopUp = oldPancakePrice, oldPancakeMin
		setting.CreemApiKey, setting.CreemProducts = oldCreemKey, oldCreemProducts
setting.CreemWebhookSecret = oldCreemWebhook
		setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = oldStripeAPI, oldStripeWebhook, oldStripePrice
		setting.StripeUnitPrice, setting.StripeMinTopUp = oldStripeUnit, oldStripeMin
	})
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey = "https://payments.invalid", "fixture", "fixture"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay", "name": "Alipay"}}
	operation_setting.MinTopUp, operation_setting.Price = 1, 7
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{10: 0.8, 1500000: 0.5}
	operation_setting.GetPaymentSetting().AmountOptions = []int{1, 10, 1500000}
	setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID = "fixture", "fixture", "fixture"
	setting.WaffoPancakeUnitPrice, setting.WaffoPancakeMinTopUp = 2.5, 1
	setting.CreemApiKey = "fixture"
setting.CreemWebhookSecret = "fixture"
	setting.CreemProducts = `[{"productId":"fixture","name":"Configured product","price":5,"currency":"EUR","quota":12345}]`
	setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "fixture", "fixture", "fixture"
	setting.StripeUnitPrice, setting.StripeMinTopUp = 1.5, 1
}

func TestStratusWalletQuotesPreserveExistingUnits(t *testing.T) {
	setupStratusWalletContracts(t)
	for _, tc := range []struct {
		name, method, display, money, currency string
		usd, requestAmount, credit int64
	}{
		{"epay USD", "alipay", operation_setting.QuotaDisplayTypeUSD, "67.20", "CNY", 10, 10, 5000000},
		{"epay TOKENS", "alipay", operation_setting.QuotaDisplayTypeTokens, "12.60", "CNY", 3, 1500000, 1500000},
		{"pancake USD", "waffo_pancake", operation_setting.QuotaDisplayTypeUSD, "24.00", "USD", 10, 10, 5000000},
		{"pancake TOKENS", "waffo_pancake", operation_setting.QuotaDisplayTypeTokens, "4.50", "USD", 3, 1500000, 1500000},
		{"stripe actual credit differs from quote money", "stripe", operation_setting.QuotaDisplayTypeUSD, "14.40", "", 10, 10, 6000000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.display
			quote, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: tc.method, USD: tc.usd}, "vip")
			require.NoError(t, err)
			require.Equal(t, tc.money, quote["money"])
			require.Equal(t, tc.currency, quote["currency"])
			require.Equal(t, tc.credit, quote["credited_quota"])
			require.Equal(t, tc.requestAmount, quote["payload"].(gin.H)["amount"])
		})
	}
}

func TestStratusWalletCreemCreditsRawQuota(t *testing.T) {
	setupStratusWalletContracts(t)
	quote, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "creem:fixture", USD: 1}, "vip")
	require.NoError(t, err)
	require.Equal(t, int64(12345), quote["credited_quota"])
	require.Equal(t, "5.00", quote["money"])
	require.Equal(t, "EUR", quote["currency"])
	require.NotContains(t, quote["payload"], "amount")
}

func TestStratusWalletMinimumMatchesExistingQuoteHandler(t *testing.T) {
	setupStratusWalletContracts(t)
	setting.WaffoPancakeUnitPrice = 0.01
	_, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "waffo_pancake", USD: 1}, "default")
	require.Error(t, err, "Pancake rejects a price equal to 0.01")
	setting.WaffoPancakeUnitPrice = 0.02
	quote, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "waffo_pancake", USD: 1}, "default")
	require.NoError(t, err)
	require.Equal(t, "0.02", quote["money"])
}

func TestStratusWalletCreemRequiresOperationalWebhook(t *testing.T) {
setupStratusWalletContracts(t)
setting.CreemWebhookSecret = ""
require.True(t, isCreemTopUpEnabled(), "checkout credentials alone are not enough")
require.False(t, isCreemWebhookEnabled())
_, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "creem:fixture", USD: 1}, "default")
require.ErrorContains(t, err, "Уведомления Creem не настроены")
found := false
for _, method := range stratusPaymentMethods() {
if method.ID == "creem:fixture" {
found = true
require.NotEmpty(t, method.DisabledReason)
}
}
require.True(t, found, "preserve the configured product with an explicit unavailable reason")
setting.CreemWebhookSecret = "fixture"
_, err = stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "creem:fixture", USD: 1}, "default")
require.NoError(t, err)
}

func TestStratusWalletRejectsUnsafeOrUnavailablePurchases(t *testing.T) {
	setupStratusWalletContracts(t)
	for _, req := range []stratusTopUpQuoteRequest{
		{Method: "alipay", USD: 0}, {Method: "alipay", USD: -1},
		{Method: "alipay", USD: 9007199254740991}, {Method: "not-configured", USD: 1},
		{Method: "stripe", USD: 10001}, {Method: "creem:fixture", USD: 2},
	} {
		_, err := stratusTopUpQuote(req, "default")
		require.Error(t, err)
	}
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	_, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "stripe", USD: 1}, "default")
	require.Error(t, err, "legacy Stripe TOKENS minimum exceeds its maximum; do not invent a normalization")
setting.StripePriceId = ""
_, err = stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "stripe", USD: 10}, "default")
require.Error(t, err, "removed provider configuration must invalidate an earlier selection")
}
