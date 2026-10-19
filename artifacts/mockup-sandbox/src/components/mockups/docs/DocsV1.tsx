import { useState } from "react";
import { Copy, Check, Key, Zap, CreditCard, AlertCircle, Code2, BookOpen, ChevronRight, ExternalLink, MessageSquare, HelpCircle } from "lucide-react";

function cn(...c: (string | undefined | false | null)[]) { return c.filter(Boolean).join(" "); }

function useCopy(t: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); }); };
  return { copied, copy };
}

const BASE = "https://api.example.com";

const PY = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="${BASE}/v1",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Привет!"}],
)
print(response.choices[0].message.content)`;

const JS = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: '${BASE}/v1',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Привет!' }],
});
console.log(response.choices[0].message.content);`;

const ERRORS = [
  { code: "401", label: "Unauthorized",          hint: "Неверный или истёкший ключ — проверьте раздел «Ключи».",              cls: "text-red-500 bg-red-500/8 border-red-500/25" },
  { code: "429", label: "Too Many Requests",     hint: "Превышен лимит. Снизьте частоту запросов или повысьте лимит.",         cls: "text-amber-500 bg-amber-500/8 border-amber-500/25" },
  { code: "402", label: "Insufficient Balance",  hint: "Недостаточно средств — пополните кошелёк.",                            cls: "text-orange-500 bg-orange-500/8 border-orange-500/25" },
  { code: "404", label: "Model not found",       hint: "Модель недоступна для вашего ключа. Проверьте настройки доступа.",     cls: "text-sky-500 bg-sky-500/8 border-sky-500/25" },
  { code: "URL", label: "base_url wrong",        hint: "URL должен заканчиваться на /v1. Двойной слэш недопустим.",            cls: "text-violet-500 bg-violet-500/8 border-violet-500/25" },
  { code: "TLS", label: "SSL error",             hint: "Используйте HTTPS. При тестах можно отключить проверку сертификата.",  cls: "text-muted-foreground bg-muted/60 border-border/60" },
];

const CLIENTS = [
  { emoji: "🖱️", name: "Cursor" },
  { emoji: "🍒", name: "Cherry Studio" },
  { emoji: "🧩", name: "VS Code + Cline" },
  { emoji: "🤖", name: "Claude Code" },
  { emoji: "💎", name: "Gemini CLI" },
  { emoji: "🌊", name: "OpenWebUI" },
  { emoji: "💬", name: "Chatbox" },
  { emoji: "🔄", name: "N8N / Dify" },
];

const NAVS = [
  { id: "connect",   label: "Подключение",  icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "clients",   label: "Клиенты",      icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "topup",     label: "Баланс",       icon: <CreditCard className="h-3.5 w-3.5" /> },
  { id: "errors",    label: "Ошибки",       icon: <AlertCircle className="h-3.5 w-3.5" /> },
  { id: "faq",       label: "FAQ",          icon: <HelpCircle className="h-3.5 w-3.5" /> },
];

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { copied, copy } = useCopy(code);
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between bg-muted/50 border-b border-border/50 px-4 py-2">
        <div className="flex gap-1.5 items-center">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <span className="ml-2 text-[10px] font-mono text-muted-foreground">{lang}</span>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors select-none">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="bg-muted/15 overflow-x-auto px-5 py-5">
        <code className="font-mono text-[12.5px] leading-[1.75] text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-6" />;
}

function BlockTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60 shadow-sm">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground leading-tight">{title}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Block({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm", className)}>
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary text-[10px] font-bold mt-0.5 ring-1 ring-primary/20">{n}</span>
      <span className="text-foreground/80 leading-snug">{children}</span>
    </div>
  );
}

export function DocsV1() {
  const [tab, setTab] = useState<"python" | "js">("python");
  const [active, setActive] = useState("connect");

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1080px] px-6 py-10 flex gap-10">

        {/* Sticky sidebar TOC */}
        <aside className="hidden lg:flex w-44 shrink-0 flex-col gap-1 pt-[72px] sticky top-0 self-start h-screen">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground px-2 mb-2">На этой странице</div>
          {NAVS.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium w-full text-left transition-all",
                active === n.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}>
              {n.icon}
              {n.label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-10">

          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 px-8 py-8 shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="font-medium">Документация APINET</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Руководства по интеграции</h1>
              <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
                Подключение к OpenAI-совместимому API, настройка клиентов и управление балансом.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Быстрый старт", "Клиенты и IDE", "Пополнение", "FAQ"].map((tag) => (
                  <span key={tag} className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Connect */}
          <SectionAnchor id="connect" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Подключение</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Block>
                <BlockTitle icon={<Zap className="h-4 w-4 text-primary" />} title="Эндпоинты API" sub="OpenAI SDK-совместимость" />
                <div className="divide-y divide-border/40">
                  {[
                    { label: "Base URL", path: "/v1" },
                    { label: "Chat completions", path: "/v1/chat/completions" },
                    { label: "Models list", path: "/v1/models" },
                    { label: "Embeddings", path: "/v1/embeddings" },
                  ].map(({ label, path }) => {
                    const full = `${BASE}${path}`;
                    const { copied, copy } = useCopy(full);
                    return (
                      <div key={path} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors group">
                        <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
                        <code className="flex-1 font-mono text-xs text-foreground truncate">{full}</code>
                        <button onClick={copy} className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1 rounded">
                          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Block>

              <Block>
                <BlockTitle icon={<Key className="h-4 w-4 text-primary" />} title="Получение API-ключа" sub="Личный кабинет → Ключи" />
                <div className="px-5 py-5 flex flex-col gap-3.5">
                  <Step n={1}>Войдите в личный кабинет и перейдите в раздел <strong>Ключи</strong>.</Step>
                  <Step n={2}>Нажмите «Добавить ключ», задайте имя и лимиты.</Step>
                  <Step n={3}>Скопируйте ключ — он отображается только один раз.</Step>
                  <Step n={4}>Вставьте его как <code className="bg-muted rounded px-1 font-mono text-xs">OPENAI_API_KEY</code>.</Step>
                  <a href="#" className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    Открыть раздел Ключи <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </Block>

              <Block className="md:col-span-2">
                <BlockTitle icon={<Code2 className="h-4 w-4 text-primary" />} title="Примеры кода" sub="Python · JavaScript / TypeScript" />
                <div className="px-5 py-5 flex flex-col gap-4">
                  <div className="flex gap-1.5 border-b border-border/40 pb-4">
                    {(["python", "js"] as const).map((t) => (
                      <button key={t} onClick={() => setTab(t)}
                        className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                          tab === t ? "bg-foreground text-background border-foreground" : "text-muted-foreground border-border/60 hover:text-foreground hover:border-foreground/40"
                        )}>
                        {t === "python" ? "Python" : "JavaScript"}
                      </button>
                    ))}
                  </div>
                  <CodeBlock code={tab === "python" ? PY : JS} lang={tab === "python" ? "python" : "javascript"} />
                </div>
              </Block>
            </div>
          </div>

          {/* Clients */}
          <SectionAnchor id="clients" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Клиенты и IDE</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <Block>
              <BlockTitle icon={<span className="text-sm leading-none">🖥️</span>} title="Поддерживаемые клиенты" sub="Работают через OpenAI-совместимый API" />
              <div className="px-5 py-5 flex flex-col gap-5">
                <div className="grid grid-cols-4 gap-2">
                  {CLIENTS.map((c) => (
                    <a key={c.name} href="#"
                      className="group flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-3.5 hover:border-foreground/20 hover:bg-muted/50 transition-all text-center">
                      <span className="text-xl leading-none">{c.emoji}</span>
                      <span className="text-[11px] font-medium text-foreground leading-tight">{c.name}</span>
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-xs flex gap-3">
                  <span className="text-muted-foreground shrink-0 mt-0.5">💡</span>
                  <span className="text-muted-foreground leading-relaxed">
                    В большинстве клиентов достаточно указать <code className="font-mono text-foreground bg-muted rounded px-1">{BASE}/v1</code> как Base URL и ваш ключ. Подробные шаги — в разделе Инструкции.
                  </span>
                </div>
              </div>
            </Block>
          </div>

          {/* Top-up */}
          <SectionAnchor id="topup" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Баланс</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <Block>
              <BlockTitle icon={<CreditCard className="h-4 w-4 text-primary" />} title="Пополнение баланса" sub="Карты и СБП через FreeKassa" />
              <div className="px-5 py-5 flex flex-col gap-3.5">
                <Step n={1}>Перейдите в раздел <strong>Кошелёк</strong>.</Step>
                <Step n={2}>Введите сумму и выберите способ оплаты (карта или СБП).</Step>
                <Step n={3}>Баланс зачисляется мгновенно после подтверждения платежа.</Step>
                <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                  Стоимость запросов списывается автоматически в реальном времени. Следите за расходами в разделе <span className="text-foreground font-medium">Журнал использования</span>.
                </div>
                <a href="#" className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  Пополнить кошелёк <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </Block>
          </div>

          {/* Errors */}
          <SectionAnchor id="errors" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ошибки</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <Block>
              <BlockTitle icon={<AlertCircle className="h-4 w-4 text-amber-500" />} title="Коды ошибок" sub="Частые проблемы и как их решить" />
              <div className="grid sm:grid-cols-2 gap-px bg-border/25 p-px rounded-b-xl overflow-hidden">
                {ERRORS.map((e) => (
                  <div key={e.code} className="bg-card flex gap-3.5 p-4.5 p-[18px] hover:bg-muted/20 transition-colors">
                    <span className={cn("mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none h-fit", e.cls)}>
                      {e.code}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground mb-0.5">{e.label}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{e.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Block>
          </div>

          {/* FAQ */}
          <SectionAnchor id="faq" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">FAQ</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <Block>
              <BlockTitle icon={<HelpCircle className="h-4 w-4 text-primary" />} title="Часто задаваемые вопросы" />
              <div className="divide-y divide-border/40">
                {[
                  { q: "Совместим ли API с библиотекой OpenAI Python?", a: "Да. Достаточно указать base_url и ваш ключ — всё остальное работает без изменений." },
                  { q: "Можно ли использовать несколько ключей?", a: "Да, вы можете создать неограниченное количество ключей с разными лимитами и именами." },
                  { q: "Как долго идёт зачисление баланса?", a: "Мгновенно — баланс появляется сразу после подтверждения платежа на стороне FreeKassa." },
                  { q: "Где найти список доступных моделей?", a: "GET /v1/models — возвращает актуальный список. Также доступен в Панели управления → Модели." },
                ].map(({ q, a }) => (
                  <div key={q} className="px-5 py-4">
                    <div className="text-sm font-semibold text-foreground mb-1.5">{q}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </Block>
          </div>

          {/* Support */}
          <Block className="mb-6">
            <div className="flex items-center gap-4 px-6 py-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <MessageSquare className="h-4.5 w-4.5 h-[18px] w-[18px] text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">Нужна помощь?</div>
                <p className="text-xs text-muted-foreground mt-0.5">Служба поддержки работает 24/7. Приложите API-ключ (первые 8 символов) и код ошибки.</p>
              </div>
              <a href="#" className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted px-3.5 py-2 text-xs font-medium text-foreground transition-colors">
                Написать в поддержку <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </div>
          </Block>

        </div>
      </div>
    </div>
  );
}
