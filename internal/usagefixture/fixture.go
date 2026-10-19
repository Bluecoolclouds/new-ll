package usagefixture

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const Marker = "__synthetic_admin_usage_v1__"

type Account struct {
	ID       int
	Username string
	Role     int
	Status   int
}

func Resolve(db *gorm.DB, userID int) (Account, error) {
	var accounts []Account
	query := db.Table("users").Select("id, username, role, status").
		Where("role IN ? AND deleted_at IS NULL", []int{common.RoleAdminUser, common.RoleRootUser})
	if userID != 0 {
		query = query.Where("id = ?", userID)
	}
	if err := query.Find(&accounts).Error; err != nil {
		return Account{}, err
	}
	if len(accounts) != 1 {
		return Account{}, errors.New("expected exactly one administrator; specify --user-id after inspecting local accounts")
	}
	if accounts[0].Status != common.UserStatusEnabled {
		return Account{}, errors.New("administrator is disabled")
	}
	return accounts[0], nil
}

// Rows are accounting examples, not a reconstruction of provider tariffs.
func Generate(account Account, now time.Time) []model.QuotaData {
	end := now.UTC().Truncate(time.Hour)
	start := end.Add(-60 * 24 * time.Hour)
	models := []struct {
		name       string
		inputRate  float64
		outputRate float64
	}{
		{"gpt-5.6-luna", 0.13, 0.13},
		{"gpt-4.1-mini", 0.4, 1.6},
		{"claude-sonnet-4", 3, 15},
		{"gemini-2.5-flash", 0.3, 2.5},
	}
	rows := make([]model.QuotaData, 0, 1441*len(models))
	for hour := 0; hour <= 1440; hour++ {
		at := start.Add(time.Duration(hour) * time.Hour)
		day := hour / 24
		activity := 0.25 + 0.75*math.Pow(math.Sin(float64(at.Hour())/24*math.Pi), 2)
		if at.Weekday() == time.Saturday || at.Weekday() == time.Sunday {
			activity *= 0.6
		}
		trend := 0.65 + float64(day)/100 + 0.2*math.Sin(float64(day)*0.6)
		if day%11 == 3 {
			trend *= 1.8
		}
		if hour == 1440 {
			activity *= math.Max(0.05, float64(now.UTC().Minute()+1)/60)
		}
		for index, spec := range models {
			noise := float64((hour*17+index*31)%23+75) / 100
			count := max(1, int(float64(20+index*9)*activity*trend*noise))
			input := count * (450 + (hour*29+index*191)%1400)
			output := count * (120 + (hour*13+index*71)%600)
			usd := (float64(input)*spec.inputRate + float64(output)*spec.outputRate) / 1_000_000
			rows = append(rows, model.QuotaData{
				UserID: account.ID, Username: account.Username, ModelName: spec.name,
				CreatedAt: at.Unix(), NodeName: Marker,
				Count: count, TokenUsed: input + output,
				Quota: max(1, int(math.Round(usd*common.QuotaPerUnit))),
			})
		}
	}
	return rows
}

func owned(db *gorm.DB, account Account) *gorm.DB {
	return db.Table("quota_data").Where(
		"user_id = ? AND node_name = ? AND use_group = ? AND token_id = ? AND channel_id = ?",
		account.ID, Marker, "", 0, 0)
}

func Existing(db *gorm.DB, account Account) ([]model.QuotaData, error) {
	var rows []model.QuotaData
	err := owned(db, account).Order("created_at, model_name").Find(&rows).Error
	return rows, err
}

// Apply never calls billing, logging, quota caches, or application initialization.
func Apply(db *gorm.DB, account Account, now time.Time, remove bool) error {
	return db.Transaction(func(tx *gorm.DB) error {
		current, err := Resolve(tx, account.ID)
		if err != nil {
			return err
		}
		if current != account {
			return fmt.Errorf("account changed since preview; run preview again")
		}
		if err := owned(tx, account).Delete(&model.QuotaData{}).Error; err != nil {
			return err
		}
		if remove {
			return nil
		}
		return tx.Table("quota_data").CreateInBatches(Generate(account, now), 100).Error
	})
}
