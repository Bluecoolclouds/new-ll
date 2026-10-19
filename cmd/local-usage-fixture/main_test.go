package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLocalPathGuards(t *testing.T) {
	for _, key := range []string{"REPLIT_DEPLOYMENT", "SQL_DSN", "LOG_SQL_DSN", "SQLITE_PATH"} {
		t.Setenv(key, "")
	}
	dir := t.TempDir()
	t.Chdir(dir)
	if _, err := localPath(); err == nil {
		t.Fatal("accepted missing project")
	}
	os.WriteFile(".replit", []byte("test"), 0600)
	if _, err := localPath(); err == nil {
		t.Fatal("accepted missing database")
	}
	os.WriteFile("one-api.db", nil, 0600)
	path, err := localPath()
	if err != nil || path != filepath.Join(dir, "one-api.db") {
		t.Fatalf("valid local file rejected: %s %v", path, err)
	}
	for _, key := range []string{"REPLIT_DEPLOYMENT", "SQL_DSN", "LOG_SQL_DSN", "SQLITE_PATH"} {
		t.Setenv(key, "blocked")
		if _, err := localPath(); err == nil {
			t.Fatalf("accepted %s", key)
		}
		t.Setenv(key, "")
	}
	os.Rename("one-api.db", "other.db")
	os.Symlink("other.db", "one-api.db")
	if _, err := localPath(); err == nil {
		t.Fatal("accepted symlink")
	}
}
