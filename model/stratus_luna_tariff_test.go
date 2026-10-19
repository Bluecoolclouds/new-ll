package model

import (
	"path/filepath"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func lunaTariffTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "luna.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&Option{}))
	return db
}

func lunaOptionValue(t *testing.T, db *gorm.DB, key string) string {
	t.Helper()
	var option Option
	require.NoError(t, db.Where("key = ?", key).First(&option).Error)
	return option.Value
}

func TestApprovedLunaTariffPreservesOtherModelsAndBalances(t *testing.T) {
	db := lunaTariffTestDB(t)
	for key, value := range map[string]string{
		"ModelRatio":                   `{"gpt-5.6-luna":0.5,"other-model":3.25}`,
		"CompletionRatio":              `{"gpt-5.6-luna":6,"other-model":4}`,
		"ModelPrice":                   `{"gpt-5.6-luna":0.1,"fixed-model":0.2}`,
		"billing_setting.billing_mode": `{"gpt-5.6-luna":"tiered_expr","other-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"gpt-5.6-luna":"p*100","other-model":"p*3+c*12"}`,
		"CacheRatio":                   `{"gpt-5.6-luna":0.1}`,
		"GroupRatio":                   `{"default":1,"vip":0.8}`,
	} {
		require.NoError(t, db.Create(&Option{Key: key, Value: value}).Error)
	}
	require.NoError(t, db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY, quota INTEGER)").Error)
	require.NoError(t, db.Exec("INSERT INTO users (id, quota) VALUES (1, 123456789)").Error)
	require.NoError(t, ApplyApprovedStratusLunaTariff(db))
	var ratios map[string]float64
	require.NoError(t, common.Unmarshal([]byte(lunaOptionValue(t, db, "ModelRatio")), &ratios))
	require.InDelta(t, common.QuotaPerUnit*11/89/1_000_000, ratios[stratusLunaModel], 1e-15)
	require.Equal(t, 3.25, ratios["other-model"])
	require.JSONEq(t, `{"gpt-5.6-luna":1,"other-model":4}`, lunaOptionValue(t, db, "CompletionRatio"))
	require.JSONEq(t, `{"fixed-model":0.2}`, lunaOptionValue(t, db, "ModelPrice"))
	require.JSONEq(t, `{"other-model":"tiered_expr"}`, lunaOptionValue(t, db, "billing_setting.billing_mode"))
	require.JSONEq(t, `{"gpt-5.6-luna":"p*100","other-model":"p*3+c*12"}`, lunaOptionValue(t, db, "billing_setting.billing_expr"))
	require.JSONEq(t, `{"gpt-5.6-luna":0.1}`, lunaOptionValue(t, db, "CacheRatio"))
	require.JSONEq(t, `{"default":1,"vip":0.8}`, lunaOptionValue(t, db, "GroupRatio"))
	var quota int
	require.NoError(t, db.Raw("SELECT quota FROM users WHERE id = 1").Scan(&quota).Error)
	require.Equal(t, 123456789, quota)

	// A later administrator change must survive every subsequent startup.
	require.NoError(t, db.Model(&Option{}).Where("key = ?", "ModelRatio").Update("value", `{"gpt-5.6-luna":0.2}`).Error)
	require.NoError(t, ApplyApprovedStratusLunaTariff(db))
	require.JSONEq(t, `{"gpt-5.6-luna":0.2}`, lunaOptionValue(t, db, "ModelRatio"))
}

func TestApprovedLunaTariffRollsBackInvalidOptions(t *testing.T) {
	for _, invalid := range []string{`not-json`, `null`, `[]`} {
		t.Run(invalid, func(t *testing.T) {
			db := lunaTariffTestDB(t)
			require.NoError(t, db.Create(&Option{Key: "CompletionRatio", Value: invalid}).Error)
			require.Error(t, ApplyApprovedStratusLunaTariff(db))
			var count int64
			require.NoError(t, db.Model(&Option{}).Where("key IN ?", []string{stratusLunaTariffMarker, "ModelRatio"}).Count(&count).Error)
			require.Zero(t, count)
			require.Equal(t, invalid, lunaOptionValue(t, db, "CompletionRatio"))
		})
	}
}

func TestApprovedLunaTariffSeedsDefaultsOnlyWhenOptionsAreAbsent(t *testing.T) {
	ratio_setting.InitRatioSettings()
	db := lunaTariffTestDB(t)
	require.NoError(t, ApplyApprovedStratusLunaTariff(db))
	var ratios map[string]float64
	require.NoError(t, common.Unmarshal([]byte(lunaOptionValue(t, db, "ModelRatio")), &ratios))
	require.Equal(t, ratio_setting.GetDefaultModelRatioMap()["gpt-5.6-sol"], ratios["gpt-5.6-sol"])
	require.Greater(t, len(ratios), 10)
	require.Equal(t, "true", lunaOptionValue(t, db, stratusLunaTariffMarker))
}

func TestApprovedLunaTariffReadsPersistedQuotaUnit(t *testing.T) {
	for _, unit := range []float64{250_000, 1_000_000, 2_000_000} {
		t.Run(strconv.FormatFloat(unit, 'f', -1, 64), func(t *testing.T) {
			db := lunaTariffTestDB(t)
			require.NoError(t, db.Create(&Option{Key: "QuotaPerUnit", Value: strconv.FormatFloat(unit, 'f', -1, 64)}).Error)
			require.NoError(t, ApplyApprovedStratusLunaTariff(db))
			var ratios map[string]float64
			require.NoError(t, common.Unmarshal([]byte(lunaOptionValue(t, db, "ModelRatio")), &ratios))
			require.InDelta(t, unit*11/89/1_000_000, ratios[stratusLunaModel], 1e-15)
		})
	}
}

func TestApprovedLunaTariffRejectsInvalidPersistedQuotaUnit(t *testing.T) {
	for _, invalid := range []string{"0", "-1", "NaN", "+Inf", "1e999", "", "not-a-number"} {
		t.Run(invalid, func(t *testing.T) {
			db := lunaTariffTestDB(t)
			require.NoError(t, db.Create(&Option{Key: "QuotaPerUnit", Value: invalid}).Error)
			require.Error(t, ApplyApprovedStratusLunaTariff(db))
			var count int64
			require.NoError(t, db.Model(&Option{}).Where("key = ?", stratusLunaTariffMarker).Count(&count).Error)
			require.Zero(t, count)
		})
	}
}

func TestLunaQuotaUnitChangePreservesApprovedTariffButNotCustomEdits(t *testing.T) {
	for _, custom := range []string{"", "ModelRatio", "CompletionRatio", "ModelPrice", "billing_setting.billing_mode", "explicit-batch"} {
		t.Run(custom, func(t *testing.T) {
			db := lunaTariffTestDB(t)
			require.NoError(t, db.Create(&Option{Key: "QuotaPerUnit", Value: "500000"}).Error)
			require.NoError(t, ApplyApprovedStratusLunaTariff(db))
			switch custom {
			case "ModelRatio":
				require.NoError(t, db.Save(&Option{Key: custom, Value: `{"gpt-5.6-luna":0.7}`}).Error)
			case "CompletionRatio":
				require.NoError(t, db.Save(&Option{Key: custom, Value: `{"gpt-5.6-luna":2}`}).Error)
			case "ModelPrice":
				require.NoError(t, db.Save(&Option{Key: custom, Value: `{"gpt-5.6-luna":0.5}`}).Error)
			case "billing_setting.billing_mode":
				require.NoError(t, db.Save(&Option{Key: custom, Value: `{"gpt-5.6-luna":"tiered_expr"}`}).Error)
			}
			values := map[string]string{"QuotaPerUnit": "1000000"}
			if custom == "explicit-batch" {
				values["ModelRatio"] = `{"gpt-5.6-luna":0.9}`
			}
			require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
				return preserveLunaTariffOnUnitChange(tx, values)
			}))
			if custom == "" {
				var ratios map[string]float64
				require.NoError(t, common.Unmarshal([]byte(values["ModelRatio"]), &ratios))
				require.InDelta(t, 11.0/89, ratios[stratusLunaModel], 1e-15)
			} else if custom == "explicit-batch" {
				require.Equal(t, `{"gpt-5.6-luna":0.9}`, values["ModelRatio"])
			} else {
				_, rewritten := values["ModelRatio"]
				require.False(t, rewritten)
			}
		})
	}
}

func TestLunaUnitUpdatePersistsAtomicRebase(t *testing.T) {
	db := lunaTariffTestDB(t)
	require.NoError(t, db.Create(&Option{Key: "QuotaPerUnit", Value: "500000"}).Error)
	require.NoError(t, ApplyApprovedStratusLunaTariff(db))
	oldDB, oldUnit, oldRatios := DB, common.QuotaPerUnit, ratio_setting.ModelRatio2JSONString()
	oldOptions := common.OptionMap
	DB = db
	common.OptionMap = make(map[string]string)
	t.Cleanup(func() {
		DB, common.QuotaPerUnit, common.OptionMap = oldDB, oldUnit, oldOptions
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(oldRatios))
	})
	require.NoError(t, UpdateOption("QuotaPerUnit", "1000000"))
	require.Equal(t, 1_000_000.0, common.QuotaPerUnit)
	ratio, ok, _ := ratio_setting.GetModelRatio(stratusLunaModel)
	require.True(t, ok)
	require.InDelta(t, 1, ratio/common.QuotaPerUnit*89/11*1_000_000, 1e-12)
	require.Equal(t, "1000000", lunaOptionValue(t, db, "QuotaPerUnit"))
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"QuotaPerUnit": "2000000", "ModelRatio": `{"gpt-5.6-luna":0.9}`,
	}))
	require.JSONEq(t, `{"gpt-5.6-luna":0.9}`, lunaOptionValue(t, db, "ModelRatio"))
	require.Error(t, UpdateOption("QuotaPerUnit", "NaN"))
	require.Equal(t, "2000000", lunaOptionValue(t, db, "QuotaPerUnit"))
}
