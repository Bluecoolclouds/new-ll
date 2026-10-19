package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const freeKassaPayURL = "https://pay.freekassa.net/"

func resolvePaymentSystemId(paymentMethod string) string {
	// Handle specific crypto sub-methods: freekassa_crypto_24, freekassa_crypto_15, etc.
	if strings.HasPrefix(paymentMethod, "freekassa_crypto_") {
		id := strings.TrimPrefix(paymentMethod, "freekassa_crypto_")
		if id != "" {
			return id
		}
	}
	switch paymentMethod {
	case "freekassa":
		// SBP (Система быстрых платежей) - payment system ID 44
		return "44"
	case "freekassa_card":
		if setting.FreeKassaCardPaymentSystemId != "" {
			return setting.FreeKassaCardPaymentSystemId
		}
		return "36"
	case "freekassa_crypto":
		if setting.FreeKassaCryptoPaymentSystemId != "" {
			return setting.FreeKassaCryptoPaymentSystemId
		}
		return setting.FreeKassaPaymentSystemId
	case "freekassa_id32":
		return "32"
	default:
		return setting.FreeKassaPaymentSystemId
	}
}

type FreeKassaPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func getFreeKassaMinTopup() int64 {
	minTopup := setting.FreeKassaMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

func getFreeKassaPayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		dAmount = dAmount.Div(dQuotaPerUnit)
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := getAmountDiscount(int(amount))

	payMoney := dAmount.
		Mul(decimal.NewFromFloat(setting.FreeKassaUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		Round(2)

	return payMoney.InexactFloat64()
}

func freeKassaSign1(merchantId, amount, secretWord1, currency, orderId string) string {
	raw := fmt.Sprintf("%s:%s:%s:%s:%s", merchantId, amount, secretWord1, currency, orderId)
	return fmt.Sprintf("%x", md5.Sum([]byte(raw)))
}

func freeKassaSign2(merchantId, amount, secretWord2, orderId string) string {
	raw := fmt.Sprintf("%s:%s:%s:%s", merchantId, amount, secretWord2, orderId)
	return fmt.Sprintf("%x", md5.Sum([]byte(raw)))
}

// freeKassaApiSign computes HMAC-SHA256 signature for FreeKassa API v2.
// Per docs: sort all request fields by key alphabetically, join values with |, HMAC-SHA256 with API key.
func freeKassaApiSign(fields map[string]string, apiKey string) string {
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	vals := make([]string, 0, len(keys))
	for _, k := range keys {
		vals = append(vals, fields[k])
	}
	msg := strings.Join(vals, "|")
	h := hmac.New(sha256.New, []byte(apiKey))
	h.Write([]byte(msg))
	return hex.EncodeToString(h.Sum(nil))
}

type freeKassaApiOrderRequest struct {
	ShopId     int    `json:"shopId"`
	Nonce      int64  `json:"nonce"`
	PaymentId  string `json:"paymentId"`
	I          int    `json:"i"`
	Email      string `json:"email"`
	Ip         string `json:"ip"`
	Amount     string `json:"amount"`
	Currency   string `json:"currency"`
	Signature  string `json:"signature"`
	SuccessURL string `json:"success_url,omitempty"`
	FailureURL string `json:"failure_url,omitempty"`
}

type freeKassaApiOrderResponse struct {
	Type      string `json:"type"`
	OrderId   int    `json:"orderId"`
	OrderHash string `json:"orderHash"`
	Location  string `json:"location"`
	Message   string `json:"message"`
}

// requestFreeKassaPayViaAPI creates an order via FreeKassa API v2 and returns the payment URL.
func requestFreeKassaPayViaAPI(c *gin.Context, shopId int, apiKey string, paymentSystemId int,
	email string, ip string, amountStr string, currency string, tradeNo string) (string, error) {

	nonce := time.Now().Unix()
	fields := map[string]string{
		"shopId":    fmt.Sprintf("%d", shopId),
		"nonce":     fmt.Sprintf("%d", nonce),
		"paymentId": tradeNo,
		"i":         fmt.Sprintf("%d", paymentSystemId),
		"email":     email,
		"ip":        ip,
		"amount":    amountStr,
		"currency":  currency,
	}

	var successURL, failureURL string
	if setting.FreeKassaReturnURL != "" {
		successURL = strings.TrimRight(setting.FreeKassaReturnURL, "/") + "?status=success"
		failureURL = strings.TrimRight(setting.FreeKassaReturnURL, "/") + "?status=failed"
	}

	sig := freeKassaApiSign(fields, apiKey)

	reqBody := freeKassaApiOrderRequest{
		ShopId:    shopId,
		Nonce:     nonce,
		PaymentId: tradeNo,
		I:         paymentSystemId,
		Email:     email,
		Ip:        ip,
		Amount:    amountStr,
		Currency:  currency,
		Signature: sig,
	}

	if successURL != "" {
		reqBody.SuccessURL = successURL
		reqBody.FailureURL = failureURL
	}

	body, err := common.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal error: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
		"https://api.fk.life/v1/orders/create", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request error: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("http error: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response error: %w", err)
	}

	var apiResp freeKassaApiOrderResponse
	if err := common.Unmarshal(respBytes, &apiResp); err != nil {
		return "", fmt.Errorf("unmarshal error: %w, body: %s", err, string(respBytes))
	}

	if apiResp.Type != "success" || apiResp.Location == "" {
		return "", fmt.Errorf("freekassa api error: %s (body: %s)", apiResp.Message, string(respBytes))
	}

	return apiResp.Location, nil
}

// usesFreeKassaAPI returns true if the payment system ID requires FreeKassa API v2.
func usesFreeKassaAPI(paymentSystemId string) bool {
	switch paymentSystemId {
	case "42", "44":
		return true
	}
	return false
}

func freeKassaMethodDisabledReason(method string) string {
	if !usesFreeKassaAPI(resolvePaymentSystemId(method)) {
		return ""
	}
	if strings.TrimSpace(setting.FreeKassaApiKey) == "" {
		return "Для этого способа FreeKassa не настроен ключ API. Уведомления и другие способы оплаты не отключены."
	}
	merchantID, err := strconv.Atoi(setting.FreeKassaMerchantId)
	if err != nil || merchantID <= 0 {
		return "Для FreeKassa API требуется числовой ID магазина."
	}
	return ""
}

func RequestFreeKassaAmount(c *gin.Context) {
	if !isFreeKassaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "FreeKassa is not configured"})
		return
	}
	var req FreeKassaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	if !customTopUpAmountValid(c, freeKassaInternalUSD(req.Amount)) {
		return
	}
	payMoney := getFreeKassaPayMoney(req.Amount, group)
	if !customTopUpMoneyValid(c, payMoney) {
		return
	}
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Минимальная сумма пополнения 100 рублей"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func getFreeKassaUserEmail(user *model.User) string {
	if user != nil && strings.TrimSpace(user.Email) != "" {
		return user.Email
	}
	if setting.FreeKassaFallbackEmail != "" {
		return setting.FreeKassaFallbackEmail
	}
	return ""
}

func RequestFreeKassaPay(c *gin.Context) {
	if !isFreeKassaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置 FreeKassa 支付信息"})
		return
	}

	var req FreeKassaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if reason := freeKassaMethodDisabledReason(req.PaymentMethod); reason != "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": reason})
		return
	}
	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	amount := freeKassaInternalUSD(req.Amount)
	if !customTopUpAmountValid(c, amount) {
		return
	}
	payMoney := getFreeKassaPayMoney(req.Amount, group)
	if !customTopUpMoneyValid(c, payMoney) {
		return
	}
	payMoney = decimal.NewFromFloat(payMoney).Round(2).InexactFloat64()
	if !customTopUpMoneyValid(c, payMoney) {
		return
	}
	if payMoney < float64(setting.FreeKassaMinTopUp) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("Минимальная сумма пополнения %d рублей", setting.FreeKassaMinTopUp)})
		return
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())

	currency := setting.FreeKassaCurrency
	if currency == "" {
		currency = "RUB"
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodFreeKassa,
		PaymentProvider: model.PaymentProviderFreeKassa,
		PaymentCurrency: currency,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("FreeKassa 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	amountStr := strconv.FormatFloat(payMoney, 'f', 2, 64)

	paymentSystemId := resolvePaymentSystemId(req.PaymentMethod)

	var payLink string

	if usesFreeKassaAPI(paymentSystemId) && setting.FreeKassaMerchantId != "" {
		// Use FreeKassa API v2 for methods that require it (SBP id=44, card id=36)
		shopId, err := strconv.Atoi(setting.FreeKassaMerchantId)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("FreeKassa shopId parse error: %v", err))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Неверный ID магазина FreeKassa"})
			return
		}
		psId, _ := strconv.Atoi(paymentSystemId)
		email := getFreeKassaUserEmail(user)
		if email == "" {
			email = fmt.Sprintf("user%d@noemail.local", id)
		}
		ip := c.ClientIP()
		link, apiErr := requestFreeKassaPayViaAPI(c, shopId, setting.FreeKassaApiKey, psId, email, ip, amountStr, currency, tradeNo)
		if apiErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("FreeKassa API error user_id=%d trade_no=%s error=%q", id, tradeNo, apiErr.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Ошибка создания платежа через FreeKassa API: " + apiErr.Error()})
			return
		}
		payLink = link
	} else {
		// Legacy widget for other payment methods
		sign := freeKassaSign1(setting.FreeKassaMerchantId, amountStr, setting.FreeKassaSecretWord1, currency, tradeNo)

		params := url.Values{}
		params.Set("m", setting.FreeKassaMerchantId)
		params.Set("oa", amountStr)
		params.Set("currency", currency)
		params.Set("o", tradeNo)
		params.Set("s", sign)
		params.Set("lang", "ru")

		if email := getFreeKassaUserEmail(user); email != "" {
			params.Set("em", email)
		}

		if paymentSystemId != "" {
			params.Set("i", paymentSystemId)
		}

		if setting.FreeKassaReturnURL != "" {
			successURL := strings.TrimRight(setting.FreeKassaReturnURL, "/") + "?status=success"
			failureURL := strings.TrimRight(setting.FreeKassaReturnURL, "/") + "?status=failed"
			params.Set("success_url", successURL)
			params.Set("failure_url", failureURL)
		}

		payLink = freeKassaPayURL + "?" + params.Encode()
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("FreeKassa 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f currency=%s payment_system=%s", id, tradeNo, req.Amount, payMoney, currency, paymentSystemId))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

func FreeKassaNotify(c *gin.Context) {
	if !isFreeKassaWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	// c.Request.Form is populated from both query string (GET) and POST body
	// after ParseForm(), so this works for both GET and POST callbacks.
	merchantId := c.Request.Form.Get("MERCHANT_ID")
	amountStr := c.Request.Form.Get("AMOUNT")
	tradeNo := c.Request.Form.Get("MERCHANT_ORDER_ID")
	sign := c.Request.Form.Get("SIGN")

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 收到请求 merchant_id=%s amount=%s trade_no=%s client_ip=%s", merchantId, amountStr, tradeNo, c.ClientIP()))

	if merchantId != setting.FreeKassaMerchantId || amountStr == "" || tradeNo == "" || sign == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 参数缺失 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	expectedSign := freeKassaSign2(merchantId, amountStr, setting.FreeKassaSecretWord2, tradeNo)
	if !paymentSignatureEqual(sign, expectedSign) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("FreeKassa webhook invalid signature trade_no=%s", tradeNo))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderFreeKassa || !paymentMoneyMatches(amountStr, topUp.Money, 2) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("FreeKassa webhook 订单支付网关不匹配 trade_no=%s order_provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		_, _ = c.Writer.WriteString("NO")
		return
	}

	if err := model.RechargeFreeKassa(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("FreeKassa 更新充值订单失败 trade_no=%s user_id=%d error=%q", topUp.TradeNo, topUp.UserId, err.Error()))
		c.Status(http.StatusInternalServerError)
		_, _ = c.Writer.WriteString("NO")
		return
	}

	_, _ = c.Writer.WriteString("YES")
}
