package controller

import (
	"bytes"
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

const pallyAPIBase = "https://pal24.pro/api/v1/bill/create"

// pallySign computes the webhook/redirect signature.
// Formula: strtoupper(md5(OutSum + ":" + InvId + ":" + apiToken))
func pallySign(outSum, invId, apiToken string) string {
	raw := outSum + ":" + invId + ":" + apiToken
	hash := md5.Sum([]byte(raw))
	return strings.ToUpper(fmt.Sprintf("%x", hash))
}

// ─── Amount ────────────────────────────────────────────────────────────────

func getPallyMinTopup() int64 {
	minTopup := setting.PallyMinTopUp
	if minTopup <= 0 {
		minTopup = 50
	}
	return int64(minTopup)
}

const pallyQuotaPerDollar = int64(500000)

func getPallyPayMoney(amount int64, group string) float64 {
	// amount is USD dollars; unitPrice is RUB per credit; 1 USD = 500 000 credits
	dAmount := decimal.NewFromInt(amount).Mul(decimal.NewFromInt(pallyQuotaPerDollar))

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	unitPrice := setting.PallyUnitPrice
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

func RequestPallyAmount(c *gin.Context) {
	if !isPallyTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Pally не настроен"})
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
	if err != nil || user == nil || !customTopUpAmountValid(c, req.Amount) {
		if user == nil {
			c.JSON(200, gin.H{"message": "error", "data": "User not found"})
		}
		return
	}
	group := user.Group

	money := getPallyPayMoney(req.Amount, group)
	if !customTopUpMoneyValid(c, money) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    fmt.Sprintf("%.2f", money),
	})
}

// ─── Pay ───────────────────────────────────────────────────────────────────

type PallyPayRequest struct {
	Amount int64 `json:"amount"`
}

type pallyCreateBillResponse struct {
	Success     interface{} `json:"success"`
	LinkURL     string      `json:"link_url"`
	LinkPageURL string      `json:"link_page_url"`
	BillID      string      `json:"bill_id"`
}

func createPallyBill(orderID string, amountRUB float64) (string, error) {
	if setting.PallyApiToken == "" || setting.PallyShopID == "" {
		return "", fmt.Errorf("Pally API Token или Shop ID не настроены")
	}

	serverAddress := strings.TrimRight(system_setting.ServerAddress, "/")
	successURL := serverAddress + "/wallet"
	failURL := serverAddress + "/wallet"

	formData := url.Values{}
	formData.Set("amount", fmt.Sprintf("%.2f", amountRUB))
	formData.Set("shop_id", setting.PallyShopID)
	formData.Set("order_id", orderID)
	formData.Set("currency_in", "RUB")
	formData.Set("type", "normal")
	formData.Set("name", "Пополнение APINET")
	formData.Set("description", "Пополнение баланса APINET")
	formData.Set("success_url", successURL)
	formData.Set("fail_url", failURL)
	formData.Set("custom", orderID)

	req, err := http.NewRequest("POST", pallyAPIBase, bytes.NewBufferString(formData.Encode()))
	if err != nil {
		return "", fmt.Errorf("create request error: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+setting.PallyApiToken)

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
		return "", fmt.Errorf("Pally API вернул статус %d: %s", resp.StatusCode, string(respBody))
	}

	var billResp pallyCreateBillResponse
	if err := common.Unmarshal(respBody, &billResp); err != nil {
		return "", fmt.Errorf("parse response error: %v (body: %s)", err, string(respBody))
	}

	if billResp.LinkPageURL == "" {
		return "", fmt.Errorf("Pally API вернул пустой link_page_url (body: %s)", string(respBody))
	}

	return billResp.LinkPageURL, nil
}

func RequestPallyPay(c *gin.Context) {
	if !isPallyTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Pally не настроен"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "read error"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Pally запрос оплаты user_id=%d body=%q", c.GetInt("id"), string(bodyBytes)))
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	var req PallyPayRequest
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

	ref := fmt.Sprintf("pally-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(6))
	tradeNo := "pl_" + common.Sha1([]byte(ref))

	money := getPallyPayMoney(req.Amount, user.Group)
	if !customTopUpMoneyValid(c, money) {
		return
	}
	minTopup := getPallyMinTopup()
	if money < float64(minTopup) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("Минимальная сумма пополнения %d рублей", minTopup)})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodPally,
		PaymentProvider: model.PaymentProviderPally,
		PaymentCurrency: "RUB",
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Pally создание заказа не удалось user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	payURL, err := createPallyBill(tradeNo, money)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Pally создание счёта не удалось user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败: " + err.Error()})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Pally заказ создан user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, money))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payURL,
			"order_id": tradeNo,
		},
	})
}

// ─── Webhook (Result URL postback) ─────────────────────────────────────────

func PallyWebhook(c *gin.Context) {
	if !isPallyWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Pally webhook отклонён reason=disabled client_ip=%s", c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Pally webhook парсинг формы ошибка error=%q", err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	status := c.Request.FormValue("Status")
	invId := c.Request.FormValue("InvId")
	outSum := c.Request.FormValue("OutSum")
	signatureValue := c.Request.FormValue("SignatureValue")

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Pally webhook получен Status=%s InvId=%s OutSum=%s client_ip=%s", status, invId, outSum, c.ClientIP()))

	// Verify signature
	expectedSign := pallySign(outSum, invId, setting.PallyApiToken)
	if !paymentSignatureEqual(expectedSign, signatureValue) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Pally webhook invalid signature InvId=%s", invId))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	if status != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Pally webhook статус не SUCCESS, пропускаем InvId=%s status=%s", invId, status))
		c.Status(http.StatusOK)
		return
	}

	tradeNo := invId
	if tradeNo == "" {
		logger.LogWarn(c.Request.Context(), "Pally webhook пустой InvId")
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Pally webhook заказ не найден trade_no=%s", tradeNo))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderPally || !paymentMoneyMatches(outSum, topUp.Money, 2) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if err := model.RechargePally(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Pally webhook начисление не удалось trade_no=%s error=%q", tradeNo, err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Pally оплата успешна trade_no=%s quota=%d money=%.2f client_ip=%s", tradeNo, topUp.Amount, topUp.Money, c.ClientIP()))
	c.Status(http.StatusOK)
}
