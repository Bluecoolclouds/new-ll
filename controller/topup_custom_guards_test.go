package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestCustomPaymentProviderCurrencyAndStatusGuards(t *testing.T) {
	for _, tc := range []struct{ provider, currency, status string }{
		{model.PaymentProviderFreeKassa, "RUB", ""},
		{model.PaymentProviderHeleket, "USD", "paid_over"},
		{model.PaymentProviderPally, "RUB", "SUCCESS"},
		{model.PaymentProviderPlategal, "RUB", "CONFIRMED"},
	} {
		t.Run(tc.provider, func(t *testing.T) {
			db, user := setupCustomPayments(t)
			topUp := model.TopUp{UserId: user.Id, Amount: 2, Money: 200, TradeNo: "guard-order", PaymentMethod: tc.provider, PaymentProvider: tc.provider, PaymentCurrency: tc.currency, ProviderReference: "ptg-id", Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&topUp).Error)
			require.NoError(t, db.Model(&topUp).Update("payment_provider", model.PaymentProviderEpay).Error)
			rec := customPaymentNotify(tc.provider, topUp, tc.status, "200", tc.currency, true)
			if tc.provider == model.PaymentProviderFreeKassa {
				require.Equal(t, "NO", rec.Body.String())
			} else {
				require.NotEqual(t, 200, rec.Code)
			}
			require.NoError(t, db.Model(&topUp).Update("payment_provider", tc.provider).Error)
			if tc.provider == model.PaymentProviderHeleket || tc.provider == model.PaymentProviderPlategal {
				rec = customPaymentNotify(tc.provider, topUp, tc.status, "200", "EUR", true)
				require.Equal(t, 400, rec.Code)
			}
			if tc.provider != model.PaymentProviderFreeKassa {
				rec = customPaymentNotify(tc.provider, topUp, "pending", "200", tc.currency, true)
				require.Equal(t, 200, rec.Code)
			}
			require.NoError(t, db.Model(&topUp).Update("status", "expired").Error)
			rec = customPaymentNotify(tc.provider, topUp, tc.status, "200", tc.currency, true)
			require.Equal(t, 500, rec.Code)
			var unchanged model.User
			require.NoError(t, db.First(&unchanged, user.Id).Error)
			require.Equal(t, 731, unchanged.Quota)
			require.NoError(t, db.Model(&topUp).Update("status", common.TopUpStatusPending).Error)
			// Accept the exact snapshotted currency even after an admin
			// changes the currency used to create future invoices.
			if tc.provider == model.PaymentProviderHeleket {
				setting.HeleketCurrency = "EUR"
			}
			rec = customPaymentNotify(tc.provider, topUp, tc.status, "200", tc.currency, true)
			require.Equal(t, 200, rec.Code)
			require.NoError(t, db.First(&unchanged, user.Id).Error)
			require.Equal(t, 1000731, unchanged.Quota)
		})
	}
}

func TestLegacyPlategaCallbackRecoversOrderWithoutPayload(t *testing.T) {
	for _, tc := range []struct {
		name   string
		quoted float64
		paid   string
	}{
		{"integer legacy bill", 200, "200"},
		{"legacy bill truncated kopecks", 974.4, "974"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, user := setupCustomPayments(t)
			topUp := model.TopUp{UserId: user.Id, Amount: 2, Money: tc.quoted, TradeNo: "legacy-platega", PaymentMethod: model.PaymentMethodPlategal, PaymentProvider: model.PaymentProviderPlategal, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&topUp).Error)
			calls := 0
			http.DefaultTransport = paymentTestTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, "GET", r.Method)
				require.Equal(t, "https://app.platega.io/transaction/ptg-id", r.URL.String())
				require.Equal(t, "test-platega", r.Header.Get("X-Secret"))
				response := fmt.Sprintf(`{"id":"ptg-id","status":"CONFIRMED","payload":%q,"paymentDetails":{"amount":%s,"currency":"RUB"}}`, topUp.TradeNo, tc.paid)
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(response)), Header: make(http.Header)}, nil
			})
			rejected := customPaymentNotify(model.PaymentProviderPlategal, topUp, "CONFIRMED", "1", "RUB", true)
			require.Equal(t, 502, rejected.Code, "the remote transaction must confirm the amount")
			for i := 0; i < 2; i++ {
				rec := customPaymentNotify(model.PaymentProviderPlategal, topUp, "CONFIRMED", tc.paid, "RUB", true)
				require.Equal(t, 200, rec.Code)
			}
			require.Equal(t, 3, calls)
			var after model.User
			require.NoError(t, db.First(&after, user.Id).Error)
			require.Equal(t, 1000731, after.Quota)
			require.NoError(t, db.First(&topUp, topUp.Id).Error)
			require.Equal(t, common.TopUpStatusSuccess, topUp.Status)
			require.Equal(t, tc.quoted, topUp.Money, "do not rewrite the historical quote")
			var logs int64
			require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ?", user.Id, model.LogTypeTopup).Count(&logs).Error)
			require.Equal(t, int64(1), logs)
		})
	}
}

func TestCustomPaymentPlategaNewOrdersRequireExactKopecks(t *testing.T) {
	db, user := setupCustomPayments(t)
	topUp := model.TopUp{UserId: user.Id, Amount: 2, Money: 974.4, TradeNo: "new-platega", PaymentMethod: model.PaymentMethodPlategal, PaymentProvider: model.PaymentProviderPlategal, PaymentCurrency: "RUB", ProviderReference: "ptg-id", Status: common.TopUpStatusPending}
	require.NoError(t, db.Create(&topUp).Error)
	rec := customPaymentNotify(model.PaymentProviderPlategal, topUp, "CONFIRMED", "974", "RUB", true)
	require.Equal(t, 400, rec.Code)
	require.NoError(t, db.First(user, user.Id).Error)
	require.Equal(t, 731, user.Quota)
	rec = customPaymentNotify(model.PaymentProviderPlategal, topUp, "CONFIRMED", "974.40", "RUB", true)
	require.Equal(t, 200, rec.Code)
	require.NoError(t, db.First(user, user.Id).Error)
	require.Equal(t, 1000731, user.Quota)
}

func TestCustomPaymentConcurrentDeliveryAndReferral(t *testing.T) {
	for _, provider := range []string{model.PaymentProviderFreeKassa, model.PaymentProviderHeleket, model.PaymentProviderPally, model.PaymentProviderPlategal} {
		t.Run(provider, func(t *testing.T) {
			db, user := setupCustomPayments(t)
			inviter := model.User{Username: "inviter", Quota: 103, AffCode: "inviter-fixture"}
			require.NoError(t, db.Create(&inviter).Error)
			require.NoError(t, db.Model(user).Update("inviter_id", inviter.Id).Error)
			topUp := model.TopUp{UserId: user.Id, Amount: 3, Money: 300, TradeNo: "concurrent-order", PaymentProvider: provider, PaymentMethod: provider, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&topUp).Error)
			var wg sync.WaitGroup
			errs := make(chan error, 12)
			for i := 0; i < 12; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					switch provider {
					case model.PaymentProviderFreeKassa:
						errs <- model.RechargeFreeKassa(topUp.TradeNo, "")
					case model.PaymentProviderHeleket:
						errs <- model.RechargeHeleket(topUp.TradeNo, "")
					case model.PaymentProviderPally:
						errs <- model.RechargePally(topUp.TradeNo, "")
					default:
						errs <- model.RechargePlategal(topUp.TradeNo, "")
					}
				}()
			}
			wg.Wait()
			close(errs)
			for err := range errs {
				require.NoError(t, err)
			}
			require.NoError(t, db.First(user, user.Id).Error)
			require.Equal(t, 1500731, user.Quota)
			require.NoError(t, db.First(&inviter, inviter.Id).Error)
require.Equal(t, 103+75000, inviter.Quota)
require.Equal(t, 75000, inviter.AffHistoryQuota)
require.Zero(t, inviter.AffQuota)
		})
	}
}

func TestCustomPaymentUnavailableReasonsAndQuotePrecision(t *testing.T) {
	_, user := setupCustomPayments(t)
	setting.FreeKassaApiKey = ""
	_, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "freekassa", USD: 10}, user.Group)
	require.ErrorContains(t, err, "ключ API")
	_, err = stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "freekassa_card", USD: 10}, user.Group)
	require.NoError(t, err, "widget payments do not require the API key")
	setting.HeleketUnitPrice = 1.00013
	quote, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: "heleket", USD: 10}, user.Group)
	require.NoError(t, err)
	require.Equal(t, "9.60", quote["money"], "preserve Heleket's existing cent-rounded tariff")
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	require.Equal(t, int64(0), freeKassaInternalUSD(500001), "never truncate fractional internal USD")
}
