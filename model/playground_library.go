package model

import (
	"errors"
	"fmt"
	"os"
	"unicode/utf8"

	"gorm.io/gorm"
)

const (
	PlaygroundMaxChats     = 50
	PlaygroundChatPageSize = 10
)

type PlaygroundChat struct {
	ID        int64  `json:"id" gorm:"primaryKey"`
	UserID    int    `json:"-" gorm:"not null;index:idx_playground_chats_owner_updated,priority:1"`
	Title     string `json:"title" gorm:"size:160;not null"`
	Messages  string `json:"-" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"not null"`
	UpdatedAt int64  `json:"updated_at" gorm:"not null;index:idx_playground_chats_owner_updated,priority:2"`
}

func (PlaygroundChat) TableName() string { return "stratus_playground_chats" }

type PlaygroundMedia struct {
	ID        int64  `json:"id" gorm:"primaryKey"`
	UserID    int    `json:"-" gorm:"not null;index:idx_playground_media_owner_created,priority:1"`
	ChatID    *int64 `json:"chat_id,omitempty" gorm:"index"`
	FilePath  string `json:"-" gorm:"size:512;not null"`
	MimeType  string `json:"mime_type" gorm:"size:64;not null"`
	Model     string `json:"model" gorm:"size:160"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"not null;index:idx_playground_media_owner_created,priority:2"`
}

func (PlaygroundMedia) TableName() string { return "stratus_playground_media" }

func CreatePlaygroundChat(userID int, title string, now int64) (*PlaygroundChat, []string, error) {
	if userID <= 0 {
		return nil, nil, errors.New("authenticated user is required")
	}
	if title == "" {
		title = "New chat"
	}
	if utf8.RuneCountInString(title) > 160 {
		title = string([]rune(title)[:160])
	}
	chat := &PlaygroundChat{UserID: userID, Title: title, Messages: "[]", CreatedAt: now, UpdatedAt: now}
	var deletedPaths []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&PlaygroundChat{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count >= PlaygroundMaxChats {
			var oldest PlaygroundChat
			if err := tx.Where("user_id = ?", userID).Order("updated_at ASC").Order("id ASC").First(&oldest).Error; err != nil {
				return err
			}
			var media []PlaygroundMedia
			if err := tx.Where("user_id = ? AND chat_id = ?", userID, oldest.ID).Find(&media).Error; err != nil {
				return err
			}
			for _, item := range media {
				deletedPaths = append(deletedPaths, item.FilePath)
			}
			if err := tx.Where("user_id = ? AND chat_id = ?", userID, oldest.ID).Delete(&PlaygroundMedia{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id = ? AND user_id = ?", oldest.ID, userID).Delete(&PlaygroundChat{}).Error; err != nil {
				return err
			}
		}
		return tx.Create(chat).Error
	})
	if err != nil {
		return nil, nil, err
	}
	return chat, deletedPaths, nil
}

func ListPlaygroundChats(userID, offset, limit int) ([]PlaygroundChat, int64, error) {
	query := DB.Model(&PlaygroundChat{}).Where("user_id = ?", userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var chats []PlaygroundChat
	err := query.Order("updated_at DESC").Order("id DESC").Offset(offset).Limit(limit).Find(&chats).Error
	return chats, total, err
}

func GetPlaygroundChat(userID int, id int64) (*PlaygroundChat, error) {
	var chat PlaygroundChat
	if err := DB.Where("id = ? AND user_id = ?", id, userID).First(&chat).Error; err != nil {
		return nil, err
	}
	return &chat, nil
}

func SavePlaygroundChat(userID int, id int64, title, messages string, now int64) error {
	result := DB.Model(&PlaygroundChat{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]any{"title": title, "messages": messages, "updated_at": now})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func DeletePlaygroundChat(userID int, id int64) ([]string, error) {
	var paths []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var chat PlaygroundChat
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&chat).Error; err != nil {
			return err
		}
		var media []PlaygroundMedia
		if err := tx.Where("user_id = ? AND chat_id = ?", userID, id).Find(&media).Error; err != nil {
			return err
		}
		for _, item := range media {
			paths = append(paths, item.FilePath)
		}
		if err := tx.Where("user_id = ? AND chat_id = ?", userID, id).Delete(&PlaygroundMedia{}).Error; err != nil {
			return err
		}
		return tx.Delete(&chat).Error
	})
	return paths, err
}

func CreatePlaygroundMedia(media *PlaygroundMedia) error {
	if media.UserID <= 0 || media.FilePath == "" || media.MimeType == "" {
		return errors.New("media owner, file path, and type are required")
	}
	if media.ChatID != nil {
		var count int64
		if err := DB.Model(&PlaygroundChat{}).Where("id = ? AND user_id = ?", *media.ChatID, media.UserID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return gorm.ErrRecordNotFound
		}
	}
	return DB.Create(media).Error
}

func ListPlaygroundMedia(userID, offset, limit int) ([]PlaygroundMedia, int64, error) {
	query := DB.Model(&PlaygroundMedia{}).Where("user_id = ?", userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var media []PlaygroundMedia
	err := query.Order("created_at DESC").Order("id DESC").Offset(offset).Limit(limit).Find(&media).Error
	return media, total, err
}

func GetPlaygroundMedia(userID int, id int64) (*PlaygroundMedia, error) {
	var media PlaygroundMedia
	if err := DB.Where("id = ? AND user_id = ?", id, userID).First(&media).Error; err != nil {
		return nil, err
	}
	return &media, nil
}

func DeletePlaygroundMedia(userID int, id int64) (string, error) {
	var media PlaygroundMedia
	if err := DB.Where("id = ? AND user_id = ?", id, userID).First(&media).Error; err != nil {
		return "", err
	}
	if err := DB.Delete(&media).Error; err != nil {
		return "", err
	}
	return media.FilePath, nil
}

func DeletePlaygroundMediaFiles(paths []string) error {
	var firstErr error
	for _, path := range paths {
		if path == "" {
			continue
		}
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) && firstErr == nil {
			firstErr = fmt.Errorf("remove playground media: %w", err)
		}
	}
	return firstErr
}
