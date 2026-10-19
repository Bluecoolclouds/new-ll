package controller

import (
	"bytes"
	"context"
	"crypto/subtle"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	system_setting "github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

const plategalAPIBase = "https://app.platega.io"

// ─── Amount calculation ─────────────────────────────────────────────────────

func getPlategalMinTopup() int64 {
	minTopup := setting.PlategalMinTopUp
	if minTopup <= 0 {
		minTopup = 100
	}
	return int64(minTopup)
}

const plategalQuotaPerDollar = int64(500000)

func getPlategalPayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount).Mul(decimal.NewFromInt(plategalQuotaPerDollar))

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	unitPrice := setting.PlategalUnitPrice
	if unitPrice <= 0 {
		unitPrice = 0.0002
	}

	discountRatio := getAmountDiscount(int(amount))

	money := dAmount.
		Mul(decimal.NewFromFloat(unitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discountRatio)).
		Round(2)

	return money.InexactFloat64()
}

func RequestPlategalAmount(c *gin.Context) {
	if !isPlategalTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Platega не настроена"})
		return
	}

	var req struct {
		Amount int64 `json:"amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "User not found"})
		return
	}
	if !customTopUpAmountValid(c, req.Amount) {
		return
	}
	group := user.Group

	money := getPlategalPayMoney(req.Amount, group)
	if !customTopUpMoneyValid(c, money) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    fmt.Sprintf("%.2f", money),
	})
}

// ─── Pay ────────────────────────────────────────────────────────────────────

type PlategalPayRequest struct {
	Amount    int64  `json:"amount"`
	SubMethod string `json:"sub_method"`
}

type plategalCreateTxRequest struct {
	PaymentMethod  int `json:"paymentMethod"`
	PaymentDetails struct {
		Amount   float64 `json:"amount"`
		Currency string  `json:"currency"`
	} `json:"paymentDetails"`
	Description string `json:"description"`
	Return      string `json:"return"`
	FailedURL   string `json:"failedUrl"`
	Payload     string `json:"payload"`
}

type plategalCreateTxResponse struct {
	TransactionId string  `json:"transactionId"`
	Status        string  `json:"status"`
	URL           string  `json:"url"`
	Redirect      string  `json:"redirect"`
	ExpiresIn     string  `json:"expiresIn"`
	Rate          float64 `json:"rate"`
}

func createPlategalTransaction(tradeNo string, amountRUB float64, paymentType int) (string, error) {
	if setting.PlategalMerchantId == "" || setting.PlategalApiSecret == "" {
		return "", fmt.Errorf("Platega MerchantId или ApiSecret не настроены")
	}

	serverAddress := strings.TrimRight(system_setting.ServerAddress, "/")
	successURL := serverAddress + "/wallet"
	failURL := serverAddress + "/wallet"

	reqBody := plategalCreateTxRequest{
		PaymentMethod: paymentType,
		Description:   "Пополнение баланса APINET",
		Return:        successURL,
		FailedURL:     failURL,
		Payload:       tradeNo,
	}
	reqBody.PaymentDetails.Amount = amountRUB
	reqBody.PaymentDetails.Currency = "RUB"

	bodyBytes, err := common.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal error: %v", err)
	}

	req, err := http.NewRequest("POST", plategalAPIBase+"/transaction/process", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create request error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MerchantId", setting.PlategalMerchantId)
	req.Header.Set("X-Secret", setting.PlategalApiSecret)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request error: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response error: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Platega API вернул статус %d: %s", resp.StatusCode, string(respBody))
	}

	var txResp plategalCreateTxResponse
	if err := common.Unmarshal(respBody, &txResp); err != nil {
		return "", fmt.Errorf("parse response error: %v (body: %s)", err, string(respBody))
	}

	payURL := txResp.Redirect
	if payURL == "" {
		payURL = txResp.URL
	}
	if payURL == "" || txResp.TransactionId == "" {
		return "", fmt.Errorf("Platega API вернул пустой url (body: %s)", string(respBody))
	}

	result := model.DB.Model(&model.TopUp{}).Where("trade_no = ? AND payment_provider = ?", tradeNo, model.PaymentProviderPlategal).
		Update("provider_reference", txResp.TransactionId)
	if result.Error != nil {
		return "", result.Error
	}
	if result.RowsAffected != 1 {
		return "", fmt.Errorf("Platega order not found")
	}
	return payURL, nil
}

func RequestPlategalPay(c *gin.Context) {
	if !isPlategalTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Platega не настроена"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "read error"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega запрос оплаты user_id=%d body=%q", c.GetInt("id"), string(bodyBytes)))
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	var req PlategalPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if !customTopUpAmountValid(c, req.Amount) {
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "User not found"})
		return
	}

	ref := fmt.Sprintf("plategal-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(6))
	tradeNo := "ptg_" + common.Sha1([]byte(ref))

	money := getPlategalPayMoney(req.Amount, user.Group)
	if !customTopUpMoneyValid(c, money) {
		return
	}
	minTopup := getPlategalMinTopup()
	if money < float64(minTopup) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("Минимальная сумма пополнения %d рублей", minTopup)})
		return
	}

	payMethod := req.SubMethod
	if payMethod == "" {
		payMethod = model.PaymentMethodPlategal
	}
	plategalTypeMap := map[string]int{
		"":                              2,
		model.PaymentMethodPlategal:     2,
		model.PaymentMethodPlategalSBP:  2,
		model.PaymentMethodPlategalCard: 11,
		model.PaymentMethodPlategalIntl: 12,
	}
	plategalType, ok := plategalTypeMap[req.SubMethod]
	if !ok {
		c.JSON(200, gin.H{"message": "error", "data": "Unsupported payment method"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   payMethod,
		PaymentProvider: model.PaymentProviderPlategal,
		PaymentCurrency: "RUB",
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega создание заказа не удалось user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	payURL, err := createPlategalTransaction(tradeNo, money, plategalType)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega создание транзакции не удалось user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败: " + err.Error()})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega заказ создан user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, money))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payURL,
			"order_id": tradeNo,
		},
	})
}

// ─── Webhook ────────────────────────────────────────────────────────────────

type plategalCallbackPayload struct {
	Id            string  `json:"id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	PaymentMethod int     `json:"paymentMethod"`
	Payload       string  `json:"payload"`
}

func PlategalWebhook(c *gin.Context) {
	if !isPlategalWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega webhook отклонён reason=disabled client_ip=%s", c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	merchantId := c.GetHeader("X-MerchantId")
	apiSecret := c.GetHeader("X-Secret")

	if subtle.ConstantTimeCompare([]byte(merchantId), []byte(setting.PlategalMerchantId)) != 1 ||
		subtle.ConstantTimeCompare([]byte(apiSecret), []byte(setting.PlategalApiSecret)) != 1 {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega webhook неверная аутентификация client_ip=%s", c.ClientIP()))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega webhook чтение тела ошибка error=%q", err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var payload plategalCallbackPayload
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega webhook парсинг JSON ошибка body=%q error=%q", string(bodyBytes), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega webhook получен id=%s status=%s amount=%.2f payload=%s client_ip=%s",
		payload.Id, payload.Status, payload.Amount, payload.Payload, c.ClientIP()))

	if payload.Status != "CONFIRMED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega webhook статус не CONFIRMED, пропускаем id=%s status=%s", payload.Id, payload.Status))
		c.Status(http.StatusOK)
		return
	}

	if payload.Id == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Official callbacks carry only the provider ID, not our payload.
	// New orders bind it at creation. For legacy orders (or a callback
	// racing order creation), recover the payload through authenticated API.
	var bound model.TopUp
	var tradeNo string
	verifiedTransaction := false
	lookup := model.DB.Where("provider_reference = ? AND payment_provider = ?", payload.Id, model.PaymentProviderPlategal).First(&bound)
	if lookup.Error == nil {
		tradeNo = bound.TradeNo
	} else {
		tradeNo, err = resolvePlategalOrder(c.Request.Context(), payload)
		if err != nil {
			c.AbortWithStatus(http.StatusBadGateway)
			return
		}
		verifiedTransaction = true
	}
	if payload.Payload != "" && payload.Payload != tradeNo {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega webhook заказ не найден trade_no=%s", tradeNo))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	expectedMoney := topUp.Money
	if verifiedTransaction && topUp.PaymentCurrency == "" && topUp.ProviderReference == "" {
		// Before currency/reference snapshots were added, creation sent
		// int(amountRUB) but persisted the fractional quote. Honor the actual
		// historical bill only after authenticated transaction recovery.
		expectedMoney = decimal.NewFromFloat(topUp.Money).Truncate(0).InexactFloat64()
	}
	if topUp.PaymentProvider != model.PaymentProviderPlategal ||
		(topUp.ProviderReference != "" && topUp.ProviderReference != payload.Id) ||
		payload.Currency != paymentCurrency(topUp, "RUB") ||
		!paymentMoneyMatches(fmt.Sprint(payload.Amount), expectedMoney, 2) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if err := model.RechargePlategal(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega webhook начисление не удалось trade_no=%s error=%q", tradeNo, err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega оплата успешна trade_no=%s quota=%d money=%.2f client_ip=%s", tradeNo, topUp.Amount, topUp.Money, c.ClientIP()))
	c.Status(http.StatusOK)
}

func resolvePlategalOrder(ctx context.Context, callback plategalCallbackPayload) (string, error) {
	// Limit IDs before placing them into an API path.
	for _, r := range callback.Id {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-') {
			return "", fmt.Errorf("invalid transaction ID")
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, plategalAPIBase+"/transaction/"+callback.Id, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-MerchantId", setting.PlategalMerchantId)
	req.Header.Set("X-Secret", setting.PlategalApiSecret)
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("transaction lookup failed: %d", resp.StatusCode)
	}
	var status struct {
		ID             string `json:"id"`
		Status         string `json:"status"`
		Payload        string `json:"payload"`
		PaymentDetails struct {
			Amount   float64 `json:"amount"`
			Currency string  `json:"currency"`
		} `json:"paymentDetails"`
	}
	if err := common.DecodeJson(io.LimitReader(resp.Body, 1<<20), &status); err != nil {
		return "", err
	}
	if status.ID != callback.Id || status.Status != "CONFIRMED" || status.Payload == "" ||
		status.PaymentDetails.Currency != callback.Currency ||
		status.PaymentDetails.Amount != callback.Amount {
		return "", fmt.Errorf("transaction lookup does not match callback")
	}
	return status.Payload, nil
}
