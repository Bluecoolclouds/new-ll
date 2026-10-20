package model

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func playgroundLibraryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "playground.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })
	if err := db.AutoMigrate(&PlaygroundChat{}, &PlaygroundMedia{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestCreatePlaygroundChatKeepsLastFiftyAndReturnsAttachedMedia(t *testing.T) {
	db := playgroundLibraryTestDB(t)
	var oldestID int64
	for i := 0; i < PlaygroundMaxChats; i++ {
		chat, _, err := CreatePlaygroundChat(12, "chat", int64(i+1))
		if err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			oldestID = chat.ID
			chatID := chat.ID
			if err := CreatePlaygroundMedia(&PlaygroundMedia{
				UserID: 12, ChatID: &chatID, FilePath: "/tmp/old-chat.webp", MimeType: "image/webp", CreatedAt: 1,
			}); err != nil {
				t.Fatal(err)
			}
		}
	}
	otherUserChat, _, err := CreatePlaygroundChat(13, "other user", 100)
	if err != nil {
		t.Fatal(err)
	}
	otherUserMedia := &PlaygroundMedia{UserID: 13, ChatID: &otherUserChat.ID, FilePath: "/tmp/other-user.png", MimeType: "image/png", CreatedAt: 100}
	if err := CreatePlaygroundMedia(otherUserMedia); err != nil {
		t.Fatal(err)
	}

	_, deletedPaths, err := CreatePlaygroundChat(12, "new chat", 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(deletedPaths) != 1 || deletedPaths[0] != "/tmp/old-chat.webp" {
		t.Fatalf("expected oldest chat media path to be returned, got %#v", deletedPaths)
	}
	if _, err := GetPlaygroundChat(12, oldestID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected oldest chat to be deleted, got %v", err)
	}
	chats, total, err := ListPlaygroundChats(12, 0, PlaygroundChatPageSize)
	if err != nil {
		t.Fatal(err)
	}
	if total != PlaygroundMaxChats || len(chats) != PlaygroundChatPageSize {
		t.Fatalf("expected 50 total chats and a 10-chat page, got total=%d page=%d", total, len(chats))
	}
	var remaining int64
	if err := db.Model(&PlaygroundMedia{}).Where("user_id = ?", 12).Count(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("expected the evicted chat's media record to be removed, got %d", remaining)
	}
	if _, err := GetPlaygroundMedia(13, otherUserMedia.ID); err != nil {
		t.Fatalf("creating a chat for one user must not remove another user's media: %v", err)
	}
}

func TestPlaygroundChatAndMediaAreScopedToOwner(t *testing.T) {
	playgroundLibraryTestDB(t)
	chat, _, err := CreatePlaygroundChat(22, "private", 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := GetPlaygroundChat(23, chat.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected a different user not to read the chat, got %v", err)
	}
	media := &PlaygroundMedia{UserID: 22, FilePath: "/tmp/private.png", MimeType: "image/png", CreatedAt: 1}
	if err := CreatePlaygroundMedia(media); err != nil {
		t.Fatal(err)
	}
	if _, err := GetPlaygroundMedia(23, media.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected a different user not to read the media, got %v", err)
	}
}
