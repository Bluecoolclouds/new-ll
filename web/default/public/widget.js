(function () {
  'use strict';

  const cfg = window.APINET_WIDGET || {};
  const API_BASE  = cfg.baseUrl || 'https://apinet.cloud';
  const API_TOKEN = cfg.token  || '';
  const BOT_URL   = (cfg.botUrl || '').replace(/\/$/, '');
  const MODEL     = cfg.model  || 'gemini-2.5-flash';
  const TG_LINK   = cfg.telegram || 'https://t.me/apinet_support';

  const BOT_MODE = !!BOT_URL;

  const SESSION_ID = (function () {
    let id = sessionStorage.getItem('aw_session');
    if (!id) {
      id = 'aw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('aw_session', id);
    }
    return id;
  })();

  function detectLang() {
    if (cfg.lang) return cfg.lang.startsWith('en') ? 'en' : 'ru';
    const siteLang = document.documentElement.lang || '';
    if (siteLang.startsWith('en')) return 'en';
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('en')) return 'en';
    return 'ru';
  }
  const LANG = detectLang();

  const T = {
    ru: {
      title: 'Поддержка APINET',
      subtitle: 'Обычно отвечаем моментально',
      tgLabel: 'Связь в Telegram',
      placeholder: 'Напишите вопрос…',
      supportLabel: 'Поддержка',
      errorMsg: (code, tg) => `Ошибка ${code}. Попробуйте позже или напишите в [Telegram](${tg}).`,
      connectErr: (tg) => `Не удалось подключиться к серверу. Проверьте соединение или напишите в [Telegram](${tg}).`,
      noToken: '⚠️ Виджет не настроен — не указан API токен.\n\nДобавьте перед тегом `<script>`:\n```\nwindow.APINET_WIDGET = { token: "sk-..." };\n```',
      noBotUrl: '⚠️ Виджет не настроен — не указан botUrl.\n\nДобавьте:\n```\nwindow.APINET_WIDGET = { botUrl: "https://your-bot.replit.app" };\n```',
      welcome: 'Привет! 👋 Я помогаю с вопросами по APINET.CLOUD.\n\nСпросите про:\n- Создание токена и пополнение баланса\n- Ошибки API (401, 403, 503…)\n- Настройку Claude Code\n- Доступные модели\n\nЧем могу помочь?',
      ariaOpen: 'Открыть чат поддержки',
      ariaClose: 'Закрыть',
      ariaSend: 'Отправить',
      reportBtn: '⚠️ Сообщить о проблеме',
      reportTemplate: 'У меня проблема:\n- Приложение: \n- Код ошибки: \n- Текст ошибки: \n- Название API-ключа: ',
      chips: ['Как создать API-ключ?', 'Ошибка 401', 'Пополнить баланс', 'Список моделей'],
      rateGood: 'Полезно',
      rateBad: 'Не помогло',
      rateThanks: 'Спасибо за оценку!',
      unread: 'непрочитанных',
      escalateLabel: 'Нужна помощь специалиста?',
      escalateSub: 'Напишите нам — живой специалист ответит',
      escalateBtn: 'Написать в Telegram',
      reportTgMsg: 'Здравствуйте! Сообщаю о проблеме.\n\nИстория чата:\n',
    },
    en: {
      title: 'APINET Support',
      subtitle: 'Usually replies instantly',
      tgLabel: 'Contact via Telegram',
      placeholder: 'Type your question…',
      supportLabel: 'Support',
      errorMsg: (code, tg) => `Error ${code}. Please try again or contact us on [Telegram](${tg}).`,
      connectErr: (tg) => `Could not connect to the server. Check your connection or reach us on [Telegram](${tg}).`,
      noToken: '⚠️ Widget not configured — API token is missing.\n\nAdd before `<script>`:\n```\nwindow.APINET_WIDGET = { token: "sk-..." };\n```',
      noBotUrl: '⚠️ Widget not configured — botUrl is missing.\n\nAdd:\n```\nwindow.APINET_WIDGET = { botUrl: "https://your-bot.replit.app" };\n```',
      welcome: 'Hi! 👋 I can help with APINET.CLOUD questions.\n\nAsk me about:\n- Creating tokens and topping up balance\n- API errors (401, 403, 503…)\n- Setting up Claude Code\n- Available models\n\nHow can I help?',
      ariaOpen: 'Open support chat',
      ariaClose: 'Close',
      ariaSend: 'Send',
      reportBtn: '⚠️ Report an issue',
      reportTemplate: 'I have an issue:\n- App: \n- Error code: \n- Error message: \n- API key name: ',
      chips: ['How to create an API key?', 'Error 401', 'Top up balance', 'Available models'],
      rateGood: 'Helpful',
      rateBad: 'Not helpful',
      rateThanks: 'Thanks for your feedback!',
      unread: 'unread',
      escalateLabel: 'Need help from a specialist?',
      escalateSub: 'Write to us — a human will reply',
      escalateBtn: 'Open Telegram',
      reportTgMsg: 'Hello! I want to report an issue.\n\nChat history:\n',
    },
  };
  const t = T[LANG];

  const SYSTEM_PROMPT = cfg.systemPrompt || (LANG === 'en'
    ? `You are a technical support agent for APINET.CLOUD — an LLM gateway that provides access to AI models (OpenAI, Claude, Gemini, DeepSeek, etc.) through a single OpenAI-compatible API.

Reply concisely and clearly. Always respond in English.

Main topics:
- Registration and first login
- API tokens: creation, quota limits, model restrictions
- Wallet top-up: Stripe, FreeKassa, promo/redemption codes
- Errors: 401, 403, 404, 429, 503 and their causes
- Setting up Claude Code with base_url and ANTHROPIC_AUTH_TOKEN
- Available models and their names
- Channels and routing

API Base URL: https://apinet.cloud/v1
Tokens are created at: https://apinet.cloud/keys

ESCALATION RULE: If the user's problem requires manual account access (balance corrections, bans, billing disputes, bugs), or the user explicitly asks for a human/operator, start your reply with the exact tag [[OPERATOR]] on its own line, then write: "Please contact our support team in Telegram." Do NOT say anything about an operator connecting or joining.

SUGGESTED ACTIONS: At the end of your reply, you may suggest 2-4 follow-up buttons by appending: [[ACTIONS: Label1 | Label2 | Label3]]
Use this when the user might want to explore next steps, for example after answering about errors suggest: [[ACTIONS: Как создать токен? | Пополнить баланс | Другая ошибка]]
Do NOT add [[ACTIONS]] if you used [[OPERATOR]].

Never invent features that don't exist. Be honest when you don't know.`
    : `Ты агент технической поддержки сервиса APINET.CLOUD — LLM-шлюза, который предоставляет доступ к AI-моделям (OpenAI, Claude, Gemini, DeepSeek и др.) через единый OpenAI-совместимый API.

Отвечай кратко, чётко и по делу. Всегда отвечай на русском языке.

Основные темы:
- Регистрация и первый вход
- API-токены: создание, лимиты квоты, ограничения по моделям
- Пополнение баланса: Stripe, FreeKassa, промокоды
- Ошибки: 401, 403, 404, 429, 503 и их причины
- Настройка Claude Code: base_url, ANTHROPIC_AUTH_TOKEN
- Доступные модели и их названия
- Каналы и маршрутизация

Base URL для API: https://apinet.cloud/v1
Токены создаются на странице: https://apinet.cloud/keys

ПРАВИЛО ЭСКАЛАЦИИ: Если проблема пользователя требует ручного доступа к аккаунту (корректировка баланса, баны, споры по оплате, ошибки платформы), или пользователь явно просит живого оператора/человека — начни ответ с тега [[OPERATOR]] на отдельной строке, затем напиши: "Свяжитесь с нашей службой поддержки в Telegram." Не пиши ничего про подключение оператора или что кто-то скоро ответит.

КНОПКИ: В конце ответа ты можешь предложить 2-4 варианта следующего шага, добавив в самом конце: [[ACTIONS: Вариант1 | Вариант2 | Вариант3]]
Используй кнопки когда есть очевидные следующие шаги — например, после ответа про ошибку: [[ACTIONS: Как создать токен? | Пополнить баланс | Другая ошибка]]
НЕ добавляй [[ACTIONS]] если уже использовал [[OPERATOR]].

Никогда не выдумывай функции которых нет. Если не знаешь — скажи честно.`
  );

  const ICON_TG    = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.68 7.91c-.12.57-.46.71-.93.44l-2.58-1.9-1.24 1.2c-.14.14-.26.26-.52.26l.18-2.62 4.74-4.28c.21-.18-.04-.28-.32-.1L7.9 14.38 5.36 13.6c-.56-.17-.57-.56.12-.83l8.91-3.44c.47-.17.88.11.72.83z"/></svg>`;
  const ICON_CHAT  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const ICON_SEND  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const ICON_BOT   = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.38-1 1.72V7h1a7 7 0 017 7H3a7 7 0 017-7h1V5.72A2 2 0 0112 2zM7.5 14a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.5 3a1 1 0 100 2 1 1 0 000-2zm-5 3h12l-1 2H7l-1-2z"/></svg>`;

  const STYLES = `
    #apinet-widget-btn-wrap {
      position: fixed !important; bottom: 24px !important; right: 24px !important;
      z-index: 999999 !important; width: 56px !important; height: 56px !important;
    }
    #apinet-widget-btn {
      position: absolute !important; inset: 0 !important;
      width: 100% !important; height: 100% !important; border-radius: 50% !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      box-shadow: 0 4px 20px rgba(37,99,235,0.45) !important;
      border: none !important; cursor: pointer !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      transition: transform 0.2s, box-shadow 0.2s !important;
      color: white !important;
    }
    #apinet-widget-btn:hover { transform: scale(1.08) !important; box-shadow: 0 6px 26px rgba(37,99,235,0.55) !important; }
    #apinet-widget-btn svg { width: 26px !important; height: 26px !important; color: white !important; fill: white !important; }
    #apinet-widget-badge {
      display: none !important;
      position: absolute !important; top: -4px !important; right: -4px !important;
      min-width: 20px !important; height: 20px !important; border-radius: 10px !important;
      background: #ef4444 !important; color: white !important; font-size: 11px !important;
      font-weight: 700 !important; align-items: center !important;
      justify-content: center !important; padding: 0 5px !important; border: 2px solid white !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      pointer-events: none !important;
      box-sizing: border-box !important;
    }
    #apinet-widget-badge.visible {
      display: flex !important;
      animation: aw-badge-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) !important;
    }
    @keyframes aw-badge-pop { from { transform: scale(0); } to { transform: scale(1); } }
    #apinet-widget-panel {
      position: fixed !important; bottom: 92px !important; right: 24px !important;
      z-index: 999998 !important; width: 360px !important;
      max-width: calc(100vw - 32px) !important;
      height: 560px !important; max-height: calc(100vh - 120px) !important;
      background: #ffffff !important; border-radius: 16px !important;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18) !important;
      display: flex !important; flex-direction: column !important; overflow: hidden !important;
      opacity: 0 !important; transform: translateY(16px) scale(0.97) !important;
      pointer-events: none !important;
      transition: opacity 0.22s ease, transform 0.22s ease !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      color: #1e293b !important;
    }
    #apinet-widget-panel *, #apinet-widget-panel *::before, #apinet-widget-panel *::after {
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    }
    #apinet-widget-panel.open {
      opacity: 1 !important; transform: translateY(0) scale(1) !important;
      pointer-events: all !important;
    }
    .aw-header {
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      padding: 12px 14px 0 !important; display: flex !important;
      flex-direction: column !important; flex-shrink: 0 !important;
    }
    .aw-header-top { display: flex !important; align-items: center !important; gap: 10px !important; padding-bottom: 10px !important; }
    .aw-header-icon {
      width: 32px !important; height: 32px !important;
      background: rgba(255,255,255,0.2) !important; border-radius: 50% !important;
      display: flex !important; align-items: center !important;
      justify-content: center !important; flex-shrink: 0 !important;
    }
    .aw-header-icon svg { width: 16px !important; height: 16px !important; fill: white !important; }
    .aw-header-text { flex: 1 !important; }
    .aw-header-title { color: white !important; font-weight: 600 !important; font-size: 14px !important; line-height: 1.2 !important; }
    .aw-header-sub { color: rgba(255,255,255,0.75) !important; font-size: 11px !important; margin-top: 1px !important; }
    .aw-close {
      background: transparent !important; border: none !important; cursor: pointer !important;
      padding: 4px !important; color: rgba(255,255,255,0.8) !important;
      border-radius: 6px !important; display: flex !important; transition: background 0.15s !important;
    }
    .aw-close:hover { background: rgba(255,255,255,0.15) !important; color: white !important; }
    .aw-close svg { width: 18px !important; height: 18px !important; fill: currentColor !important; }
    .aw-tg-bar {
      background: rgba(255,255,255,0.12) !important; border-radius: 8px !important; margin: 0 0 8px !important;
      display: flex !important; align-items: center !important; gap: 7px !important;
      padding: 7px 10px !important; text-decoration: none !important; cursor: pointer !important;
      transition: background 0.15s !important; border: 1px solid rgba(255,255,255,0.2) !important;
    }
    .aw-tg-bar:hover { background: rgba(255,255,255,0.2) !important; }
    .aw-tg-bar svg { width: 16px !important; height: 16px !important; fill: white !important; flex-shrink: 0 !important; }
    .aw-tg-bar span { color: white !important; font-size: 12.5px !important; font-weight: 500 !important; }
    .aw-report-bar {
      background: rgba(255,255,255,0.10) !important; border-radius: 8px !important;
      margin: 0 0 10px !important; display: flex !important; align-items: center !important;
      gap: 7px !important; padding: 6px 10px !important; cursor: pointer !important;
      transition: background 0.15s !important; border: 1px solid rgba(255,255,255,0.15) !important;
      color: rgba(255,255,255,0.9) !important; font-size: 12px !important; font-weight: 500 !important;
      width: 100% !important; text-align: left !important;
    }
    .aw-report-bar:hover { background: rgba(255,255,255,0.18) !important; }
    .aw-actions {
      display: flex !important; flex-wrap: wrap !important; gap: 6px !important;
      margin-top: 6px !important; padding: 0 2px !important;
    }
    .aw-action-btn {
      background: #eff6ff !important; border: 1.5px solid #bfdbfe !important;
      border-radius: 16px !important; padding: 5px 12px !important;
      font-size: 12px !important; color: #1d4ed8 !important; cursor: pointer !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      white-space: nowrap !important; font-weight: 500 !important;
    }
    .aw-action-btn:hover { background: #2563eb !important; color: white !important; border-color: #2563eb !important; }
    .aw-messages {
      flex: 1 !important; overflow-y: auto !important; padding: 14px 12px !important;
      display: flex !important; flex-direction: column !important; gap: 10px !important;
      scroll-behavior: smooth !important; background: #ffffff !important; color: #1e293b !important;
    }
    .aw-messages::-webkit-scrollbar { width: 4px; }
    .aw-messages::-webkit-scrollbar-track { background: transparent; }
    .aw-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
    .aw-msg { max-width: 88% !important; display: flex !important; flex-direction: column !important; gap: 3px !important; }
    .aw-msg.user   { align-self: flex-end !important; }
    .aw-msg.bot    { align-self: flex-start !important; }
    .aw-msg.admin  { align-self: flex-start !important; }
    .aw-msg-label  { font-size: 10px !important; font-weight: 600 !important; color: #64748b !important; padding: 0 2px !important; letter-spacing: 0.03em !important; }
    .aw-bubble {
      padding: 9px 13px !important; border-radius: 14px !important;
      font-size: 13.5px !important; line-height: 1.5 !important;
      word-break: break-word !important; white-space: pre-wrap !important;
    }
    .aw-msg.user  .aw-bubble { background: #2563eb !important; color: white !important; border-bottom-right-radius: 4px !important; }
    .aw-msg.bot   .aw-bubble { background: #f1f5f9 !important; color: #1e293b !important; border-bottom-left-radius: 4px !important; }
    .aw-msg.admin .aw-bubble { background: #ecfdf5 !important; color: #064e3b !important; border-bottom-left-radius: 4px !important; border: 1px solid #a7f3d0 !important; }
    .aw-bubble a { color: #2563eb !important; }
    .aw-msg.bot .aw-bubble code, .aw-msg.admin .aw-bubble code {
      background: #e2e8f0 !important; padding: 1px 5px !important; border-radius: 4px !important;
      font-size: 12px !important; font-family: monospace !important; color: #1e293b !important;
    }
    .aw-msg.bot .aw-bubble pre, .aw-msg.admin .aw-bubble pre {
      background: #1e293b !important; color: #e2e8f0 !important; padding: 10px 12px !important;
      border-radius: 8px !important; overflow-x: auto !important;
      font-size: 12px !important; margin: 6px 0 !important; white-space: pre !important;
    }
    .aw-msg.bot .aw-bubble pre code, .aw-msg.admin .aw-bubble pre code {
      background: transparent !important; padding: 0 !important; color: #e2e8f0 !important;
    }
    .aw-rating { display: flex !important; align-items: center !important; gap: 6px !important; margin-top: 4px !important; padding: 0 2px !important; }
    .aw-rate-btn {
      background: transparent !important; border: 1px solid #e2e8f0 !important;
      border-radius: 6px !important; padding: 2px 8px !important; font-size: 12px !important;
      cursor: pointer !important; color: #64748b !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
    }
    .aw-rate-btn:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #1e293b !important; }
    .aw-rate-btn.good:hover { background: #dcfce7 !important; border-color: #86efac !important; color: #15803d !important; }
    .aw-rate-btn.bad:hover  { background: #fee2e2 !important; border-color: #fca5a5 !important; color: #b91c1c !important; }
    .aw-rate-thanks { font-size: 11px !important; color: #94a3b8 !important; font-style: italic !important; }
    .aw-typing { display: flex !important; align-items: center !important; gap: 4px !important; padding: 10px 13px !important; background: #f1f5f9 !important; border-radius: 14px !important; }
    .aw-typing span { width: 7px !important; height: 7px !important; border-radius: 50% !important; background: #94a3b8 !important; animation: aw-bounce 1.2s infinite !important; display: block !important; }
    .aw-typing span:nth-child(2) { animation-delay: 0.2s !important; }
    .aw-typing span:nth-child(3) { animation-delay: 0.4s !important; }
    @keyframes aw-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
    .aw-footer {
      padding: 10px 12px !important; border-top: 1px solid #e2e8f0 !important;
      display: flex !important; gap: 8px !important; flex-shrink: 0 !important;
      background: #ffffff !important;
    }
    .aw-input {
      flex: 1 !important; border: 1.5px solid #e2e8f0 !important; border-radius: 10px !important;
      padding: 9px 12px !important; font-size: 13.5px !important; outline: none !important;
      resize: none !important; transition: border-color 0.15s !important;
      line-height: 1.4 !important; max-height: 90px !important; overflow-y: auto !important;
      color: #1e293b !important; background: #ffffff !important;
    }
    .aw-input:focus { border-color: #2563eb !important; }
    .aw-input::placeholder { color: #94a3b8 !important; }
    .aw-send {
      width: 38px !important; height: 38px !important; border-radius: 10px !important;
      background: #2563eb !important; border: none !important; cursor: pointer !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      flex-shrink: 0 !important; align-self: flex-end !important;
      transition: background 0.15s, transform 0.1s !important;
      color: white !important;
    }
    .aw-send:hover { background: #1d4ed8 !important; }
    .aw-send:active { transform: scale(0.95) !important; }
    .aw-send:disabled { background: #93c5fd !important; cursor: not-allowed !important; }
    .aw-send svg { width: 17px !important; height: 17px !important; fill: white !important; }
    .aw-powered {
      font-size: 10px !important; color: #cbd5e1 !important; text-align: center !important;
      padding: 0 0 7px !important; flex-shrink: 0 !important;
      letter-spacing: 0.01em !important; background: #ffffff !important;
    }
    .aw-escalate {
      margin: 10px 0 0 !important; border-radius: 14px !important;
      border: 1.5px solid #e2e8f0 !important; background: #f8fafc !important;
      padding: 14px 16px !important; display: flex !important;
      flex-direction: column !important; gap: 10px !important;
    }
    .aw-escalate-head {
      display: flex !important; align-items: center !important; gap: 10px !important;
    }
    .aw-escalate-icon {
      width: 36px !important; height: 36px !important; flex-shrink: 0 !important;
      background: #229ed9 !important; border-radius: 50% !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
    }
    .aw-escalate-icon svg { width: 20px !important; height: 20px !important; fill: white !important; }
    .aw-escalate-body { min-width: 0 !important; }
    .aw-escalate-title {
      font-size: 13px !important; font-weight: 700 !important;
      color: #0f172a !important; line-height: 1.3 !important; margin: 0 0 1px !important;
    }
    .aw-escalate-sub {
      font-size: 11.5px !important; color: #64748b !important; line-height: 1.4 !important;
    }
    .aw-escalate-btn {
      display: flex !important; align-items: center !important; justify-content: center !important;
      gap: 6px !important; background: #229ed9 !important; color: white !important;
      font-size: 13px !important; font-weight: 600 !important;
      border-radius: 9px !important; padding: 9px 14px !important;
      text-decoration: none !important; transition: background 0.15s !important;
      width: 100% !important; box-sizing: border-box !important;
    }
    .aw-escalate-btn:hover { background: #1a8bbf !important; }
    .aw-escalate-btn svg { width: 15px !important; height: 15px !important; fill: white !important; flex-shrink: 0 !important; }
  `;

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMarkdown(text) {
    let h = escapeHtml(text);
    // Code blocks first (protect content inside)
    const blocks = [];
    h = h.replace(/```[\s\S]*?```/g, function (m) {
      const code = m.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
      blocks.push(`<pre><code>${code}</code></pre>`);
      return '\x00BLOCK' + (blocks.length - 1) + '\x00';
    });
    // Inline code
    const inlines = [];
    h = h.replace(/`([^`]+)`/g, function (_, c) {
      inlines.push(`<code>${c}</code>`);
      return '\x00INLINE' + (inlines.length - 1) + '\x00';
    });
    // Headers: ###, ##, # → bold line
    h = h.replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>');
    // Bold
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Bullet lists: lines starting with - or *
    h = h.replace(/^[-*]\s+(.+)$/gm, '• $1');
    // Links
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)"]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // Restore blocks
    h = h.replace(/\x00INLINE(\d+)\x00/g, function (_, i) { return inlines[+i]; });
    h = h.replace(/\x00BLOCK(\d+)\x00/g, function (_, i) { return blocks[+i]; });
    return h;
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    // ── Button wrapper (for badge positioning) ──────────────────────────────
    const btnWrap = document.createElement('div');
    btnWrap.id = 'apinet-widget-btn-wrap';
    btnWrap.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;width:56px;height:56px;';

    const btn = document.createElement('button');
    btn.id = 'apinet-widget-btn';
    btn.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    btn.setAttribute('aria-label', t.ariaOpen);
    btn.innerHTML = ICON_CHAT;
    btnWrap.appendChild(btn);

    const badge = document.createElement('div');
    badge.id = 'apinet-widget-badge';
    btnWrap.appendChild(badge);

    const panel = document.createElement('div');
    panel.id = 'apinet-widget-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t.title);
    panel.innerHTML = `
      <div class="aw-header">
        <div class="aw-header-top">
          <div class="aw-header-icon">${ICON_BOT}</div>
          <div class="aw-header-text">
            <div class="aw-header-title">${t.title}</div>
            <div class="aw-header-sub">${t.subtitle}</div>
          </div>
          <button class="aw-close" aria-label="${t.ariaClose}">${ICON_CLOSE}</button>
        </div>
        <a class="aw-tg-bar" href="${TG_LINK}" target="_blank" rel="noopener">
          ${ICON_TG}<span>${t.tgLabel}</span>
        </a>
        <button class="aw-report-bar" id="aw-report-btn">${t.reportBtn}</button>
      </div>
      <div class="aw-messages" id="aw-messages"></div>
      <div class="aw-footer">
        <textarea class="aw-input" id="aw-input" placeholder="${t.placeholder}" rows="1" maxlength="2000"></textarea>
        <button class="aw-send" id="aw-send" aria-label="${t.ariaSend}">${ICON_SEND}</button>
      </div>
      <div class="aw-powered">APINET.CLOUD · AI Support</div>
    `;

    document.body.appendChild(btnWrap);
    document.body.appendChild(panel);

    const messagesEl = panel.querySelector('#aw-messages');
    const inputEl    = panel.querySelector('#aw-input');
    const sendBtn    = panel.querySelector('#aw-send');
    const reportBtn  = panel.querySelector('#aw-report-btn');
    let isOpen      = false;
    let isStreaming  = false;
    const history   = [];
    let pollTimer   = null;
    let unreadCount = 0;

    // ── Unread badge ─────────────────────────────────────────────────────────
    function incrementUnread() {
      if (isOpen) return;
      unreadCount++;
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      badge.classList.add('visible');
    }

    function clearUnread() {
      unreadCount = 0;
      badge.classList.remove('visible');
    }


    // ── Rating row ───────────────────────────────────────────────────────────
    function addRating(msgEl) {
      const row = document.createElement('div');
      row.className = 'aw-rating';

      const goodBtn = document.createElement('button');
      goodBtn.className = 'aw-rate-btn good';
      goodBtn.textContent = '👍 ' + t.rateGood;

      const badBtn = document.createElement('button');
      badBtn.className = 'aw-rate-btn bad';
      badBtn.textContent = '👎 ' + t.rateBad;

      function rate(value) {
        row.innerHTML = '<span class="aw-rate-thanks">' + t.rateThanks + '</span>';
        if (BOT_MODE && BOT_URL) {
          fetch(`${BOT_URL}/widget/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: SESSION_ID, rating: value }),
          }).catch(function () {});
        }
      }
      goodBtn.addEventListener('click', function () { rate('good'); });
      badBtn.addEventListener('click', function () { rate('bad'); });

      row.appendChild(goodBtn);
      row.appendChild(badBtn);
      msgEl.appendChild(row);
    }

    // ── Messages ─────────────────────────────────────────────────────────────
    function addMessage(text, role, withRating) {
      const msg = document.createElement('div');
      msg.className = `aw-msg ${role}`;
      if (role === 'admin') {
        const label = document.createElement('div');
        label.className = 'aw-msg-label';
        label.textContent = t.supportLabel;
        msg.appendChild(label);
      }
      const bubble = document.createElement('div');
      bubble.className = 'aw-bubble';
      if (role === 'user') {
        bubble.textContent = text;
      } else {
        bubble.innerHTML = renderMarkdown(text);
      }
      msg.appendChild(bubble);
      messagesEl.appendChild(msg);
      if (withRating && (role === 'bot' || role === 'admin')) {
        addRating(msg);
      }
      scrollBottom();
      if (role !== 'user') incrementUnread();
      return bubble;
    }

    // ── Build chat history text for Telegram ──────────────────────────────────
    function buildHistoryText() {
      return history.map(m => (m.role === 'user' ? '👤 ' : '🤖 ') + m.content).join('\n\n');
    }

    function tgEscalateUrl(msgPrefix) {
      const text = msgPrefix + buildHistoryText();
      const tgUsername = TG_LINK.replace('https://t.me/', '');
      return `https://t.me/${tgUsername}?text=${encodeURIComponent(text.slice(0, 4000))}`;
    }

    // ── Action buttons under a message ───────────────────────────────────────
    function addActions(parentEl, labels) {
      if (!labels || !labels.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'aw-actions';
      labels.forEach(function(label) {
        const btn = document.createElement('button');
        btn.className = 'aw-action-btn';
        btn.textContent = label.trim();
        btn.addEventListener('click', function() {
          wrap.remove();
          sendMessage(label.trim());
        });
        wrap.appendChild(btn);
      });
      parentEl.appendChild(wrap);
      scrollBottom();
    }

    // ── Escalation block ──────────────────────────────────────────────────────
    function addEscalation(parentEl) {
      const block = document.createElement('div');
      block.className = 'aw-escalate';
      block.innerHTML = `
        <div class="aw-escalate-head">
          <div class="aw-escalate-icon">${ICON_TG}</div>
          <div class="aw-escalate-body">
            <div class="aw-escalate-title">${t.escalateLabel}</div>
            <div class="aw-escalate-sub">${t.escalateSub}</div>
          </div>
        </div>
        <a class="aw-escalate-btn" href="${TG_LINK}" target="_blank" rel="noopener">
          ${ICON_TG}<span>${t.escalateBtn}</span>
        </a>`;
      parentEl.appendChild(block);
      scrollBottom();
    }

    function addTyping() {
      const msg = document.createElement('div');
      msg.className = 'aw-msg bot'; msg.id = 'aw-typing';
      msg.innerHTML = '<div class="aw-bubble aw-typing"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(msg);
      scrollBottom();
    }

    function removeTyping() { const el = document.getElementById('aw-typing'); if (el) el.remove(); }
    function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

    // ── Report button ─────────────────────────────────────────────────────────
    reportBtn.addEventListener('click', function () {
      // Open Telegram with pre-filled message containing chat history
      const url = tgEscalateUrl(t.reportTgMsg);
      window.open(url, '_blank', 'noopener');
    });

    // ── Bot mode: poll for admin replies ─────────────────────────────────────
    function startPolling() {
      if (!BOT_MODE || pollTimer) return;
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`${BOT_URL}/widget/poll?session=${encodeURIComponent(SESSION_ID)}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.reply) {
            addMessage(data.reply, 'admin', true);
          }
        } catch {}
      }, 3000);
    }

    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function togglePanel() {
      isOpen = !isOpen;
      panel.classList.toggle('open', isOpen);
      btn.innerHTML = isOpen ? ICON_CLOSE : ICON_CHAT;
      if (isOpen) {
        clearUnread();
        if (messagesEl.children.length === 0) {
          const welcomeBubble = addMessage(t.welcome, 'bot', false);
          addActions(welcomeBubble.parentElement, t.chips);
          clearUnread();
        }
        setTimeout(() => inputEl.focus(), 220);
        if (BOT_MODE) startPolling();
      } else {
        stopPolling();
      }
    }

    // ── Send via BOT ──────────────────────────────────────────────────────────
    async function sendViaBotMode(text) {
      if (!BOT_URL) { addMessage(t.noBotUrl, 'bot', false); return; }
      isStreaming = true;
      sendBtn.disabled = true;
      addMessage(text, 'user', false);
      history.push({ role: 'user', content: text });
      addTyping();
      try {
        const resp = await fetch(`${BOT_URL}/widget/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: SESSION_ID, message: text, lang: LANG }),
        });
        removeTyping();
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          addMessage(t.errorMsg(err?.error || resp.status, TG_LINK), 'bot', false);
          history.pop(); return;
        }
        const data = await resp.json();
        if (data.reply) {
          addMessage(data.reply, 'bot', true);
          history.push({ role: 'assistant', content: data.reply });
        }
      } catch {
        removeTyping();
        addMessage(t.connectErr(TG_LINK), 'bot', false);
        history.pop();
      } finally {
        isStreaming = false;
        sendBtn.disabled = false;
        scrollBottom();
      }
    }

    // ── Send via direct APINET API (streaming) ────────────────────────────────
    async function sendViaDirectMode(text) {
      if (!API_TOKEN || API_TOKEN === 'WIDGET_TOKEN_PLACEHOLDER') {
        addMessage(t.noToken, 'bot', false); return;
      }
      isStreaming = true;
      sendBtn.disabled = true;
      addMessage(text, 'user', false);
      history.push({ role: 'user', content: text });
      addTyping();
      try {
        const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history.slice(-10)],
            stream: true, max_tokens: 1024, temperature: 0.5,
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          removeTyping();
          addMessage(t.errorMsg(err?.error?.code || resp.status, TG_LINK), 'bot', false);
          history.pop(); return;
        }
        removeTyping();
        const bubble = addMessage('', 'bot', false);
        // Get the parent msg element to add rating after streaming
        const msgEl = bubble.parentElement;
        let fullText = '';
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const delta = JSON.parse(raw)?.choices?.[0]?.delta?.content;
              if (delta) { fullText += delta; bubble.innerHTML = renderMarkdown(fullText); scrollBottom(); }
            } catch {}
          }
        }
        if (fullText) {
          // Detect [[OPERATOR]] escalation trigger
          const ESCALATE_TAG = '[[OPERATOR]]';
          // Detect [[ACTIONS: label1 | label2 | ...]] suggested buttons
          const ACTIONS_RE = /\[\[ACTIONS:\s*([^\]]+)\]\]/i;
          let processed = fullText;
          let hasOperator = false;
          let actionLabels = null;

          if (processed.includes(ESCALATE_TAG)) {
            processed = processed.replace(ESCALATE_TAG, '').replace(/^\n+/, '').trim();
            hasOperator = true;
          }
          const actionsMatch = processed.match(ACTIONS_RE);
          if (actionsMatch) {
            actionLabels = actionsMatch[1].split('|').map(s => s.trim()).filter(Boolean);
            processed = processed.replace(ACTIONS_RE, '').replace(/\n{2,}$/, '').trimEnd();
          }

          bubble.innerHTML = renderMarkdown(processed);
          history.push({ role: 'assistant', content: processed });

          if (hasOperator) {
            addEscalation(msgEl);
          } else if (actionLabels) {
            addActions(msgEl, actionLabels);
          } else {
            addRating(msgEl);
          }
        }
      } catch {
        removeTyping();
        addMessage(t.connectErr(TG_LINK), 'bot', false);
        history.pop();
      } finally {
        isStreaming = false;
        sendBtn.disabled = false;
        scrollBottom();
      }
    }

    function sendMessage(text) {
      if (!text.trim() || isStreaming) return;
      if (BOT_MODE) sendViaBotMode(text);
      else          sendViaDirectMode(text);
    }

    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = this.value.trim();
        if (v) { this.value = ''; this.style.height = 'auto'; sendMessage(v); }
      }
    });
    sendBtn.addEventListener('click', () => {
      const v = inputEl.value.trim();
      if (v) { inputEl.value = ''; inputEl.style.height = 'auto'; sendMessage(v); }
    });
    btn.addEventListener('click', togglePanel);
    panel.querySelector('.aw-close').addEventListener('click', togglePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) togglePanel(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
