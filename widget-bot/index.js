'use strict';

const express = require('express');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────────
const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN || '';
const SUPPORT_CHAT_ID  = process.env.TELEGRAM_SUPPORT_CHAT_ID || '';
const ADMIN_IDS        = new Set(
  (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const WIDGET_TOKEN     = process.env.WIDGET_TOKEN || '';
const APINET_BASE      = (process.env.APINET_BASE_URL || 'https://apinet.cloud').replace(/\/$/, '');
const MODEL            = process.env.WIDGET_MODEL || 'gemini-2.5-flash';
const PORT             = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGIN      = process.env.WIDGET_CORS_ORIGIN || '*';
const WEBHOOK_SECRET   = process.env.WEBHOOK_SECRET || 'apinet_widget_hook';
const DB_PATH          = process.env.SESSIONS_DB_PATH || path.join(__dirname, 'sessions.db');

// Validate required config
const missingVars = [];
if (!BOT_TOKEN)       missingVars.push('TELEGRAM_BOT_TOKEN');
if (!SUPPORT_CHAT_ID) missingVars.push('TELEGRAM_SUPPORT_CHAT_ID');
if (!WIDGET_TOKEN)    missingVars.push('WIDGET_TOKEN');
if (missingVars.length) {
  console.warn('[warn] Missing env vars:', missingVars.join(', '));
  console.warn('[warn] Bot will start but functionality may be limited.');
}

// ── SQLite persistent session store ──────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    thread_id   TEXT,
    messages    TEXT NOT NULL DEFAULT '[]',
    pending_reply TEXT,
    lang        TEXT NOT NULL DEFAULT 'ru',
    created_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_thread_id ON sessions(thread_id);
`);

const stmts = {
  upsert: db.prepare(`
    INSERT INTO sessions (session_id, thread_id, messages, pending_reply, lang, created_at)
    VALUES (@session_id, @thread_id, @messages, @pending_reply, @lang, @created_at)
    ON CONFLICT(session_id) DO UPDATE SET
      thread_id     = excluded.thread_id,
      messages      = excluded.messages,
      pending_reply = excluded.pending_reply,
      lang          = excluded.lang
  `),
  getById:       db.prepare('SELECT * FROM sessions WHERE session_id = ?'),
  getByThread:   db.prepare('SELECT * FROM sessions WHERE thread_id = ?'),
  deleteOld:     db.prepare('DELETE FROM sessions WHERE created_at < ?'),
  all:           db.prepare('SELECT * FROM sessions'),
};

function rowToSess(row) {
  return {
    threadId:     row.thread_id || null,
    messages:     JSON.parse(row.messages || '[]'),
    pendingReply: row.pending_reply || null,
    lang:         row.lang || 'ru',
    createdAt:    row.created_at,
  };
}

function persistSess(sessionId, sess) {
  stmts.upsert.run({
    session_id:    sessionId,
    thread_id:     sess.threadId || null,
    messages:      JSON.stringify(sess.messages),
    pending_reply: sess.pendingReply || null,
    lang:          sess.lang,
    created_at:    sess.createdAt,
  });
}

// ── In-memory session cache (restored from DB on startup) ─────────────────────
// sessions[sessionId] = { threadId, messages[], pendingReply, lang, createdAt }
const sessions = new Map();

// topicToSession[thread_id] → sessionId (for routing admin replies)
const topicToSession = new Map();

// Restore all sessions from DB
(function loadSessions() {
  const rows = stmts.all.all();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let restored = 0;
  for (const row of rows) {
    if (row.created_at < cutoff) continue;
    const sess = rowToSess(row);
    sessions.set(row.session_id, sess);
    if (sess.threadId) topicToSession.set(String(sess.threadId), row.session_id);
    restored++;
  }
  console.log(`[db] Restored ${restored} active session(s) from ${DB_PATH}`);
})();

// Clean up sessions older than 24h every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, sess] of sessions) {
    if (sess.createdAt < cutoff) {
      if (sess.threadId) topicToSession.delete(String(sess.threadId));
      sessions.delete(id);
    }
  }
  stmts.deleteOld.run(cutoff);
}, 60 * 60 * 1000);

// ── Telegram Bot API helper ────────────────────────────────────────────────────
function tgRequest(method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ ok: false, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createTopic(sessionId, lang) {
  const time = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const langLabel = lang === 'en' ? '🇬🇧' : '🇷🇺';
  const name = `${langLabel} ${time} · ${sessionId.slice(0, 8)}`;
  const res = await tgRequest('createForumTopic', {
    chat_id: SUPPORT_CHAT_ID,
    name,
    icon_color: 0x6FB9F0,
  });
  if (res.ok) return res.result.message_thread_id;
  console.warn('[tg] createForumTopic failed:', res.description);
  return null;
}

async function sendToTopic(threadId, text, parseMode) {
  const body = {
    chat_id: SUPPORT_CHAT_ID,
    message_thread_id: threadId,
    text,
  };
  if (parseMode) body.parse_mode = parseMode;
  return tgRequest('sendMessage', body);
}

// ── APINET AI call (non-streaming, returns full text) ────────────────────────
function callAI(messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      max_tokens: 1024,
      temperature: 0.5,
    });
    const url = new URL(`${APINET_BASE}/v1/chat/completions`);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WIDGET_TOKEN}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json?.choices?.[0]?.message?.content || '';
          resolve(text);
        } catch {
          reject(new Error(`AI parse error: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── System prompts ─────────────────────────────────────────────────────────────
function getSystemPrompt(lang) {
  if (lang === 'en') {
    return `You are a technical support agent for APINET.CLOUD — an LLM gateway providing access to AI models (OpenAI, Claude, Gemini, DeepSeek, etc.) through a single OpenAI-compatible API.

Reply concisely and clearly. Always respond in English.
When giving instructions — always include a direct link to the relevant page.

## Key Pages
- Login / Register: https://apinet.cloud/login
- API Tokens: https://apinet.cloud/keys
- Top Up Balance: https://apinet.cloud/topup
- Playground (test models): https://apinet.cloud/playground
- Request Log: https://apinet.cloud/log
- Models List: https://apinet.cloud/models
- Channels (providers): https://apinet.cloud/channel
- User Management: https://apinet.cloud/user
- Settings: https://apinet.cloud/setting
- Promo Codes / Redemption: https://apinet.cloud/redemption

## Onboarding
1. Register: https://apinet.cloud/login
2. Create API token: https://apinet.cloud/keys → "Create Token"
3. Top up balance: https://apinet.cloud/topup (Stripe, FreeKassa or promo code)
4. Test in Playground: https://apinet.cloud/playground
5. API Base URL: https://apinet.cloud/v1

## API Tokens
- Create at: https://apinet.cloud/keys → "Create Token" button
- Can be restricted by models, quota, IP
- Token starts with sk-
- If token does not work → check limits at https://apinet.cloud/keys

## Billing
- Top up: https://apinet.cloud/topup — Stripe (card), FreeKassa (RU), promo code
- Transaction history: https://apinet.cloud/log
- Activate promo code: https://apinet.cloud/redemption
- Balance notification settings: https://apinet.cloud/setting

## Errors
- 401 Unauthorized → wrong or missing token. Check: https://apinet.cloud/keys
- 403 Forbidden → model not available for token. Check limits: https://apinet.cloud/keys
- 404 Not Found → wrong endpoint. Use https://apinet.cloud/v1
- 429 Too Many Requests → quota exceeded. Check: https://apinet.cloud/keys or top up: https://apinet.cloud/topup
- 503 Service Unavailable → provider down. Check channels: https://apinet.cloud/channel
- Full request log: https://apinet.cloud/log

## Models
- Full list: https://apinet.cloud/models
- Test a model: https://apinet.cloud/playground
- Routing via channels: https://apinet.cloud/channel
- Default settings: https://apinet.cloud/setting

## Channels (Providers)
- Manage channels: https://apinet.cloud/channel
- Add provider (OpenAI, Anthropic, Google, etc.) → https://apinet.cloud/channel → "Add Channel"
- Routing settings: https://apinet.cloud/setting

## Auth
- Login: https://apinet.cloud/login
- Register: https://apinet.cloud/login (Register tab)
- Profile & 2FA: https://apinet.cloud/setting
- OAuth (GitHub, Google): https://apinet.cloud/login

## Claude Code Setup
\`\`\`bash
export ANTHROPIC_BASE_URL=https://apinet.cloud/v1
export ANTHROPIC_AUTH_TOKEN=sk-YOUR_TOKEN
\`\`\`
Create token at: https://apinet.cloud/keys

If you cannot help or the issue requires account access, direct the user to Telegram: https://t.me/apinet_support

Never invent features that don't exist. Be honest when you don't know.`;
  }
  return `Ты агент технической поддержки сервиса APINET.CLOUD — LLM-шлюза для доступа к AI-моделям (OpenAI, Claude, Gemini, DeepSeek и др.) через единый OpenAI-совместимый API.

Отвечай кратко, чётко и по делу. Всегда отвечай на русском языке.
Когда даёшь инструкции — всегда прикладывай прямую ссылку на нужную страницу.

## Ключевые страницы
- Вход / регистрация: https://apinet.cloud/login
- API-токены: https://apinet.cloud/keys
- Пополнение баланса: https://apinet.cloud/topup
- Playground (тест моделей): https://apinet.cloud/playground
- Лог запросов: https://apinet.cloud/log
- Список моделей: https://apinet.cloud/models
- Каналы (провайдеры): https://apinet.cloud/channel
- Управление пользователями: https://apinet.cloud/user
- Настройки: https://apinet.cloud/setting
- Промокоды / redemption: https://apinet.cloud/redemption

## Онбординг
1. Зарегистрируйся: https://apinet.cloud/login
2. Создай API-токен: https://apinet.cloud/keys → "Создать токен"
3. Пополни баланс: https://apinet.cloud/topup (Stripe, FreeKassa или промокод)
4. Протестируй в Playground: https://apinet.cloud/playground
5. Base URL для API: https://apinet.cloud/v1

## API-токены
- Создание: https://apinet.cloud/keys → кнопка "Создать токен"
- Можно ограничить по моделям, квоте, IP
- Токен начинается с sk-
- Если токен не работает → проверь лимиты на https://apinet.cloud/keys

## Биллинг
- Пополнение: https://apinet.cloud/topup — Stripe (карта), FreeKassa (RU), промокод
- История транзакций: https://apinet.cloud/log
- Активировать промокод: https://apinet.cloud/redemption
- Настройки уведомлений о балансе: https://apinet.cloud/setting

## Ошибки
- 401 Unauthorized → токен неверный или не указан. Проверь: https://apinet.cloud/keys
- 403 Forbidden → модель недоступна для токена. Проверь лимиты: https://apinet.cloud/keys
- 404 Not Found → неверный endpoint. Используй https://apinet.cloud/v1
- 429 Too Many Requests → превышен лимит. Проверь квоту: https://apinet.cloud/keys или пополни: https://apinet.cloud/topup
- 503 Service Unavailable → провайдер недоступен. Проверь каналы: https://apinet.cloud/channel
- Лог всех запросов: https://apinet.cloud/log

## Модели
- Список всех моделей: https://apinet.cloud/models
- Тест модели: https://apinet.cloud/playground
- Маршрутизация через каналы: https://apinet.cloud/channel
- Настройки по умолчанию: https://apinet.cloud/setting

## Каналы (провайдеры)
- Управление каналами: https://apinet.cloud/channel
- Добавить провайдера (OpenAI, Anthropic, Google и др.) → https://apinet.cloud/channel → "Добавить канал"
- Настройки маршрутизации: https://apinet.cloud/setting

## Авторизация
- Вход: https://apinet.cloud/login
- Регистрация: https://apinet.cloud/login (вкладка "Регистрация")
- Профиль и 2FA: https://apinet.cloud/setting
- OAuth (GitHub, Google): https://apinet.cloud/login

## Настройка Claude Code
\`\`\`bash
export ANTHROPIC_BASE_URL=https://apinet.cloud/v1
export ANTHROPIC_AUTH_TOKEN=sk-ВАШ_ТОКЕН
\`\`\`
Токен создаётся на: https://apinet.cloud/keys

Если не можешь помочь или проблема требует доступа к аккаунту — отправь пользователя в Telegram: https://t.me/apinet_support

Никогда не выдумывай функции которых нет. Если не знаешь — скажи честно.`;
}

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS middleware
app.use((req, res, next) => {
  const origin = CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── POST /widget/message ───────────────────────────────────────────────────────
// Widget sends user message → bot calls AI → forwards to Telegram → returns AI reply
app.post('/widget/message', async (req, res) => {
  const { sessionId, message, lang = 'ru' } = req.body || {};

  if (!sessionId || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'sessionId and message required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'message too long' });
  }

  // Get or create session (check DB if not in memory cache)
  let sess = sessions.get(sessionId);
  if (!sess) {
    const row = stmts.getById.get(sessionId);
    if (row) {
      sess = rowToSess(row);
      sessions.set(sessionId, sess);
      if (sess.threadId) topicToSession.set(String(sess.threadId), sessionId);
    } else {
      sess = { threadId: null, messages: [], pendingReply: null, lang, createdAt: Date.now() };
      sessions.set(sessionId, sess);
    }
  }

  // Build message history
  sess.messages.push({ role: 'user', content: message });
  const historySlice = sess.messages.slice(-10);

  // Call AI
  let aiReply = '';
  try {
    aiReply = await callAI([
      { role: 'system', content: getSystemPrompt(sess.lang) },
      ...historySlice,
    ]);
    sess.messages.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    console.error('[ai] error:', err.message);
    sess.messages.pop();
    return res.status(502).json({ error: 'AI unavailable', details: err.message });
  }

  // Telegram: create topic on first message, then send
  if (BOT_TOKEN && SUPPORT_CHAT_ID) {
    try {
      if (!sess.threadId) {
        sess.threadId = await createTopic(sessionId, sess.lang);
        if (sess.threadId) {
          topicToSession.set(String(sess.threadId), sessionId);
          // Send session info header
          const header = sess.lang === 'en'
            ? `🆔 Session: \`${sessionId}\`\n🌐 Language: English`
            : `🆔 Сессия: \`${sessionId}\`\n🌐 Язык: Русский`;
          await sendToTopic(sess.threadId, header, 'Markdown');
        }
      }
      if (sess.threadId) {
        const userMsg = sess.lang === 'en'
          ? `👤 *User:*\n${message}`
          : `👤 *Пользователь:*\n${message}`;
        await sendToTopic(sess.threadId, userMsg, 'Markdown');

        const botMsg = sess.lang === 'en'
          ? `🤖 *AI reply:*\n${aiReply}`
          : `🤖 *Ответ AI:*\n${aiReply}`;
        await sendToTopic(sess.threadId, botMsg, 'Markdown');
      }
    } catch (err) {
      console.warn('[tg] send error:', err.message);
    }
  }

  // Persist updated session to DB
  persistSess(sessionId, sess);

  res.json({ reply: aiReply, sessionId });
});

// ── GET /widget/poll ───────────────────────────────────────────────────────────
// Widget polls for admin reply (every 3s while chat is open)
app.get('/widget/poll', (req, res) => {
  const { session } = req.query;
  if (!session) return res.status(400).json({ error: 'session required' });

  const sess = sessions.get(session);
  if (!sess) return res.json({ reply: null });

  const reply = sess.pendingReply || null;
  if (reply) {
    sess.pendingReply = null;
    persistSess(session, sess);
  }
  res.json({ reply });
});

// ── Telegram: send message to user (direct chat) ──────────────────────────────
function tgSendToUser(chatId, text, extra = {}) {
  return tgRequest('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🌐 Открыть APINET.CLOUD', url: 'https://apinet.cloud' }],
      [{ text: '💬 Чат поддержки на сайте', url: 'https://apinet.cloud' }],
      [{ text: '📣 Telegram поддержки', url: 'https://t.me/apinet_support' }],
    ],
  };
}

// ── POST /telegram/webhook/<secret> ───────────────────────────────────────────
// Telegram sends updates here (admin replies in topics + user direct messages)
app.post(`/telegram/webhook/${WEBHOOK_SECRET}`, (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  const msg = update?.message;
  if (!msg) return;

  const senderId = String(msg.from?.id || '');
  const chatId = msg.chat?.id;
  const text = msg.text || '';
  const threadId = msg.message_thread_id;

  if (!text) return;

  // ── Direct messages from users (not in a topic) ────────────────────────────
  if (!threadId) {
    if (text.startsWith('/start')) {
      const firstName = msg.from?.first_name || 'пользователь';
      tgSendToUser(chatId,
        `👋 Привет, <b>${firstName}</b>!\n\n` +
        `Я бот технической поддержки <b>APINET.CLOUD</b> — AI API шлюза.\n\n` +
        `Для общения со службой поддержки используйте чат на сайте — ` +
        `там AI ответит мгновенно, а если нужен оператор — подключим живого специалиста.`,
        { reply_markup: startKeyboard() }
      );
    } else {
      tgSendToUser(chatId,
        `💬 Для обращения в поддержку воспользуйтесь чатом на сайте или напишите нам в Telegram.`,
        { reply_markup: startKeyboard() }
      );
    }
    return;
  }

  // Check admin whitelist — fail-closed: reject ALL if ADMIN_IDS is empty
  if (!ADMIN_IDS.has(senderId)) {
    console.log(`[tg] ignored reply from non-admin ${senderId}`);
    return;
  }

  // Map topic → session (check DB if not in memory)
  let sessionId = topicToSession.get(String(threadId));
  if (!sessionId) {
    const row = stmts.getByThread.get(String(threadId));
    if (row) {
      sessionId = row.session_id;
      const sess = rowToSess(row);
      sessions.set(sessionId, sess);
      topicToSession.set(String(threadId), sessionId);
    }
  }

  if (!sessionId) {
    console.log(`[tg] no session for thread ${threadId}`);
    return;
  }

  const sess = sessions.get(sessionId);
  if (!sess) return;

  // Store admin reply for widget to pick up via poll
  sess.pendingReply = text;
  sess.messages.push({ role: 'assistant', content: `[Admin] ${text}` });
  persistSess(sessionId, sess);

  console.log(`[admin] reply for session ${sessionId.slice(0, 8)}: ${text.slice(0, 60)}`);
});

// ── POST /widget/rate ──────────────────────────────────────────────────────────
// Widget sends rating after a bot/admin reply (👍 / 👎)
app.post('/widget/rate', async (req, res) => {
  const { sessionId, rating } = req.body || {};
  if (!sessionId || !rating) return res.status(400).json({ error: 'sessionId and rating required' });

  const sess = sessions.get(sessionId);
  if (!sess || !sess.threadId) return res.json({ ok: true });

  const emoji = rating === 'good' ? '👍' : '👎';
  const text = sess.lang === 'en'
    ? `${emoji} User rated the last reply as: ${rating === 'good' ? 'helpful' : 'not helpful'}`
    : `${emoji} Пользователь оценил последний ответ: ${rating === 'good' ? 'полезно' : 'не помогло'}`;

  try {
    await sendToTopic(sess.threadId, text);
  } catch (err) {
    console.warn('[tg] rate send error:', err.message);
  }
  res.json({ ok: true });
});

// ── GET /health ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    sessions: sessions.size,
    bot: !!BOT_TOKEN,
    admins: ADMIN_IDS.size,
  });
});

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[bot] Widget bridge listening on port ${PORT}`);
  console.log(`[bot] Telegram webhook path: /telegram/webhook/${WEBHOOK_SECRET}`);
  console.log(`[bot] Sessions DB: ${DB_PATH}`);
  if (ADMIN_IDS.size === 0) {
    console.warn('[bot] ADMIN_IDS is not set — all Telegram replies will be rejected. Set ADMIN_IDS to enable admin replies.');
  } else {
    console.log(`[bot] Admin IDs: ${[...ADMIN_IDS].join(', ')}`);
  }
  if (!BOT_TOKEN) console.warn('[bot] TELEGRAM_BOT_TOKEN not set — Telegram integration disabled');
  if (!WIDGET_TOKEN) console.warn('[bot] WIDGET_TOKEN not set — AI calls will fail');

  // Register webhook with Telegram if WEBHOOK_URL is set
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl && BOT_TOKEN) {
    const fullUrl = `${webhookUrl.replace(/\/$/, '')}/telegram/webhook/${WEBHOOK_SECRET}`;
    tgRequest('setWebhook', { url: fullUrl, allowed_updates: ['message'] })
      .then(r => console.log(`[tg] Webhook set: ${fullUrl} →`, r.ok ? 'ok' : r.description))
      .catch(e => console.warn('[tg] Webhook set error:', e.message));
  }
});
