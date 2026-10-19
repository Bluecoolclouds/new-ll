import type { WorkspaceLanguage } from "../lib/workspace-copy";

export function createNewApiClientDocs(language: WorkspaceLanguage) {
  return language === "ru" ? {
    groups: [{
      title: "Клиенты и интеграции",
      entries: [
        { slug: "cursor-cline", title: "Cursor + Cline", category: "Клиенты и интеграции" },
        { slug: "vscode-cline", title: "VS Code + Cline", category: "Клиенты и интеграции" },
        { slug: "cherry-studio", title: "Cherry Studio", category: "Клиенты и интеграции" },
        { slug: "gemini-cli", title: "Gemini CLI", category: "Клиенты и интеграции" },
        { slug: "trae-cline", title: "Trae + Cline", category: "Клиенты и интеграции" },
        { slug: "chatbox", title: "Chatbox", category: "Клиенты и интеграции" },
        { slug: "n8n", title: "n8n", category: "Клиенты и интеграции" },
        { slug: "dify", title: "Dify", category: "Клиенты и интеграции" },
        { slug: "sillytavern", title: "SillyTavern", category: "Клиенты и интеграции" },
        { slug: "openwebui", title: "OpenWebUI / LobeChat / NextChat", category: "Клиенты и интеграции" },
        { slug: "python-batch", title: "Python: пакетные запросы", category: "Клиенты и интеграции" },
      ],
    }],
    articles: {
      "cursor-cline": {
        intro: "Подключите Cline внутри Cursor к OpenAI-совместимому API Stratus. Это отдельный способ работы от встроенных настроек моделей Cursor.",
        sections: [
          { id: "install", title: "Установите Cline", bullets: [
            "Откройте маркетплейс расширений Cursor, найдите Cline и установите его.",
            "Откройте панель Cline и перейдите в настройки провайдера.",
          ] },
          { id: "provider", title: "Параметры Stratus", code: `API Provider: OpenAI Compatible
Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "Проверьте подключение", bullets: [
            "Выберите модель, доступную вашему ключу в каталоге Stratus или GET /v1/models.",
            "Начните с короткого запроса в несекретном проекте; проверьте ответ и журнал использования.",
          ] },
        ],
      },
      "vscode-cline": {
        intro: "Настройте расширение Cline в VS Code через OpenAI-совместимый API Stratus.",
        sections: [
          { id: "install", title: "Установите расширение", bullets: [
            "Откройте маркетплейс расширений VS Code, найдите Cline и установите его.",
            "Откройте значок Cline на боковой панели и перейдите в настройки.",
          ] },
          { id: "provider", title: "Параметры провайдера", code: `API Provider: OpenAI Compatible
Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model ID: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "Первый запрос", paragraphs: [
            "Выберите точный ID модели из каталога Stratus или GET /v1/models и отправьте короткий тестовый запрос без приватного кода.",
          ] },
        ],
      },
      "cherry-studio": {
        intro: "Cherry Studio подключается к Stratus как поставщик моделей OpenAI.",
        sections: [
          { id: "setup", title: "Добавьте поставщика", bullets: [
            "Откройте Настройки → Поставщики моделей → Добавить поставщика → OpenAI.",
            "Укажите значения ниже, проверьте соединение и сохраните поставщика.",
            "На главном экране создайте ассистента и выберите модель, доступную вашему ключу.",
          ] },
          { id: "settings", title: "Параметры подключения", code: `Provider: OpenAI
URL: $STRATUS_BASE_URL
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
        ],
      },
      "gemini-cli": {
        intro: "Gemini CLI использует нативный формат Google Generative Language API. Stratus регистрирует для него маршрут /v1beta; доступность конкретной Gemini-модели зависит от каталога и каналов.",
        sections: [
          { id: "install", title: "Установка", paragraphs: [
            "Требуется Node.js 18 или новее. Установите CLI командой:",
          ], code: "npm install -g @google/gemini-cli" },
          { id: "unix", title: "Запуск в Linux и macOS", code: `export GEMINI_API_KEY="PASTE_YOUR_STRATUS_API_KEY"
export GOOGLE_GEMINI_BASE_URL="$STRATUS_BASE_URL"
gemini` },
          { id: "windows", title: "Запуск в Windows CMD", code: `set GEMINI_API_KEY=PASTE_YOUR_STRATUS_API_KEY
set GOOGLE_GEMINI_BASE_URL=$STRATUS_BASE_URL
gemini` },
          { id: "availability", title: "Модели и проверка", bullets: [
            "Проверьте, что ключу доступна Gemini-модель в каталоге Stratus.",
            "Нативный список Gemini-моделей доступен через GET /v1beta/models.",
          ] },
        ],
      },
      "trae-cline": {
        intro: "В Trae можно использовать расширение Cline с OpenAI-совместимым API Stratus.",
        sections: [
          { id: "install", title: "Установите Cline", bullets: [
            "Откройте раздел Extensions в Trae, найдите Cline и установите расширение.",
            "Откройте Cline на боковой панели и заполните настройки провайдера.",
          ] },
          { id: "provider", title: "Параметры Stratus", code: `Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "Проверьте результат", paragraphs: [
            "Выберите точный ID доступной модели из каталога Stratus или GET /v1/models и выполните тестовый запрос в несекретном проекте.",
          ] },
        ],
      },
      chatbox: {
        intro: "Chatbox подключается к Stratus через режим OpenAI Compatible.",
        sections: [
          { id: "setup", title: "Добавьте модельный сервис", bullets: [
            "Откройте веб-версию Chatbox или настольное приложение.",
            "Перейдите в Настройки → Поставщик модели и добавьте новый сервис.",
            "Введите параметры ниже, затем загрузите список моделей и выберите доступную.",
          ] },
          { id: "settings", title: "Параметры подключения", code: `API mode: OpenAI Compatible
API URL: $STRATUS_BASE_URL
API Key: PASTE_YOUR_STRATUS_API_KEY` },
        ],
      },
      n8n: {
        intro: "В n8n можно отправлять запросы к Stratus через узел HTTP Request и зарегистрированный маршрут Chat Completions.",
        sections: [
          { id: "request", title: "Настройте HTTP Request", bullets: [
            "Выберите метод POST и URL из примера ниже.",
            "Добавьте заголовки Authorization и Content-Type.",
            "В теле запроса укажите модель из каталога Stratus.",
          ], code: `POST $STRATUS_BASE_URL/v1/chat/completions

Authorization: Bearer PASTE_YOUR_STRATUS_API_KEY
Content-Type: application/json

{
  "model": "MODEL_ID_FROM_STRATUS_CATALOG",
  "messages": [
    { "role": "user", "content": "Привет" }
  ]
}` },
          { id: "security", title: "Храните ключ безопасно", bullets: [
            "Сохраните ключ в Credentials или защищённых переменных n8n, а не в общем workflow.",
            "Не публикуйте экспорт workflow с секретными заголовками.",
          ] },
        ],
      },
      dify: {
        intro: "Dify подключается к Stratus через плагин OpenAI-API-compatible.",
        sections: [
          { id: "plugin", title: "Установите провайдера", bullets: [
            "В настройках Dify откройте раздел поставщиков моделей и установите плагин OpenAI-API-compatible.",
            "Добавьте модель и выберите её в рабочем пространстве.",
          ] },
          { id: "settings", title: "Параметры Stratus", code: `API Key: PASTE_YOUR_STRATUS_API_KEY
Base URL: $STRATUS_BASE_URL
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "availability", title: "Доступность модели", paragraphs: [
            "Используйте точный ID модели, доступной вашему ключу. Требуемые возможности и ограничения задаются подключённой моделью и провайдером.",
          ] },
        ],
      },
      sillytavern: {
        intro: "SillyTavern подключается к Stratus через OpenAI Chat Completions.",
        sections: [
          { id: "setup", title: "Настройте подключение", bullets: [
            "Откройте SillyTavern и нажмите «Подключить API».",
            "Выберите Chat Completions и источник Custom (Пользовательский).",
            "Добавьте ключ API, затем выберите модель из списка доступных и подключитесь.",
          ] },
          { id: "settings", title: "Параметры API", code: `API: Chat Completions
Source: Custom
URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY` },
        ],
      },
      openwebui: {
        intro: "OpenWebUI, LobeChat и NextChat могут обращаться к Stratus как к OpenAI-совместимому API.",
        sections: [
          { id: "setup", title: "Подключите API", bullets: [
            "Откройте настройки приложения и найдите раздел API или Model Provider.",
            "Выберите OpenAI-compatible provider, если клиент предлагает выбор типа.",
            "Добавьте адрес API и ключ, затем выберите модель, доступную вашему ключу.",
          ] },
          { id: "settings", title: "Общие параметры", code: `Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "note", title: "Примечание", paragraphs: [
            "Названия и расположение полей различаются между приложениями и версиями. Используйте модель из GET /v1/models; не указывайте URL чужого шлюза.",
          ] },
        ],
      },
      "python-batch": {
        intro: "Пример параллельных запросов к OpenAI-совместимому маршруту Stratus через aiohttp.",
        sections: [
          { id: "example", title: "Асинхронный пример", code: `import aiohttp
import asyncio

API_KEY = "PASTE_YOUR_STRATUS_API_KEY"
BASE_URL = "$STRATUS_BASE_URL/v1"
MODEL = "MODEL_ID_FROM_STRATUS_CATALOG"

async def chat(session, prompt):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with session.post(
        f"{BASE_URL}/chat/completions",
        headers=headers,
        json=body,
    ) as response:
        response.raise_for_status()
        data = await response.json()
        return data["choices"][0]["message"]["content"]

async def main():
    prompts = ["Что такое Python?", "Что такое API?", "Объясни asyncio"]
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(
            *(chat(session, prompt) for prompt in prompts),
            return_exceptions=True,
        )
        for index, result in enumerate(results, start=1):
            print(f"[{index}] {result}")

asyncio.run(main())` },
          { id: "limits", title: "Ограничьте параллелизм", bullets: [
            "Не запускайте неограниченное количество одновременных запросов; обрабатывайте ошибки и ограничения ключа.",
            "Используйте переменные окружения или хранилище секретов для API-ключа в реальном приложении.",
          ] },
        ],
      },
    },
  } : {
    groups: [{
      title: "Clients and integrations",
      entries: [
        { slug: "cursor-cline", title: "Cursor + Cline", category: "Clients and integrations" },
        { slug: "vscode-cline", title: "VS Code + Cline", category: "Clients and integrations" },
        { slug: "cherry-studio", title: "Cherry Studio", category: "Clients and integrations" },
        { slug: "gemini-cli", title: "Gemini CLI", category: "Clients and integrations" },
        { slug: "trae-cline", title: "Trae + Cline", category: "Clients and integrations" },
        { slug: "chatbox", title: "Chatbox", category: "Clients and integrations" },
        { slug: "n8n", title: "n8n", category: "Clients and integrations" },
        { slug: "dify", title: "Dify", category: "Clients and integrations" },
        { slug: "sillytavern", title: "SillyTavern", category: "Clients and integrations" },
        { slug: "openwebui", title: "OpenWebUI / LobeChat / NextChat", category: "Clients and integrations" },
        { slug: "python-batch", title: "Python: batch requests", category: "Clients and integrations" },
      ],
    }],
    articles: {
      "cursor-cline": {
        intro: "Connect Cline inside Cursor to the Stratus OpenAI-compatible API. This is separate from Cursor's built-in model settings.",
        sections: [
          { id: "install", title: "Install Cline", bullets: [
            "Open Cursor's extension marketplace, find Cline, and install it.",
            "Open the Cline panel and go to the provider settings.",
          ] },
          { id: "provider", title: "Stratus settings", code: `API Provider: OpenAI Compatible
Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "Verify the connection", bullets: [
            "Choose a model available to your key in the Stratus catalog or GET /v1/models.",
            "Start with a short prompt in a non-sensitive project and check the response and usage log.",
          ] },
        ],
      },
      "vscode-cline": {
        intro: "Configure the Cline extension in VS Code to use the Stratus OpenAI-compatible API.",
        sections: [
          { id: "install", title: "Install the extension", bullets: [
            "Open the VS Code extension marketplace, find Cline, and install it.",
            "Open Cline from the sidebar and go to its settings.",
          ] },
          { id: "provider", title: "Provider settings", code: `API Provider: OpenAI Compatible
Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model ID: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "First request", paragraphs: [
            "Choose an exact model ID from the Stratus catalog or GET /v1/models, then send a short test prompt without private code.",
          ] },
        ],
      },
      "cherry-studio": {
        intro: "Connect Cherry Studio to Stratus as an OpenAI model provider.",
        sections: [
          { id: "setup", title: "Add a provider", bullets: [
            "Open Settings → Model Providers → Add Provider → OpenAI.",
            "Enter the values below, test the connection, and save the provider.",
            "Create an assistant on the home screen and select a model available to your key.",
          ] },
          { id: "settings", title: "Connection settings", code: `Provider: OpenAI
URL: $STRATUS_BASE_URL
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
        ],
      },
      "gemini-cli": {
        intro: "Gemini CLI uses Google's native Generative Language API format. Stratus registers the /v1beta route; access to a specific Gemini model depends on the catalog and connected channels.",
        sections: [
          { id: "install", title: "Install", paragraphs: [
            "Node.js 18 or later is required. Install the CLI:",
          ], code: "npm install -g @google/gemini-cli" },
          { id: "unix", title: "Run on Linux and macOS", code: `export GEMINI_API_KEY="PASTE_YOUR_STRATUS_API_KEY"
export GOOGLE_GEMINI_BASE_URL="$STRATUS_BASE_URL"
gemini` },
          { id: "windows", title: "Run in Windows CMD", code: `set GEMINI_API_KEY=PASTE_YOUR_STRATUS_API_KEY
set GOOGLE_GEMINI_BASE_URL=$STRATUS_BASE_URL
gemini` },
          { id: "availability", title: "Models and verification", bullets: [
            "Make sure a Gemini model is available to your key in the Stratus catalog.",
            "The native Gemini model list is available at GET /v1beta/models.",
          ] },
        ],
      },
      "trae-cline": {
        intro: "Use the Cline extension in Trae with the Stratus OpenAI-compatible API.",
        sections: [
          { id: "install", title: "Install Cline", bullets: [
            "Open Extensions in Trae, find Cline, and install the extension.",
            "Open Cline in the sidebar and configure its provider.",
          ] },
          { id: "provider", title: "Stratus settings", code: `Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "test", title: "Verify the result", paragraphs: [
            "Choose an exact model ID available in the Stratus catalog or GET /v1/models and test it in a non-sensitive project.",
          ] },
        ],
      },
      chatbox: {
        intro: "Connect Chatbox to Stratus using OpenAI Compatible mode.",
        sections: [
          { id: "setup", title: "Add a model provider", bullets: [
            "Open Chatbox web or desktop app.",
            "Go to Settings → Model Provider and add a service.",
            "Enter the values below, load the model list, and choose an available model.",
          ] },
          { id: "settings", title: "Connection settings", code: `API mode: OpenAI Compatible
API URL: $STRATUS_BASE_URL
API Key: PASTE_YOUR_STRATUS_API_KEY` },
        ],
      },
      n8n: {
        intro: "In n8n, send requests to Stratus through an HTTP Request node and the registered Chat Completions route.",
        sections: [
          { id: "request", title: "Configure HTTP Request", bullets: [
            "Select POST and use the URL in the example below.",
            "Add Authorization and Content-Type headers.",
            "Set model to an ID from the Stratus catalog.",
          ], code: `POST $STRATUS_BASE_URL/v1/chat/completions

Authorization: Bearer PASTE_YOUR_STRATUS_API_KEY
Content-Type: application/json

{
  "model": "MODEL_ID_FROM_STRATUS_CATALOG",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}` },
          { id: "security", title: "Store the key safely", bullets: [
            "Store the key in n8n Credentials or protected environment variables, not in a shared workflow.",
            "Do not publish workflow exports containing secret headers.",
          ] },
        ],
      },
      dify: {
        intro: "Connect Dify to Stratus with the OpenAI-API-compatible plugin.",
        sections: [
          { id: "plugin", title: "Install the provider", bullets: [
            "In Dify settings, open model providers and install the OpenAI-API-compatible plugin.",
            "Add a model and select it in your workspace.",
          ] },
          { id: "settings", title: "Stratus settings", code: `API Key: PASTE_YOUR_STRATUS_API_KEY
Base URL: $STRATUS_BASE_URL
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "availability", title: "Model availability", paragraphs: [
            "Use the exact ID of a model available to your key. Required capabilities and limits depend on the connected model and provider.",
          ] },
        ],
      },
      sillytavern: {
        intro: "Connect SillyTavern to Stratus through OpenAI Chat Completions.",
        sections: [
          { id: "setup", title: "Configure the connection", bullets: [
            "Open SillyTavern and choose Connect API.",
            "Select Chat Completions and Custom as the source.",
            "Add an API key, select an available model, and connect.",
          ] },
          { id: "settings", title: "API settings", code: `API: Chat Completions
Source: Custom
URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY` },
        ],
      },
      openwebui: {
        intro: "OpenWebUI, LobeChat, and NextChat can use Stratus as an OpenAI-compatible API.",
        sections: [
          { id: "setup", title: "Connect the API", bullets: [
            "Open the app settings and find API or Model Provider.",
            "Choose an OpenAI-compatible provider if the client offers a provider type.",
            "Enter the API URL and key, then choose a model available to your key.",
          ] },
          { id: "settings", title: "Shared settings", code: `Base URL: $STRATUS_BASE_URL/v1
API Key: PASTE_YOUR_STRATUS_API_KEY
Model: MODEL_ID_FROM_STRATUS_CATALOG` },
          { id: "note", title: "Note", paragraphs: [
            "Field names and locations vary by app and version. Use a model from GET /v1/models; do not enter another gateway's URL.",
          ] },
        ],
      },
      "python-batch": {
        intro: "Example of concurrent requests to Stratus's OpenAI-compatible route using aiohttp.",
        sections: [
          { id: "example", title: "Async example", code: `import aiohttp
import asyncio

API_KEY = "PASTE_YOUR_STRATUS_API_KEY"
BASE_URL = "$STRATUS_BASE_URL/v1"
MODEL = "MODEL_ID_FROM_STRATUS_CATALOG"

async def chat(session, prompt):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with session.post(
        f"{BASE_URL}/chat/completions",
        headers=headers,
        json=body,
    ) as response:
        response.raise_for_status()
        data = await response.json()
        return data["choices"][0]["message"]["content"]

async def main():
    prompts = ["What is Python?", "What is an API?", "Explain asyncio"]
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(
            *(chat(session, prompt) for prompt in prompts),
            return_exceptions=True,
        )
        for index, result in enumerate(results, start=1):
            print(f"[{index}] {result}")

asyncio.run(main())` },
          { id: "limits", title: "Limit concurrency", bullets: [
            "Avoid unlimited simultaneous requests; handle errors and key limits.",
            "Use environment variables or a secret store for the API key in production.",
          ] },
        ],
      },
    },
  };
}
