package controller

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const playgroundMediaLimit = 20 << 20

type playgroundChatPayload struct {
	Title    string          `json:"title"`
	Messages json.RawMessage `json:"messages"`
}

func ListPlaygroundChats(c *gin.Context) {
	page := playgroundPage(c)
	chats, total, err := model.ListPlaygroundChats(c.GetInt("id"), (page-1)*model.PlaygroundChatPageSize, model.PlaygroundChatPageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": chats, "total": total, "page": page, "page_size": model.PlaygroundChatPageSize})
}

func CreatePlaygroundChat(c *gin.Context) {
	chat, deletedPaths, err := model.CreatePlaygroundChat(c.GetInt("id"), strings.TrimSpace(c.Query("title")), common.GetTimestamp())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.DeletePlaygroundMediaFiles(deletedPaths)
	common.ApiSuccess(c, gin.H{
		"id": chat.ID, "title": chat.Title,
		"created_at": chat.CreatedAt, "updated_at": chat.UpdatedAt,
	})
}

func GetPlaygroundChat(c *gin.Context) {
	id, ok := playgroundID(c)
	if !ok {
		return
	}
	chat, err := model.GetPlaygroundChat(c.GetInt("id"), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "Chat not found.")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id": chat.ID, "title": chat.Title, "messages": chat.Messages,
		"created_at": chat.CreatedAt, "updated_at": chat.UpdatedAt,
	})
}

func SavePlaygroundChat(c *gin.Context) {
	id, ok := playgroundID(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
	var payload playgroundChatPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiErrorMsg(c, "Chat data is invalid or too large.")
		return
	}
	if utf8.RuneCountInString(payload.Title) > 160 || len(payload.Messages) == 0 || len(payload.Messages) > 1<<20 {
		common.ApiErrorMsg(c, "Chat title or message history is too large.")
		return
	}
	var messages []json.RawMessage
	if err := common.Unmarshal(payload.Messages, &messages); err != nil || messages == nil {
		common.ApiErrorMsg(c, "Chat messages must be a JSON array.")
		return
	}
	err := model.SavePlaygroundChat(c.GetInt("id"), id, strings.TrimSpace(payload.Title), string(payload.Messages), common.GetTimestamp())
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "Chat not found.")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"saved": true})
}

func DeletePlaygroundChat(c *gin.Context) {
	id, ok := playgroundID(c)
	if !ok {
		return
	}
	paths, err := model.DeletePlaygroundChat(c.GetInt("id"), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "Chat not found.")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.DeletePlaygroundMediaFiles(paths)
	common.ApiSuccess(c, gin.H{"deleted": true})
}

func ListPlaygroundMedia(c *gin.Context) {
	page := playgroundPage(c)
	media, total, err := model.ListPlaygroundMedia(c.GetInt("id"), (page-1)*24, 24)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for i := range media {
		media[i].FilePath = ""
	}
	common.ApiSuccess(c, gin.H{"items": media, "total": total, "page": page, "page_size": 24})
}

func UploadPlaygroundMedia(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, playgroundMediaLimit+(1<<20))
	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "A supported image file is required.")
		return
	}
	if fileHeader.Size <= 0 || fileHeader.Size > playgroundMediaLimit {
		common.ApiErrorMsg(c, "Images must be no larger than 20 MB.")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, playgroundMediaLimit+1))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(data) == 0 || len(data) > playgroundMediaLimit {
		common.ApiErrorMsg(c, "Images must be no larger than 20 MB.")
		return
	}
	mimeType, extension := playgroundImageType(data)
	if mimeType == "" {
		common.ApiErrorMsg(c, "Only PNG, JPEG, GIF, and WebP images are supported.")
		return
	}
	var chatID *int64
	if rawID := strings.TrimSpace(c.PostForm("chat_id")); rawID != "" {
		id, err := strconv.ParseInt(rawID, 10, 64)
		if err != nil || id <= 0 {
			common.ApiErrorMsg(c, "Chat ID is invalid.")
			return
		}
		chatID = &id
	}
	modelName := strings.TrimSpace(c.PostForm("model"))
	prompt := strings.TrimSpace(c.PostForm("prompt"))
	if len(modelName) > 160 || len(prompt) > 20_000 {
		common.ApiErrorMsg(c, "Image metadata is too long.")
		return
	}

	randomName := make([]byte, 20)
	if _, err := rand.Read(randomName); err != nil {
		common.ApiError(c, err)
		return
	}
	directory, err := playgroundMediaDirectory()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := os.MkdirAll(directory, 0700); err != nil {
		common.ApiError(c, err)
		return
	}
	path := filepath.Join(directory, hex.EncodeToString(randomName)+extension)
	if err := os.WriteFile(path, data, 0600); err != nil {
		common.ApiError(c, err)
		return
	}
	media := &model.PlaygroundMedia{
		UserID: c.GetInt("id"), ChatID: chatID, FilePath: path, MimeType: mimeType,
		Model: modelName, Prompt: prompt, CreatedAt: common.GetTimestamp(),
	}
	if err := model.CreatePlaygroundMedia(media); err != nil {
		_ = os.Remove(path)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "Chat not found.")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id": media.ID, "chat_id": media.ChatID, "mime_type": media.MimeType,
		"model": media.Model, "prompt": media.Prompt, "created_at": media.CreatedAt,
		"content_url": fmt.Sprintf("/api/user/playground/library/%d/content", media.ID),
	})
}

func GetPlaygroundMediaContent(c *gin.Context) {
	id, ok := playgroundID(c)
	if !ok {
		return
	}
	media, err := model.GetPlaygroundMedia(c.GetInt("id"), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.Status(http.StatusNotFound)
		return
	}
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	file, err := os.Open(media.FilePath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.DataFromReader(http.StatusOK, -1, media.MimeType, file, nil)
}

func DeletePlaygroundMedia(c *gin.Context) {
	id, ok := playgroundID(c)
	if !ok {
		return
	}
	path, err := model.DeletePlaygroundMedia(c.GetInt("id"), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "Image not found.")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.DeletePlaygroundMediaFiles([]string{path})
	common.ApiSuccess(c, gin.H{"deleted": true})
}

func playgroundPage(c *gin.Context) int {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 || page > 1_000_000 {
		return 1
	}
	return page
}

func playgroundID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "ID is invalid.")
		return 0, false
	}
	return id, true
}

func playgroundMediaDirectory() (string, error) {
	directory := strings.TrimSpace(os.Getenv("STRATUS_PLAYGROUND_MEDIA_DIR"))
	if directory == "" {
		directory = filepath.Join("data", "stratus-playground")
	}
	return filepath.Abs(directory)
}

func playgroundImageType(data []byte) (string, string) {
	switch {
	case len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n":
		return "image/png", ".png"
	case len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff:
		return "image/jpeg", ".jpg"
	case len(data) >= 6 && (string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a"):
		return "image/gif", ".gif"
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image/webp", ".webp"
	default:
		return "", ""
	}
}
