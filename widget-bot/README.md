# APINET Widget Bot

Telegram-бот для двустороннего чата с виджетом поддержки на сайте.

## Как работает

```
Пользователь → виджет → POST /widget/message → AI ответ + сообщение в Telegram-тред
Админ отвечает в Telegram → /telegram/webhook → reply в pending → GET /widget/poll → виджет
```

## Настройка

### 1. Создать Telegram-бота

1. Напишите @BotFather → `/newbot` → получите токен
2. Создайте группу (supergroup) → включите **Topics/Forum** в настройках группы
3. Добавьте бота в группу как администратора (права: управление темами + отправка сообщений)
4. Получите ID группы: добавьте @userinfobot в группу или используйте `getUpdates`

### 2. Узнать свой Telegram ID

Напишите @userinfobot → он покажет ваш `id`

### 3. Настроить переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```env
TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxxx
TELEGRAM_SUPPORT_CHAT_ID=-1001234567890
ADMIN_IDS=123456789,987654321
WIDGET_TOKEN=sk-xxxxxxxx
APINET_BASE_URL=https://apinet.cloud
WEBHOOK_URL=https://your-bot.replit.app
WEBHOOK_SECRET=your_random_secret
```

### 4. Установить и запустить

```bash
npm install
npm start
```

### 5. Настроить виджет на сайте

В `web/default/index.html` замените конфигурацию виджета:

```html
<script>
window.APINET_WIDGET = {
  botUrl: "https://your-bot.replit.app",  // URL этого бота
  telegram: "https://t.me/apinet_support",
};
</script>
```

Когда `botUrl` указан — виджет автоматически работает через бот (токен не нужен).

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/widget/message` | Принять сообщение из виджета |
| GET | `/widget/poll?session=xxx` | Получить ответ администратора |
| POST | `/widget/rate` | Получить оценку ответа (👍/👎) → форвардит в Telegram-тред |
| POST | `/telegram/webhook/<secret>` | Вебхук для Telegram |
| GET | `/health` | Статус бота |

## Переменные окружения

| Переменная | Обязательна | Описание |
|-----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Да | Токен от @BotFather |
| `TELEGRAM_SUPPORT_CHAT_ID` | Да | ID группы с Topics |
| `ADMIN_IDS` | Да | Telegram ID админов через запятую |
| `WIDGET_TOKEN` | Да | APINET API ключ (server-side) |
| `APINET_BASE_URL` | Нет | По умолч. `https://apinet.cloud` |
| `WIDGET_MODEL` | Нет | По умолч. `gemini-2.5-flash` |
| `PORT` | Нет | По умолч. `3000` |
| `WIDGET_CORS_ORIGIN` | Нет | Домен сайта для CORS |
| `WEBHOOK_URL` | Нет | Публичный URL бота (для авторегистрации webhook) |
| `WEBHOOK_SECRET` | Нет | Секрет для URL вебхука |
