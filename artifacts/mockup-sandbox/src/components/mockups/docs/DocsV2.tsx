import { useState } from "react";
import { Copy, Check, Key, Zap, CreditCard, AlertCircle, Code2, BookOpen, ChevronRight, ExternalLink, MessageSquare, HelpCircle, ArrowRight } from "lucide-react";

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

const NAV_SECTIONS = [
  { id: "start",   label: "Быстрый старт", icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "keys",    label: "API-ключи",     icon: <Key className="h-3.5 w-3.5" /> },
  { id: "clients", label: "Клиенты",       icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "topup",   label: "Баланс",        icon: <CreditCard className="h-3.5 w-3.5" /> },
  { id: "errors",  label: "Ошибки",        icon: <AlertCircle className="h-3.5 w-3.5" /> },
  { id: "faq",     label: "FAQ",           icon: <HelpCircle className="h-3.5 w-3.5" /> },
];

const CLIENTS = [
  { emoji: "🖱️", name: "Cursor",          hint: "Settings → Models → Add model" },
  { emoji: "🍒", name: "Cherry Studio",   hint: "Settings → Provider → Custom" },
  { emoji: "🧩", name: "VS Code + Cline", hint: "Cline → Settings → API Provider" },
  { emoji: "🤖", name: "Claude Code",     hint: "--api-url flag" },
  { emoji: "💎", name: "Gemini CLI",      hint: "OPENAI_BASE_URL env" },
  { emoji: "🌊", name: "OpenWebUI",       hint: "Admin → OpenAI API URL" },
  { emoji: "💬", name: "Chatbox",         hint: "Settings → OpenAI Compatible" },
  { emoji: "🔄", name: "N8N",             hint: "OpenAI node → Base URL" },
];

const ERRORS = [
  { code: "401", label: "Unauthorized",         color: "bg-red-500",    border: "border-red-500/20",    hint: "Неверный или истёкший ключ. Проверьте раздел «Ключи»." },
  { code: "429", label: "Too Many Requests",    color: "bg-amber-500",  border: "border-amber-500/20",  hint: "Превышен лимит запросов. Снизьте частоту или повысьте лимит." },
  { code: "402", label: "Insufficient Balance", color: "bg-orange-500", border: "border-orange-500/20", hint: "Недостаточно средств на счёте. Пополните кошелёк." },
  { code: "404", label: "Model not found",      color: "bg-sky-500",    border: "border-sky-500/20",    hint: "Модель недоступна для вашего ключа." },
  { code: "URL", label: "base_url wrong",       color: "bg-violet-500", border: "border-violet-500/20", hint: "URL должен заканчиваться на /v1 без двойного слэша." },
  { code: "TLS", label: "SSL error",            color: "bg-slate-400",  border: "border-slate-400/20",  hint: "Используйте HTTPS-адрес сервера." },
];

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { copied, copy } = useCopy(code);
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between bg-[hsl(var(--muted)/0.6)] border-b border-border/50 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="bg-muted/10 overflow-x-auto px-5 py-5">
        <code className="font-mono text-[12.5px] leading-[1.75] text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function SectionH({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60">
        {icon}
      </div>
      <div>
        <div className="text-base font-semibold text-foreground">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function DocsV2() {
  const [tab, setTab] = useState<"python" | "js">("python");
  const [active, setActive] = useState("start");

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-sm px-6 flex items-center h-12 gap-6 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Документация
        </div>
        <div className="w-px h-4 bg-border/60" />
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_SECTIONS.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                active === n.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">

        {/* Left sidebar */}
        <aside className="hidden lg:flex w-56 shrink-0 border-r border-border/60 bg-muted/10 flex-col pt-6 px-3 gap-0.5">
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-foreground mb-0.5">APINET</div>
            <div className="text-[11px] text-muted-foreground">Справочная документация</div>
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1.5">Начало работы</div>
          {NAV_SECTIONS.slice(0, 2).map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium w-full text-left transition-colors",
                active === n.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
              {n.icon} {n.label}
            </button>
          ))}
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-3 mt-3 mb-1.5">Интеграция</div>
          {NAV_SECTIONS.slice(2, 4).map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium w-full text-left transition-colors",
                active === n.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
              {n.icon} {n.label}
            </button>
          ))}
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-3 mt-3 mb-1.5">Справка</div>
          {NAV_SECTIONS.slice(4).map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium w-full text-left transition-colors",
                active === n.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
              {n.icon} {n.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-[860px] px-8 py-8 flex flex-col gap-12">

            {/* Quick-start */}
            <section id="start" className="scroll-mt-8">
              <SectionH icon={<Zap className="h-4 w-4 text-primary" />} title="Быстрый старт" sub="Первый запрос за 3 минуты" />

              {/* 3-step flow */}
              <div className="relative flex flex-col sm:flex-row gap-4 mb-8">
                <div className="absolute top-[28px] left-[44px] right-[44px] hidden sm:block border-t border-dashed border-border/60" />
                {[
                  { n: "1", icon: <Key className="h-5 w-5 text-primary" />, title: "Создайте ключ",    sub: "Ключи → Добавить ключ",        href: "#keys" },
                  { n: "2", icon: <CreditCard className="h-5 w-5 text-primary" />, title: "Пополните баланс", sub: "Кошелёк → FreeKassa / СБП", href: "#topup" },
                  { n: "3", icon: <Code2 className="h-5 w-5 text-primary" />,   title: "Отправьте запрос",  sub: "Скопируйте пример ниже",       href: "#" },
                ].map((s) => (
                  <a key={s.n} href={s.href}
                    className="group relative flex-1 flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted border border-border/50 shadow-sm">
                        {s.icon}
                      </div>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-[10px] font-bold text-muted-foreground">
                        {s.n}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>

              {/* Code example */}
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Пример кода</span>
                  </div>
                  <div className="flex gap-1">
                    {(["python", "js"] as const).map((t) => (
                      <button key={t} onClick={() => setTab(t)}
                        className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}>
                        {t === "python" ? "Python" : "JavaScript"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <CodeBlock code={tab === "python" ? PY : JS} lang={tab === "python" ? "python" : "javascript"} />
                </div>
              </div>
            </section>

            {/* Keys */}
            <section id="keys" className="scroll-mt-8">
              <SectionH icon={<Key className="h-4 w-4 text-primary" />} title="API-ключи" sub="Управление доступом" />
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="divide-y divide-border/40">
                  {[
                    { n: 1, text: <>Перейдите в личный кабинет → раздел <strong className="text-foreground">Ключи</strong>.</> },
                    { n: 2, text: "Нажмите «Добавить ключ», задайте имя и лимиты запросов." },
                    { n: 3, text: "Скопируйте ключ — он отображается только один раз." },
                    { n: 4, text: <span>Вставьте ключ как переменную <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">OPENAI_API_KEY</code>.</span> },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5 ring-1 ring-primary/20">{n}</span>
                      <span className="text-sm text-foreground/80 leading-snug">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3.5 border-t border-border/40 bg-muted/20">
                  <a href="#" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    Открыть раздел Ключи <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </section>

            {/* Clients */}
            <section id="clients" className="scroll-mt-8">
              <SectionH icon={<span className="text-base leading-none">🖥️</span>} title="Клиенты и IDE" sub="OpenAI-совместимый API" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                {CLIENTS.map((c) => (
                  <a key={c.name} href="#"
                    className="group flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-0.5">
                      <span className="text-xl leading-none">{c.emoji}</span>
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs font-semibold text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-snug">{c.hint}</div>
                  </a>
                ))}
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3.5 flex gap-3 text-xs">
                <span className="text-muted-foreground mt-0.5 shrink-0">💡</span>
                <span className="text-muted-foreground leading-relaxed">
                  Во всех клиентах укажите <code className="font-mono text-foreground bg-muted rounded px-1">{BASE}/v1</code> как Base URL и ваш API-ключ. Подробные шаги — в разделе <a href="#" className="text-primary hover:underline">Инструкции</a>.
                </span>
              </div>
            </section>

            {/* Top-up */}
            <section id="topup" className="scroll-mt-8">
              <SectionH icon={<CreditCard className="h-4 w-4 text-primary" />} title="Пополнение баланса" sub="Карты и СБП через FreeKassa" />
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="divide-y divide-border/40">
                  {[
                    { n: 1, text: <>Перейдите в раздел <strong className="text-foreground">Кошелёк</strong>.</> },
                    { n: 2, text: "Введите сумму и выберите способ оплаты: карта или СБП." },
                    { n: 3, text: "Баланс зачисляется мгновенно после подтверждения платежа." },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5 ring-1 ring-primary/20">{n}</span>
                      <span className="text-sm text-foreground/80 leading-snug">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-border/40 bg-muted/10 flex gap-3 items-start">
                  <span className="text-sm shrink-0 mt-px">💡</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Стоимость запросов списывается в реальном времени. Следите за расходами в разделе <strong className="text-foreground">Журнал использования</strong>.
                  </p>
                </div>
                <div className="px-5 py-3.5 border-t border-border/40 bg-muted/20">
                  <a href="#" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    Пополнить кошелёк <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </section>

            {/* Errors */}
            <section id="errors" className="scroll-mt-8">
              <SectionH icon={<AlertCircle className="h-4 w-4 text-amber-500" />} title="Коды ошибок" sub="Частые проблемы и решения" />
              <div className="grid sm:grid-cols-2 gap-3">
                {ERRORS.map((e) => (
                  <div key={e.code}
                    className={cn("rounded-xl border bg-card p-4 flex gap-3.5", e.border)}>
                    <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", e.color)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-mono text-xs font-bold text-foreground">{e.code}</code>
                        <span className="text-xs text-muted-foreground">{e.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{e.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-8">
              <SectionH icon={<HelpCircle className="h-4 w-4 text-primary" />} title="Часто задаваемые вопросы" />
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm divide-y divide-border/40">
                {[
                  { q: "Совместим ли API с библиотекой openai?",          a: "Да. Достаточно указать base_url и ваш ключ — остальное работает без изменений." },
                  { q: "Можно ли создать несколько ключей?",              a: "Да, неограниченное количество ключей с разными именами и лимитами." },
                  { q: "Как быстро зачисляется баланс?",                  a: "Мгновенно — сразу после подтверждения платежа на стороне FreeKassa." },
                  { q: "Где найти список доступных моделей?",              a: "GET /v1/models — возвращает актуальный список. Также в Панели управления → Модели." },
                ].map(({ q, a }) => (
                  <div key={q} className="flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground mb-1">{q}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Support CTA */}
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-primary/5 p-6 mb-6">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.07),transparent_60%)]" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Нужна помощь?</div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-md">
                    Служба поддержки работает 24/7. Для быстрого ответа укажите первые 8 символов ключа, код ошибки и полный текст ответа.
                  </p>
                  <a href="#"
                    className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity">
                    Написать в поддержку <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
