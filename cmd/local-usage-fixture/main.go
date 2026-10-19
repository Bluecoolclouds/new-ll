package main

import (
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/QuantumNous/new-api/internal/usagefixture"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func localPath() (string, error) {
	for _, key := range []string{"REPLIT_DEPLOYMENT", "SQL_DSN", "LOG_SQL_DSN", "SQLITE_PATH"} {
		if os.Getenv(key) != "" {
			return "", fmt.Errorf("%s is set; only the default local SQLite preview is supported", key)
		}
	}
	if _, err := os.Stat(".replit"); err != nil {
		return "", fmt.Errorf("run from the project root containing .replit")
	}
	path, err := filepath.Abs("one-api.db")
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("one-api.db must be an existing regular file, not a symlink")
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil || resolved != path {
		return "", fmt.Errorf("database path must not contain symlinks")
	}
	return path, nil
}

func run() error {
	action := flag.String("action", "preview", "preview, seed, or delete")
	userID := flag.Int("user-id", 0, "existing administrator ID; required for writes")
	confirm := flag.String("confirm-local", "", "absolute database path printed by preview; required for writes")
	flag.Parse()
	if *action != "preview" && *action != "seed" && *action != "delete" {
		return fmt.Errorf("invalid action")
	}
	path, err := localPath()
	if err != nil {
		return err
	}
	write := *action != "preview"
	if write && (*confirm != path || *userID <= 0) {
		return fmt.Errorf("first run preview, then provide --user-id and --confirm-local with the exact database path")
	}
	mode := "ro"
	if write {
		mode = "rw"
	}
	dsn := (&url.URL{Scheme: "file", Path: path}).String() + "?mode=" + mode + "&_pragma=busy_timeout(30000)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(1)
	account, err := usagefixture.Resolve(db, *userID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	rows := usagefixture.Generate(account, now)
	existing, err := usagefixture.Existing(db, account)
	if err != nil {
		return err
	}
	fmt.Printf("LOCAL SQLite: %s\nAdministrator: %s (ID %d, role %d)\nSynthetic marker: %s\nExisting fixture rows: %d\nPlanned: %d hourly model rows, %s — %s UTC\n",
		path, account.Username, account.ID, account.Role, usagefixture.Marker, len(existing), len(rows),
		time.Unix(rows[0].CreatedAt, 0).UTC().Format(time.RFC3339),
		time.Unix(rows[len(rows)-1].CreatedAt, 0).UTC().Format(time.RFC3339))
	fmt.Println("TEST DATA: included in personal and administrative statistics; no balance, payments, credentials, request logs or collection settings are modified.")
	if !write {
		fmt.Printf("Seed: go run ./cmd/local-usage-fixture --action seed --user-id %d --confirm-local %q\nDelete: go run ./cmd/local-usage-fixture --action delete --user-id %d --confirm-local %q\n", account.ID, path, account.ID, path)
		return nil
	}
	if err := usagefixture.Apply(db, account, now, *action == "delete"); err != nil {
		return err
	}
	fmt.Printf("Completed: %s (only this user's marked fixture rows).\n", *action)
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
