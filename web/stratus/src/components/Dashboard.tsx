import { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, Check, Code2, FileText, Image as ImageIcon, Layers3, Menu, Network, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { useLandingSession } from '../lib/use-landing-session';
import { authUrl } from '../lib/auth-session';
import { routePath } from '../lib/routes';
import { copyFor, type LandingLanguage } from '../lib/landing-copy';
import { readWorkspaceLanguage } from '../lib/workspace-copy';
import { LivePriceCatalog } from './LivePriceCatalog';
import './landing/landing.css';

export function Dashboard() {
  const { isAuthenticated, isChecking, hasSavedIdentity } = useLandingSession();
  const [language, setLanguage] = useState<LandingLanguage>(() => readWorkspaceLanguage());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'coding' | 'studio' | 'chat'>('coding');
  const c = copyFor(language);
  const cabinetPath = routePath('/dashboard');
  const signInPath = authUrl('/sign-in', cabinetPath);
  const signUpPath = authUrl('/sign-up', cabinetPath);
  const waitingForSession = isChecking && hasSavedIdentity;
  const accountHref = isAuthenticated ? cabinetPath : signUpPath;
  const accountLabel = isAuthenticated ? c.cabinet : c.createAccount;

  const chooseLanguage = (next: LandingLanguage) => {
    setLanguage(next);
    try {
      window.localStorage.setItem('stratus-landing-language', next);
      window.localStorage.setItem('stratus-landing-language-explicit', '1');
    } catch { /* The current page still switches when storage is unavailable. */ }
  };

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previous; };
  }, [language]);

  useEffect(() => {
    if (!window.location.hash) return;
    let target: string;
    try { target = decodeURIComponent(window.location.hash.slice(1)); }
    catch { return; }
    const timer = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'instant' }), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    window.history.pushState(null, '', `#${id}`);
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const anchor = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => jumpTo(event, id);
  const accountAction = (className: string, testId: string) => waitingForSession
    ? <span className={`${className} cursor-wait opacity-70`} role="status" aria-live="polite">{c.checking}</span>
    : <a href={accountHref} className={className} data-testid={testId}>{accountLabel}<ArrowRight className="ml-2 inline" size={14}/></a>;

  return (
    <div className="landing min-h-[100dvh] overflow-x-clip" data-theme="light">
      <div className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 lg:px-12">
        <header className="land-enter sticky top-3 z-30 mt-3 flex min-h-[62px] items-center justify-between gap-3 rounded-full px-4 py-2 sm:px-6">
          <a href="#" onClick={(event) => jumpTo(event, 'top')} className="display shrink-0 text-[19px] font-extrabold tracking-[-.06em]" aria-label="Stratus home">stratus<span className="land-accent">/</span>hub</a>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[12px] font-medium md:flex">
            <a href="#catalog" onClick={anchor('catalog')} className="transition-opacity hover:opacity-60">{c.catalog}</a>
            <a href="#features" onClick={anchor('features')} className="transition-opacity hover:opacity-60">{c.features}</a>
            <a href="#faq" onClick={anchor('faq')} className="transition-opacity hover:opacity-60">{c.faq}</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-full bg-black/[.045] p-0.5" role="group" aria-label={c.language}>
              <button type="button" onClick={() => chooseLanguage('ru')} aria-pressed={language === 'ru'} aria-label="Русский" data-testid="button-language-ru" className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold ${language === 'ru' ? 'bg-[var(--land-bg)] shadow-sm' : 'opacity-55'}`}>RU</button>
              <button type="button" onClick={() => chooseLanguage('en')} aria-pressed={language === 'en'} aria-label="English" data-testid="button-language-en" className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold ${language === 'en' ? 'bg-[var(--land-bg)] shadow-sm' : 'opacity-55'}`}>EN</button>
            </div>
            {!isAuthenticated && <a href={signInPath} data-testid="link-header-sign-in" className="hidden rounded-full px-3 py-2 text-[11px] font-semibold opacity-75 transition-opacity hover:opacity-100 sm:inline-flex">{c.signIn}</a>}
            {waitingForSession ? <span role="status" className="hidden rounded-full px-4 py-2 text-[11px] font-semibold opacity-60 sm:inline-flex">{c.checking}</span> : <a href={accountHref} data-testid="link-header-account" className="hidden rounded-full px-4 py-2.5 text-[11px] font-bold land-button sm:inline-flex">{accountLabel}</a>}
            <button type="button" aria-label={menuOpen ? c.menuClose : c.menuOpen} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" data-testid="button-mobile-menu" className="grid h-9 w-9 place-items-center rounded-full bg-black/[.045] md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={16}/> : <Menu size={16}/>}</button>
          </div>
        </header>
        {menuOpen && <div id="landing-mobile-menu" className="land-panel mt-2 rounded-[24px] border p-4 shadow-lg md:hidden">
          <nav aria-label="Mobile navigation" className="grid">
            <a href="#catalog" onClick={anchor('catalog')} className="border-b land-line py-3 text-sm">{c.catalog}</a>
            <a href="#features" onClick={anchor('features')} className="border-b land-line py-3 text-sm">{c.features}</a>
            <a href="#faq" onClick={anchor('faq')} className="py-3 text-sm">{c.faq}</a>
          </nav>
          <div className="mt-2 flex gap-3 border-t land-line pt-3">
            {!isAuthenticated && <a href={signInPath} data-testid="link-mobile-sign-in" className="rounded-full border land-line px-4 py-3 text-center text-xs font-semibold">{c.signIn}</a>}
            {waitingForSession ? <span className="rounded-full px-4 py-3 text-xs opacity-60" role="status">{c.checking}</span> : <a href={accountHref} data-testid="link-mobile-account" className="flex-1 rounded-full px-4 py-3 text-center text-xs font-bold land-button">{accountLabel}<ArrowRight className="ml-2 inline" size={13}/></a>}
          </div>
        </div>}

        <main id="top">
          <section className="grid items-center gap-10 pb-16 pt-16 sm:pt-24 lg:grid-cols-[.94fr_1.06fr] lg:gap-16 lg:pb-20">
            <div className="land-enter max-w-[590px]">
              <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] land-muted"><span className="h-2 w-2 rounded-full bg-[#80c5ce]"/>{c.eyebrow}</div>
              <h1 className="display text-[58px] font-extrabold leading-[.92] sm:text-[78px]">{c.heroTitle1}<br/><span className="land-accent">{c.heroTitle2}</span></h1>
              <p className="mt-7 max-w-[495px] text-[16px] leading-[1.65] land-muted sm:text-[17px]">{c.heroBody}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {accountAction('inline-flex items-center rounded-full px-5 py-3.5 text-[13px] font-bold land-button', 'link-hero-account')}
                <a href="#ai-gateway" onClick={anchor('ai-gateway')} data-testid="link-smart-router" className="inline-flex items-center text-[13px] font-semibold underline decoration-current/30 underline-offset-4 hover:decoration-current">{c.smartRouter}<ArrowRight className="ml-2" size={14}/></a>
              </div>
              <div className="mt-8 flex items-center gap-2 text-[11px] land-muted"><ShieldCheck size={14} className="land-accent"/>{c.heroNote}</div>
            </div>
            <div className="land-hero-art land-enter relative min-h-[340px] overflow-hidden rounded-[32px] p-6 sm:min-h-[460px] sm:p-9">
              <div className="absolute -right-20 top-8 h-56 w-56 rounded-full bg-white/30 blur-3xl"/>
              <div className="land-float relative mx-auto flex min-h-[285px] max-w-[410px] items-center justify-center sm:min-h-[390px]">
                <div className="absolute left-0 top-[18%] rounded-2xl border border-white/70 bg-white/75 px-3 py-2 text-[10px] font-semibold text-[#355563] shadow-lg">{c.appChip} <Code2 className="ml-2 inline" size={12}/></div>
                <div className="relative grid h-40 w-40 place-items-center rounded-[38px] border-[10px] border-white/60 bg-white/35 shadow-[0_18px_60px_rgba(65,126,145,.18)] sm:h-48 sm:w-48">
                  <div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/75 bg-[#d9eef0]/80 text-[#558e9e]"><Layers3 size={36} strokeWidth={1.3}/></div>
                  <span className="absolute -right-3 top-8 h-3 w-3 rounded-full bg-[#7acbd0] ring-4 ring-[#d4eef1]"/>
                </div>
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 260" fill="none" aria-hidden="true"><path d="M25 65 C115 65 112 125 190 125 S278 90 370 90" stroke="rgba(255,255,255,.9)" strokeWidth="2"/><path d="M30 202 C115 202 120 151 190 151 S285 180 370 155" stroke="rgba(255,255,255,.9)" strokeWidth="2"/></svg>
                <div className="absolute right-0 top-[22%] rounded-2xl border border-white/70 bg-white/75 px-3 py-2 text-[10px] font-semibold text-[#355563] shadow-lg">{c.routeChip} <Zap className="ml-2 inline text-[#59aeb6]" size={12}/></div>
                <div className="absolute bottom-0 left-[7%] rounded-2xl border border-white/70 bg-white/75 px-3 py-2 text-[10px] font-semibold text-[#355563] shadow-lg"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#73c7cb]"/>{c.balanceChip}</div>
              </div>
              <div className="relative flex items-center justify-between text-[10px] text-[#53727e]"><span>AI Gateway · Smart router</span><span className="font-mono">01 / 04</span></div>
            </div>
          </section>

          <section className="border-y land-line py-6" aria-label={c.providers}>
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-[.12em] land-muted">{c.providers}</div>
            <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] font-bold land-muted">{['OpenAI', 'Anthropic', 'Google AI', 'Mistral', 'Groq'].map((name, index) => <div key={name} className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg land-soft text-[9px]">{['O', 'A', 'G', 'M', 'G'][index]}</span>{name}</div>)}</div>
          </section>

          <section id="features" className="land-anchor py-16 sm:py-24">
            <div className="mb-8 max-w-[700px]">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] land-accent"><Sparkles size={14}/>{c.featuresEyebrow}</div>
              <h2 className="display text-[42px] font-extrabold leading-[.98] sm:text-[58px]">{c.featuresTitle}</h2>
              <p className="mt-5 max-w-[600px] text-[14px] leading-relaxed land-muted">{c.featuresIntro}</p>
            </div>
            <article id="ai-gateway" aria-labelledby="gateway-title" className="land-anchor land-panel overflow-hidden rounded-[30px] border land-line">
              <div className="grid items-center lg:grid-cols-[1.03fr_.97fr]">
                <div className="px-6 py-8 sm:px-10 sm:py-12">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border land-line bg-[var(--land-bg)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] land-accent"><span className="h-2 w-2 rounded-full bg-[#73b9c5]"/>{c.gatewayStatus}</div>
                  <h3 id="gateway-title" className="display max-w-[550px] text-[39px] font-extrabold leading-[.98] sm:text-[54px]">{c.gatewayTitle}</h3>
                  <p className="mt-5 max-w-[520px] text-[14px] leading-[1.7] land-muted">{c.gatewayBody}</p>
                  <div className="mt-7 grid gap-2 sm:grid-cols-2">
                    {[[c.autoModel, c.autoModelText], [c.fallback, c.fallbackText], [c.costLatency, c.costLatencyText], [c.cache, c.cacheText], [c.limits, c.limitsText], [c.logs, c.logsText]].map(([title, description]) => <div key={title} className="land-tile rounded-2xl px-4 py-3.5"><div className="text-[12px] font-bold">{title}</div><div className="mt-1 text-[11px] leading-relaxed land-muted">{description}</div></div>)}
                  </div>
                  <p className="mt-5 text-[11px] leading-relaxed land-muted">{c.gatewayDisclaimer}</p>
                </div>
                <div className="relative h-[260px] overflow-hidden sm:h-[350px] lg:h-full lg:min-h-[480px]">
                  <img src="/stratus-images/ai-gateway-illustration.png" alt="" loading="lazy" className="h-full w-full object-cover object-center"/>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#d6e9ef]/40 to-transparent lg:bg-gradient-to-r lg:from-[var(--land-panel)] lg:via-transparent lg:to-transparent"/>
                </div>
              </div>
            </article>
          </section>

          <section className="border-t land-line py-16 sm:py-20">
            <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
              <div><div className="mb-4 text-[11px] font-semibold uppercase tracking-[.12em] land-accent">{c.featuresEyebrow}</div><h2 className="display text-[38px] font-extrabold leading-[.98] sm:text-[50px]">{c.modesTitle}</h2></div>
              <p className="max-w-[540px] text-[13px] leading-relaxed land-muted">{c.modesIntro}</p>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-[.37fr_1fr]">
              <div role="tablist" aria-label={c.modesTitle} className="space-y-2">
                {([{id:'coding',label:c.coding,detail:c.codingDetail,icon:Code2},{id:'studio',label:c.studio,detail:c.studioDetail,icon:ImageIcon},{id:'chat',label:c.chat,detail:c.chatDetail,icon:AudioLines}] as const).map(({id,label,detail,icon:Icon}) => <button key={id} type="button" role="tab" aria-selected={activeMode===id} onClick={()=>setActiveMode(id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${activeMode===id?'land-panel land-line shadow-sm':'border-transparent hover:land-panel'}`}><span className="grid h-9 w-9 place-items-center rounded-xl land-soft land-accent"><Icon size={17}/></span><span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-[11px] land-muted">{detail}</span></span><ArrowRight className="ml-auto land-accent" size={14}/></button>)}
                <p className="rounded-2xl px-4 py-3 text-[11px] leading-relaxed land-muted">{c.modeFoot}</p>
              </div>
              <div className="land-panel min-h-[270px] overflow-hidden rounded-[26px] border land-line p-4 sm:p-6">
                <div className="mb-5 flex items-center gap-3 text-[10px] land-muted"><span className="font-bold tracking-wide">stratus / {activeMode}</span><span className="rounded-full px-2.5 py-1 land-soft land-accent">Stratus</span><span className="ml-auto">OpenAI-compatible</span></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="land-code rounded-2xl p-5 font-mono text-[11px] leading-[2]"><div className="mb-3 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#df7770]"/><span className="h-2 w-2 rounded-full bg-[#d6ae6f]"/><span className="h-2 w-2 rounded-full bg-[#81b9c5]"/></div><div className="text-[#9fc8d0]">POST /v1/chat/completions</div><div>model: MODEL_NAME</div><div>messages: [...]</div><div className="mt-3 text-[#8ab9c1]">→ routed by server config</div></div>
                  <div className="flex flex-col justify-between rounded-2xl border land-line p-5"><div><div className="text-[10px] font-semibold uppercase tracking-[.12em] land-accent">{activeMode=== 'coding' ? c.coding : activeMode==='studio' ? c.studio : c.chat}</div><p className="mt-3 text-[17px] font-semibold leading-snug">{activeMode=== 'coding' ? c.codingDetail : activeMode==='studio' ? c.studioDetail : c.chatDetail}</p></div><div className="mt-6 flex items-center gap-2 text-[11px] land-muted"><Check size={14} className="land-accent"/>{c.configuredWorkspace}</div></div>
                </div>
              </div>
            </div>
          </section>

          <section id="catalog" className="land-anchor border-y land-line py-16 sm:py-24">
            <LivePriceCatalog language={language} isAuthenticated={isAuthenticated} signupHref={signUpPath}/>
          </section>

          <section className="py-16 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6"><div><div className="mb-4 text-[11px] font-semibold uppercase tracking-[.12em] land-accent">{c.casesEyebrow}</div><h2 className="display text-[40px] font-extrabold leading-[.98] sm:text-[56px]">{c.casesTitle}</h2></div><p className="max-w-[280px] text-[13px] leading-relaxed land-muted">{c.casesIntro}</p></div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[[Network,c.support,c.supportTitle,c.supportText,'ai-proxy-case-support.png'],[FileText,c.teams,c.teamsTitle,c.teamsText,'ai-proxy-case-sales.png'],[ShieldCheck,c.agents,c.agentsTitle,c.agentsText,'ai-proxy-case-agents.png']].map(([Icon,label,title,body,image]) => {
                const FeatureIcon = Icon as typeof Network;
                return <article key={label as string} className="group overflow-hidden rounded-[24px] border land-line land-panel transition-transform hover:-translate-y-1"><div className="h-[180px] overflow-hidden"><img src={`/stratus-images/${image}`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"/></div><div className="p-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] land-accent"><FeatureIcon size={13}/>{label as string}</div><h3 className="mt-3 text-[17px] font-bold leading-snug">{title as string}</h3><p className="mt-2 text-[12px] leading-relaxed land-muted">{body as string}</p></div></article>;
              })}
            </div>
          </section>

          <section className="border-t land-line py-16 sm:py-20">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
              <div>
                <h2 className="display max-w-[490px] text-[38px] font-extrabold leading-[.98] sm:text-[50px]">{c.accountTitle}</h2>
                <p className="mt-5 max-w-[480px] text-[13px] leading-relaxed land-muted">{c.accountBody}</p>
              </div>
              <div className="landing-account-detail rounded-[23px] border p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--land-bg)] land-accent"><ShieldCheck size={18}/></span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.12em] land-accent">{c.accessEyebrow}</div>
                    <div className="mt-1 text-[17px] font-bold">{c.accessTitle}</div>
                  </div>
                </div>
                <p className="mt-5 text-[12px] leading-relaxed land-muted">{c.accessBody}</p>
              </div>
            </div>
            <div className="landing-connect mt-8 grid items-center gap-7 rounded-[26px] p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] land-accent">{c.connectEyebrow}</div>
                <h3 className="display text-[28px] font-bold leading-tight sm:text-[30px]">{c.connectTitle}</h3>
                <p className="mt-2 max-w-[620px] text-[12px] leading-relaxed land-muted">{c.connectBody}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {accountAction('inline-flex items-center rounded-full px-5 py-3 text-[12px] font-bold land-button', 'link-connect-account')}
                <a href={routePath('/docs/quickstart')} className="landing-connect-link text-[12px] font-semibold underline underline-offset-4">{c.quickstart}</a>
              </div>
            </div>
          </section>

          <section id="faq" className="land-anchor py-16 sm:py-24">
            <div className="grid gap-9 lg:grid-cols-[.7fr_1.3fr]">
              <div><div className="mb-4 text-[11px] font-semibold uppercase tracking-[.12em] land-accent">FAQ</div><h2 className="display text-[42px] font-extrabold leading-[.98] sm:text-[56px]">{c.faqTitle}</h2><p className="mt-5 max-w-[300px] text-[13px] leading-relaxed land-muted">{c.faqIntro}</p></div>
              <div className="space-y-2">{[[c.qIntegrate,c.aIntegrate],[c.qSubscription,c.aSubscription],[c.qCache,c.aCache],[c.qPrice,c.aPrice],[c.qModels,c.aModels],[c.qSpend,c.aSpend],[c.qToken,c.aToken]].map(([question,answer],index)=><details key={question} open={index===0} className="group rounded-[19px] border land-line land-panel px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-bold">{question}<span className="text-xl font-normal land-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-[600px] pt-3 text-[12px] leading-relaxed land-muted">{answer}</p></details>)}</div>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-5 border-t land-line pt-6 text-[10px] land-muted">
          <a href="#top" onClick={anchor('top')} className="font-bold tracking-[-.04em]">stratus/hub</a><span>© 2026 · Stratus Hub</span>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <a href={routePath('/docs')} data-testid="link-footer-docs" className="hover:opacity-70">{c.footerDocs}</a>
            <a href={routePath('/wallet')} className="hover:opacity-70">{c.footerBalance}</a>
            <a href={cabinetPath} className="hover:opacity-70">{c.cabinet}</a>
            <a href={routePath('/privacy')} className="hover:opacity-70">{c.footerPrivacy}</a>
            <a href={routePath('/offer')} className="hover:opacity-70">{c.footerOffer}</a>
            <a href={routePath('/refund')} className="hover:opacity-70">{c.footerRefund}</a>
            <a href={routePath('/contacts')} className="hover:opacity-70">{c.footerContacts}</a>
            <a href="https://t.me/wpnetwork_sup" target="_blank" rel="noopener noreferrer" aria-label={c.footerTelegram} className="hover:opacity-70">@wpnetwork_sup</a>
          </div>
          <span>{c.footerWork} · QuantumNous</span>
        </footer>
      </div>
    </div>
  );
}
