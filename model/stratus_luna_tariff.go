package model

import (
	"errors"
	"fmt"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const stratusLunaModel = "gpt-5.6-luna"
const stratusLunaTariffMarker = "stratus.luna_text_x1_applied"

// ApplyApprovedStratusLunaTariff runs before options are loaded into memory.
// Only the explicitly approved Luna tariff is changed, once per database.
func ApplyApprovedStratusLunaTariff(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		marker := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{
			Key: stratusLunaTariffMarker, Value: "true",
		})
		if marker.Error != nil {
			return marker.Error
		}
		if marker.RowsAffected == 0 {
			return nil
		}
		if info := ratio_setting.GetCompletionRatioInfo(stratusLunaModel); info.Locked {
			return fmt.Errorf("cannot apply Luna x1: completion ratio is locked")
		}
		quotaPerUnit, err := persistedLunaQuotaUnit(tx)
		if err != nil {
			return err
		}
		ratio := quotaPerUnit * 11 / 89 / 1_000_000
		if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
			return fmt.Errorf("cannot apply Luna x1: invalid quota unit")
		}
		if err := patchLunaOption(tx, "ModelRatio", ratio_setting.ModelRatio2JSONString(), func(values map[string]float64) {
			values[stratusLunaModel] = ratio
		}); err != nil {
			return err
		}
		if err := patchLunaOption(tx, "CompletionRatio", ratio_setting.CompletionRatio2JSONString(), func(values map[string]float64) {
			values[stratusLunaModel] = 1
		}); err != nil {
			return err
		}
		if err := patchLunaOption(tx, "ModelPrice", ratio_setting.ModelPrice2JSONString(), func(values map[string]float64) {
			delete(values, stratusLunaModel)
		}); err != nil {
			return err
		}
		return patchLunaOption(tx, "billing_setting.billing_mode", "{}", func(values map[string]string) {
			delete(values, stratusLunaModel)
		})
	})
}

func patchLunaOption[T any](tx *gorm.DB, key, fallback string, patch func(map[string]T)) error {
	values, err := readLunaOptionMap[T](tx, key, fallback)
	if err != nil {
		return err
	}
	patch(values)
	encoded, err := common.Marshal(values)
	if err != nil {
		return err
	}
	return tx.Save(&Option{Key: key, Value: string(encoded)}).Error
}

func readLunaOptionMap[T any](tx *gorm.DB, key, fallback string) (map[string]T, error) {
	option := Option{Key: key}
	err := tx.Where(&Option{Key: key}).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		option.Value = fallback
	} else if err != nil {
		return nil, err
	}
	values := make(map[string]T)
	if err := common.Unmarshal([]byte(option.Value), &values); err != nil {
		return nil, fmt.Errorf("cannot apply Luna x1: invalid %s: %w", key, err)
	}
	if values == nil {
		return nil, fmt.Errorf("cannot apply Luna x1: %s must be an object", key)
	}
	return values, nil
}

func validLunaQuotaUnit(value string) (float64, error) {
	unit, err := strconv.ParseFloat(value, 64)
	ratio := unit * 11 / 89 / 1_000_000
	if err != nil || math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
		return 0, fmt.Errorf("cannot preserve Luna x1: invalid QuotaPerUnit")
	}
	return unit, nil
}

func persistedLunaQuotaUnit(tx *gorm.DB) (float64, error) {
	var option Option
	err := tx.Where(&Option{Key: "QuotaPerUnit"}).Take(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return validLunaQuotaUnit(strconv.FormatFloat(common.QuotaPerUnit, 'g', -1, 64))
	}
	if err != nil {
		return 0, err
	}
	return validLunaQuotaUnit(option.Value)
}

// Keep a still-unmodified approved tariff stable when only accounting units
// change. Explicit tariff edits in the same save always take precedence.
func preserveLunaTariffOnUnitChange(tx *gorm.DB, values map[string]string) error {
	value, changingUnit := values["QuotaPerUnit"]
	if !changingUnit {
		return nil
	}
	newUnit, err := validLunaQuotaUnit(value)
	if err != nil {
		return err
	}
	for _, key := range []string{"ModelRatio", "CompletionRatio", "ModelPrice", "billing_setting.billing_mode", "billing_setting.billing_expr"} {
		if _, explicitTariffEdit := values[key]; explicitTariffEdit {
			return nil
		}
	}
	var marker Option
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(&Option{Key: stratusLunaTariffMarker}).Take(&marker).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	oldUnit, err := persistedLunaQuotaUnit(tx)
	if err != nil {
		return err
	}
	ratios, err := readLunaOptionMap[float64](tx, "ModelRatio", "{}")
	if err != nil {
		return err
	}
	if ratios[stratusLunaModel] != oldUnit*11/89/1_000_000 {
		return nil
	}
	completion, err := readLunaOptionMap[float64](tx, "CompletionRatio", "{}")
	if err != nil {
		return err
	}
	if completion[stratusLunaModel] != 1 {
		return nil
	}
	prices, err := readLunaOptionMap[float64](tx, "ModelPrice", "{}")
	if err != nil {
		return err
	}
	if _, fixedPrice := prices[stratusLunaModel]; fixedPrice {
		return nil
	}
	modes, err := readLunaOptionMap[string](tx, "billing_setting.billing_mode", "{}")
	if err != nil {
		return err
	}
	if mode := modes[stratusLunaModel]; mode != "" && mode != "ratio" {
		return nil
	}
	ratios[stratusLunaModel] = newUnit * 11 / 89 / 1_000_000
	encoded, err := common.Marshal(ratios)
	if err != nil {
		return err
	}
	values["ModelRatio"] = string(encoded)
	return nil
}
