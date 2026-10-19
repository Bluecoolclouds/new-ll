# APINET.CLOUD — LLM Gateway

## Описание проекта

**APINET.CLOUD** — коммерческий AI API шлюз на базе форка **new-api**. Предоставляет единый OpenAI-совместимый API к 40+ провайдерам (OpenAI, Claude, Gemini, DeepSeek, Azure, AWS Bedrock и др.) с управлением пользователями, биллингом, rate limiting и административной панелью.

Сайт: https://apinet.cloud  
Telegram поддержки: https://t.me/apinet_support

## Тех. стек

- **Backend**: Go 1.25+, Gin, GORM v2
- **Frontend**: React 19, TypeScript, Rsbuild, Tailwind CSS, Base UI
- **БД**: SQLite (dev), MySQL / PostgreSQL (prod)
- **Кеш**: Redis + in-memory
- **Frontend пакетный менеджер**: Bun

## Структура проекта

```
router/            HTTP роутинг (API, relay, web)
controller/        Обработчики запросов
service/           Бизнес-логика
model/             Модели данных (GORM)
relay/             Проксирование AI API
  relay/channel/   Адаптеры провайдеров (openai/, claude/, gemini/, ...)
middleware/        Auth, rate limiting, логирование
setting/           Конфигурация (ratio, model, system)
common/            Утилиты (JSON, crypto, Redis, env)
web/
  web/default/     Основной фронтенд (React 19, Rsbuild)
  web/classic/     Классический фронтенд (React 18, Vite)
widget-bot/        Telegram-бот для поддержки виджета (Node.js)
```

## Билд-цикл (ОБЯЗАТЕЛЬНО)

Любое изменение фронтенда требует ОБОИХ шагов — бинарь Go **встраивает** ассеты:

```bash
cd web/default && DISABLE_ESLINT_PLUGIN=true bun run build
go build -buildvcs=false -o new-api .
# затем restart_workflow "Start application"
```

`widget.js` находится в `web/default/public/` — копируется в dist как есть. При изменениях нужен полный пересбор.

## Запуск в Replit

Нужен Go 1.25 и Bun. При чистом импорте выполните из корня проекта:

```bash
cd web/default && bun install --frozen-lockfile && DISABLE_ESLINT_PLUGIN=true bun run build
cd ../..
cd web/stratus && bun install --frozen-lockfile && bun run build
cd ../..
mkdir -p web/classic/dist
printf '%s\n' '<!DOCTYPE html><html><head><title>New API</title></head><body><div id="root"></div></body></html>' > web/classic/dist/index.html
go build -buildvcs=false -o new-api .
```

Затем запустите существующий workflow **Start application** (`PORT=5000 ./new-api`). Доступен основной интерфейс; classic-тема не собрана и заглушка нужна только для обязательного `go:embed` при компиляции. Локально используется SQLite (`one-api.db`, файл игнорируется Git), Redis не обязателен. На первом запуске пройдите мастер настройки в превью и самостоятельно создайте учётную запись администратора. Секрет `SESSION_SECRET` задавайте через Replit Secrets; провайдерские ключи и платёжные интеграции добавляются отдельно. Для публичной эксплуатации включите `SESSION_COOKIE_SECURE=true` и настройте постоянное хранилище данных.

### Третья тема — Stratus Hub

Исходники находятся в `web/stratus/`. Для просмотра без смены текущей темы откройте `/stratus`, `/stratus/docs`, `/stratus/dashboard` или `/stratus/settings`. Включение для всего сайта: административные настройки сайта → «Тема интерфейса» → **Stratus Hub** (`theme.frontend=stratus`); затем перезагрузите страницу. `default` и `classic` остаются отдельными вариантами.

Stratus использует существующую сессию New API и его API для баланса, расходов, журналов, цен и токенов. При активной теме Stratus страницы входа, регистрации, восстановления доступа, двухфакторного подтверждения и OAuth открываются в Stratus, включая существующие ссылки `/login`, `/register`, `/reset` и `/user/reset`. В режиме предпросмотра доступны `/stratus/sign-in` и `/stratus/sign-up`. Проверки регистрации, email, Turnstile, доступные провайдеры и ключи доступа определяются настройками серверной части. Отдельные Clerk, Express и PostgreSQL из дизайн-архива не нужны.

Перенос интерфейса идёт поэтапно: `/setup`, `/wallet` и административные разделы пока используют основной интерфейс. Платёжные механизмы и управление сервером сохраняются в New API; следующие этапы должны перенести их интерфейс в Stratus, а не создавать второй бэкенд. Документация перенесена как справочный контент; примеры не являются реальными ключами или гарантией доступности конкретной модели.

Проверки Stratus: `cd web/stratus && bun run typecheck && bun test tests`. После изменений фронтенда нужны `bun run build` и пересборка Go-сервера, поскольку он встраивает готовые файлы.

Для явно запускаемого заполнения и точного удаления тестовой статистики локального администратора см. `docs/local-usage-fixture.md`. Команда `go run ./cmd/local-usage-fixture` показывает цель без записи; при запуске приложения и в production набор не создаётся.

Для `gpt-5.6-luna` согласован коэффициент обычного текста ×1 при ставке группы 1. При первом запуске обновлённого сервера применяется одноразовая транзакция штатных тарифных настроек только этой модели; балансы и остальные модели не меняются. Последующие правки администратора не перезаписываются. Область формулы, дополнительные расходы, округление и порядок настройки других моделей: `docs/stratus-text-billing.md`.

Для полной сборки можно выполнить `bash scripts/post-merge.sh`. Скрипт собирает оба действующих фронтенда и затем Go, безопасно заменяя исполняемый файл. Перед запуском `go build` обязательна сборка **обоих** фронтендов (`web/default/dist` и `web/stratus/dist`), поскольку Go встраивает их в бинарный файл.

## Кастомные компоненты APINET (защитить при upstream-мержах)

- `web/default/src/features/home/` — лендинг с виджетом, убрана секция "Тарификация моделей"
- `web/default/public/widget.js` — виджет поддержки (прямой режим AI + эскалация к оператору)
- `web/default/index.html` — конфигурация виджета (`window.APINET_WIDGET`)
- `controller/payment_freekassa.go` — FreeKassa платёжный шлюз
- `controller/payment_heleket.go` — Heleket платёжный шлюз
- `controller/payment_pally.go` — Pally платёжный шлюз
- `web/default/src/features/topup/` — UI пополнения с промокодами и RedemptionCodeCard
- `web/default/src/features/wallet/` — кошелёк с виводом средств
- `controller/withdrawal.go` — запросы на вывод средств
- `widget-bot/` — Telegram-бот поддержки (Node.js, SQLite сессии)

## Платёжные шлюзы

### FreeKassa
- Nonce хранится как **signed int32** — использовать Unix seconds (не ms/ns)
- Подпись: `md5(merchantId:amount:secret2:orderId)`

### Heleket
- Подпись: `md5(base64(body) + apiKey)` — **без двоеточия**
- `amount` в топап-API в **USD**, не в кредитах
- `unitPrice` умножается, не делится

### Pally
- Стандартный HMAC webhook

## Виджет поддержки

**Файл:** `web/default/public/widget.js`  
**Конфиг:** `web/default/index.html` → `window.APINET_WIDGET`

Работает в **прямом режиме** (без botUrl): виджет → APINET API → AI модель напрямую.

Возможности:
- Автоматические ответы AI (gpt-5.5)
- Эскалация к оператору: AI пишет `[[OPERATOR]]` → виджет показывает карточку с кнопкой Telegram
- Кнопки-подсказки: AI пишет `[[ACTIONS: Вариант1 | Вариант2]]` → виджет рисует кнопки под ответом
- Кнопка "⚠️ Сообщить о проблеме" → открывает Telegram с историей чата
- 👍/👎 рейтинг ответов
- Бейдж непрочитанных сообщений

Версия виджета в `index.html` (`?v=N`) нужна для сброса кеша браузера при изменениях.

## i18n (интернационализация)

**Frontend:** `web/default/src/i18n/locales/{lang}.json`  
Языки: en, zh, fr, ru, ja, vi  
Ключи — английские строки, файлы используют namespace `translation`:
```json
{ "translation": { "English key": "Перевод" } }
```

**Backend:** `i18n/` (go-i18n, en + zh)

## Правила кодирования (из AGENTS.md)

1. **JSON**: использовать только `common.Marshal` / `common.Unmarshal`, НЕ `encoding/json` напрямую
2. **БД**: совместимость с SQLite + MySQL + PostgreSQL одновременно, предпочитать GORM методы
3. **Frontend**: `bun` как основной пакетный менеджер
4. **Relay DTO**: опциональные поля — pointer types с `omitempty`
5. **Биллинг**: перед изменениями читать `pkg/billingexpr/expr.md`

## Настройки пользователя

- Язык общения: русский
- Не добавлять лишних комментариев в код
- Сохранять существующую структуру проекта
