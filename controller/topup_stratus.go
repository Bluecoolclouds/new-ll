package controller

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// This read-only adapter describes the existing payment contracts. It never
// creates orders, calls a provider, changes tariffs, or credits an account.
type stratusPaymentMethod struct {
	ID             string        `json:"id"`
	QuantityKind   string        `json:"quantity_kind,omitempty"`
	Name           string        `json:"name"`
	MinUSD         int64         `json:"min_usd"`
	MaxUSD         int64         `json:"max_usd"`
	AmountOptions  []int64       `json:"amount_options"`
	Product        *CreemProduct `json:"product,omitempty"`
	Notice         string        `json:"notice,omitempty"`
	DisabledReason string        `json:"disabled_reason,omitempty"`
	MinAmountRUB   int64         `json:"min_amount_rub,omitempty"`
	path           string
	payload        gin.H
	factor         int64
	minMoney       float64
	minExclusive   bool
	currency       string
	price          func(int64, string) float64
	credit         func(int64, string) int64
}

func stratusPaymentMethods() []stratusPaymentMethod {
	methods := make([]stratusPaymentMethod, 0)
	unit := int64(common.QuotaPerUnit)
	if unit <= 0 || float64(unit) != common.QuotaPerUnit {
		return methods
	}
	factor := int64(1)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		factor = unit
	}
	credit := func(usd int64, _ string) int64 { return usd * unit }
	add := func(id, name, path, currency string, minimum, maximum, f int64, minMoney float64, price func(int64, string) float64) {
		minimum = max(1, int64(math.Ceil(float64(minimum)/float64(f))))
		maximum = min(maximum/f, int64(9007199254740991)/unit)
		options := make([]int64, 0)
		for _, option := range operation_setting.GetPaymentSetting().AmountOptions {
			if int64(option)%f == 0 && int64(option)/f >= minimum && int64(option)/f <= maximum {
				options = append(options, int64(option)/f)
			}
		}
		methods = append(methods, stratusPaymentMethod{
			ID: id, Name: name, MinUSD: minimum, MaxUSD: maximum, AmountOptions: options,
			path: path, payload: gin.H{"payment_method": id}, factor: f,
			minMoney: minMoney, currency: currency, price: price, credit: credit,
		})
		if minimum > maximum {
			methods[len(methods)-1].DisabledReason = "Минимум превышает допустимый максимум действующего платёжного API."
		}
		methods[len(methods)-1].minExclusive = id == "waffo_pancake" || strings.HasPrefix(id, "waffo:")
	}
	// A whole internal USD avoids truncation when legacy TOKENS handlers divide
	// the incoming integer quota and persist only whole USD in TopUp.Amount.
	const unlimited = int64(9007199254740991)
	if isEpayTopUpEnabled() {
		for _, method := range operation_setting.PayMethods {
			if method["type"] != "" && method["type"] != "stripe" && method["type"] != "waffo" && method["type"] != "waffo_pancake" {
				add(method["type"], method["name"], "/api/user/pay", "CNY", getMinTopup(), unlimited, factor, 0.01, getPayMoney)
			}
		}
	}
	if isStripeTopUpEnabled() {
		// Stripe checkout uses raw amount as PriceId quantity, even in TOKENS
		// display mode. Do not normalize it or pretend its external price is known.
		add("stripe", "Stripe", "/api/user/stripe/pay", "", getStripeMinTopup(), 10000, 1, 0, func(n int64, g string) float64 {
			return getStripePayMoney(float64(n), g)
		})
		m := &methods[len(methods)-1]
		m.Notice = "Цена и валюта Stripe, включая промокоды, подтверждаются на странице оплаты."
		m.credit = func(n int64, group string) int64 {
			return int64(GetChargedAmount(float64(n), model.User{Group: group}) * common.QuotaPerUnit)
		}
	}
	if isFreeKassaTopUpEnabled() {
		currency := setting.FreeKassaCurrency
		if currency == "" {
			currency = "RUB"
		}
		for _, variant := range []struct {
			id, name string
			enabled  bool
		}{
			{"freekassa", "FreeKassa · СБП", setting.FreeKassaEnableSBP},
			{"freekassa_card", "FreeKassa · Карта", setting.FreeKassaEnableCard},
			{"freekassa_crypto", "FreeKassa · Криптовалюта", setting.FreeKassaEnableCrypto},
			{"freekassa_id32", "FreeKassa · " + setting.FreeKassaID32Name, setting.FreeKassaEnableID32},
		} {
			if variant.enabled {
				add(variant.id, variant.name, "/api/user/freekassa/pay", currency, getFreeKassaMinTopup(), unlimited, factor, float64(setting.FreeKassaMinTopUp), getFreeKassaPayMoney)
				if reason := freeKassaMethodDisabledReason(variant.id); reason != "" {
					methods[len(methods)-1].DisabledReason = reason
				}
			}
		}
	}
	if isHeleketTopUpEnabled() {
		currency := setting.HeleketCurrency
		if currency == "" {
			currency = "USD"
		}
		add("heleket", "Heleket", "/api/user/heleket/pay", currency, getHeleketMinTopup(), unlimited, 1, 0, getHeleketPayMoney)
	}
	if isPallyTopUpEnabled() {
		add("pally", "Pally", "/api/user/pally/pay", "RUB", 1, unlimited, 1, float64(getPallyMinTopup()), getPallyPayMoney)
	}
	if isPlategalTopUpEnabled() {
		for _, variant := range []struct{ id, name string }{
			{"plategal_sbp", "Platega · СБП"}, {"plategal_card", "Platega · Карта"}, {"plategal_intl", "Platega · Международная карта"},
		} {
			add(variant.id, variant.name, "/api/user/plategal/pay", "RUB", 1, unlimited, 1, float64(getPlategalMinTopup()), getPlategalPayMoney)
			methods[len(methods)-1].payload = gin.H{"payment_method": "plategal", "sub_method": variant.id}
		}
	}
	if isWaffoTopUpEnabled() {
		for index, method := range setting.GetWaffoPayMethods() {
			add("waffo:"+strconv.Itoa(index), "Waffo · "+method.Name, "/api/user/waffo/pay", getWaffoCurrency(), int64(setting.WaffoMinTopUp), unlimited, factor, 0.01, func(n int64, g string) float64 {
				return getWaffoPayMoney(float64(n), g)
			})
			methods[len(methods)-1].payload = gin.H{"pay_method_index": index}
		}
	}
	if isWaffoPancakeTopUpEnabled() {
		add("waffo_pancake", "Waffo Pancake", "/api/user/waffo-pancake/pay", "USD", int64(setting.WaffoPancakeMinTopUp), unlimited, factor, 0.01, getWaffoPancakePayMoney)
	}
	if isCreemTopUpEnabled() {
		var products []CreemProduct
		if common.UnmarshalJsonStr(setting.CreemProducts, &products) == nil {
			for _, product := range products {
				if product.ProductId == "" || product.Quota <= 0 || product.Price <= 0 {
					continue
				}
				p := product
				methods = append(methods, stratusPaymentMethod{
					ID: "creem:" + p.ProductId, Name: "Creem · " + p.Name,
					MinUSD: 1, MaxUSD: 1, AmountOptions: []int64{}, Product: &p,
					path: "/api/user/creem/pay", payload: gin.H{"product_id": p.ProductId, "payment_method": "creem"},
					currency: p.Currency, price: func(_ int64, _ string) float64 { return p.Price },
					credit: func(_ int64, _ string) int64 { return p.Quota },
				})
				if !isCreemWebhookEnabled() {
					methods[len(methods)-1].DisabledReason = "Уведомления Creem не настроены. Оплата недоступна до настройки подтверждения и начисления."
				}
			}
		}
	}
	return methods
}

func GetStratusTopUpInfo(c *gin.Context) {
	methods := append([]stratusPaymentMethod{}, stratusPackMethods()...)
	methods = append(methods, stratusPaymentMethods()...)
	common.ApiSuccess(c, gin.H{
		"methods": methods, "redemption": isPaymentComplianceConfirmed(), "topup_link": common.TopUpLink,
	})
}

type stratusTopUpQuoteRequest struct {
	Method    string `json:"method"`
	USD       int64  `json:"usd"`
	Packs     int64  `json:"packs"`
	AmountRUB int64  `json:"amount_rub"`
}

func stratusTopUpQuote(req stratusTopUpQuoteRequest, group string) (gin.H, error) {
	if strings.HasPrefix(req.Method, "packs:") {
		if req.AmountRUB != 0 {
			if req.USD != 0 || req.Packs != 0 {
				return nil, fmt.Errorf("Для расчёта суммы передавайте только amount_rub.")
			}
			quote, _, err := stratusRubAmountQuote(req.Method, req.AmountRUB, group)
			return quote, err
		}
		if req.USD != 0 {
			return nil, fmt.Errorf("Для пакетов передавайте количество packs, а не USD.")
		}
		quote, _, err := stratusPackQuote(req.Method, req.Packs, group)
		return quote, err
	}
	if req.Packs != 0 || req.AmountRUB != 0 {
		return nil, fmt.Errorf("Этот способ оплаты не поддерживает пакеты или сумму в RUB.")
	}
	for _, method := range stratusPaymentMethods() {
		if method.ID != req.Method {
			continue
		}
		if method.DisabledReason != "" {
			return nil, fmt.Errorf("%s", method.DisabledReason)
		}
		if req.USD < method.MinUSD || req.USD > method.MaxUSD {
			return nil, fmt.Errorf("Допустима целая сумма от %d до %d внутренних USD. Этот способ может быть недоступен при текущих настройках.", method.MinUSD, method.MaxUSD)
		}
		amount := req.USD * method.factor
		money := method.price(amount, group)
		if !math.IsNaN(money) && !math.IsInf(money, 0) && money > 0 && (money > method.minMoney || money == method.minMoney && !method.minExclusive) {
			payload := method.payload
			if method.Product == nil {
				payload["amount"] = amount
			}
			quota := method.credit(req.USD, group)
			if quota <= 0 || quota > 9007199254740991 {
				return nil, fmt.Errorf("Начисление выходит за допустимый диапазон.")
			}
			formatted := decimal.NewFromFloat(money).StringFixed(2)
			if strings.HasPrefix(method.ID, "waffo:") {
				formatted = formatWaffoAmount(money, method.currency)
			}
			// Stripe's PriceId and checkout promotions are external; never
			// label the local display estimate as an exact payable total.
			return gin.H{
				"money": formatted, "currency": method.currency, "credited_quota": quota,
				"pay_path": method.path, "payload": payload, "notice": method.Notice,
			}, nil
		}
		return nil, fmt.Errorf("Сумма ниже минимума платёжного способа или цена некорректна. Увеличьте сумму. Минимум оплаты: %g %s.", method.minMoney, method.currency)
	}
	return nil, fmt.Errorf("Способ оплаты недоступен. Обновите список.")
}

func GetStratusTopUpQuote(c *gin.Context) {
	var req stratusTopUpQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Введите целую сумму внутренних USD."})
		return
	}
	group, err := model.GetUserGroup(c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quote, err := stratusTopUpQuote(req, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, quote)
}
