package service

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestStratusLunaServerQuotaMatchesWalletContract(t *testing.T) {
	var fixture struct {
		Model           string  `json:"model"`
		QuotaPerUSD     float64 `json:"quota_per_usd"`
		ModelRatio      float64 `json:"model_ratio"`
		CompletionRatio float64 `json:"completion_ratio"`
		Cases           []struct {
			Name   string  `json:"name"`
			Input  int     `json:"input"`
			Output int     `json:"output"`
			Group  float64 `json:"group"`
			Quota  int     `json:"quota"`
		} `json:"cases"`
	}
	data, err := os.ReadFile("../testdata/stratus-luna-billing.json")
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(data, &fixture))
	oldRatio, oldCompletion, oldPrice := ratio_setting.ModelRatio2JSONString(), ratio_setting.CompletionRatio2JSONString(), ratio_setting.ModelPrice2JSONString()
	oldGroups := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(oldRatio))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(oldCompletion))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrice))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups))
	})
	ratio_setting.InitRatioSettings()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "luna.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	require.NoError(t, model.ApplyApprovedStratusLunaTariff(db))
	for key, load := range map[string]func(string) error{
		"ModelRatio":      ratio_setting.UpdateModelRatioByJSONString,
		"CompletionRatio": ratio_setting.UpdateCompletionRatioByJSONString,
		"ModelPrice":      ratio_setting.UpdateModelPriceByJSONString,
	} {
		var option model.Option
		require.NoError(t, db.Where("key = ?", key).First(&option).Error)
		require.NoError(t, load(option.Value))
	}
	require.Equal(t, fixture.QuotaPerUSD, common.QuotaPerUnit)
	require.False(t, ratio_setting.GetCompletionRatioInfo(fixture.Model).Locked)

	for _, tc := range fixture.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			groups, err := common.Marshal(map[string]float64{"luna-test": tc.Group})
			require.NoError(t, err)
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(groups)))
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				OriginModelName: fixture.Model, UsingGroup: "luna-test", UserGroup: "default",
				StartTime: time.Now(), RelayFormat: types.RelayFormatOpenAI,
			}
			price, err := helper.ModelPriceHelper(ctx, info, tc.Input, &types.TokenCountMeta{})
			require.NoError(t, err)
			require.False(t, price.UsePrice)
			require.InDelta(t, fixture.ModelRatio, price.ModelRatio, 1e-15)
			require.Equal(t, fixture.CompletionRatio, price.CompletionRatio)
			summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{
				PromptTokens: tc.Input, CompletionTokens: tc.Output,
			})
			require.Equal(t, tc.Quota, summary.Quota)
			walletDebit := float64(summary.Quota) / common.QuotaPerUnit * 89 / 11 * 1_000_000
			idealWalletDebit := float64(tc.Input+tc.Output) * tc.Group
			// Normal requests round to nearest quota; tiny paid requests have a
			// one-quota minimum, so their error bound is one full quota unit.
			maxError := 89.0 / 11 * 1_000_000 / common.QuotaPerUnit
			if tc.Name != "minimum" {
				maxError /= 2
			}
			require.InDelta(t, idealWalletDebit, walletDebit, maxError)
		})
	}
}

func TestStratusUniformExpressionBypassesLockedCompletion(t *testing.T) {
	for _, name := range []string{"gpt-5", "o3", "claude-sonnet-4-6", "gemini-2.0-flash"} {
		t.Run(name, func(t *testing.T) {
			require.True(t, ratio_setting.GetCompletionRatioInfo(name).Locked)
			expr := `tier("text", (p + c) * 11 / 89)`
			info := &relaycommon.RelayInfo{TieredBillingSnapshot: &billingexpr.BillingSnapshot{
				BillingMode: "tiered_expr", ModelName: name, ExprString: expr,
				ExprHash: billingexpr.ExprHashString(expr), ExprVersion: 1,
				QuotaPerUnit: 500_000, GroupRatio: 1,
			}}
			ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 1000, Len: 1000})
			require.True(t, ok)
			require.NotNil(t, result)
			require.Equal(t, 124, quota)
		})
	}
}

func TestStratusLunaNondefaultPersistedQuotaUnits(t *testing.T) {
	var fixture struct {
		Model string `json:"model"`
		Cases []struct {
			QuotaPerUSD float64 `json:"quota_per_usd"`
			ModelRatio  float64 `json:"model_ratio"`
			Input       int     `json:"input"`
			Output      int     `json:"output"`
			Quota       int     `json:"quota"`
		} `json:"accounting_cases"`
	}
	data, err := os.ReadFile("../testdata/stratus-luna-billing.json")
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal(data, &fixture))
	oldRatio, oldCompletion, oldPrice := ratio_setting.ModelRatio2JSONString(), ratio_setting.CompletionRatio2JSONString(), ratio_setting.ModelPrice2JSONString()
	oldGroups, oldUnit := ratio_setting.GroupRatio2JSONString(), common.QuotaPerUnit
	t.Cleanup(func() {
		common.QuotaPerUnit = oldUnit
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(oldRatio))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(oldCompletion))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrice))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups))
	})
	for _, sample := range fixture.Cases {
		t.Run(strconv.FormatFloat(sample.QuotaPerUSD, 'f', -1, 64), func(t *testing.T) {
			// Reproduce startup: the DB unit has not yet reached common.QuotaPerUnit.
			common.QuotaPerUnit = 500_000
			db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "luna.db")), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			require.NoError(t, db.AutoMigrate(&model.Option{}))
			require.NoError(t, db.Create(&model.Option{
				Key: "QuotaPerUnit", Value: strconv.FormatFloat(sample.QuotaPerUSD, 'f', -1, 64),
			}).Error)
			require.NoError(t, model.ApplyApprovedStratusLunaTariff(db))
			for key, load := range map[string]func(string) error{
				"ModelRatio":      ratio_setting.UpdateModelRatioByJSONString,
				"CompletionRatio": ratio_setting.UpdateCompletionRatioByJSONString,
				"ModelPrice":      ratio_setting.UpdateModelPriceByJSONString,
			} {
				var option model.Option
				require.NoError(t, db.Where(&model.Option{Key: key}).First(&option).Error)
				require.NoError(t, load(option.Value))
			}
			common.QuotaPerUnit = sample.QuotaPerUSD
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"luna-test":1}`))
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				OriginModelName: fixture.Model, UsingGroup: "luna-test", UserGroup: "default",
				StartTime: time.Now(), RelayFormat: types.RelayFormatOpenAI,
			}
			price, err := helper.ModelPriceHelper(ctx, info, sample.Input, &types.TokenCountMeta{})
			require.NoError(t, err)
			require.InDelta(t, sample.ModelRatio, price.ModelRatio, 1e-15)
			summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{
				PromptTokens: sample.Input, CompletionTokens: sample.Output,
			})
			require.Equal(t, sample.Quota, summary.Quota)
			require.InDelta(t, 1, price.ModelRatio/common.QuotaPerUnit*89/11*1_000_000, 1e-12)
		})
	}
}
