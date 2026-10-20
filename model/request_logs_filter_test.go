package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestGetUserLogsRequestOnlyIncludesUsageAndErrors(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "request-logs.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	previousLogDB := LOG_DB
	previousMainType := common.MainDatabaseType()
	previousLogType := common.LogDatabaseType()
	LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
	})

	if err := db.AutoMigrate(&Log{}); err != nil {
		t.Fatal(err)
	}
	records := []Log{
		{UserId: 42, Type: LogTypeConsume, ModelName: "gpt-test"},
		{UserId: 42, Type: LogTypeError, ModelName: "gpt-test", Content: "upstream error"},
		{UserId: 42, Type: LogTypeTopup, Content: "top-up"},
		{UserId: 43, Type: LogTypeConsume, ModelName: "other-user"},
	}
	if err := db.Create(&records).Error; err != nil {
		t.Fatal(err)
	}

	logs, total, err := GetUserLogs(42, LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "", true)
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || len(logs) != 2 {
		t.Fatalf("expected only usage and error logs, got total=%d len=%d", total, len(logs))
	}
	found := map[int]bool{}
	for _, log := range logs {
		found[log.Type] = true
	}
	if !found[LogTypeConsume] || !found[LogTypeError] {
		t.Fatalf("expected consume and error types, got %#v", found)
	}
}
