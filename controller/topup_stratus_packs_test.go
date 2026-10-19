package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func TestStratusPacksExactPricesAndLegacyIsolation(t *testing.T) {
	_, _ = setupCustomPayments(t)
	for _, display := range []string{operation_setting.QuotaDisplayTypeUSD, operation_setting.QuotaDisplayTypeTokens} {
		operation_setting.GetGeneralSetting().QuotaDisplayType = display
		for _, packs := range []int64{1, 3, 10, 100, model.StratusMaxPacks} {
			quote, _, err := stratusPackQuote("packs:pally", packs, "default")
			require.NoError(t, err)
			actualRUB := decimal.NewFromInt(packs * 1157).Div(decimal.NewFromInt(100))
			expectedQuota := decimal.NewFromInt(packs * model.StratusPackQuota).
				Mul(decimal.NewFromInt(100).Add(stratusTokenBonusPercent(actualRUB)).Div(decimal.NewFromInt(100))).
				Truncate(0).IntPart()
			require.Equal(t, expectedQuota, quote["credited_quota"])
			require.Equal(t, fmt.Sprintf("%d.%02d", packs*1157/100, packs*1157%100), quote["money"])
		}
	}
	// Existing unit prices and exact-key discounts are not overwritten.
	require.Equal(t, 0.0002, setting.PallyUnitPrice)
	legacy, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "pally", USD: 10}, "vip")
	require.NoError(t, err)
	require.Equal(t, "960.00", legacy["money"])
	require.Equal(t, int64(5000000), legacy["credited_quota"])

	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{0: 0.01, 1: 0.2, 13: 0.9}
	quote, _, err := stratusPackQuote("packs:pally", 1, "default")
	require.NoError(t, err)
	require.Equal(t, "11.57", quote["money"], "do not truncate 0.13 USD into discount key 0")
	quote, _, err = stratusPackQuote("packs:pally", 100, "default")
	require.NoError(t, err)
	require.Equal(t, "1157.00", quote["money"], "new token bonuses replace, not stack with, legacy amount discounts")
	require.Greater(t, quote["credited_quota"].(int64), int64(100*model.StratusPackQuota))
	quote, _, err = stratusPackQuote("packs:pally", 1, "vip")
	require.NoError(t, err)
	require.Equal(t, "13.88", quote["money"], "round the final cash amount once, not credited quota")
}

func TestStratusRubAmountQuotesUseProgressiveBonus(t *testing.T) {
	setupCustomPayments(t)
	for _, tc := range []struct {
		amount int64
		bonus  float64
	}{
		{100, 0},
		{12_550, 25},
		{25_000, 50},
		{25_001, 70},
	} {
		quote, _, err := stratusRubAmountQuote("packs:pally", tc.amount, "default")
		require.NoError(t, err)
		require.Equal(t, tc.amount, quote["amount_rub"])
		require.InDelta(t, tc.bonus, quote["bonus_percent"].(float64), 0.000001)
		require.Equal(t, fmt.Sprintf("%d.00", tc.amount), quote["money"])
		expectedQuota, err := stratusQuotaForRUBAmount(decimal.NewFromInt(tc.amount), 1)
		require.NoError(t, err)
		require.Equal(t, expectedQuota, quote["credited_quota"])
	}

	for _, tc := range []struct {
		method string
		amount int64
	}{
		{"packs:pally", 99},
		{"packs:pally", -1},
		{"packs:pally", math.MaxInt64},
		{"packs:unknown", 100},
	} {
		_, _, err := stratusRubAmountQuote(tc.method, tc.amount, "default")
		require.Error(t, err)
	}

	usdQuote, _, err := stratusRubAmountQuote("packs:heleket", 25_000, "default")
	require.NoError(t, err)
	require.Equal(t, "280.90", usdQuote["money"])
	require.Equal(t, "USD", usdQuote["currency"])
	require.InDelta(t, float64(50), usdQuote["bonus_percent"], 0.000001,
		"the slider's RUB amount, not rounded USD conversion, determines the bonus tier")
	expectedUSDQuota, err := stratusQuotaForRUBAmount(decimal.NewFromInt(25_000), 1)
	require.NoError(t, err)
	require.Equal(t, expectedUSDQuota, usdQuote["credited_quota"])
}

func TestStratusRubAmountCheckoutAndAuthenticatedSettlement(t *testing.T) {
	db, user := setupCustomPayments(t)
	require.NoError(t, db.Model(user).Update("group", "default").Error)
	http.DefaultTransport = paymentTestTransport(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.Contains(t, string(body), "amount=25001")
		require.Contains(t, string(body), "currency_in=RUB")
		return &http.Response{
			StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"success":true,"link_page_url":"https://checkout.invalid/pally","bill_id":"rub-amount"}`)),
			Header: make(http.Header),
		}, nil
	})
	quote, _, err := stratusRubAmountQuote("packs:pally", 25_001, "default")
	require.NoError(t, err)
	require.InDelta(t, float64(70), quote["bonus_percent"], 0.000001)
	payload, err := json.Marshal(quote["payload"])
	require.NoError(t, err)
	rec := customPaymentCall(RequestStratusPackPay, "POST", "/api/user/topup/stratus/pay", string(payload), user.Id, nil)
	require.Contains(t, rec.Body.String(), `"message":"success"`)

	var order model.TopUp
	require.NoError(t, db.First(&order).Error)
	require.Zero(t, order.WalletPacks)
	require.Equal(t, quote["credited_quota"], order.WalletQuota)
	require.Equal(t, float64(25_001), order.Money)
	require.Equal(t, "RUB", order.PaymentCurrency)
	var actual model.User
	require.NoError(t, db.First(&actual, user.Id).Error)
	require.Equal(t, 731, actual.Quota, "checkout must not credit before provider confirmation")

	customPaymentNotify(model.PaymentProviderPally, order, "SUCCESS", "25001.00", "RUB", true)
	require.NoError(t, db.First(&actual, user.Id).Error)
	require.Equal(t, 731+int(order.WalletQuota), actual.Quota)
}

func TestStratusPacksRejectInvalidOrUnavailableQuotes(t *testing.T) {
	setupCustomPayments(t)
	for _, n := range []int64{-1, 0, model.StratusMaxPacks + 1, math.MaxInt64} {
		_, _, err := stratusPackQuote("packs:pally", n, "default")
		require.Error(t, err)
	}
	for _, id := range []string{"packs:stripe", "packs:creem:fixture", "packs:alipay", "packs:unknown"} {
		_, _, err := stratusPackQuote(id, 1, "default")
		require.Error(t, err, "never reinterpret an external PriceId or product")
	}
	_, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "packs:pally", USD: 1, Packs: 1}, "default")
	require.Error(t, err)
	_, err = stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "pally", Packs: 1}, "default")
	require.Error(t, err)
	_, err = stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "packs:pally", Packs: 1}, "default")
	require.NoError(t, err)

	setting.PallyMinTopUp = 50
	_, _, err = stratusPackQuote("packs:pally", 4, "default")
	require.ErrorContains(t, err, "Минимум")
	_, _, err = stratusPackQuote("packs:pally", 5, "default")
	require.NoError(t, err)
	setting.PallyApiToken = ""
	_, _, err = stratusPackQuote("packs:pally", 5, "default")
	require.Error(t, err)
	setting.FreeKassaCurrency = "EUR"
	_, _, err = stratusPackQuote("packs:freekassa_card", 1, "default")
	require.Error(t, err)
	common.QuotaPerUnit = 1000000
	_, _, err = stratusPackQuote("packs:plategal_sbp", 1, "default")
	require.Error(t, err, "do not promise exact tokens under a different quota conversion")
}

func TestStratusPackCheckoutAndAuthenticatedSettlement(t *testing.T) {
	for _, tc := range []struct {
		method, provider, money, currency, status string
		packs                                     int64
	}{
		{"freekassa", model.PaymentProviderFreeKassa, "11.57", "RUB", "", 1},
		{"freekassa_card", model.PaymentProviderFreeKassa, "11.57", "RUB", "", 1},
		{"heleket", model.PaymentProviderHeleket, "1.04", "USD", "paid", 8},
		{"pally", model.PaymentProviderPally, "11.57", "RUB", "SUCCESS", 1},
		{"plategal_sbp", model.PaymentProviderPlategal, "11.57", "RUB", "CONFIRMED", 1},
		{"plategal_card", model.PaymentProviderPlategal, "11.57", "RUB", "CONFIRMED", 1},
		{"plategal_intl", model.PaymentProviderPlategal, "11.57", "RUB", "CONFIRMED", 1},
	} {
		t.Run(tc.method, func(t *testing.T) {
			db, user := setupCustomPayments(t)
			require.NoError(t, db.Model(user).Update("group", "default").Error)
			calls := 0
			http.DefaultTransport = paymentTestTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				response := ""
				switch r.URL.Host {
				case "api.fk.life":
					var request struct {
						Amount string `json:"amount"`
					}
					require.NoError(t, json.Unmarshal(body, &request))
					require.Equal(t, tc.money, request.Amount)
					response = `{"type":"success","location":"https://checkout.invalid/free"}`
				case "api.heleket.com":
					var request heleketCreateInvoiceRequest
					require.NoError(t, json.Unmarshal(body, &request))
					require.Equal(t, "1.0400", request.Amount)
					require.Equal(t, tc.currency, request.Currency)
					response = `{"state":0,"result":{"url":"https://checkout.invalid/heleket","uuid":"fixture"}}`
				case "pal24.pro":
					require.Contains(t, string(body), "amount=11.57")
					require.Contains(t, string(body), "currency_in=RUB")
					response = `{"success":true,"link_page_url":"https://checkout.invalid/pally","bill_id":"fixture"}`
				case "app.platega.io":
					var request plategalCreateTxRequest
					require.NoError(t, json.Unmarshal(body, &request))
					require.Equal(t, 11.57, request.PaymentDetails.Amount)
					require.Equal(t, "RUB", request.PaymentDetails.Currency)
					response = `{"transactionId":"ptg-id","redirect":"https://checkout.invalid/platega"}`
				default:
					t.Fatalf("unexpected external host: %s", r.URL.Host)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(response)), Header: make(http.Header)}, nil
			})
			quote, _, err := stratusPackQuote("packs:"+tc.method, tc.packs, "default")
			require.NoError(t, err)
			require.Equal(t, tc.money, quote["money"])
			payload, err := json.Marshal(quote["payload"])
			require.NoError(t, err)
			rec := customPaymentCall(RequestStratusPackPay, "POST", "/api/user/topup/stratus/pay", string(payload), user.Id, nil)
			require.Contains(t, rec.Body.String(), `"message":"success"`)
			if tc.method == "freekassa_card" {
				require.Zero(t, calls, "widget checkout needs no external request")
				require.Contains(t, rec.Body.String(), "oa=11.57")
			} else {
				require.Equal(t, 1, calls)
			}
			var order model.TopUp
			require.NoError(t, db.First(&order).Error)
			require.Equal(t, int64(0), order.Amount, "never save fractional USD in the legacy integer field")
			require.Equal(t, tc.packs, order.WalletPacks)
			require.Equal(t, tc.packs*65000, order.WalletQuota)
			require.Equal(t, tc.currency, order.PaymentCurrency)
			require.Equal(t, common.TopUpStatusPending, order.Status)
			// Checkout must not credit. Failed signatures/amounts must not either.
			customPaymentNotify(tc.provider, order, tc.status, tc.money, tc.currency, false)
			customPaymentNotify(tc.provider, order, tc.status, "0.01", tc.currency, true)
			var actual model.User
			require.NoError(t, db.First(&actual, user.Id).Error)
			require.Equal(t, 731, actual.Quota)
			// A later configuration change must not reprice an existing order.
			setting.PallyUnitPrice = 1
			common.QuotaPerUnit = 1000000
			rec = customPaymentNotify(tc.provider, order, tc.status, tc.money, tc.currency, true)
			require.Equal(t, 200, rec.Code)
			rec = customPaymentNotify(tc.provider, order, tc.status, tc.money, tc.currency, true)
			require.Equal(t, 200, rec.Code)
			require.NoError(t, db.First(&actual, user.Id).Error)
			require.Equal(t, 731+int(tc.packs*65000), actual.Quota, "one exact snapshot credit, even after repeated notification")
			require.NoError(t, db.First(&order, order.Id).Error)
			require.Equal(t, common.TopUpStatusSuccess, order.Status)
		})
	}
}

func TestStratusPackPayRejectsStaleQuotesBeforeCreatingOrder(t *testing.T) {
	db, user := setupCustomPayments(t)
	quote, _, err := stratusPackQuote("packs:pally", 1, user.Group)
	require.NoError(t, err)
	payload, err := json.Marshal(quote["payload"])
	require.NoError(t, err)
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"vip":2}`))
	rec := customPaymentCall(RequestStratusPackPay, "POST", "/", string(payload), user.Id, nil)
	require.Contains(t, rec.Body.String(), "Условия оплаты изменились")
	for _, body := range []string{
		`{"method":"packs:pally","packs":1.5}`,
		`{"method":"packs:pally","packs":-1}`,
		`{"method":"packs:pally","packs":1,"expected_money":"0.01","expected_currency":"RUB","expected_quota":65000}`,
		`{"method":"packs:pally","packs":1,"expected_money":"23.14","expected_currency":"RUB","expected_quota":999999}`,
	} {
		rec := customPaymentCall(RequestStratusPackPay, "POST", "/", body, user.Id, nil)
		require.Contains(t, rec.Body.String(), `"message":"error"`)
	}
	var count int64
	require.NoError(t, db.Model(&model.TopUp{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestStratusPackSnapshotValidationAndAdminCompletion(t *testing.T) {
	db, user := setupCustomPayments(t)
	valid := model.TopUp{UserId: user.Id, WalletPacks: 1, WalletQuota: 65000, PaymentProvider: model.PaymentProviderPally, Status: common.TopUpStatusPending, TradeNo: "admin-pack"}
	quota, err := valid.CustomCreditedQuota()
	require.NoError(t, err)
	require.Equal(t, int64(65000), quota)
	amountOrder := model.TopUp{
		UserId: user.Id, WalletQuota: 500000, Money: 100, PaymentCurrency: "RUB",
		PaymentProvider: model.PaymentProviderPally, Status: common.TopUpStatusPending, TradeNo: "admin-rub",
	}
	quota, err = amountOrder.CustomCreditedQuota()
	require.NoError(t, err)
	require.Equal(t, int64(500000), quota)
	for _, mutate := range []func(*model.TopUp){
		func(o *model.TopUp) { o.Amount = 1 },
		func(o *model.TopUp) { o.WalletPacks = -1 },
		func(o *model.TopUp) { o.WalletQuota = 64999 },
		func(o *model.TopUp) { o.WalletQuota = 97501 },
		func(o *model.TopUp) { o.WalletPacks = model.StratusMaxPacks + 1 },
		func(o *model.TopUp) { o.PaymentProvider = model.PaymentProviderStripe },
	} {
		order := valid
		mutate(&order)
		_, err := order.CustomCreditedQuota()
		require.Error(t, err)
	}
	require.NoError(t, db.Create(&valid).Error)
	require.NoError(t, model.ManualCompleteTopUp(valid.TradeNo, ""))
	require.NoError(t, model.ManualCompleteTopUp(valid.TradeNo, ""))
	var actual model.User
	require.NoError(t, db.First(&actual, user.Id).Error)
	require.Equal(t, 65731, actual.Quota)
}
