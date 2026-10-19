package controller

import (
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// This is a separate purchase contract. Legacy unit prices, amount units and
// pending orders remain untouched; neither USD fractions nor wallet tokens are
// passed to the old int64-USD payment APIs.
const stratusPackNotice = "Базовая цена — 11,57 ₽ за 1 млн токенов. Бонус плавно растёт с 0% на 100 ₽ до 50% на 25 000 ₽; при сумме выше 25 000 ₽ составляет 70%. Сервер закрепляет сумму зачисления в заказе."

func stratusPackMethods() []stratusPaymentMethod {
	var result []stratusPaymentMethod
	for _, legacy := range stratusPaymentMethods() {
		id := legacy.ID
		if !(strings.HasPrefix(id, "freekassa") || id == "heleket" || id == "pally" || strings.HasPrefix(id, "plategal_")) {
			continue
		}
		if legacy.path != "/api/user/freekassa/pay" && legacy.path != "/api/user/heleket/pay" &&
			legacy.path != "/api/user/pally/pay" && legacy.path != "/api/user/plategal/pay" {
			continue
		}
		// An Epay method name alone must not enable a custom provider.
		if strings.HasPrefix(id, "freekassa") && !isFreeKassaTopUpEnabled() ||
			id == "heleket" && !isHeleketTopUpEnabled() ||
			id == "pally" && !isPallyTopUpEnabled() ||
			strings.HasPrefix(id, "plategal_") && !isPlategalTopUpEnabled() {
			continue
		}
		m := legacy
		m.ID, m.Name, m.QuantityKind = "packs:"+id, legacy.Name+" · пакеты токенов", "packs"
		m.Notice = stratusPackNotice
		m.AmountOptions = []int64{}
		m.MinUSD, m.MaxUSD = 1, model.StratusMaxPacks
		if m.currency != "RUB" && m.currency != "USD" {
			m.DisabledReason = "Точные пакеты поддерживают только счета в RUB или USD. Прежний способ оплаты остаётся доступен отдельно."
		}
		minimum := m.minMoney
		unitPrice := 11.57
		if m.currency == "USD" {
			unitPrice = 0.13
		}
		if id == "heleket" {
			// Its existing minimum is denominated in internal USD.
			minimum = float64(getHeleketMinTopup())
		}
		m.minMoney = minimum
		m.MinUSD = max(1, int64(math.Ceil(minimum/unitPrice)))
		m.MinAmountRUB = stratusMethodMinAmountRUB(m)
		if common.QuotaPerUnit != 500000 {
			m.DisabledReason = "Для точных пакетов требуется 500000 единиц квоты на внутренний USD."
		}
		result = append(result, m)
	}
	return result
}

func stratusPackQuote(methodID string, packs int64, group string) (gin.H, *stratusPaymentMethod, error) {
	for _, method := range stratusPackMethods() {
		if method.ID != methodID {
			continue
		}
		if method.DisabledReason != "" {
			return nil, nil, fmt.Errorf("%s", method.DisabledReason)
		}
		if packs <= 0 || packs > model.StratusMaxPacks {
			return nil, nil, fmt.Errorf("Количество пакетов должно быть целым числом от 1 до %d.", model.StratusMaxPacks)
		}
		ratio := common.GetTopupGroupRatio(group)
		if ratio == 0 {
			ratio = 1 // existing payment group convention
		}
		if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
			return nil, nil, fmt.Errorf("Некорректный коэффициент группы.")
		}
		cents := int64(1157)
		if method.currency == "USD" {
			cents = 13
		}
		money := decimal.NewFromInt(packs).Mul(decimal.NewFromInt(cents)).
			Div(decimal.NewFromInt(100)).Mul(decimal.NewFromFloat(ratio)).Round(2)
		if !money.IsPositive() || money.LessThan(decimal.NewFromFloat(method.minMoney)) ||
			money.Mul(decimal.NewFromInt(100)).GreaterThan(decimal.NewFromInt(9007199254740991)) {
			return nil, nil, fmt.Errorf("Сумма вне допустимого диапазона. Минимум провайдера: %g %s. Увеличьте количество пакетов.", method.minMoney, method.currency)
		}
		formatted := money.StringFixed(2)
		actualRUB := money
		if method.currency == "USD" {
			actualRUB = money.Mul(decimal.NewFromInt(stratusUSDToRUB))
		}
		bonus := stratusTokenBonusPercent(actualRUB)
		quotaDecimal := decimal.NewFromInt(packs * model.StratusPackQuota).
			Mul(decimal.NewFromInt(100).Add(bonus).Div(decimal.NewFromInt(100))).Truncate(0)
		if !quotaDecimal.IsPositive() || quotaDecimal.GreaterThan(stratusSafeInteger) {
			return nil, nil, fmt.Errorf("Начисление выходит за допустимый диапазон.")
		}
		quota := quotaDecimal.IntPart()
		summary := stratusBonusSummary(actualRUB, quota)
		return gin.H{
			"money": formatted, "currency": method.currency, "credited_quota": quota,
			"pay_path": "/api/user/topup/stratus/pay", "notice": method.Notice,
			"payment_rub":        actualRUB.InexactFloat64(),
			"bonus_percent":      summary["bonus_percent"],
			"equivalent_rub":     summary["equivalent_rub"],
			"effective_rate_rub": summary["effective_rate_rub"],
			"payload":            gin.H{"method": methodID, "packs": packs, "expected_money": formatted, "expected_currency": method.currency, "expected_quota": quota},
		}, &method, nil
	}
	return nil, nil, fmt.Errorf("Способ покупки пакетов недоступен. Обновите список.")
}

type stratusPackPayRequest struct {
	Method           string `json:"method"`
	Packs            int64  `json:"packs"`
	AmountRUB        int64  `json:"amount_rub"`
	ExpectedMoney    string `json:"expected_money"`
	ExpectedCurrency string `json:"expected_currency"`
	ExpectedQuota    int64  `json:"expected_quota"`
}

func RequestStratusPackPay(c *gin.Context) {
	fail := func(err error) { c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()}) }
	var req stratusPackPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(fmt.Errorf("Некорректные параметры пакета."))
		return
	}
	user, err := model.GetUserById(c.GetInt("id"), false)
	if err != nil || user == nil {
		fail(fmt.Errorf("Не удалось получить пользователя."))
		return
	}
	var quote gin.H
	var method *stratusPaymentMethod
	if req.AmountRUB != 0 {
		if req.Packs != 0 || req.AmountRUB < 0 {
			fail(fmt.Errorf("Передайте только положительную сумму amount_rub."))
			return
		}
		quote, method, err = stratusRubAmountQuote(req.Method, req.AmountRUB, user.Group)
	} else {
		quote, method, err = stratusPackQuote(req.Method, req.Packs, user.Group)
	}
	if err != nil {
		fail(err)
		return
	}
	if req.ExpectedMoney != quote["money"] || req.ExpectedCurrency != quote["currency"] || req.ExpectedQuota != quote["credited_quota"] {
		fail(fmt.Errorf("Условия оплаты изменились. Обновите расчёт и подтвердите оплату ещё раз."))
		return
	}
	money, _ := strconv.ParseFloat(quote["money"].(string), 64)
	id := strings.TrimPrefix(method.ID, "packs:")
	provider := id
	if strings.HasPrefix(id, "freekassa") {
		provider = model.PaymentProviderFreeKassa
	} else if strings.HasPrefix(id, "plategal_") {
		provider = model.PaymentProviderPlategal
	}
	order := &model.TopUp{
		UserId: user.Id, WalletPacks: req.Packs, WalletQuota: req.ExpectedQuota,
		Money: money, TradeNo: "pack_" + common.GetUUID(),
		PaymentMethod: id, PaymentProvider: provider, PaymentCurrency: method.currency,
		CreateTime: common.GetTimestamp(), Status: common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		fail(fmt.Errorf("Не удалось сохранить заказ."))
		return
	}
	var link string
	switch provider {
	case model.PaymentProviderFreeKassa:
		link, err = stratusFreeKassaCheckout(c, user, order)
	case model.PaymentProviderHeleket:
		link, err = createHeleketInvoice(c.Request.Context(), order.TradeNo, money)
	case model.PaymentProviderPally:
		link, err = createPallyBill(order.TradeNo, money)
	case model.PaymentProviderPlategal:
		paymentType := map[string]int{"plategal_sbp": 2, "plategal_card": 11, "plategal_intl": 12}[id]
		link, err = createPlategalTransaction(order.TradeNo, money, paymentType)
	}
	if err != nil || link == "" {
		// A timeout may have created an invoice upstream. Leave it pending so
		// an authenticated late notification can still credit exactly once.
		fail(fmt.Errorf("Не удалось получить ссылку оплаты. Проверьте историю заказов перед повтором."))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_link": link}})
}

func stratusFreeKassaCheckout(c *gin.Context, user *model.User, order *model.TopUp) (string, error) {
	amount := decimal.NewFromFloat(order.Money).StringFixed(2)
	systemID := resolvePaymentSystemId(order.PaymentMethod)
	if usesFreeKassaAPI(systemID) {
		shopID, _ := strconv.Atoi(setting.FreeKassaMerchantId)
		paymentID, _ := strconv.Atoi(systemID)
		email := getFreeKassaUserEmail(user)
		if email == "" {
			email = fmt.Sprintf("user%d@noemail.local", user.Id)
		}
		return requestFreeKassaPayViaAPI(c, shopID, setting.FreeKassaApiKey, paymentID, email, c.ClientIP(), amount, order.PaymentCurrency, order.TradeNo)
	}
	params := url.Values{
		"m": {setting.FreeKassaMerchantId}, "oa": {amount}, "currency": {order.PaymentCurrency},
		"o": {order.TradeNo}, "lang": {"ru"},
		"s": {freeKassaSign1(setting.FreeKassaMerchantId, amount, setting.FreeKassaSecretWord1, order.PaymentCurrency, order.TradeNo)},
	}
	if systemID != "" {
		params.Set("i", systemID)
	}
	if email := getFreeKassaUserEmail(user); email != "" {
		params.Set("em", email)
	}
	if setting.FreeKassaReturnURL != "" {
		params.Set("success_url", strings.TrimRight(setting.FreeKassaReturnURL, "/")+"?status=success")
		params.Set("failure_url", strings.TrimRight(setting.FreeKassaReturnURL, "/")+"?status=failed")
	}
	return freeKassaPayURL + "?" + params.Encode(), nil
}
