package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled           bool   `json:"enabled"`             // 是否启用签到功能
	MinQuota          int    `json:"min_quota"`           // 签到最小额度奖励
	MaxQuota          int    `json:"max_quota"`           // 签到最大额度奖励
	TelegramChannelId string `json:"telegram_channel_id"` // Telegram канал, подписка обязательна (например @apinet_news)
}

var checkinSetting = CheckinSetting{
	Enabled:           false,
	MinQuota:          1000,
	MaxQuota:          10000,
	TelegramChannelId: "",
}

func init() {
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}
