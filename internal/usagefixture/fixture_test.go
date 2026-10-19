package usagefixture_test

import (
	"flag"
	"fmt"
	"math"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/internal/usagefixture"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var verifyLocal = flag.Bool("local-preview", false, "read-only verification of the existing local preview database")

func fixtureDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "fixture.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { sqlDB.Close() })
	if err := db.AutoMigrate(&model.User{}, &model.QuotaData{}, &model.Log{}, &model.TopUp{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestSeedRepeatDeletePreservesExistingData(t *testing.T) {
	db := fixtureDB(t)
	admin := model.User{Username: "fixture-admin", AffCode: "admin", Password: "fake-password-sentinel", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Quota: 7654321, UsedQuota: 1234, RequestCount: 99}
	other := model.User{Username: "other", AffCode: "other", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Quota: 9876}
	for _, user := range []*model.User{&admin, &other} {
		if err := db.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	account, err := usagefixture.Resolve(db, 0)
	if err != nil || account.ID != admin.Id {
		t.Fatalf("resolve: %+v %v", account, err)
	}
	now := time.Date(2026, 10, 17, 12, 34, 56, 0, time.UTC)
	original := []model.QuotaData{
		{UserID: admin.Id, Username: admin.Username, ModelName: "gpt-5.6-luna", CreatedAt: now.Truncate(time.Hour).Unix(), Count: 8, Quota: 27, TokenUsed: 999},
		{UserID: other.Id, NodeName: usagefixture.Marker, Count: 9, Quota: 99},
		{UserID: admin.Id, NodeName: usagefixture.Marker, TokenID: 7, Count: 3, Quota: 123},
	}
	if err := db.Create(&original).Error; err != nil {
		t.Fatal(err)
	}
	log := model.Log{UserId: admin.Id, Content: "existing real log", Quota: 123}
	payment := model.TopUp{UserId: admin.Id, TradeNo: "existing-payment"}
	if err := db.Create(&log).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatal(err)
	}
	var beforeUsers []model.User
	var beforeLogs []model.Log
	var beforePayments []model.TopUp
	db.Find(&beforeUsers)
	db.Find(&beforeLogs)
	db.Find(&beforePayments)
	expected := usagefixture.Generate(account, now)
	for iteration := 0; iteration < 2; iteration++ {
		if err := usagefixture.Apply(db, account, now, false); err != nil {
			t.Fatal(err)
		}
		rows, err := usagefixture.Existing(db, account)
		if err != nil || len(rows) != len(expected) {
			t.Fatalf("repeat %d: %d rows, %v", iteration, len(rows), err)
		}
		var actualTotals, expectedTotals [3]int
		for index, row := range rows {
			actualTotals[0] += row.Count
			actualTotals[1] += row.Quota
			actualTotals[2] += row.TokenUsed
			expectedTotals[0] += expected[index].Count
			expectedTotals[1] += expected[index].Quota
			expectedTotals[2] += expected[index].TokenUsed
		}
		if actualTotals != expectedTotals {
			t.Fatal("repeated seed changed fixture totals")
		}
		var total int64
		db.Table("quota_data").Count(&total)
		if total != int64(len(expected)+len(original)) {
			t.Fatalf("unexpected total %d", total)
		}
	}
	if err := usagefixture.Apply(db, account, now.Add(time.Hour), false); err != nil {
		t.Fatal(err)
	}
	for iteration := 0; iteration < 2; iteration++ {
		if err := usagefixture.Apply(db, account, now, true); err != nil {
			t.Fatal(err)
		}
	}
	var remaining []model.QuotaData
	db.Table("quota_data").Order("id").Find(&remaining)
	if !reflect.DeepEqual(original, remaining) {
		t.Fatalf("existing aggregates changed: %+v", remaining)
	}
	var afterUsers []model.User
	var afterLogs []model.Log
	var afterPayments []model.TopUp
	db.Find(&afterUsers)
	db.Find(&afterLogs)
	db.Find(&afterPayments)
	if !reflect.DeepEqual(beforeUsers, afterUsers) || !reflect.DeepEqual(beforeLogs, afterLogs) || !reflect.DeepEqual(beforePayments, afterPayments) {
		t.Fatal("users, balances, logs or payments changed")
	}
}

func TestRollbackAndAccountSelection(t *testing.T) {
	db := fixtureDB(t)
	for _, name := range []string{"first", "second"} {
		if err := db.Create(&model.User{Username: name, AffCode: name, Role: common.RoleAdminUser, Status: common.UserStatusEnabled}).Error; err != nil {
			t.Fatal(err)
		}
	}
	if _, err := usagefixture.Resolve(db, 0); err == nil {
		t.Fatal("ambiguous administrator accepted")
	}
	var first model.User
	db.Where("username = ?", "first").First(&first)
	account, err := usagefixture.Resolve(db, first.Id)
	if err != nil {
		t.Fatal(err)
	}
	old := model.QuotaData{UserID: account.ID, NodeName: usagefixture.Marker, Count: 123}
	db.Create(&old)
	db.Exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON quota_data BEGIN SELECT RAISE(ABORT, 'test insert failure'); END")
	if err := usagefixture.Apply(db, account, time.Now(), false); err == nil {
		t.Fatal("insert should fail")
	}
	rows, err := usagefixture.Existing(db, account)
	if err != nil || len(rows) != 1 || rows[0].Count != 123 {
		t.Fatal("transaction did not preserve previous fixture")
	}
	db.Model(&model.User{}).Where("id = ?", account.ID).Update("role", common.RoleCommonUser)
	if err := usagefixture.Apply(db, account, time.Now(), true); err == nil {
		t.Fatal("changed role accepted")
	}
}

func TestDeterministicHourlyHistory(t *testing.T) {
	account := usagefixture.Account{ID: 42, Username: "test"}
	now := time.Date(2026, 10, 17, 12, 34, 56, 0, time.UTC)
	rows := usagefixture.Generate(account, now)
	if !reflect.DeepEqual(rows, usagefixture.Generate(account, now)) || len(rows) != 1441*4 {
		t.Fatal("fixture is not deterministic or does not cover 60 days")
	}
	hours := map[int64]int{}
	counts := map[int]bool{}
	for _, row := range rows {
		if row.CreatedAt%3600 != 0 || row.CreatedAt > now.Unix() || row.Count < 1 || row.TokenUsed <= row.Count || row.Quota <= 0 || row.NodeName != usagefixture.Marker {
			t.Fatalf("invalid row %+v", row)
		}
		hours[row.CreatedAt]++
		counts[row.Count] = true
		if row.ModelName == "gpt-5.6-luna" && row.Quota != int(math.Round(float64(row.TokenUsed)*0.13/1_000_000*common.QuotaPerUnit)) {
			t.Fatal("Luna fixture must respect the agreed uniform wallet-token multiplier")
		}
	}
	if len(hours) != 1441 || len(counts) < 20 {
		t.Fatal("missing hourly coverage or variation")
	}
	for _, count := range hours {
		if count != 4 {
			t.Fatal("missing model")
		}
	}
}

func checkPersonalPeriods(t *testing.T, db *gorm.DB, account usagefixture.Account, now time.Time) {
	t.Helper()
	previousDB := model.DB
	model.DB = db
	defer func() { model.DB = previousDB }()
	for _, days := range []int64{1, 7, 30} {
		for previous := int64(0); previous < 2; previous++ {
			end := now.Unix() - previous*(days*86400+1)
			start := end - days*86400
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Set("id", account.ID)
			context.Request = httptest.NewRequest("GET", fmt.Sprintf("/api/data/self?start_timestamp=%d&end_timestamp=%d", start, end), nil)
			controller.GetUserQuotaDates(context)
			var body struct {
				Success bool              `json:"success"`
				Data    []model.QuotaData `json:"data"`
			}
			if err := common.Unmarshal(recorder.Body.Bytes(), &body); err != nil || !body.Success || len(body.Data) == 0 {
				t.Fatalf("personal API: days=%d previous=%d: %s (%v)", days, previous, recorder.Body.String(), err)
			}
			models := map[string]bool{}
			for _, row := range body.Data {
				if row.UserID != account.ID || row.CreatedAt < start || row.CreatedAt > end || row.Quota <= 0 || row.TokenUsed <= 0 {
					t.Fatalf("invalid personal API row: %+v", row)
				}
				models[row.ModelName] = true
			}
			if len(models) != 4 {
				t.Fatal("missing models in personal period")
			}
			t.Logf("personal API: days=%d previous=%d rows=%d models=%d", days, previous, len(body.Data), len(models))
		}
	}
}

func TestPersonalAPIWithFixture(t *testing.T) {
	db := fixtureDB(t)
	db.Create(&model.User{Username: "admin", Role: common.RoleAdminUser, Status: common.UserStatusEnabled})
	account, err := usagefixture.Resolve(db, 0)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if err := usagefixture.Apply(db, account, now, false); err != nil {
		t.Fatal(err)
	}
	checkPersonalPeriods(t, db, account, now)
}

func TestLocalPreviewPersonalAPI(t *testing.T) {
	if !*verifyLocal {
		t.Skip("explicit -local-preview flag required; never write to the local preview from tests")
	}
	db, err := gorm.Open(sqlite.Open("file:../../one-api.db?mode=ro"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	account, err := usagefixture.Resolve(db, 0)
	if err != nil {
		t.Fatal(err)
	}
	checkPersonalPeriods(t, db, account, time.Now().UTC())
}
