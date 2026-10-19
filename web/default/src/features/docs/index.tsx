import { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Copy, Check, Key, Zap, CreditCard, AlertCircle, Code2,
  BookOpen, ArrowRight, ExternalLink, ChevronDown, ChevronRight,
  HelpCircle, MessageSquare,
} from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { cn } from '@/lib/utils'

/* ─── Copy hook ─────────────────────────────────────────────────────────── */
function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return { copied, copy }
}

/* ─── Code block with macOS-style header ───────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { copied, copy } = useCopy(code)
  return (
    <div className='rounded-xl border overflow-hidden'>
      <div className='flex items-center justify-between bg-muted/40 border-b px-4 py-2'>
        <div className='flex gap-1.5'>
          <span className='h-2.5 w-2.5 rounded-full bg-red-400/70' />
          <span className='h-2.5 w-2.5 rounded-full bg-amber-400/70' />
          <span className='h-2.5 w-2.5 rounded-full bg-green-400/70' />
        </div>
        <span className='text-muted-foreground text-[10px] font-mono'>{lang}</span>
        <button
          onClick={copy}
          className='flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs transition-colors'
        >
          {copied ? <Check className='h-3 w-3 text-green-500' /> : <Copy className='h-3 w-3' />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className='bg-muted/20 overflow-x-auto px-5 py-4'>
        <code className='font-mono text-foreground text-[12.5px] leading-[1.7]'>{code}</code>
      </pre>
    </div>
  )
}

/* ─── Endpoint row ──────────────────────────────────────────────────────── */
function EndpointRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy(value)
  return (
    <div className='flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors border-b last:border-0 border-border/40'>
      <span className='text-xs text-muted-foreground w-32 shrink-0'>{label}</span>
      <code className='flex-1 font-mono text-xs text-foreground truncate'>{value}</code>
      <button
        onClick={copy}
        className='shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded'
        aria-label='Copy'
      >
        {copied ? <Check className='h-3.5 w-3.5 text-green-500' /> : <Copy className='h-3.5 w-3.5' />}
      </button>
    </div>
  )
}

/* ─── Config row ────────────────────────────────────────────────────────── */
function ConfigRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const { copied, copy } = useCopy(value)
  return (
    <div className='flex items-center gap-3 py-1.5'>
      <span className='text-xs text-muted-foreground w-28 shrink-0'>{label}</span>
      <code className='flex-1 font-mono text-xs bg-muted/40 px-2 py-1 rounded border border-border/40 text-foreground truncate'>{value}</code>
      {copyable && (
        <button onClick={copy} className='shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded' aria-label='Copy'>
          {copied ? <Check className='h-3 w-3 text-green-500' /> : <Copy className='h-3 w-3' />}
        </button>
      )}
    </div>
  )
}

/* ─── Section card wrapper ──────────────────────────────────────────────── */
function SectionCard({
  icon, title, subtitle, children, id,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <div id={id} className='rounded-xl border border-border/60 bg-card overflow-hidden scroll-mt-6'>
      <div className='flex items-center gap-3 px-5 py-3.5 border-b border-border/50'>
        <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60'>
          {icon}
        </div>
        <div>
          <div className='text-sm font-semibold text-foreground'>{title}</div>
          {subtitle && <div className='text-xs text-muted-foreground'>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ─── Sidebar nav item ──────────────────────────────────────────────────── */
function NavItem({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium w-full text-left transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/* ─── Accordion integration item ────────────────────────────────────────── */
function IntegrationItem({
  emoji, title, subtitle, children,
}: {
  emoji: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className='border-b border-border/40 last:border-0'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left'
      >
        <span className='text-base leading-none w-6 text-center'>{emoji}</span>
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold text-foreground'>{title}</div>
          <div className='text-xs text-muted-foreground mt-0.5'>{subtitle}</div>
        </div>
        {open
          ? <ChevronDown className='h-4 w-4 text-muted-foreground shrink-0' />
          : <ChevronRight className='h-4 w-4 text-muted-foreground shrink-0' />}
      </button>
      {open && (
        <div className='px-5 pb-5 flex flex-col gap-3 bg-muted/5'>
          {children}
        </div>
      )}
    </div>
  )
}

/* ─── Step list ─────────────────────────────────────────────────────────── */
function Steps({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ol className='flex flex-col gap-2'>
      {items.map((item, i) => (
        <li key={i} className='flex gap-3 text-sm'>
          <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5'>{i + 1}</span>
          <span className='text-muted-foreground leading-snug'>{item}</span>
        </li>
      ))}
    </ol>
  )
}

/* ─── Main component ────────────────────────────────────────────────────── */
export function Docs() {
  const { t } = useTranslation()
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const [activeTab, setActiveTab] = useState<'python' | 'js'>('python')
  const [activeSection, setActiveSection] = useState('quickstart')

  const sectionIds = ['quickstart', 'endpoints', 'clients', 'topup', 'errors', 'faq', 'support'] as const
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    )
    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="${baseUrl}/v1",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Привет!"}],
)
print(response.choices[0].message.content)`

  const jsExample = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: '${baseUrl}/v1',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Привет!' }],
});
console.log(response.choices[0].message.content);`

  const batchPythonExample = `import aiohttp
import asyncio

API_KEY = "sk-ВАШ_КЛЮЧ"
BASE_URL = "${baseUrl}/v1"

async def chat(session, prompt):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}]
    }
    async with session.post(f"{BASE_URL}/chat/completions", headers=headers, json=body) as resp:
        data = await resp.json()
        return data["choices"][0]["message"]["content"]

async def main():
    prompts = ["Что такое Python?", "Что такое API?", "Объясни asyncio"]
    async with aiohttp.ClientSession() as session:
        tasks = [chat(session, p) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, result in enumerate(results):
            print(f"[{i+1}] {result}\\n")

asyncio.run(main())`

  const errors = [
    { code: '401', label: 'Unauthorized', dot: 'bg-red-500', desc: 'Неверный или истёкший API-ключ. Проверьте ключ в разделе «Ключи» и убедитесь, что он активен.' },
    { code: '429', label: 'Too Many Requests', dot: 'bg-amber-500', desc: 'Превышен лимит запросов. Проверьте лимиты ключа или обратитесь в поддержку.' },
    { code: '402', label: 'Insufficient Balance', dot: 'bg-orange-500', desc: 'Недостаточно средств на балансе. Пополните кошелёк.' },
    { code: '404', label: 'Model not found', dot: 'bg-muted-foreground/60', desc: 'Модель недоступна для вашего ключа. Проверьте настройки доступа в разделе «Ключи».' },
    { code: 'URL', label: 'base_url wrong', dot: 'bg-blue-500', desc: `Убедитесь что Base URL указан без двойного слэша и заканчивается на /v1.` },
    { code: 'TLS', label: 'SSL / TLS error', dot: 'bg-muted-foreground/60', desc: 'Используйте HTTPS-адрес. Если запускаете локально, отключите проверку сертификата только для тестов.' },
  ]

  return (
    <PublicLayout>
      <div className='flex w-full min-h-0'>

        {/* ── Left sidebar ── */}
        <aside className='hidden lg:flex w-52 shrink-0 flex-col border-r border-border/60 bg-muted/10 pt-6 px-3 gap-1 sticky top-0 h-[calc(100vh-var(--header-height,60px))] overflow-y-auto'>
          <div className='flex items-center gap-2 px-3 mb-4'>
            <BookOpen className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-semibold text-foreground'>{t('Документация')}</span>
          </div>

          <div className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1'>
            {t('Начало работы')}
          </div>
          <NavItem icon={<Zap className='h-3.5 w-3.5' />} label={t('Быстрый старт')} active={activeSection === 'quickstart'} onClick={() => scrollTo('quickstart')} />
          <NavItem icon={<Key className='h-3.5 w-3.5' />} label={t('API-ключи')} active={activeSection === 'endpoints'} onClick={() => scrollTo('endpoints')} />

          <div className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-1'>
            {t('Интеграция')}
          </div>
          <NavItem icon={<span className='text-xs'>🖥️</span>} label={t('Клиенты и IDE')} active={activeSection === 'clients'} onClick={() => scrollTo('clients')} />
          <NavItem icon={<CreditCard className='h-3.5 w-3.5' />} label={t('Оплата')} active={activeSection === 'topup'} onClick={() => scrollTo('topup')} />

          <div className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-1'>
            {t('Справка')}
          </div>
          <NavItem icon={<AlertCircle className='h-3.5 w-3.5' />} label={t('Ошибки')} active={activeSection === 'errors'} onClick={() => scrollTo('errors')} />
          <NavItem icon={<HelpCircle className='h-3.5 w-3.5' />} label='FAQ' active={activeSection === 'faq'} onClick={() => scrollTo('faq')} />
          <NavItem icon={<MessageSquare className='h-3.5 w-3.5' />} label={t('Поддержка')} active={activeSection === 'support'} onClick={() => scrollTo('support')} />
        </aside>

        {/* ── Main content ── */}
        <main className='flex-1 min-w-0 overflow-y-auto'>
          <div className='mx-auto max-w-[860px] px-6 py-10 flex flex-col gap-10 sm:px-8'>

            {/* Quick-start ── */}
            <div id='quickstart'>
              <div className='mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>{t('Быстрый старт')}</div>
              <h1 className='text-2xl font-bold tracking-tight text-foreground mb-1'>{t('Три шага до первого запроса')}</h1>
              <p className='text-muted-foreground text-sm mb-6'>{t('Займёт меньше пяти минут.')}</p>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8'>
                {[
                  { icon: <Key className='h-5 w-5 text-primary' />, title: t('Создайте ключ'), desc: t('Ключи → Добавить ключ'), to: '/keys' as const },
                  { icon: <CreditCard className='h-5 w-5 text-primary' />, title: t('Пополните баланс'), desc: t('Кошелёк → FreeKassa / СБП'), to: '/wallet/' as const },
                  { icon: <Code2 className='h-5 w-5 text-primary' />, title: t('Отправьте запрос'), desc: t('Скопируйте пример ниже'), to: '/docs' as const },
                ].map((s, i) => (
                  <Link key={i} to={s.to} className='group flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all'>
                    <div className='flex items-start justify-between'>
                      <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border/50'>{s.icon}</div>
                      <ArrowRight className='h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors' />
                    </div>
                    <div>
                      <div className='text-sm font-semibold text-foreground'>{s.title}</div>
                      <div className='text-xs text-muted-foreground mt-0.5'>{s.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className='rounded-xl border border-border/60 bg-card overflow-hidden'>
                <div className='flex items-center justify-between px-5 py-3.5 border-b border-border/50'>
                  <div className='flex items-center gap-2'>
                    <Code2 className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-semibold text-foreground'>{t('Пример кода')}</span>
                  </div>
                  <div className='flex gap-1'>
                    {(['python', 'js'] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', activeTab === tab ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                        {tab === 'python' ? 'Python' : 'JS'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className='p-4'>
                  <CodeBlock code={activeTab === 'python' ? pythonExample : jsExample} lang={activeTab === 'python' ? 'python' : 'javascript'} />
                </div>
              </div>
            </div>

            {/* Endpoints ── */}
            <SectionCard id='endpoints' icon={<Zap className='h-4 w-4 text-primary' />} title={t('Эндпоинты API')} subtitle={t('Совместимость с OpenAI SDK')}>
              <div>
                <EndpointRow label='Base URL' value={`${baseUrl}/v1`} />
                <EndpointRow label='Chat completions' value={`${baseUrl}/v1/chat/completions`} />
                <EndpointRow label='Models' value={`${baseUrl}/v1/models`} />
                <EndpointRow label='Embeddings' value={`${baseUrl}/v1/embeddings`} />
              </div>
            </SectionCard>

            {/* Clients ── */}
            <SectionCard id='clients' icon={<span className='text-sm leading-none'>🖥️</span>} title={t('Клиенты и IDE')} subtitle={t('Пошаговые инструкции подключения')}>
              <div>

                {/* Cursor */}
                <IntegrationItem emoji='🖱️' title='Cursor' subtitle='AI-редактор кода на базе VS Code'>
                  <Steps items={[
                    <>Откройте маркетплейс Cursor, найдите <strong>Cline</strong> и установите.</>,
                    'Значок Cline появится в верхнем меню — откройте его.',
                    'Нажмите значок настроек в правом верхнем углу.',
                    <>Заполните параметры:</>,
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='API Provider' value='OpenAI Compatible' />
                    <ConfigRow label='Base URL' value={`${baseUrl}/v1`} copyable />
                    <ConfigRow label='API Key' value='Ваш API-ключ' />
                    <ConfigRow label='Model' value='gpt-4o' />
                  </div>
                  <p className='text-xs text-muted-foreground'>Введите «Привет» в чат Cline — если получили ответ, настройка выполнена ✅</p>
                </IntegrationItem>

                {/* Cherry Studio */}
                <IntegrationItem emoji='🍒' title='Cherry Studio' subtitle='Open-source десктопный AI-клиент'>
                  <Steps items={[
                    'Запустите Cherry Studio → Настройки → Поставщики моделей.',
                    'Нажмите «Добавить поставщика» → тип OpenAI.',
                    <>Заполните параметры:</>,
                    'Нажмите «Проверить соединение» → Сохранить.',
                    'Главный экран → Добавить ассистента → выбрать модель.',
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='URL' value={`${baseUrl}`} copyable />
                    <ConfigRow label='API Key' value='Ваш API-ключ' />
                  </div>
                  <a href='https://www.cherry-ai.com/' target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-xs text-primary hover:underline'>
                    cherry-ai.com <ExternalLink className='h-2.5 w-2.5' />
                  </a>
                </IntegrationItem>

                {/* VS Code + Cline */}
                <IntegrationItem emoji='💙' title='VS Code — Cline' subtitle='Плагин для AI-разработки прямо в VS Code'>
                  <Steps items={[
                    'Откройте маркетплейс VS Code, найдите Cline и установите.',
                    'Нажмите значок Cline в боковой панели → иконка настроек.',
                    <>Заполните параметры:</>,
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='API Provider' value='OpenAI Compatible' />
                    <ConfigRow label='Base URL' value={`${baseUrl}/v1`} copyable />
                    <ConfigRow label='API Key' value='Ваш API-ключ' />
                    <ConfigRow label='Model ID' value='gpt-4o' />
                  </div>
                </IntegrationItem>

                {/* Claude Code */}
                <IntegrationItem emoji='🤖' title='Claude Code' subtitle='AI-ассистент для программирования в терминале'>
                  <p className='text-xs text-muted-foreground'>Требуется Node.js v18+. Установка:</p>
                  <CodeBlock code={`npm install -g @anthropic-ai/claude-code`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>Запуск (macOS / Linux):</p>
                  <CodeBlock code={`export ANTHROPIC_AUTH_TOKEN=sk-ВАШ_КЛЮЧ\nexport ANTHROPIC_BASE_URL=${baseUrl}\nclaude`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>Запуск (Windows cmd):</p>
                  <CodeBlock code={`set ANTHROPIC_AUTH_TOKEN=sk-ВАШ_КЛЮЧ\nset ANTHROPIC_BASE_URL=${baseUrl}\nclaude`} lang='cmd' />
                </IntegrationItem>

                {/* Gemini CLI */}
                <IntegrationItem emoji='✨' title='Gemini CLI' subtitle='Официальный CLI Google для работы с Gemini'>
                  <p className='text-xs text-muted-foreground'>Требуется Node.js v18+. Установка:</p>
                  <CodeBlock code={`npm install -g @google/gemini-cli`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>Запуск (macOS / Linux):</p>
                  <CodeBlock code={`export GEMINI_API_KEY=sk-ВАШ_КЛЮЧ\nexport GOOGLE_GEMINI_BASE_URL=${baseUrl}\ngemini`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>Запуск (Windows):</p>
                  <CodeBlock code={`set GEMINI_API_KEY=sk-ВАШ_КЛЮЧ\nset GOOGLE_GEMINI_BASE_URL=${baseUrl}\ngemini`} lang='cmd' />
                </IntegrationItem>

                {/* Trae */}
                <IntegrationItem emoji='🛠️' title='Trae' subtitle='AI-среда разработки на базе VS Code'>
                  <Steps items={[
                    'Откройте Trae → Расширения → найдите cline → установите.',
                    'Нажмите значок Cline в боковой панели.',
                    <>Заполните параметры:</>,
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='Base URL' value={`${baseUrl}/v1`} copyable />
                    <ConfigRow label='API Key' value='Ваш API-ключ' />
                    <ConfigRow label='Model' value='gpt-4o' />
                  </div>
                  <a href='https://www.trae.cn/' target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-xs text-primary hover:underline'>
                    trae.cn <ExternalLink className='h-2.5 w-2.5' />
                  </a>
                </IntegrationItem>

                {/* Chatbox */}
                <IntegrationItem emoji='💬' title='Chatbox' subtitle='Приложение для чата с AI, десктоп и веб'>
                  <Steps items={[
                    <>Откройте <a href='https://web.chatboxai.app/' target='_blank' rel='noopener noreferrer' className='text-primary hover:underline'>web.chatboxai.app</a> или десктопное приложение.</>,
                    'Настройки → Поставщик модели → нажмите +.',
                    <>Заполните поля:</>,
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='Режим API' value='OpenAI Compatible' />
                    <ConfigRow label='URL API' value={`${baseUrl}`} copyable />
                    <ConfigRow label='API-ключ' value='Ваш API-ключ' />
                  </div>
                  <p className='text-xs text-muted-foreground'>Нажмите «Получить» для загрузки списка моделей, выберите нужную ✅</p>
                </IntegrationItem>

                {/* N8N */}
                <IntegrationItem emoji='⚙️' title='N8N' subtitle='Автоматизация задач с AI через HTTP'>
                  <p className='text-xs text-muted-foreground'>Добавьте узел <strong>HTTP Request</strong>:</p>
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='Метод' value='POST' />
                    <ConfigRow label='URL' value={`${baseUrl}/v1/chat/completions`} copyable />
                  </div>
                  <p className='text-xs text-muted-foreground mt-2'>Заголовки:</p>
                  <CodeBlock code={`{\n  "Authorization": "Bearer ВАШ_КЛЮЧ",\n  "Content-Type": "application/json"\n}`} lang='json' />
                  <p className='text-xs text-muted-foreground mt-1'>Тело запроса:</p>
                  <CodeBlock code={`{\n  "model": "gpt-4o",\n  "messages": [\n    { "role": "user", "content": "Привет" }\n  ]\n}`} lang='json' />
                </IntegrationItem>

                {/* Dify */}
                <IntegrationItem emoji='🔷' title='Dify' subtitle='Open-source платформа для LLM-приложений'>
                  <Steps items={[
                    <>Войдите на <a href='https://dify.ai' target='_blank' rel='noopener noreferrer' className='text-primary hover:underline'>dify.ai</a> → Настройки → Поставщики моделей.</>,
                    'Установите плагин OpenAI-API-compatible.',
                    'Нажмите «Добавить модель» и заполните:',
                    'В рабочем пространстве выберите добавленную модель в правом верхнем углу.',
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='API-ключ' value='Ваш API-ключ' />
                    <ConfigRow label='URL' value={`${baseUrl}`} copyable />
                  </div>
                </IntegrationItem>

                {/* SillyTavern */}
                <IntegrationItem emoji='🎭' title='SillyTavern' subtitle='Локальный интерфейс для ролевых игр с AI'>
                  <Steps items={[
                    'После запуска SillyTavern нажмите «Подключить API».',
                    <>Заполните параметры:</>,
                    <>Нажмите «Управление ключами» → «Добавить ключ API».</>,
                    'В разделе «Доступные модели» выберите нужную → «Подключить».',
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='API' value='Chat Completions' />
                    <ConfigRow label='Источник' value='Custom (Пользовательский)' />
                    <ConfigRow label='URL' value={`${baseUrl}/v1`} copyable />
                  </div>
                  <p className='text-xs text-muted-foreground'>Зелёный индикатор = готово к работе ✅</p>
                </IntegrationItem>

                {/* OpenWebUI / Lobechat */}
                <IntegrationItem emoji='🌐' title='OpenWebUI / Lobechat / NextChat' subtitle='Веб-интерфейсы с поддержкой OpenAI API'>
                  <Steps items={[
                    'Откройте настройки → раздел API / Model Provider.',
                    <>Укажите Base URL и API-ключ:</>,
                  ]} />
                  <div className='flex flex-col gap-1.5 mt-1'>
                    <ConfigRow label='Base URL' value={`${baseUrl}/v1`} copyable />
                    <ConfigRow label='API Key' value='Ваш API-ключ' />
                  </div>
                  <div className='flex gap-3 flex-wrap mt-1'>
                    {[
                      { label: 'OpenWebUI', href: 'https://openwebui.com' },
                      { label: 'Lobechat', href: 'https://lobechat.com' },
                      { label: 'NextChat', href: 'https://nextchat.dev' },
                    ].map((l) => (
                      <a key={l.label} href={l.href} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-xs text-primary hover:underline'>
                        {l.label} <ExternalLink className='h-2.5 w-2.5' />
                      </a>
                    ))}
                  </div>
                </IntegrationItem>

                {/* OpenClaw */}
                <IntegrationItem emoji='🦞' title='OpenClaw' subtitle='AI-шлюз в вашем мессенджере: Telegram, Discord, WhatsApp и др.'>
                  <p className='text-xs text-muted-foreground'>Установка (требуется Node.js):</p>
                  <CodeBlock code={`npm install -g openclaw@latest\nopenclaw onboard`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>
                    При прохождении мастера: выберите <strong>QuickStart</strong>, шаг с ключом API — пропустить, затем выберите <strong>All providers</strong>.
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>Откройте конфигурационный файл:</p>
                  <CodeBlock code={`open ~/.openclaw`} lang='bash' />
                  <p className='text-xs text-muted-foreground mt-1'>Замените содержимое <code className='font-mono bg-muted/40 px-1 rounded'>openclaw.json</code>:</p>
                  <CodeBlock code={`{
  "gateway": { "mode": "local" },
  "agents": {
    "defaults": {
      "model": { "primary": "proxy/gpt-4o" },
      "models": { "proxy/gpt-4o": {} }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "proxy": {
        "baseUrl": "${baseUrl}/v1",
        "apiKey": "sk-ВАШ_КЛЮЧ",
        "api": "openai-completions",
        "models": [{
          "id": "gpt-4o",
          "name": "gpt-4o",
          "contextWindow": 128000,
          "maxTokens": 32000
        }]
      }
    }
  }
}`} lang='json' />
                  <p className='text-xs text-muted-foreground'>Запуск шлюза:</p>
                  <CodeBlock code={`openclaw gateway`} lang='bash' />
                  <a href='https://docs.openclaw.ai/zh-CN' target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-xs text-primary hover:underline'>
                    docs.openclaw.ai <ExternalLink className='h-2.5 w-2.5' />
                  </a>
                </IntegrationItem>

                {/* Xinghu Claw */}
                <IntegrationItem emoji='🤖' title='Xinghu Claw' subtitle='Деплой OpenClaw-бота за 1 минуту — без технических знаний'>
                  <p className='text-xs text-muted-foreground'>
                    Десктопный инструмент для запуска AI-бота в Telegram, Feishu, DingTalk, Discord. Автоматически устанавливает Node.js, Git и зависимости.
                  </p>
                  <div className='flex flex-col gap-1.5'>
                    <div className='text-xs font-medium text-foreground'>Поддерживаемые ОС:</div>
                    <div className='flex gap-2 flex-wrap text-xs text-muted-foreground'>
                      <span className='bg-muted/40 border border-border/50 rounded px-2 py-1'>Windows 11 (64-bit)</span>
                      <span className='bg-muted/40 border border-border/50 rounded px-2 py-1'>macOS Apple Silicon (M1–M4)</span>
                    </div>
                  </div>
                  <Steps items={[
                    <>Скачайте установщик с <a href='https://xinghuclaw.com/' target='_blank' rel='noopener noreferrer' className='text-primary hover:underline'>xinghuclaw.com</a> и запустите.</>,
                    'При первом запуске дождитесь автоматической установки окружения (все пункты ✅).',
                    'Нажмите «Новый экземпляр», выберите модель и платформу (Telegram, Discord и др.).',
                    'Нажмите «Деплой» — бот запустится автоматически ✅',
                  ]} />
                  <div className='rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground'>
                    💡 Смена модели и обновление API-ключа доступны в любой момент через кнопки «Сменить модель» / «Обновить API Key».
                  </div>
                </IntegrationItem>

                {/* Пакетные запросы */}
                <IntegrationItem emoji='🐍' title='Пакетные запросы Python' subtitle='Параллельные async-запросы через aiohttp'>
                  <p className='text-xs text-muted-foreground'>Используйте <code className='font-mono bg-muted/40 px-1 rounded'>aiohttp</code> для параллельных запросов. Результаты записывайте по мере получения.</p>
                  <CodeBlock code={batchPythonExample} lang='python' />
                  <div className='rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground'>
                    ⚠️ Не отправляйте слишком много запросов из одного скрипта — это может переполнить TCP-соединения. Обязательно обрабатывайте ошибки.
                  </div>
                </IntegrationItem>

              </div>
            </SectionCard>

            {/* Top-up ── */}
            <SectionCard id='topup' icon={<CreditCard className='h-4 w-4 text-primary' />} title={t('Пополнение баланса')} subtitle={t('Банковские карты и СБП')}>
              <div className='p-5 flex flex-col gap-3'>
                {[
                  <>{t('Перейдите в раздел')} <Link to='/wallet/' className='text-primary hover:underline'>{t('Кошелёк')}</Link>.</>,
                  t('Введите сумму и выберите способ оплаты (FreeKassa).'),
                  t('Оплатите через банковскую карту или СБП. Баланс зачисляется автоматически.'),
                ].map((step, i) => (
                  <div key={i} className='flex gap-3 text-sm'>
                    <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5'>{i + 1}</span>
                    <span className='text-foreground leading-snug'>{step}</span>
                  </div>
                ))}
                <div className='rounded-lg bg-muted/40 border border-border/50 px-3 py-2.5 text-xs text-muted-foreground mt-1'>
                  💡 {t('Стоимость запросов списывается автоматически. Следите за балансом в разделе')}{' '}
                  <Link to='/dashboard' className='text-primary hover:underline'>{t('Консоль')}</Link>.
                </div>
                <Link to='/wallet/' className='mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'>
                  {t('Пополнить баланс')} <ArrowRight className='h-3.5 w-3.5' />
                </Link>
              </div>
            </SectionCard>

            {/* Errors ── */}
            <SectionCard id='errors' icon={<AlertCircle className='h-4 w-4 text-amber-500' />} title={t('Коды ошибок')} subtitle={t('Частые проблемы и решения')}>
              <div className='divide-y divide-border/40'>
                {errors.map((e) => (
                  <div key={e.code} className='flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors'>
                    <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', e.dot)} />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-0.5'>
                        <code className='font-mono text-xs font-bold text-foreground'>{e.code}</code>
                        <span className='text-xs text-muted-foreground'>{e.label}</span>
                      </div>
                      <p className='text-xs text-muted-foreground leading-relaxed'>{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* FAQ ── */}
            <SectionCard id='faq' icon={<HelpCircle className='h-4 w-4 text-primary' />} title='FAQ' subtitle='Часто задаваемые вопросы'>
              <div className='p-5 flex flex-col gap-5'>

                {/* HTTP статусы */}
                <div>
                  <div className='text-xs font-semibold text-foreground mb-2'>HTTP-статусы и их значения</div>
                  <div className='rounded-xl border border-border/60 overflow-hidden'>
                    <div className='grid grid-cols-[80px_1fr_1fr] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 px-4 py-2 border-b border-border/40'>
                      <span>Статус</span>
                      <span>Описание</span>
                      <span>Что делать</span>
                    </div>
                    {[
                      { code: '400', desc: 'Неверный формат запроса', fix: 'Проверьте структуру JSON-тела запроса' },
                      { code: '401', desc: 'Ошибка проверки API-ключа', fix: 'Убедитесь в правильности ключа и его сроке действия' },
                      { code: '403', desc: 'Недостаточно прав доступа', fix: 'Проверьте группу токена и доступные модели' },
                      { code: '404', desc: 'Ресурс не найден', fix: 'Проверьте URL и название эндпоинта' },
                      { code: '413', desc: 'Слишком большое тело запроса', fix: 'Уменьшите объём передаваемых данных' },
                      { code: '429', desc: 'Превышен лимит запросов', fix: 'Проверьте баланс, снизьте частоту запросов' },
                      { code: '500', desc: 'Внутренняя ошибка сервера', fix: 'Повторите запрос позже' },
                      { code: '503', desc: 'Сервер временно недоступен', fix: 'Ведётся техническое обслуживание' },
                    ].map((row) => (
                      <div key={row.code} className='grid grid-cols-[80px_1fr_1fr] items-start gap-2 px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors'>
                        <code className='font-mono text-xs font-bold text-foreground'>{row.code}</code>
                        <span className='text-xs text-muted-foreground'>{row.desc}</span>
                        <span className='text-xs text-muted-foreground'>{row.fix}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Общие вопросы */}
                <div className='flex flex-col gap-3'>
                  <div className='text-xs font-semibold text-foreground mb-1'>Общие вопросы</div>
                  {[
                    {
                      q: 'Почему модель не отвечает?',
                      a: 'Скорее всего, для выбранной модели нужна другая группа токена. Создайте новый ключ и выберите подходящую группу в разделе «Ключи».',
                    },
                    {
                      q: 'Поддерживается ли потоковая передача (streaming)?',
                      a: 'Да, добавьте "stream": true в тело запроса — большинство моделей его поддерживают.',
                    },
                    {
                      q: 'Как проверить расход токенов и баланс?',
                      a: 'Перейдите в раздел «Консоль» — там отображается история запросов и текущий баланс.',
                    },
                    {
                      q: 'Можно ли использовать один ключ для всех приложений?',
                      a: 'Да, один API-ключ работает со всеми поддерживаемыми клиентами: Cursor, Cherry Studio, Cline и др.',
                    },
                  ].map((faq, i) => (
                    <div key={i} className='rounded-lg border border-border/50 bg-muted/20 px-4 py-3'>
                      <div className='text-sm font-medium text-foreground mb-1'>{faq.q}</div>
                      <div className='text-xs text-muted-foreground leading-relaxed'>{faq.a}</div>
                    </div>
                  ))}
                </div>

              </div>
            </SectionCard>

            {/* Support ── */}
            <SectionCard id='support' icon={<MessageSquare className='h-4 w-4 text-primary' />} title='Поддержка' subtitle='Как связаться и что подготовить'>
              <div className='p-5 flex flex-col gap-4'>

                <div className='rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                  💡 Перед обращением в поддержку проверьте раздел <span className='font-medium text-foreground'>FAQ</span> и <span className='font-medium text-foreground'>Коды ошибок</span> выше — большинство проблем решается там.
                </div>

                <div>
                  <div className='text-xs font-semibold text-foreground mb-2'>Что подготовить при обращении</div>
                  <div className='flex flex-col gap-2'>
                    {[
                      { num: '1', label: 'Приложение', desc: 'какое используете (Cursor, Cherry Studio и т.д.)' },
                      { num: '2', label: 'Текст ошибки', desc: 'полное сообщение об ошибке из приложения' },
                      { num: '3', label: 'HTTP-статус', desc: 'код ошибки (401, 429 и т.д.)' },
                      { num: '4', label: 'Имя ключа', desc: 'название API-ключа из раздела «Ключи»' },
                    ].map((item) => (
                      <div key={item.num} className='flex gap-3 items-start'>
                        <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5'>{item.num}</span>
                        <span className='text-sm text-foreground'>
                          <span className='font-medium'>{item.label}</span>
                          <span className='text-muted-foreground'> — {item.desc}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='rounded-lg border border-border/50 overflow-hidden'>
                  <div className='bg-muted/30 px-4 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border/40 uppercase tracking-wider'>
                    Полезные ссылки
                  </div>
                  {[
                    { label: 'Кошелёк — пополнение баланса', to: '/wallet/' as const, internal: true },
                    { label: 'Консоль — история запросов', to: '/dashboard' as const, internal: true },
                    { label: 'Ключи — управление API-ключами', to: '/keys' as const, internal: true },
                  ].map((link) => (
                    <div key={link.label} className='flex items-center justify-between px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors'>
                      <span className='text-sm text-foreground'>{link.label}</span>
                      <Link to={link.to} className='text-xs text-primary hover:underline flex items-center gap-1'>
                        Открыть <ArrowRight className='h-3 w-3' />
                      </Link>
                    </div>
                  ))}
                </div>

              </div>
            </SectionCard>

          </div>
        </main>

      </div>
    </PublicLayout>
  )
}
