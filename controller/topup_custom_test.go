package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func paymentTestSet[T any](t *testing.T, target *T, value T) {
	t.Helper()
	old := *target
	t.Cleanup(func() { *target = old })
	*target = value
}

type paymentTestTransport func(*http.Request) (*http.Response, error)

func (f paymentTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func setupCustomPayments(t *testing.T) (*gorm.DB, *model.User) {
	t.Helper()
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedis := common.RedisEnabled
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedis
		common.SetDatabaseTypes(oldMain, oldLog)
	})
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}, &model.Log{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	setupStratusWalletContracts(t)
	paymentTestSet(t, &setting.FreeKassaMerchantId, "123")
	paymentTestSet(t, &setting.FreeKassaApiKey, "test-fk-api")
	paymentTestSet(t, &setting.FreeKassaCardPaymentSystemId, "36")
	paymentTestSet(t, &setting.FreeKassaSecretWord1, "test-secret1")
	paymentTestSet(t, &setting.FreeKassaSecretWord2, "test-secret2")
	paymentTestSet(t, &setting.FreeKassaCurrency, "RUB")
	paymentTestSet(t, &setting.FreeKassaUnitPrice, 100.0)
	paymentTestSet(t, &setting.FreeKassaMinTopUp, 1)
	paymentTestSet(t, &setting.FreeKassaEnableSBP, true)
	paymentTestSet(t, &setting.FreeKassaEnableCard, true)
	paymentTestSet(t, &setting.FreeKassaEnableCrypto, true)
	paymentTestSet(t, &setting.FreeKassaEnableID32, false)
	paymentTestSet(t, &setting.HeleketApiKey, "test-heleket")
	paymentTestSet(t, &setting.HeleketMerchantUUID, "test-merchant")
	paymentTestSet(t, &setting.HeleketCurrency, "USD")
	paymentTestSet(t, &setting.HeleketUnitPrice, 1.0)
	paymentTestSet(t, &setting.HeleketMinTopUp, 1)
	paymentTestSet(t, &setting.PallyApiToken, "test-pally")
	paymentTestSet(t, &setting.PallyShopID, "test-shop")
	paymentTestSet(t, &setting.PallyUnitPrice, 0.0002)
	paymentTestSet(t, &setting.PallyMinTopUp, 1)
	paymentTestSet(t, &setting.PlategalMerchantId, "test-merchant")
	paymentTestSet(t, &setting.PlategalApiSecret, "test-platega")
	// Fractional RUB must survive the upstream request unchanged.
	paymentTestSet(t, &setting.PlategalUnitPrice, 0.000203)
	paymentTestSet(t, &setting.PlategalMinTopUp, 1)
	paymentTestSet(t, &http.DefaultTransport, http.RoundTripper(paymentTestTransport(func(r *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("unexpected external request: %s", r.URL)
	})))
	user := &model.User{Username: "payment-fixture", Group: "vip", Quota: 731, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	return db, user
}

func customPaymentCall(handler gin.HandlerFunc, method, path, body string, userID int, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		c.Request.Header.Set(k, v)
	}
	c.Set("id", userID)
	handler(c)
	return w
}

// Build provider notifications independently of the production signing helpers.
func customPaymentNotify(provider string, topUp model.TopUp, status, money, currency string, validSign bool) *httptest.ResponseRecorder {
	switch provider {
	case model.PaymentProviderFreeKassa:
		sign := fmt.Sprintf("%x", md5.Sum([]byte("123:"+money+":test-secret2:"+topUp.TradeNo)))
		if !validSign {
			sign = "invalid"
		}
		form := url.Values{"MERCHANT_ID": {"123"}, "MERCHANT_ORDER_ID": {topUp.TradeNo}, "AMOUNT": {money}, "SIGN": {sign}}
		return customPaymentCall(FreeKassaNotify, "POST", "/api/freekassa/notify", form.Encode(), 0, map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	case model.PaymentProviderHeleket:
		unsigned := fmt.Sprintf(`{"uuid":"hk-id","order_id":%q,"amount":%q,"currency":%q,"status":%q,"unknown":{"url":"https:\/\/example.test\/ёж"}}`, topUp.TradeNo, money, currency, status)
		sign := fmt.Sprintf("%x", md5.Sum([]byte(base64.StdEncoding.EncodeToString([]byte(unsigned))+"test-heleket")))
		if !validSign {
			sign = "invalid"
		}
		body := strings.TrimSuffix(unsigned, "}") + `,"sign":"` + sign + `"}`
		return customPaymentCall(HeleketWebhook, "POST", "/api/heleket/webhook", body, 0, nil)
	case model.PaymentProviderPally:
		sign := strings.ToUpper(fmt.Sprintf("%x", md5.Sum([]byte(money+":"+topUp.TradeNo+":test-pally"))))
		if !validSign {
			sign = "invalid"
		}
		form := url.Values{"InvId": {topUp.TradeNo}, "OutSum": {money}, "Status": {status}, "SignatureValue": {sign}}
		return customPaymentCall(PallyWebhook, "POST", "/api/pally/webhook", form.Encode(), 0, map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	default:
		secret := "test-platega"
		if !validSign {
			secret = "invalid"
		}
		// No payload: this is the documented callback contract.
		body := fmt.Sprintf(`{"id":"ptg-id","amount":%s,"currency":%q,"status":%q}`, money, currency, status)
		return customPaymentCall(PlategalWebhook, "POST", "/api/plategal/webhook", body, 0, map[string]string{"X-MerchantId": "test-merchant", "X-Secret": secret})
	}
}

func TestCustomPaymentOrderNotificationAndExactBalance(t *testing.T) {
	for _, display := range []string{operation_setting.QuotaDisplayTypeUSD, operation_setting.QuotaDisplayTypeTokens} {
		for _, tc := range []struct {
			method, provider, currency, status string
			pay                                gin.HandlerFunc
		}{
			{"freekassa", model.PaymentProviderFreeKassa, "RUB", "", RequestFreeKassaPay},
			{"freekassa_card", model.PaymentProviderFreeKassa, "RUB", "", RequestFreeKassaPay},
			{"heleket", model.PaymentProviderHeleket, "USD", "paid", RequestHeleketPay},
			{"pally", model.PaymentProviderPally, "RUB", "SUCCESS", RequestPallyPay},
			{"plategal_sbp", model.PaymentProviderPlategal, "RUB", "CONFIRMED", RequestPlategalPay},
			{"plategal_card", model.PaymentProviderPlategal, "RUB", "CONFIRMED", RequestPlategalPay},
			{"plategal_intl", model.PaymentProviderPlategal, "RUB", "CONFIRMED", RequestPlategalPay},
		} {
			t.Run(display+"/"+tc.method, func(t *testing.T) {
				db, user := setupCustomPayments(t)
				operation_setting.GetGeneralSetting().QuotaDisplayType = display
				expectedFreeKassaMoney := "960.00"
				if display == operation_setting.QuotaDisplayTypeTokens {
					expectedFreeKassaMoney = "1200.00"
				}
				remoteCalls := 0
				http.DefaultTransport = paymentTestTransport(func(r *http.Request) (*http.Response, error) {
					remoteCalls++
					var response string
					switch tc.provider {
					case model.PaymentProviderFreeKassa:
						var payload freeKassaApiOrderRequest
						require.NoError(t, common.DecodeJson(r.Body, &payload))
						require.Equal(t, 123, payload.ShopId)
						require.Equal(t, 44, payload.I)
						require.Equal(t, expectedFreeKassaMoney, payload.Amount)
						require.LessOrEqual(t, payload.Nonce, int64(2147483647))
						mac := hmac.New(sha256.New, []byte("test-fk-api"))
						_, _ = mac.Write([]byte(strings.Join([]string{
							payload.Amount, payload.Currency, payload.Email,
							fmt.Sprint(payload.I), payload.Ip, fmt.Sprint(payload.Nonce),
							payload.PaymentId, fmt.Sprint(payload.ShopId),
						}, "|")))
						require.Equal(t, fmt.Sprintf("%x", mac.Sum(nil)), payload.Signature)
						response = `{"type":"success","location":"https://checkout.test/freekassa"}`
					case model.PaymentProviderHeleket:
						data, err := io.ReadAll(r.Body)
						require.NoError(t, err)
						signature := fmt.Sprintf("%x", md5.Sum([]byte(base64.StdEncoding.EncodeToString(data)+"test-heleket")))
						require.Equal(t, signature, r.Header.Get("sign"))
						require.Equal(t, "test-merchant", r.Header.Get("merchant"))
						var payload heleketCreateInvoiceRequest
						require.NoError(t, common.Unmarshal(data, &payload))
						require.Equal(t, "9.6000", payload.Amount)
						require.True(t, strings.HasSuffix(payload.URLCallback, "/api/heleket/webhook"))
						response = `{"state":0,"result":{"uuid":"hk-id","url":"https://checkout.test/heleket"}}`
					case model.PaymentProviderPally:
						require.NoError(t, r.ParseForm())
						require.Equal(t, "960.00", r.PostForm.Get("amount"))
						require.Equal(t, "Bearer test-pally", r.Header.Get("Authorization"))
						response = `{"success":true,"bill_id":"bill-id","link_page_url":"https://checkout.test/pally"}`
					case model.PaymentProviderPlategal:
						require.Equal(t, "https://app.platega.io/transaction/process", r.URL.String())
						var payload plategalCreateTxRequest
						require.NoError(t, common.DecodeJson(r.Body, &payload))
						require.Equal(t, 974.4, payload.PaymentDetails.Amount)
						require.Equal(t, map[string]int{"plategal_sbp": 2, "plategal_card": 11, "plategal_intl": 12}[tc.method], payload.PaymentMethod)
						response = `{"transactionId":"ptg-id","redirect":"https://checkout.test/platega","status":"PENDING"}`
					}
					return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(response)), Header: make(http.Header)}, nil
				})
				quote, err := stratusTopUpQuote(stratusTopUpQuoteRequest{Method: tc.method, USD: 10}, user.Group)
				require.NoError(t, err)
				require.Equal(t, int64(5000000), quote["credited_quota"])
				payload, err := common.Marshal(quote["payload"])
				require.NoError(t, err)
				rec := customPaymentCall(tc.pay, "POST", quote["pay_path"].(string), string(payload), user.Id, nil)
				require.Equal(t, 200, rec.Code)
				require.Contains(t, rec.Body.String(), `"message":"success"`)
				var topUp model.TopUp
				require.NoError(t, db.Where("user_id = ?", user.Id).First(&topUp).Error)
				require.Equal(t, int64(10), topUp.Amount)
				require.Equal(t, tc.provider, topUp.PaymentProvider)
				require.Equal(t, tc.currency, topUp.PaymentCurrency)
				require.True(t, paymentMoneyMatches(quote["money"].(string), topUp.Money, 4))
				require.Equal(t, common.TopUpStatusPending, topUp.Status)
				var before model.User
				require.NoError(t, db.First(&before, user.Id).Error)
				require.Equal(t, 731, before.Quota, "order creation never credits")
				if tc.method == "freekassa_card" {
					require.Zero(t, remoteCalls)
					var envelope struct {
						Data struct {
							Link string `json:"pay_link"`
						} `json:"data"`
					}
					require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &envelope))
					link, err := url.Parse(envelope.Data.Link)
					require.NoError(t, err)
					require.Equal(t, quote["money"], link.Query().Get("oa"))
				} else {
					require.Equal(t, 1, remoteCalls)
				}
				money := quote["money"].(string)
				rejected := customPaymentNotify(tc.provider, topUp, tc.status, money, tc.currency, false)
				require.NotEqual(t, "YES", rejected.Body.String())
				if tc.provider != model.PaymentProviderFreeKassa {
					require.Equal(t, 401, rejected.Code)
				}
				rejected = customPaymentNotify(tc.provider, topUp, tc.status, "0.01", tc.currency, true)
				if tc.provider == model.PaymentProviderFreeKassa {
					require.Equal(t, "NO", rejected.Body.String())
				} else {
					require.Equal(t, 400, rejected.Code)
				}
				require.NoError(t, db.First(&before, user.Id).Error)
				require.Equal(t, 731, before.Quota)
				for i := 0; i < 2; i++ {
					accepted := customPaymentNotify(tc.provider, topUp, tc.status, money, tc.currency, true)
					require.Equal(t, 200, accepted.Code)
					if tc.method == "freekassa_card" {
						require.Zero(t, remoteCalls)
						require.Equal(t, "YES", accepted.Body.String())
					}
				}
				var after model.User
				require.NoError(t, db.First(&after, user.Id).Error)
				require.Equal(t, 5000731, after.Quota)
				require.NoError(t, db.First(&topUp, topUp.Id).Error)
				require.Equal(t, common.TopUpStatusSuccess, topUp.Status)
				require.Positive(t, topUp.CompleteTime)
				var logs int64
				require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ?", user.Id, model.LogTypeTopup).Count(&logs).Error)
				require.Equal(t, int64(1), logs)
			})
		}
	}
}

func TestCustomPaymentsRollbackThenRetryAndLegacyPending(t *testing.T) {
	for _, provider := range []string{model.PaymentProviderFreeKassa, model.PaymentProviderHeleket, model.PaymentProviderPally, model.PaymentProviderPlategal} {
		t.Run(provider, func(t *testing.T) {
			db, user := setupCustomPayments(t)
			topUp := model.TopUp{UserId: user.Id, Amount: 3, Money: 300, TradeNo: "legacy-order", PaymentProvider: provider, PaymentMethod: provider, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(&topUp).Error)
			complete := func() error {
				switch provider {
				case model.PaymentProviderFreeKassa:
					return model.RechargeFreeKassa(topUp.TradeNo, "")
				case model.PaymentProviderHeleket:
					return model.RechargeHeleket(topUp.TradeNo, "")
				case model.PaymentProviderPally:
					return model.RechargePally(topUp.TradeNo, "")
				default:
					return model.RechargePlategal(topUp.TradeNo, "")
				}
			}
			require.NoError(t, db.Exec(`CREATE TRIGGER reject_credit BEFORE UPDATE OF quota ON users BEGIN SELECT RAISE(ABORT, 'injected credit failure'); END`).Error)
			require.Error(t, complete())
			require.NoError(t, db.First(&topUp, topUp.Id).Error)
			require.Equal(t, common.TopUpStatusPending, topUp.Status)
			var before model.User
			require.NoError(t, db.First(&before, user.Id).Error)
			require.Equal(t, 731, before.Quota)
			require.NoError(t, db.Exec("DROP TRIGGER reject_credit").Error)
			require.NoError(t, complete())
			require.NoError(t, complete())
			require.NoError(t, db.First(&before, user.Id).Error)
			require.Equal(t, 1500731, before.Quota)
		})
	}
}

func TestCustomPaymentRejectsInvalidInputsBeforeExternalRequests(t *testing.T) {
	db, user := setupCustomPayments(t)
	for _, pay := range []gin.HandlerFunc{RequestFreeKassaPay, RequestHeleketPay, RequestPallyPay, RequestPlategalPay} {
		for _, amount := range []string{"0", "-1", "0.5", "9007199254740991"} {
			rec := customPaymentCall(pay, "POST", "/test", `{"amount":`+amount+`}`, user.Id, nil)
			require.Contains(t, rec.Body.String(), `"message":"error"`)
		}
	}
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	rec := customPaymentCall(RequestFreeKassaPay, "POST", "/test", `{"amount":500001}`, user.Id, nil)
	require.Contains(t, rec.Body.String(), `"message":"error"`)
	var count int64
	require.NoError(t, db.Model(&model.TopUp{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestHeleketSignatureCoversAllFields(t *testing.T) {
	setupCustomPayments(t)
	body := []byte(`{"uuid":"test","order_id":"test","amount":"10","status":"paid","sign":"ignored","unknown":"a\/b"}`)
	sign, err := heleketWebhookSign(body, "test-heleket")
	require.NoError(t, err)
	changed := bytes.Replace(body, []byte(`"amount":"10"`), []byte(`"amount":"100"`), 1)
	changedSign, err := heleketWebhookSign(changed, "test-heleket")
	require.NoError(t, err)
	require.NotEqual(t, sign, changedSign)
	expected := fmt.Sprintf("%x", md5.Sum([]byte(base64.StdEncoding.EncodeToString([]byte(`{"uuid":"test","order_id":"test","amount":"10","status":"paid","unknown":"a\/b"}`))+"test-heleket")))
	require.Equal(t, expected, sign)
}
