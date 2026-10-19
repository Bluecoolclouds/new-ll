package controller

import "github.com/QuantumNous/new-api/setting/operation_setting"

func getAmountDiscount(amount int) float64 {
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[amount]; ok {
		return ds
	}
	return 1.0
}
