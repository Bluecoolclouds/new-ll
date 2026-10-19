import type { WorkspaceLanguage } from "../lib/workspace-copy";
import { createNewApiClientDocs } from "./docs-client-articles";

export type DocEntry = { slug: string; title: string; category: string };
export type DocSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
};
export type DocArticle = { intro: string; sections: DocSection[] };
type OpenClawModel = {
  id: string;
  name: string;
  reasoning?: boolean;
  compat?: {
    supportedReasoningEfforts: string[];
    reasoningEffortMap: Record<string, string>;
  };
};
type OpenCodeModel = {
  name: string;
  variants?: Record<string, { reasoningEffort: string }>;
};
export type DocsContent = {
  groups: { title: string; entries: DocEntry[] }[];
  articles: Record<string, DocArticle>;
  codexGuide: {
    methodTabsLabel: string;
    scriptLabel: string;
    manualLabel: string;
    scriptNote: string;
    appTabs: { id: string; title: string; platforms: { id: string; slug: string; title: string; steps: string[]; configPath: string; authPath: string; envPath: string; envCommand: string }[] }[];
    config: string;
    auth: string;
  };
  claudeGuide: {
    appTitle: string;
    methodTabsLabel: string;
    scriptLabel: string;
    manualLabel: string;
    scriptNote: string;
    installNote: string;
    installCommand: string;
    entries: { slug: string; title: string; platform: string; steps: string[]; scriptAvailable: boolean }[];
    values: string;
  };
  cursorGuide: {
    appTitle: string;
    settingsHeading: string;
    setupSteps: string[];
    providerSettings: string;
    manualHeading: string;
    manualSteps: string[];
    models: string[];
    finalStep: string;
    note: string;
  };
  openclawGuide: {
    appTitle: string;
    providerHeading: string;
    providerInfo: string;
    installHeading: string;
    installCommand: string;
    steps: string[];
    launchHeading: string;
    launchCommand: string;
    note: string;
    models: OpenClawModel[];
  };
  openCodeGuide: {
    appTitle: string;
    providerHeading: string;
    providerInfo: string;
    steps: string[];
    note: string;
    models: Record<string, OpenCodeModel>;
  };
  hermesGuide: {
    appTitle: string;
    providerHeading: string;
    steps: string[];
    providerSettings: string;
    note: string;
  };
  copy: {
    title: string;
    back: string;
    search: string;
    close: string;
    openMenu: string;
    navigation: string;
    availability: string;
    toc: string;
    noResults: string;
    noSelection: string;
    copyCode: string;
    copied: string;
    language: string;
  };
};

function createCodexArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  const guides = [
    ["vscode-linux", "VS Code", "Linux"],
    ["vscode-windows", "VS Code", "Windows"],
    ["vscode-macos", "VS Code", "macOS"],
    ["codex-macos", "Codex", "macOS"],
    ["codex-windows", "Codex", "Windows"],
    ["codex-linux", "Codex", "Linux"],
  ] as const;
  return Object.fromEntries(guides.map(([slug, app, platform]) => [slug, {
    intro: language === "ru" ? `Инструкция: ${app} + ${platform}.` : `Instructions: ${app} + ${platform}.`,
    sections: [],
  }]));
}

function createClaudeArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  const guides = [
    ["claude-full", "Полная инструкция", "Full instructions"],
    ["claude-windows", "Windows", "Windows"],
    ["claude-macos", "macOS", "macOS"],
    ["claude-linux", "Linux", "Linux"],
  ] as const;
  return Object.fromEntries(guides.map(([slug, ruTitle, enTitle]) => [slug, {
    intro: language === "ru" ? `Инструкция: Claude CLI + ${ruTitle}.` : `Instructions: Claude CLI + ${enTitle}.`,
    sections: [],
  }]));
}

function createCursorArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  return {
    "cursor-manual": {
      intro: language === "ru" ? "4. Инструкция: Cursor." : "4. Instructions: Cursor.",
      sections: [],
    },
  };
}

function createOpenClawArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  return {
    "openclaw-manual": {
      intro: language === "ru" ? "4. Инструкция: OpenClaw." : "4. Instructions: OpenClaw.",
      sections: [],
    },
  };
}

function createOpenCodeArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  return {
    "opencode-linux": {
      intro: language === "ru"
        ? "4. Инструкция: OpenCode + Linux."
        : "4. Instructions: OpenCode + Linux.",
      sections: [],
    },
  };
}

function createHermesArticles(language: WorkspaceLanguage): Record<string, DocArticle> {
  return {
    "hermes-linux": {
      intro: language === "ru"
        ? "4. Инструкция: Hermes Desktop + Linux."
        : "4. Instructions: Hermes Desktop + Linux.",
      sections: [],
    },
  };
}

const OPENCLAW_MODELS: OpenClawModel[] = [
  {
    id: "gpt-5.5",
    name: "GPT 5.5",
    reasoning: true,
    compat: {
      supportedReasoningEfforts: ["low", "medium", "high", "xhigh"],
      reasoningEffortMap: { xhigh: "xhigh" },
    },
  },
  { id: "deepseek-flash", name: "DeepSeek V4.1 Flash" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna" },
  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra" },
  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol" },
  { id: "gpt-6-astra", name: "GPT 6 Astra" },
  { id: "gpt-6.1-sol", name: "GPT 6.1 Sol" },
  { id: "gpt-6-sol", name: "GPT 6 Sol" },
  { id: "gpt-6-luna", name: "GPT 6 Luna" },
  { id: "glm-5.3-flash", name: "GLM 5.3 Flash" },
  { id: "glm-5.3", name: "GLM 5.3" },
  { id: "glm-5.2", name: "GLM 5.2" },
];

const OPENCODE_MODELS: Record<string, OpenCodeModel> = {
  "deepseek-flash": { name: "DeepSeek V4.1 Flash" },
  "deepseek-v4-pro": { name: "DeepSeek V4 Pro" },
  "gpt-5.5": {
    name: "GPT 5.5",
    variants: {
      low: { reasoningEffort: "low" },
      medium: { reasoningEffort: "medium" },
      high: { reasoningEffort: "high" },
      xhigh: { reasoningEffort: "xhigh" },
    },
  },
  "gpt-5.6-luna": { name: "GPT 5.6 Luna" },
  "gpt-5.6-terra": { name: "GPT 5.6 Terra" },
  "gpt-5.6-sol": { name: "GPT 5.6 Sol" },
  "gpt-6-astra": { name: "GPT 6 Astra" },
  "gpt-6.1-sol": { name: "GPT 6.1 Sol" },
  "gpt-6-sol": { name: "GPT 6 Sol" },
  "gpt-6-luna": { name: "GPT 6 Luna" },
  "glm-5.3-flash": { name: "GLM 5.3 Flash" },
  "glm-5.3": { name: "GLM 5.3" },
  "glm-5.2": { name: "GLM 5.2" },
};

const ruClientDocs = createNewApiClientDocs("ru");
const ru: DocsContent = {
  copy: {
    title: "Документация Stratus",
    back: "В кабинет",
    search: "Поиск по документации…",
    close: "Закрыть",
    openMenu: "Открыть разделы документации",
    navigation: "Навигация документации",
    availability: "Справочник описывает маршруты, зарегистрированные в Stratus. Успешность конкретного запроса зависит от доступной модели, настроек каналов, прав ключа и параметров провайдера. Примеры используют ваш текущий домен.",
    toc: "На этой странице",
    noResults: "Ничего не найдено",
    noSelection: "Выберите раздел в меню слева.",
    copyCode: "Скопировать код",
    copied: "Скопировано",
    language: "Язык документации",
  },
  groups: [
    { title: "Начало работы", entries: [
      { slug: "quickstart", title: "Быстрый старт", category: "Начало работы" },
      { slug: "models-auth", title: "Ключи и список моделей", category: "Начало работы" },
    ] },
    { title: "Текстовые API", entries: [
      { slug: "chat-completions", title: "OpenAI Chat Completions", category: "Текстовые API" },
      { slug: "responses", title: "OpenAI Responses", category: "Текстовые API" },
      { slug: "anthropic", title: "Anthropic Messages", category: "Текстовые API" },
      { slug: "gemini", title: "Google Gemini", category: "Текстовые API" },
      { slug: "realtime", title: "Realtime API", category: "Текстовые API" },
    ] },
    { title: "VS Code", entries: [
      { slug: "vscode-linux", title: "Linux", category: "VS Code" },
      { slug: "vscode-windows", title: "Windows", category: "VS Code" },
      { slug: "vscode-macos", title: "macOS", category: "VS Code" },
    ] },
    { title: "Codex", entries: [
      { slug: "codex-macos", title: "macOS", category: "Codex" },
      { slug: "codex-windows", title: "Windows", category: "Codex" },
      { slug: "codex-linux", title: "Linux", category: "Codex" },
    ] },
    { title: "Claude Code", entries: [
      { slug: "claude-full", title: "Полная инструкция", category: "Claude Code" },
      { slug: "claude-windows", title: "Windows", category: "Claude Code" },
      { slug: "claude-macos", title: "macOS", category: "Claude Code" },
      { slug: "claude-linux", title: "Linux", category: "Claude Code" },
    ] },
    { title: "Cursor", entries: [
      { slug: "cursor-manual", title: "Вручную", category: "Cursor" },
    ] },
    { title: "OpenClaw", entries: [
      { slug: "openclaw-manual", title: "Вручную", category: "OpenClaw" },
    ] },
    { title: "OpenCode", entries: [
      { slug: "opencode-linux", title: "Linux", category: "OpenCode" },
    ] },
    { title: "Hermes Desktop", entries: [
      { slug: "hermes-linux", title: "Linux", category: "Hermes Desktop" },
    ] },
    ...ruClientDocs.groups,
    { title: "Другие возможности", entries: [
      { slug: "images", title: "Изображения", category: "Другие возможности" },
      { slug: "audio", title: "Аудио", category: "Другие возможности" },
      { slug: "video", title: "Видео", category: "Другие возможности" },
      { slug: "embeddings-tools", title: "Embeddings, rerank и moderation", category: "Другие возможности" },
      { slug: "media-tasks", title: "Медиа-задачи: Midjourney и Suno", category: "Другие возможности" },
    ] },
    { title: "Справка", entries: [
      { slug: "errors-billing", title: "Ошибки, лимиты и списание", category: "Справка" },
    ] },
  ],
  codexGuide: {
    methodTabsLabel: "Способ настройки",
    scriptLabel: "Скрипт",
    manualLabel: "Вручную",
    scriptNote: "Скрипт создаёт папку и конфигурационные файлы с заполненным адресом Stratus. Замените PASTE_YOUR_STRATUS_API_KEY на свой ключ и задайте STRATUS_API_KEY в окружении.",
    appTabs: [
      { id: "vscode", title: "VS Code", platforms: [
        { id: "linux", slug: "vscode-linux", title: "Linux", steps: [
          "Создайте папку .codex на машине Linux, где запускается VS Code.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
        { id: "windows", slug: "vscode-windows", title: "Windows", steps: [
          "Создайте папку .codex на машине Windows, где запускается VS Code.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "%USERPROFILE%\\.codex\\config.toml", authPath: "%USERPROFILE%\\.codex\\auth.json", envPath: "User environment variable", envCommand: `[Environment]::SetEnvironmentVariable("STRATUS_API_KEY", "PASTE_YOUR_STRATUS_API_KEY", "User")` },
        { id: "macos", slug: "vscode-macos", title: "macOS", steps: [
          "Создайте папку .codex на машине macOS, где запускается VS Code.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
      ] },
      { id: "codex", title: "Codex", platforms: [
        { id: "macos", slug: "codex-macos", title: "macOS", steps: [
          "Создайте папку .codex на машине macOS, где запускается Codex.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
        { id: "windows", slug: "codex-windows", title: "Windows", steps: [
          "Создайте папку .codex на машине Windows, где запускается Codex.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "%USERPROFILE%\\.codex\\config.toml", authPath: "%USERPROFILE%\\.codex\\auth.json", envPath: "User environment variable", envCommand: `[Environment]::SetEnvironmentVariable("STRATUS_API_KEY", "PASTE_YOUR_STRATUS_API_KEY", "User")` },
        { id: "linux", slug: "codex-linux", title: "Linux", steps: [
          "Создайте папку .codex на машине Linux, где запускается Codex.",
          "Создайте или замените config.toml и auth.json блоками ниже.",
          "Установите STRATUS_API_KEY и полностью перезапустите приложение, если оно держит старого провайдера.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
      ] },
    ],
    config: `model = "gpt-5.6-luna"
model_reasoning_effort = "high"
model_provider = "stratus"

[model_providers.stratus]
name = "Stratus"
base_url = "$STRATUS_BASE_URL/v1"
wire_api = "responses"
env_key = "STRATUS_API_KEY"
supports_websockets = false
requires_openai_auth = true`,
    auth: `{
  "auth_mode": "apikey",
  "OPENAI_API_KEY": "PASTE_YOUR_STRATUS_API_KEY"
}`,
  },
  claudeGuide: {
    appTitle: "Claude CLI",
    methodTabsLabel: "Способ настройки",
    scriptLabel: "Скрипт",
    manualLabel: "Вручную",
    scriptNote: "Скрипт запросит API-ключ отдельно и сохранит настройки локально. Перед запуском проверьте адрес Stratus.",
    installNote: "Требуется Node.js версии 18 или новее. Установка Claude Code:",
    installCommand: "npm install -g @anthropic-ai/claude-code",
    entries: [
      { slug: "claude-full", title: "Полная инструкция", platform: "full", scriptAvailable: false, steps: [
        "Откройте настройки окружения Claude CLI.",
        "Укажите Anthropic base URL, auth token и model из блока ниже.",
        "Перезапустите Claude CLI, если выбранная модель не появилась.",
      ] },
      { slug: "claude-windows", title: "Windows", platform: "windows", scriptAvailable: true, steps: [
        "Откройте настройки Claude CLI или env-файл терминала.",
        "Вставьте Anthropic-compatible значения ниже.",
        "Перезапустите Claude CLI, если он держит старые настройки.",
      ] },
      { slug: "claude-macos", title: "macOS", platform: "macos", scriptAvailable: true, steps: [
        "Откройте настройки Claude CLI или env-файл терминала.",
        "Вставьте Anthropic-compatible значения ниже.",
        "Перезапустите Claude CLI, если он держит старые настройки.",
      ] },
      { slug: "claude-linux", title: "Linux", platform: "linux", scriptAvailable: true, steps: [
        "Откройте терминал или файл окружения Claude CLI.",
        "Задайте Anthropic-compatible параметры из блока ниже.",
        "Перезапустите Claude CLI, чтобы он загрузил новые настройки.",
      ] },
    ],
    values: `ANTHROPIC_BASE_URL="$STRATUS_BASE_URL"
ANTHROPIC_AUTH_TOKEN="PASTE_YOUR_STRATUS_API_KEY"
ANTHROPIC_MODEL="claude-opus-5-5"`,
  },
  cursorGuide: {
    appTitle: "Cursor",
    settingsHeading: "Cursor Settings -> Models",
    setupSteps: [
      "Откройте Cursor Settings -> Models.",
      "Добавьте API key, включите Override OpenAI Base URL и вставьте base endpoint.",
      "Добавьте gpt-5.6-luna и перезапустите Cursor, если модель не появилась.",
    ],
    providerSettings: `Provider type: OpenAI-compatible / OpenAI API key
Provider name: Stratus
API Key: PASTE_YOUR_STRATUS_API_KEY
Base URL: $STRATUS_BASE_URL/v1`,
    manualHeading: "Ручная настройка:",
    manualSteps: [
      "Включите OpenAI API Key.",
      "Если в вашей версии Cursor есть такой переключатель, включите Override OpenAI Base URL.",
      "Вставьте API-ключ и указанный выше Base URL.",
      "Добавьте идентификаторы пользовательских моделей:",
    ],
    models: [
      "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-sol", "gpt-5.5",
      "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6-luna", "glm-5.2", "glm-5.3",
      "glm-5.3-flash", "deepseek-flash", "deepseek-v4-pro", "claude-opus-5-5",
      "claude-fable-5-1", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7",
      "claude-opus-4-6", "claude-sonnet-5-5", "claude-haiku-4-5-20251001", "claude-haiku-5-5",
    ],
    finalStep: "Сохраните изменения, нажмите Verify и перезапустите Cursor, если список моделей кэшируется.",
    note: "Список моделей, доступных ключу, можно получить через /v1/models. Cursor отправляет OpenAI-compatible запросы, когда включён Override OpenAI Base URL.",
  },
  openclawGuide: {
    appTitle: "OpenClaw",
    providerHeading: "Провайдер OpenClaw для ручной настройки",
    providerInfo: `Provider ID: stratus
API: openai-completions
Primary model: stratus/gpt-5.6-luna`,
    installHeading: "Установка и первичный запуск",
    installCommand: "npm install -g openclaw@latest\nopenclaw onboard",
    steps: [
      "Для установки требуется Node.js.",
      "В мастере выберите QuickStart, пропустите настройку API-ключа, затем выберите All providers.",
      "Откройте ~/.openclaw/openclaw.json и объедините настройки Stratus с существующей конфигурацией.",
      "Установите stratus/gpt-5.6-luna как основную модель.",
    ],
    launchHeading: "Запуск шлюза",
    launchCommand: "openclaw gateway",
    note: "Если файл уже содержит gateway, models или agents, объедините параметры вручную и сохраните остальные настройки.",
    models: OPENCLAW_MODELS,
  },
  openCodeGuide: {
    appTitle: "OpenCode + Linux",
    providerHeading: "Пользовательский провайдер OpenCode",
    providerInfo: `Provider ID: stratus
Provider package: @ai-sdk/openai-compatible
Default model: stratus/gpt-5.6-luna`,
    steps: [
      "Откройте настройки OpenCode или файл opencode.json.",
      "Добавьте пользовательский провайдер stratus с OpenAI-compatible пакетом, API-ключом, Base URL и моделями ниже.",
      "Выберите stratus/gpt-5.6-luna и перезапустите OpenCode, если модели не появились.",
    ],
    note: "Добавьте этот блок в существующий opencode.json, сохранив остальные настройки.",
    models: OPENCODE_MODELS,
  },
  hermesGuide: {
    appTitle: "Hermes Desktop + Linux",
    providerHeading: "Подключение Hermes Desktop",
    steps: [
      "Откройте настройки Hermes Desktop.",
      "Вставьте параметры подключения Stratus из блока ниже.",
      "Перезапустите приложение, если оно использует старые настройки.",
    ],
    providerSettings: `Base URL: $STRATUS_BASE_URL/v1
Provider ID: stratus
Default model: gpt-5.6-luna
API key: PASTE_YOUR_STRATUS_API_KEY`,
    note: "Ручной режим предназначен для клиентов, где установщик не нужен или не поддерживается.",
  },
  articles: {
    ...createCodexArticles("ru"),
    ...createClaudeArticles("ru"),
    ...createCursorArticles("ru"),
    ...createOpenClawArticles("ru"),
    ...createOpenCodeArticles("ru"),
    ...createHermesArticles("ru"),
    ...ruClientDocs.articles,
    quickstart: {
      intro: "Stratus предоставляет единый API-шлюз к подключённым моделям. Используйте API-ключ из личного кабинета и URL домена Stratus — адреса сторонних шлюзов в настройках клиента не нужны.",
      sections: [
        { id: "requirements", title: "Перед первым запросом", bullets: [
          "Создайте API-ключ в личном кабинете Stratus и сохраните его сразу: полный секрет показывается только при создании.",
          "Скопируйте точный идентификатор модели из каталога Stratus или ответа GET /v1/models.",
          "Убедитесь, что для ключа разрешены запросы и на балансе достаточно токенов.",
        ] },
        { id: "first-request", title: "Первый запрос", code: `curl "$STRATUS_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "messages": [{"role": "user", "content": "Привет!"}]
  }'` },
        { id: "base-url", title: "Адрес API", paragraphs: [
          "Задайте STRATUS_BASE_URL равным публичному HTTPS-домену вашей установки Stratus без завершающего слеша. Например: https://stratus.example.com. Пути /v1 и /v1beta добавляются после домена.",
          "Не используйте адрес api.gpt.ge из справочника-референса: он относится к другому сервису.",
        ] },
      ],
    },
    "models-auth": {
      intro: "Модельные запросы проходят через API-ключ Stratus. Список моделей отражает текущую конфигурацию шлюза, но фактическая доступность также зависит от включённых каналов и возможностей модели.",
      sections: [
        { id: "auth", title: "Авторизация", paragraphs: [
          "Для OpenAI-совместимых маршрутов передавайте ключ в заголовке Authorization: Bearer. Ключ создаётся и отзывается в личном кабинете Stratus.",
        ], code: `Authorization: Bearer $STRATUS_API_KEY` },
        { id: "list-models", title: "Список моделей", code: `curl "$STRATUS_BASE_URL/v1/models" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
        { id: "response-shape", title: "Выбор модели", bullets: [
          "Передавайте точное значение id из ответа списка моделей в поле model.",
          "Псевдоним auto поддерживается только если он настроен для вашего ключа; иначе используйте конкретный model id.",
          "Появление маршрута в справке не означает, что любой провайдер или любая модель поддерживают этот формат.",
        ] },
        { id: "gemini-models", title: "Gemini: список моделей", code: `curl "$STRATUS_BASE_URL/v1beta/models" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
      ],
    },
    "chat-completions": {
      intro: "OpenAI-совместимый API для диалоговой генерации. Маршрут принимает обычные JSON-запросы и поддерживает потоковый ответ там, где это разрешает модель и провайдер.",
      sections: [
        { id: "endpoint", title: "Метод и путь", code: `POST /v1/chat/completions` },
        { id: "request", title: "Пример запроса", code: `curl "$STRATUS_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "messages": [
      {"role": "system", "content": "Отвечай кратко."},
      {"role": "user", "content": "Объясни, что такое API-шлюз."}
    ],
    "stream": false
  }'` },
        { id: "streaming", title: "Потоковая генерация", paragraphs: [
          "Установите stream в true, чтобы получать события по мере генерации. Обрабатывайте SSE-события и завершение потока; не считайте частично полученный ответ завершённым результатом.",
        ] },
        { id: "compatibility", title: "SDK", bullets: [
          "В OpenAI SDK укажите baseURL как домен Stratus с путём /v1, если библиотека ожидает base URL с версией API.",
          "Используйте API-ключ Stratus как apiKey. Название модели берите из списка Stratus.",
        ] },
      ],
    },
    responses: {
      intro: "Responses API принимает формат OpenAI Responses. Поддержка отдельных инструментов и параметров зависит от модели, канала и включённых возможностей.",
      sections: [
        { id: "create", title: "Создание ответа", code: `POST /v1/responses

curl "$STRATUS_BASE_URL/v1/responses" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "input": "Составь краткий план проекта."
  }'` },
        { id: "compact", title: "Сжатие контекста", code: `POST /v1/responses/compact` },
        { id: "notes", title: "Примечания", bullets: [
          "Маршрут /v1/responses/compact зарегистрирован отдельно и предназначен для совместимого сценария компактизации.",
          "Проверяйте документацию выбранной модели: инструменты, структурированный вывод и reasoning-параметры могут отличаться.",
          "Не отправляйте ключи провайдера в теле запроса; используйте ключ Stratus в заголовке авторизации.",
        ] },
      ],
    },
    anthropic: {
      intro: "Для клиентов Anthropic предусмотрен маршрут Messages. Stratus принимает ключ через x-api-key; для SDK задайте базовый URL Stratus и используйте API-ключ Stratus, а не ключ провайдера.",
      sections: [
        { id: "endpoint", title: "Метод и путь", code: `POST /v1/messages` },
        { id: "request", title: "Пример запроса", code: `curl "$STRATUS_BASE_URL/v1/messages" \\
  -H "x-api-key: $STRATUS_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Привет!"}]
  }'` },
        { id: "models", title: "Модели", bullets: [
          "Запрос списка в формате Anthropic: GET /v1/models с заголовками x-api-key и anthropic-version.",
          "Используйте только модели, доступные для вашей установки и совместимые с Messages API.",
        ] },
      ],
    },
    gemini: {
      intro: "Поддерживаются native Gemini-маршруты и OpenAI-совместимое представление списка моделей. Нативные вызовы используют формат Google Generative Language API.",
      sections: [
        { id: "endpoint", title: "Нативный маршрут", code: `POST /v1beta/models/{model}:{action}` },
        { id: "generate", title: "Генерация текста", code: `curl "$STRATUS_BASE_URL/v1beta/models/MODEL_ID:generateContent" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{"parts": [{"text": "Привет!"}]}]
  }'` },
        { id: "auth", title: "Авторизация и модели", bullets: [
          "Для native Gemini допустимы Authorization: Bearer, заголовок x-goog-api-key или параметр key в URL. Не помещайте ключ в URL в клиентском приложении, если можно использовать заголовок.",
          "Список native-моделей: GET /v1beta/models.",
          "Формат списка OpenAI-совместимых моделей Gemini: GET /v1beta/openai/models.",
          "Доступные действия и мультимодальные возможности определяются выбранной моделью и подключённым каналом.",
        ] },
      ],
    },
    realtime: {
      intro: "Realtime WebSocket-маршрут зарегистрирован для OpenAI-совместимых real-time сессий. Подключение зависит от доступности realtime-совместимой модели и настроек сервера.",
      sections: [
        { id: "endpoint", title: "WebSocket маршрут", code: `wss://YOUR_STRATUS_DOMAIN/v1/realtime` },
        { id: "auth", title: "Подключение", paragraphs: [
          "Передайте API-ключ способом, который поддерживает ваш WebSocket-клиент и Stratus. В браузере не встраивайте постоянный секрет в публичный код; используйте серверную выдачу временных полномочий, если она настроена.",
        ] },
        { id: "availability", title: "Совместимость", bullets: [
          "Проверьте документацию конкретной модели и формат клиентских событий.",
          "Наличие маршрута не гарантирует поддержку аудио, транскрипции или инструментов для всех моделей.",
        ] },
      ],
    },
    images: {
      intro: "Маршруты генерации и редактирования изображений используют OpenAI-совместимый формат. Требуемые поля и допустимые форматы входных файлов зависят от модели и провайдера.",
      sections: [
        { id: "routes", title: "Маршруты", bullets: [
          "POST /v1/images/generations — создать изображение.",
          "POST /v1/images/edits — редактировать изображение.",
          "POST /v1/edits — совместимый маршрут редактирования изображений.",
        ] },
        { id: "generation", title: "Пример генерации", code: `curl "$STRATUS_BASE_URL/v1/images/generations" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "IMAGE_MODEL_ID",
    "prompt": "Минималистичная иллюстрация облачного API-шлюза"
  }'` },
        { id: "limits", title: "Форматы и стоимость", bullets: [
          "Передавайте модель, которая указана в каталоге как поддерживающая генерацию или редактирование изображений.",
          "Image variations (/v1/images/variations) в этой сборке не реализован.",
          "Изображения могут тарифицироваться за операцию или по параметрам результата. Проверяйте фактические условия в Stratus; не рассчитывайте стоимость по текстовым токенам.",
        ] },
      ],
    },
    audio: {
      intro: "В этой сборке зарегистрированы маршруты распознавания речи, перевода аудио и синтеза речи в OpenAI-совместимом формате.",
      sections: [
        { id: "routes", title: "Маршруты", bullets: [
          "POST /v1/audio/transcriptions — распознавание речи.",
          "POST /v1/audio/translations — перевод аудио в текст.",
          "POST /v1/audio/speech — синтез речи.",
        ] },
        { id: "transcription", title: "Пример транскрибации", code: `curl "$STRATUS_BASE_URL/v1/audio/transcriptions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -F "model=AUDIO_MODEL_ID" \\
  -F "file=@speech.mp3"` },
        { id: "support", title: "Совместимость", paragraphs: [
          "Проверьте формат запроса, тип файла, язык и параметры в документации модели. Маршрут должен быть включён в канал, поддерживающий выбранную операцию.",
        ] },
      ],
    },
    video: {
      intro: "Для генерации видео зарегистрированы OpenAI-совместимые маршруты задач и получение результата. Создание обычно асинхронное: сначала отправьте задачу, затем опрашивайте её состояние.",
      sections: [
        { id: "routes", title: "Маршруты задач", bullets: [
          "POST /v1/video/generations — создать видеозадачу.",
          "GET /v1/video/generations/{task_id} — получить состояние задачи.",
          "POST /v1/videos — создать задачу в совместимом формате.",
          "GET /v1/videos/{task_id} — получить задачу; GET /v1/videos/{task_id}/content — получить видео.",
          "POST /v1/videos/{video_id}/remix — запросить remix, если выбранный провайдер поддерживает операцию.",
        ] },
        { id: "create", title: "Создание и проверка", code: `curl "$STRATUS_BASE_URL/v1/videos" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"VIDEO_MODEL_ID","prompt":"Ночной город под дождём"}'

curl "$STRATUS_BASE_URL/v1/videos/TASK_ID" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
        { id: "provider-routes", title: "Форматы провайдеров", bullets: [
          "Также зарегистрированы /kling/v1/videos/text2video и /kling/v1/videos/image2video с соответствующими маршрутами получения результата.",
          "Для этих API важно использовать модели и формат параметров, совместимые с подключённым провайдером.",
          "Видео может тарифицироваться за задачу, длительность или параметры результата, а не за текстовые токены.",
        ] },
      ],
    },
    "embeddings-tools": {
      intro: "Вспомогательные маршруты для векторизации, переранжирования результатов поиска и модерации текста.",
      sections: [
        { id: "routes", title: "Маршруты", bullets: [
          "POST /v1/embeddings — создать векторные представления.",
          "POST /v1/rerank — переранжировать документы относительно запроса.",
          "POST /v1/moderations — выполнить модерацию.",
          "POST /v1/completions — legacy OpenAI-compatible completions.",
        ] },
        { id: "embeddings", title: "Пример embeddings", code: `curl "$STRATUS_BASE_URL/v1/embeddings" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"EMBEDDING_MODEL_ID","input":"Текст для индексирования"}'` },
        { id: "availability", title: "Доступность", paragraphs: [
          "Для каждого маршрута требуется модель подходящего типа и активный канал. Формат полей может отличаться между провайдерами; сверяйтесь с контрактом выбранной модели.",
        ] },
      ],
    },
    "media-tasks": {
      intro: "Для некоторых подключённых провайдеров доступны отдельные маршруты асинхронных медиа-задач. Это специализированные API, не взаимозаменяемые с OpenAI-совместимыми запросами.",
      sections: [
        { id: "suno", title: "Suno", bullets: [
          "POST /suno/submit/{action} — отправить задачу.",
          "POST /suno/fetch и GET /suno/fetch/{id} — получить статус или результат.",
        ] },
        { id: "midjourney", title: "Midjourney", bullets: [
          "Маршруты /mj/submit/imagine, /mj/submit/action, /mj/submit/change, /mj/submit/describe, /mj/submit/blend и другие зарегистрированные операции.",
          "GET /mj/task/{id}/fetch — получить состояние задачи.",
          "Набор разрешённых операций и формат тела задаются подключённой интеграцией.",
        ] },
        { id: "note", title: "Перед использованием", paragraphs: [
          "Проверьте точный формат запросов у администратора Stratus и в настройках соответствующего провайдера. Не переносите сюда базовый URL или секреты из чужого сервиса.",
        ] },
      ],
    },
    "errors-billing": {
      intro: "Ошибки авторизации, лимитов и маршрутизации зависят от статуса API-ключа, аккаунта, выбранной модели и её канала.",
      sections: [
        { id: "common", title: "Что проверить", bullets: [
          "401: проверьте API-ключ Stratus, заголовок авторизации и то, что ключ не отозван.",
          "403: проверьте доступ аккаунта и ограничения ключа.",
          "404: проверьте путь и точный model id; маршрут может существовать, но модель или канал могут быть недоступны.",
          "429: проверьте лимиты ключа, частоту запросов и доступный баланс.",
          "5xx или ошибка провайдера: проверьте статус канала и повторяйте только запросы, для которых безопасны возможные дубликаты.",
        ] },
        { id: "billing", title: "Списание и usage", bullets: [
          "Расход и количество токенов возвращаются в usage там, где это предоставляет провайдер.",
          "Стоимость текстовых запросов зависит от фактического usage и настроенного коэффициента модели; кэш, изображения и медиа могут тарифицироваться отдельно.",
          "Историческое списание не следует пересчитывать по текущему тарифу модели.",
          "Проверяйте журнал запросов и баланс в личном кабинете Stratus. Не отправляйте API-ключи в логи, тикеты или клиентский код.",
        ] },
        { id: "unsupported", title: "Маршруты, которые не поддерживаются", bullets: [
          "В этой сборке не реализованы /v1/images/variations, /v1/files (и связанные операции) и /v1/fine-tunes.",
          "Удаление модели через DELETE /v1/models/{model} также не поддерживается.",
          "Возможности API могут меняться при обновлении сервера; проверяйте актуальный каталог и настройки.",
        ] },
      ],
    },
  },
};

const enClientDocs = createNewApiClientDocs("en");
const en: DocsContent = {
  copy: {
    title: "Stratus documentation",
    back: "Back to dashboard",
    search: "Search documentation…",
    close: "Close",
    openMenu: "Open documentation sections",
    navigation: "Documentation navigation",
    availability: "This reference describes routes registered in Stratus. A specific request still depends on available models, channel configuration, key permissions, and provider parameters. Examples use your current domain.",
    toc: "On this page",
    noResults: "No results found",
    noSelection: "Choose a section from the menu.",
    copyCode: "Copy code",
    copied: "Copied",
    language: "Documentation language",
  },
  groups: [
    { title: "Getting started", entries: [
      { slug: "quickstart", title: "Quickstart", category: "Getting started" },
      { slug: "models-auth", title: "API keys and models", category: "Getting started" },
    ] },
    { title: "Text APIs", entries: [
      { slug: "chat-completions", title: "OpenAI Chat Completions", category: "Text APIs" },
      { slug: "responses", title: "OpenAI Responses", category: "Text APIs" },
      { slug: "anthropic", title: "Anthropic Messages", category: "Text APIs" },
      { slug: "gemini", title: "Google Gemini", category: "Text APIs" },
      { slug: "realtime", title: "Realtime API", category: "Text APIs" },
    ] },
    { title: "VS Code", entries: [
      { slug: "vscode-linux", title: "Linux", category: "VS Code" },
      { slug: "vscode-windows", title: "Windows", category: "VS Code" },
      { slug: "vscode-macos", title: "macOS", category: "VS Code" },
    ] },
    { title: "Codex", entries: [
      { slug: "codex-macos", title: "macOS", category: "Codex" },
      { slug: "codex-windows", title: "Windows", category: "Codex" },
      { slug: "codex-linux", title: "Linux", category: "Codex" },
    ] },
    { title: "Claude Code", entries: [
      { slug: "claude-full", title: "Full instructions", category: "Claude Code" },
      { slug: "claude-windows", title: "Windows", category: "Claude Code" },
      { slug: "claude-macos", title: "macOS", category: "Claude Code" },
      { slug: "claude-linux", title: "Linux", category: "Claude Code" },
    ] },
    { title: "Cursor", entries: [
      { slug: "cursor-manual", title: "Manual", category: "Cursor" },
    ] },
    { title: "OpenClaw", entries: [
      { slug: "openclaw-manual", title: "Manual", category: "OpenClaw" },
    ] },
    { title: "OpenCode", entries: [
      { slug: "opencode-linux", title: "Linux", category: "OpenCode" },
    ] },
    { title: "Hermes Desktop", entries: [
      { slug: "hermes-linux", title: "Linux", category: "Hermes Desktop" },
    ] },
    ...enClientDocs.groups,
    { title: "Other capabilities", entries: [
      { slug: "images", title: "Images", category: "Other capabilities" },
      { slug: "audio", title: "Audio", category: "Other capabilities" },
      { slug: "video", title: "Video", category: "Other capabilities" },
      { slug: "embeddings-tools", title: "Embeddings, rerank, and moderation", category: "Other capabilities" },
      { slug: "media-tasks", title: "Media tasks: Midjourney and Suno", category: "Other capabilities" },
    ] },
    { title: "Reference", entries: [
      { slug: "errors-billing", title: "Errors, limits, and billing", category: "Reference" },
    ] },
  ],
  codexGuide: {
    methodTabsLabel: "Setup method",
    scriptLabel: "Script",
    manualLabel: "Manual",
    scriptNote: "The script creates the folder and configuration files with the Stratus URL filled in. Replace PASTE_YOUR_STRATUS_API_KEY with your key and set STRATUS_API_KEY in your environment.",
    appTabs: [
      { id: "vscode", title: "VS Code", platforms: [
        { id: "linux", slug: "vscode-linux", title: "Linux", steps: [
          "Create a .codex folder on the Linux machine where VS Code runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
        { id: "windows", slug: "vscode-windows", title: "Windows", steps: [
          "Create a .codex folder on the Windows machine where VS Code runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "%USERPROFILE%\\.codex\\config.toml", authPath: "%USERPROFILE%\\.codex\\auth.json", envPath: "User environment variable", envCommand: `[Environment]::SetEnvironmentVariable("STRATUS_API_KEY", "PASTE_YOUR_STRATUS_API_KEY", "User")` },
        { id: "macos", slug: "vscode-macos", title: "macOS", steps: [
          "Create a .codex folder on the macOS machine where VS Code runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
      ] },
      { id: "codex", title: "Codex", platforms: [
        { id: "macos", slug: "codex-macos", title: "macOS", steps: [
          "Create a .codex folder on the macOS machine where Codex runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
        { id: "windows", slug: "codex-windows", title: "Windows", steps: [
          "Create a .codex folder on the Windows machine where Codex runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "%USERPROFILE%\\.codex\\config.toml", authPath: "%USERPROFILE%\\.codex\\auth.json", envPath: "User environment variable", envCommand: `[Environment]::SetEnvironmentVariable("STRATUS_API_KEY", "PASTE_YOUR_STRATUS_API_KEY", "User")` },
        { id: "linux", slug: "codex-linux", title: "Linux", steps: [
          "Create a .codex folder on the Linux machine where Codex runs.",
          "Create or replace config.toml and auth.json with the blocks below.",
          "Set STRATUS_API_KEY and fully restart the app if it is still using the old provider.",
        ], configPath: "~/.codex/config.toml", authPath: "~/.codex/auth.json", envPath: "~/.codex/stratus.env", envCommand: `export STRATUS_API_KEY="PASTE_YOUR_STRATUS_API_KEY"` },
      ] },
    ],
    config: `model = "gpt-5.6-luna"
model_reasoning_effort = "high"
model_provider = "stratus"

[model_providers.stratus]
name = "Stratus"
base_url = "$STRATUS_BASE_URL/v1"
wire_api = "responses"
env_key = "STRATUS_API_KEY"
supports_websockets = false
requires_openai_auth = true`,
    auth: `{
  "auth_mode": "apikey",
  "OPENAI_API_KEY": "PASTE_YOUR_STRATUS_API_KEY"
}`,
  },
  claudeGuide: {
    appTitle: "Claude CLI",
    methodTabsLabel: "Setup method",
    scriptLabel: "Script",
    manualLabel: "Manual",
    scriptNote: "The script prompts for your API key separately and saves the settings locally. Check the Stratus URL before running it.",
    installNote: "Node.js 18 or later is required. Install Claude Code:",
    installCommand: "npm install -g @anthropic-ai/claude-code",
    entries: [
      { slug: "claude-full", title: "Full instructions", platform: "full", scriptAvailable: false, steps: [
        "Open the Claude CLI environment settings.",
        "Set the Anthropic base URL, auth token, and model from the block below.",
        "Restart Claude CLI if the selected model does not appear.",
      ] },
      { slug: "claude-windows", title: "Windows", platform: "windows", scriptAvailable: true, steps: [
        "Open the Claude CLI settings or the terminal environment file.",
        "Paste the Anthropic-compatible values below.",
        "Restart Claude CLI if it is still using the old settings.",
      ] },
      { slug: "claude-macos", title: "macOS", platform: "macos", scriptAvailable: true, steps: [
        "Open the Claude CLI settings or the terminal environment file.",
        "Paste the Anthropic-compatible values below.",
        "Restart Claude CLI if it is still using the old settings.",
      ] },
      { slug: "claude-linux", title: "Linux", platform: "linux", scriptAvailable: true, steps: [
        "Open a terminal or the Claude CLI environment file.",
        "Set the Anthropic-compatible values from the block below.",
        "Restart Claude CLI to load the new settings.",
      ] },
    ],
    values: `ANTHROPIC_BASE_URL="$STRATUS_BASE_URL"
ANTHROPIC_AUTH_TOKEN="PASTE_YOUR_STRATUS_API_KEY"
ANTHROPIC_MODEL="claude-opus-5-5"`,
  },
  cursorGuide: {
    appTitle: "Cursor",
    settingsHeading: "Cursor Settings -> Models",
    setupSteps: [
      "Open Cursor Settings -> Models.",
      "Add the API key, enable Override OpenAI Base URL, and enter the base endpoint.",
      "Add gpt-5.6-luna and restart Cursor if the model does not appear.",
    ],
    providerSettings: `Provider type: OpenAI-compatible / OpenAI API key
Provider name: Stratus
API Key: PASTE_YOUR_STRATUS_API_KEY
Base URL: $STRATUS_BASE_URL/v1`,
    manualHeading: "Manual steps:",
    manualSteps: [
      "Enable OpenAI API Key.",
      "Enable Override OpenAI Base URL if your Cursor build shows it.",
      "Paste the API key and Base URL above.",
      "Add custom model IDs:",
    ],
    models: [
      "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-sol", "gpt-5.5",
      "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6-luna", "glm-5.2", "glm-5.3",
      "glm-5.3-flash", "deepseek-flash", "deepseek-v4-pro", "claude-opus-5-5",
      "claude-fable-5-1", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7",
      "claude-opus-4-6", "claude-sonnet-5-5", "claude-haiku-4-5-20251001", "claude-haiku-5-5",
    ],
    finalStep: "Save, select Verify, and restart Cursor if the model list is cached.",
    note: "Models available to your key can be retrieved from /v1/models. Cursor sends OpenAI-compatible requests when Override OpenAI Base URL is enabled.",
  },
  openclawGuide: {
    appTitle: "OpenClaw",
    providerHeading: "OpenClaw manual provider",
    providerInfo: `Provider ID: stratus
API: openai-completions
Primary model: stratus/gpt-5.6-luna`,
    installHeading: "Install and initialize",
    installCommand: "npm install -g openclaw@latest\nopenclaw onboard",
    steps: [
      "Node.js is required for installation.",
      "In the setup wizard, choose QuickStart, skip API key setup, then select All providers.",
      "Open ~/.openclaw/openclaw.json and merge the Stratus settings with your existing configuration.",
      "Set stratus/gpt-5.6-luna as the primary model.",
    ],
    launchHeading: "Start the gateway",
    launchCommand: "openclaw gateway",
    note: "If the file already contains gateway, models, or agents settings, merge the fields manually and keep the rest of your configuration.",
    models: OPENCLAW_MODELS,
  },
  openCodeGuide: {
    appTitle: "OpenCode + Linux",
    providerHeading: "OpenCode custom provider",
    providerInfo: `Provider ID: stratus
Provider package: @ai-sdk/openai-compatible
Default model: stratus/gpt-5.6-luna`,
    steps: [
      "Open OpenCode settings or the opencode.json file.",
      "Add the stratus custom provider with the OpenAI-compatible package, API key, Base URL, and models below.",
      "Select stratus/gpt-5.6-luna and restart OpenCode if the models do not appear.",
    ],
    note: "Merge this block into your existing opencode.json and keep your other settings.",
    models: OPENCODE_MODELS,
  },
  hermesGuide: {
    appTitle: "Hermes Desktop + Linux",
    providerHeading: "Connect Hermes Desktop",
    steps: [
      "Open the Hermes Desktop settings.",
      "Paste the Stratus connection settings from the block below.",
      "Restart the application if it is still using the old settings.",
    ],
    providerSettings: `Base URL: $STRATUS_BASE_URL/v1
Provider ID: stratus
Default model: gpt-5.6-luna
API key: PASTE_YOUR_STRATUS_API_KEY`,
    note: "Manual setup is for clients where an installer is not needed or supported.",
  },
  articles: {
    ...createCodexArticles("en"),
    ...createClaudeArticles("en"),
    ...createCursorArticles("en"),
    ...createOpenClawArticles("en"),
    ...createOpenCodeArticles("en"),
    ...createHermesArticles("en"),
    ...enClientDocs.articles,
    quickstart: {
      intro: "Stratus provides a unified API gateway to connected models. Use an API key from your Stratus dashboard and your Stratus domain; you do not need another provider gateway URL in your client.",
      sections: [
        { id: "requirements", title: "Before your first request", bullets: [
          "Create an API key in the Stratus dashboard and save it immediately; the full secret is shown only once.",
          "Copy the exact model ID from the Stratus catalog or from GET /v1/models.",
          "Make sure requests are allowed for the key and your token balance is sufficient.",
        ] },
        { id: "first-request", title: "Your first request", code: `curl "$STRATUS_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'` },
        { id: "base-url", title: "API base URL", paragraphs: [
          "Set STRATUS_BASE_URL to your installation's public HTTPS domain without a trailing slash, for example https://stratus.example.com. Append /v1 or /v1beta for API paths.",
          "Do not use api.gpt.ge from the reference documentation; it belongs to a different service.",
        ] },
      ],
    },
    "models-auth": {
      intro: "Model requests are authenticated with a Stratus API key. The model list reflects the gateway configuration, while actual availability also depends on enabled channels and model capabilities.",
      sections: [
        { id: "auth", title: "Authentication", paragraphs: [
          "For OpenAI-compatible routes, send the key in the Authorization: Bearer header. Create and revoke keys in the Stratus dashboard.",
        ], code: `Authorization: Bearer $STRATUS_API_KEY` },
        { id: "list-models", title: "List models", code: `curl "$STRATUS_BASE_URL/v1/models" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
        { id: "response-shape", title: "Choosing a model", bullets: [
          "Use the exact id from the model-list response in the model field.",
          "The auto alias is available only when configured for your key; otherwise use a specific model ID.",
          "A registered route does not mean every provider or model supports that request format.",
        ] },
        { id: "gemini-models", title: "Gemini model list", code: `curl "$STRATUS_BASE_URL/v1beta/models" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
      ],
    },
    "chat-completions": {
      intro: "An OpenAI-compatible API for conversational generation. The route accepts JSON requests and supports streaming where permitted by the selected model and provider.",
      sections: [
        { id: "endpoint", title: "Method and path", code: `POST /v1/chat/completions` },
        { id: "request", title: "Example request", code: `curl "$STRATUS_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "messages": [
      {"role": "system", "content": "Keep answers concise."},
      {"role": "user", "content": "What is an API gateway?"}
    ],
    "stream": false
  }'` },
        { id: "streaming", title: "Streaming", paragraphs: [
          "Set stream to true to receive events as the response is generated. Process SSE events and the stream terminator; do not treat a partial response as complete.",
        ] },
        { id: "compatibility", title: "SDKs", bullets: [
          "For OpenAI SDKs, set baseURL to your Stratus domain with /v1 if the library expects a versioned API base URL.",
          "Use your Stratus API key as apiKey and choose a model from the Stratus model list.",
        ] },
      ],
    },
    responses: {
      intro: "The Responses API accepts the OpenAI Responses format. Support for individual tools and parameters depends on the model, channel, and enabled capabilities.",
      sections: [
        { id: "create", title: "Create a response", code: `POST /v1/responses

curl "$STRATUS_BASE_URL/v1/responses" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "input": "Write a short project plan."
  }'` },
        { id: "compact", title: "Context compaction", code: `POST /v1/responses/compact` },
        { id: "notes", title: "Notes", bullets: [
          "The /v1/responses/compact route is registered separately for compatible compaction workflows.",
          "Check the selected model's documentation: tools, structured output, and reasoning parameters may vary.",
          "Do not send provider keys in the request body; authenticate with your Stratus key.",
        ] },
      ],
    },
    anthropic: {
      intro: "The Anthropic Messages route is available for compatible clients. Stratus accepts the key through x-api-key. Configure SDKs to use the Stratus base URL and your Stratus API key, not a provider key.",
      sections: [
        { id: "endpoint", title: "Method and path", code: `POST /v1/messages` },
        { id: "request", title: "Example request", code: `curl "$STRATUS_BASE_URL/v1/messages" \\
  -H "x-api-key: $STRATUS_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "MODEL_ID",
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'` },
        { id: "models", title: "Models", bullets: [
          "List models in Anthropic format with GET /v1/models and the x-api-key and anthropic-version headers.",
          "Use only models available in your installation that support the Messages API format.",
        ] },
      ],
    },
    gemini: {
      intro: "Native Gemini routes and an OpenAI-compatible Gemini model-list view are registered. Native calls use the Google Generative Language API format.",
      sections: [
        { id: "endpoint", title: "Native route", code: `POST /v1beta/models/{model}:{action}` },
        { id: "generate", title: "Generate text", code: `curl "$STRATUS_BASE_URL/v1beta/models/MODEL_ID:generateContent" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{"parts": [{"text": "Hello!"}]}]
  }'` },
        { id: "auth", title: "Authentication and models", bullets: [
          "Native Gemini accepts Authorization: Bearer, the x-goog-api-key header, or a key query parameter. Avoid query-string keys in client-side apps when a header is available.",
          "Native model list: GET /v1beta/models.",
          "OpenAI-compatible Gemini model list: GET /v1beta/openai/models.",
          "Available actions and multimodal features depend on the selected model and connected channel.",
        ] },
      ],
    },
    realtime: {
      intro: "A Realtime WebSocket route is registered for OpenAI-compatible real-time sessions. Connections require a compatible model and server configuration.",
      sections: [
        { id: "endpoint", title: "WebSocket route", code: `wss://YOUR_STRATUS_DOMAIN/v1/realtime` },
        { id: "auth", title: "Connecting", paragraphs: [
          "Authenticate using a method supported by your WebSocket client and Stratus. Do not embed a permanent secret in public browser code; use server-side issuance of temporary credentials if configured.",
        ] },
        { id: "availability", title: "Compatibility", bullets: [
          "Check the selected model's documentation and client event format.",
          "A registered route does not guarantee audio, transcription, or tool support for every model.",
        ] },
      ],
    },
    images: {
      intro: "Image generation and editing use OpenAI-compatible routes. Required fields and accepted input formats depend on the model and provider.",
      sections: [
        { id: "routes", title: "Routes", bullets: [
          "POST /v1/images/generations — generate an image.",
          "POST /v1/images/edits — edit an image.",
          "POST /v1/edits — compatible image-edit route.",
        ] },
        { id: "generation", title: "Generate an image", code: `curl "$STRATUS_BASE_URL/v1/images/generations" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "IMAGE_MODEL_ID",
    "prompt": "A minimal illustration of a cloud API gateway"
  }'` },
        { id: "limits", title: "Formats and pricing", bullets: [
          "Choose a model listed in the catalog as supporting image generation or editing.",
          "Image variations (/v1/images/variations) is not implemented in this build.",
          "Images may be billed per operation or by output parameters. Check actual Stratus pricing; do not estimate image costs using text-token rates.",
        ] },
      ],
    },
    audio: {
      intro: "This build registers OpenAI-compatible routes for speech recognition, audio translation, and speech generation.",
      sections: [
        { id: "routes", title: "Routes", bullets: [
          "POST /v1/audio/transcriptions — transcribe speech.",
          "POST /v1/audio/translations — translate audio to text.",
          "POST /v1/audio/speech — generate speech.",
        ] },
        { id: "transcription", title: "Transcribe audio", code: `curl "$STRATUS_BASE_URL/v1/audio/transcriptions" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -F "model=AUDIO_MODEL_ID" \\
  -F "file=@speech.mp3"` },
        { id: "support", title: "Compatibility", paragraphs: [
          "Check the model documentation for request format, accepted file types, languages, and options. The route must be enabled on a channel that supports the requested operation.",
        ] },
      ],
    },
    video: {
      intro: "Video generation routes create asynchronous tasks and provide status and content retrieval. Submit a task first, then poll its status.",
      sections: [
        { id: "routes", title: "Task routes", bullets: [
          "POST /v1/video/generations — create a video task.",
          "GET /v1/video/generations/{task_id} — retrieve task status.",
          "POST /v1/videos — create a task in a compatible format.",
          "GET /v1/videos/{task_id} — retrieve a task; GET /v1/videos/{task_id}/content — retrieve its video.",
          "POST /v1/videos/{video_id}/remix — request a remix when supported by the provider.",
        ] },
        { id: "create", title: "Create and check a task", code: `curl "$STRATUS_BASE_URL/v1/videos" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"VIDEO_MODEL_ID","prompt":"A rainy city at night"}'

curl "$STRATUS_BASE_URL/v1/videos/TASK_ID" \\
  -H "Authorization: Bearer $STRATUS_API_KEY"` },
        { id: "provider-routes", title: "Provider-specific format", bullets: [
          "Kling-compatible routes are also registered: /kling/v1/videos/text2video and /kling/v1/videos/image2video, with matching status routes.",
          "Use models and request parameters compatible with the connected provider.",
          "Video may be billed per task, duration, or output settings rather than text tokens.",
        ] },
      ],
    },
    "embeddings-tools": {
      intro: "Additional routes for vector embeddings, document reranking, and text moderation.",
      sections: [
        { id: "routes", title: "Routes", bullets: [
          "POST /v1/embeddings — create vector embeddings.",
          "POST /v1/rerank — rerank documents against a query.",
          "POST /v1/moderations — moderate content.",
          "POST /v1/completions — legacy OpenAI-compatible completions.",
        ] },
        { id: "embeddings", title: "Create embeddings", code: `curl "$STRATUS_BASE_URL/v1/embeddings" \\
  -H "Authorization: Bearer $STRATUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"EMBEDDING_MODEL_ID","input":"Text to index"}'` },
        { id: "availability", title: "Availability", paragraphs: [
          "Each route requires a model of the appropriate type and an active channel. Request fields may vary by provider; check the selected model's contract.",
        ] },
      ],
    },
    "media-tasks": {
      intro: "Separate asynchronous media-task routes are available for some connected providers. These APIs are provider-specific and are not interchangeable with OpenAI-compatible requests.",
      sections: [
        { id: "suno", title: "Suno", bullets: [
          "POST /suno/submit/{action} — submit a task.",
          "POST /suno/fetch and GET /suno/fetch/{id} — retrieve task status or result.",
        ] },
        { id: "midjourney", title: "Midjourney", bullets: [
          "Routes include /mj/submit/imagine, /mj/submit/action, /mj/submit/change, /mj/submit/describe, /mj/submit/blend, and other registered operations.",
          "GET /mj/task/{id}/fetch — retrieve task status.",
          "Allowed operations and request format are determined by the connected integration.",
        ] },
        { id: "note", title: "Before you use these routes", paragraphs: [
          "Confirm the exact request format with your Stratus administrator and the relevant provider configuration. Do not reuse another service's base URL or credentials.",
        ] },
      ],
    },
    "errors-billing": {
      intro: "Authentication, rate-limit, and routing errors depend on API-key status, account access, model selection, and channel configuration.",
      sections: [
        { id: "common", title: "What to check", bullets: [
          "401: verify the Stratus API key, authorization header, and that the key has not been revoked.",
          "403: check account access and key restrictions.",
          "404: verify the path and exact model ID; a route may exist while a model or channel is unavailable.",
          "429: check key limits, request rate, and available balance.",
          "5xx or provider errors: check channel status and retry only when duplicate requests are safe.",
        ] },
        { id: "billing", title: "Usage and billing", bullets: [
          "Token usage is returned when the provider supplies usage data.",
          "Text request costs depend on actual usage and the configured model multiplier; cache, images, and media may be billed separately.",
          "Do not recalculate historical charges using current model prices.",
          "Check request logs and balance in the Stratus dashboard. Never include API keys in logs, tickets, or client-side code.",
        ] },
        { id: "unsupported", title: "Unsupported routes", bullets: [
          "This build does not implement /v1/images/variations, /v1/files and related operations, or /v1/fine-tunes.",
          "Deleting a model with DELETE /v1/models/{model} is also unsupported.",
          "API capabilities can change with server updates; check the current catalog and configuration.",
        ] },
      ],
    },
  },
};

export function docsContentFor(language: WorkspaceLanguage): DocsContent {
  return language === "en" ? en : ru;
}
