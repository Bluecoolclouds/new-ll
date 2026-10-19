import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { Search, Menu, ChevronRight, ChevronDown, Copy, Check, ArrowLeft, Info } from 'lucide-react';
import { docsContentFor } from './docs-data';
import { readWorkspaceLanguage, type WorkspaceLanguage } from '../lib/workspace-copy';
import './Docs.css';

export function Docs() {
  const [, params] = useRoute('/docs/:slug');
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<WorkspaceLanguage>(() => readWorkspaceLanguage());
  const content = docsContentFor(language);
  const { groups, articles, copy } = content;
  const currentSlug = params?.slug;
  const defaultSlug = groups[0]?.entries[0]?.slug ?? 'quickstart';
  const activeSlug = currentSlug === 'codex-setup' ? 'vscode-linux' : currentSlug || defaultSlug;
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [guideMode, setGuideMode] = useState<'script' | 'manual'>('manual');
  const article = articles[activeSlug] ?? articles.quickstart;
  const activeEntry = groups.flatMap((group) => group.entries).find((entry) => entry.slug === activeSlug);
  const activeGuideSelection = content.codexGuide.appTabs.flatMap((app) =>
    app.platforms.map((platform) => ({ app, platform })),
  ).find(({ platform }) => platform.slug === activeSlug);
  const activeClaudeSelection = content.claudeGuide.entries.find((entry) => entry.slug === activeSlug);
  const activeCursorGuide = activeSlug === 'cursor-manual' ? content.cursorGuide : null;
  const activeOpenClawGuide = activeSlug === 'openclaw-manual' ? content.openclawGuide : null;
  const activeOpenCodeGuide = activeSlug === 'opencode-linux' ? content.openCodeGuide : null;
  const activeHermesGuide = activeSlug === 'hermes-linux' ? content.hermesGuide : null;
  const pageTitle = activeGuideSelection
    ? `${activeGuideSelection.app.title} + ${activeGuideSelection.platform.title}`
    : activeClaudeSelection
      ? `${content.claudeGuide.appTitle} + ${activeClaudeSelection.title}`
      : activeCursorGuide
        ? activeCursorGuide.appTitle
        : activeOpenClawGuide
          ? activeOpenClawGuide.appTitle
          : activeOpenCodeGuide
            ? activeOpenCodeGuide.appTitle
            : activeHermesGuide
              ? activeHermesGuide.appTitle
              : activeEntry?.title ?? copy.title;

  useEffect(() => {
    if (!currentSlug) setLocation(`/docs/${defaultSlug}`);
    else if (currentSlug === 'codex-setup') setLocation('/docs/vscode-linux');
  }, [currentSlug, defaultSlug, setLocation]);

  useEffect(() => setGuideMode('manual'), [activeSlug]);

  useEffect(() => {
    document.title = `${pageTitle} — Stratus`;
    document.documentElement.lang = language;
  }, [language, pageTitle]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const activeCategory = groups.flatMap((group) => group.entries).find((entry) => entry.slug === activeSlug)?.category;
    if (activeCategory) setExpandedGroups((previous) => ({ ...previous, [activeCategory]: true }));
  }, [activeSlug, groups]);
  const toggleGroup = (title: string) => setExpandedGroups((previous) => ({ ...previous, [title]: !previous[title] }));
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(language === 'ru' ? 'ru' : 'en');
    if (!query) return groups;
    return groups.map((group) => {
      const entries = group.entries.filter((entry) =>
        `${entry.title} ${entry.slug} ${group.title}`.toLocaleLowerCase(language === 'ru' ? 'ru' : 'en').includes(query),
      );
      return entries.length ? { ...group, entries } : null;
    }).filter((group): group is (typeof groups)[number] => Boolean(group));
  }, [groups, language, searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      let current = '';
      for (const section of article.sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top < 150) current = section.id;
      }
      setActiveSectionId(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [article]);

  const chooseLanguage = (next: WorkspaceLanguage) => {
    setLanguage(next);
    try {
      localStorage.setItem('stratus-landing-language', next);
      localStorage.setItem('stratus-landing-language-explicit', '1');
    } catch { /* The current page still changes when storage is unavailable. */ }
  };
  const apiOrigin = window.location.origin;

  return (
    <div className="docs-layout">
      <div className={`docs-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className={`docs-sidebar ${mobileOpen ? 'open' : ''}`} aria-label={copy.navigation}>
        <div className="docs-sidebar-header">
          <button className="docs-mobile-close" type="button" aria-label={copy.close} onClick={() => setMobileOpen(false)}>{copy.close}</button>
          <Link href="/" className="docs-logo" data-testid="link-docs-home">stratus<span>/</span>hub</Link>
          <div className="docs-sidebar-toolbar">
            <Link href="/dashboard" className="docs-back" data-testid="link-docs-dashboard"><ArrowLeft size={12}/>{copy.back}</Link>
            <div className="docs-language" role="group" aria-label={copy.language}>
              <button type="button" onClick={() => chooseLanguage('ru')} aria-pressed={language === 'ru'}>RU</button>
              <button type="button" onClick={() => chooseLanguage('en')} aria-pressed={language === 'en'}>EN</button>
            </div>
          </div>
          <div className="docs-search">
            <Search size={14}/>
            <input type="search" placeholder={copy.search} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} data-testid="input-docs-search"/>
          </div>
        </div>
        <nav className="docs-nav">
          {filteredGroups.map((group) => (
            <div key={group.title} className="docs-group">
              <button className="docs-group-btn" onClick={() => toggleGroup(group.title)} aria-expanded={Boolean(expandedGroups[group.title] || searchQuery.trim())}>
                {group.title}{expandedGroups[group.title] || searchQuery.trim() ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </button>
              {(expandedGroups[group.title] || searchQuery.trim()) && <div className="docs-group-items">
                {group.entries.map((entry) => <Link key={entry.slug} href={`/docs/${entry.slug}`} className={`docs-item ${activeSlug === entry.slug ? 'active' : ''}`} onClick={() => setMobileOpen(false)} data-testid={`link-doc-${entry.slug}`}>
                  <span>{entry.title}</span>
                </Link>)}
              </div>}
            </div>
          ))}
          {filteredGroups.length === 0 && <div className="docs-no-results">{copy.noResults}</div>}
        </nav>
      </aside>

      <main className="docs-main">
        <header className="docs-mobile-header">
          <Link href="/" className="docs-logo" data-testid="link-docs-mobile-home">stratus<span>/</span>hub</Link>
          <div className="docs-mobile-actions">
            <div className="docs-language" role="group" aria-label={copy.language}>
              <button type="button" onClick={() => chooseLanguage('ru')} aria-pressed={language === 'ru'}>RU</button>
              <button type="button" onClick={() => chooseLanguage('en')} aria-pressed={language === 'en'}>EN</button>
            </div>
            <button className="docs-mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label={copy.openMenu} data-testid="button-mobile-docs-menu"><Menu size={20}/></button>
          </div>
        </header>
        <div className="docs-content-wrapper">
          <article className="docs-article" aria-label={copy.title}>
            <div className="docs-eyebrow" data-testid="text-doc-category">{activeGuideSelection?.app.title ?? (activeClaudeSelection ? content.claudeGuide.appTitle : activeCursorGuide?.appTitle ?? activeOpenClawGuide?.appTitle ?? activeOpenCodeGuide?.appTitle ?? activeHermesGuide?.appTitle ?? activeEntry?.category) ?? copy.title}</div>
            <h1 className="docs-title" data-testid="text-doc-title">{pageTitle}</h1>
            <div className="docs-availability" role="note" data-testid="docs-availability"><Info size={16} aria-hidden="true"/><span>{copy.availability}</span></div>
            <p className="docs-intro" data-testid="text-doc-intro">{article.intro}</p>
            {activeGuideSelection ? <CodexSetupGuide
              guide={content.codexGuide}
              app={activeGuideSelection.app}
              platform={activeGuideSelection.platform}
              mode={guideMode}
              onModeChange={setGuideMode}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : activeClaudeSelection ? <ClaudeSetupGuide
              guide={content.claudeGuide}
              entry={activeClaudeSelection}
              mode={guideMode}
              onModeChange={setGuideMode}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : activeCursorGuide ? <CursorSetupGuide
              guide={activeCursorGuide}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : activeOpenClawGuide ? <OpenClawSetupGuide
              guide={activeOpenClawGuide}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : activeOpenCodeGuide ? <OpenCodeSetupGuide
              guide={activeOpenCodeGuide}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : activeHermesGuide ? <HermesSetupGuide
              guide={activeHermesGuide}
              apiOrigin={apiOrigin}
              copyCode={copy.copyCode}
              copied={copy.copied}
            /> : article.sections.map((section) => <section key={section.id} id={section.id} className="docs-section" data-testid={`section-${section.id}`}>
              <h2 className="docs-section-title">{section.title}</h2>
              {section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph.replaceAll('$STRATUS_BASE_URL', apiOrigin)}</p>)}
              {section.bullets?.length ? <ul>{section.bullets.map((bullet, index) => <li key={index}>{bullet.replaceAll('$STRATUS_BASE_URL', apiOrigin)}</li>)}</ul> : null}
              {section.code && <CodeBlock code={section.code.replaceAll('$STRATUS_BASE_URL', apiOrigin)} copyLabel={copy.copyCode} copiedLabel={copy.copied}/>}
            </section>)}
          </article>
          {article.sections.length > 0 && <aside className="docs-toc" aria-label={copy.toc}>
            <div className="docs-toc-title">{copy.toc}</div>
            <div className="docs-toc-list">{article.sections.map((section) => <a key={section.id} href={`#${section.id}`} className={`docs-toc-link ${activeSectionId === section.id ? 'active' : ''}`}>{section.title}</a>)}</div>
          </aside>}
        </div>
      </main>
    </div>
  );
}

type CursorGuide = ReturnType<typeof docsContentFor>['cursorGuide'];
function CursorSetupGuide({ guide, apiOrigin, copyCode, copied }: {
  guide: CursorGuide;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const settings = guide.providerSettings.replaceAll('$STRATUS_BASE_URL', apiOrigin);
  return <section className="docs-section docs-setup" aria-label={guide.appTitle}>
    <div className="docs-setup-label">{guide.settingsHeading}</div>
    <div className="docs-setup-panel">
      <ol className="docs-setup-steps">
        {guide.setupSteps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <CodeBlock code={settings} copyLabel={copyCode} copiedLabel={copied}/>
      <h2 className="docs-section-title docs-cursor-manual-title">{guide.manualHeading}</h2>
      <ol className="docs-setup-steps">
        {guide.manualSteps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <ul className="docs-setup-models">
        {guide.models.map((model) => <li key={model}><code>{model}</code></li>)}
      </ul>
      <ol className="docs-setup-steps" start={5}>
        <li>{guide.finalStep}</li>
      </ol>
      <p className="docs-setup-script-note">{guide.note}</p>
    </div>
  </section>;
}

type OpenClawGuide = ReturnType<typeof docsContentFor>['openclawGuide'];
function OpenClawSetupGuide({ guide, apiOrigin, copyCode, copied }: {
  guide: OpenClawGuide;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const config = JSON.stringify({
    gateway: { mode: 'local' },
    models: {
      mode: 'merge',
      providers: {
        stratus: {
          baseUrl: `${apiOrigin}/v1`,
          apiKey: 'PASTE_YOUR_STRATUS_API_KEY',
          api: 'openai-completions',
          timeoutSeconds: 300,
          models: guide.models,
        },
      },
    },
    agents: {
      defaults: {
        model: { primary: 'stratus/gpt-5.6-luna' },
        models: { 'stratus/*': {} },
      },
    },
  }, null, 2);
  return <section className="docs-section docs-setup" aria-label={guide.appTitle}>
    <div className="docs-setup-label">{guide.providerHeading}</div>
    <div className="docs-setup-panel">
      <p className="docs-setup-script-note">{guide.installHeading}</p>
      <CodeBlock code={guide.installCommand} copyLabel={copyCode} copiedLabel={copied}/>
      <ol className="docs-setup-steps">
        {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <CodeBlock code={guide.providerInfo} copyLabel={copyCode} copiedLabel={copied}/>
      <p className="docs-setup-script-note">{guide.note}</p>
      <CodeBlock code={config} copyLabel={copyCode} copiedLabel={copied}/>
      <p className="docs-setup-script-note">{guide.launchHeading}</p>
      <CodeBlock code={guide.launchCommand} copyLabel={copyCode} copiedLabel={copied}/>
    </div>
  </section>;
}

type OpenCodeGuide = ReturnType<typeof docsContentFor>['openCodeGuide'];
function OpenCodeSetupGuide({ guide, apiOrigin, copyCode, copied }: {
  guide: OpenCodeGuide;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const config = JSON.stringify({
    '$schema': 'https://opencode.ai/config.json',
    model: 'stratus/gpt-5.6-luna',
    provider: {
      stratus: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Stratus',
        options: {
          baseURL: `${apiOrigin}/v1`,
          apiKey: 'PASTE_YOUR_STRATUS_API_KEY',
        },
        models: guide.models,
      },
    },
  }, null, 2);
  return <section className="docs-section docs-setup" aria-label={guide.appTitle}>
    <div className="docs-setup-label">{guide.providerHeading}</div>
    <div className="docs-setup-panel">
      <ol className="docs-setup-steps">
        {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <CodeBlock code={guide.providerInfo} copyLabel={copyCode} copiedLabel={copied}/>
      <p className="docs-setup-script-note">{guide.note}</p>
      <CodeBlock code={config} copyLabel={copyCode} copiedLabel={copied}/>
    </div>
  </section>;
}

type HermesGuide = ReturnType<typeof docsContentFor>['hermesGuide'];
function HermesSetupGuide({ guide, apiOrigin, copyCode, copied }: {
  guide: HermesGuide;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const settings = guide.providerSettings.replaceAll('$STRATUS_BASE_URL', apiOrigin);
  return <section className="docs-section docs-setup" aria-label={guide.appTitle}>
    <div className="docs-setup-label">{guide.providerHeading}</div>
    <div className="docs-setup-panel">
      <ol className="docs-setup-steps">
        {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <CodeBlock code={settings} copyLabel={copyCode} copiedLabel={copied}/>
      <p className="docs-setup-script-note">{guide.note}</p>
    </div>
  </section>;
}

type CodexGuide = ReturnType<typeof docsContentFor>['codexGuide'];
function CodexSetupGuide({ guide, app, platform, mode, onModeChange, apiOrigin, copyCode, copied }: {
  guide: CodexGuide;
  app: CodexGuide['appTabs'][number];
  platform: CodexGuide['appTabs'][number]['platforms'][number];
  mode: 'script' | 'manual';
  onModeChange: (mode: 'script' | 'manual') => void;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const config = guide.config.replaceAll('$STRATUS_BASE_URL', apiOrigin);
  return <section className="docs-section docs-setup" aria-label={app.title}>
    <div className="docs-setup-label">{app.title} · {platform.title}</div>
    <div className="docs-setup-tabs docs-setup-modes" role="tablist" aria-label={guide.methodTabsLabel}>
      <button type="button" role="tab" aria-selected={mode === 'script'} onClick={() => onModeChange('script')}>{guide.scriptLabel}</button>
      <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => onModeChange('manual')}>{guide.manualLabel}</button>
    </div>
    <div className="docs-setup-panel" role="tabpanel">
      {mode === 'manual' ? <>
        <ol className="docs-setup-steps">
          {platform.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
        <div className="docs-setup-file">
          <h3>{platform.configPath}</h3>
          <CodeBlock code={config} copyLabel={copyCode} copiedLabel={copied}/>
        </div>
        <div className="docs-setup-file">
          <h3>{platform.authPath}</h3>
          <CodeBlock code={guide.auth} copyLabel={copyCode} copiedLabel={copied}/>
        </div>
      </> : <>
        <p className="docs-setup-script-note">{guide.scriptNote}</p>
        <CodeBlock code={codexSetupScript(platform.id, config, guide.auth)} copyLabel={copyCode} copiedLabel={copied}/>
      </>}
      <div className="docs-setup-file">
        <h3>{platform.envPath}</h3>
        <CodeBlock code={platform.envCommand} copyLabel={copyCode} copiedLabel={copied}/>
      </div>
    </div>
  </section>;
}

function codexSetupScript(platform: string, config: string, auth: string) {
  if (platform === 'windows') {
    return `$codexDir = Join-Path $env:USERPROFILE ".codex"
New-Item -ItemType Directory -Force -Path $codexDir | Out-Null

@'
${config}
'@ | Set-Content -Encoding utf8 (Join-Path $codexDir "config.toml")

@'
${auth}
'@ | Set-Content -Encoding utf8 (Join-Path $codexDir "auth.json")`;
  }
  return `mkdir -p "$HOME/.codex"

cat > "$HOME/.codex/config.toml" <<'STRATUS_CONFIG'
${config}
STRATUS_CONFIG

cat > "$HOME/.codex/auth.json" <<'STRATUS_AUTH'
${auth}
STRATUS_AUTH

chmod 600 "$HOME/.codex/auth.json"`;
}

type ClaudeGuide = ReturnType<typeof docsContentFor>['claudeGuide'];
function ClaudeSetupGuide({ guide, entry, mode, onModeChange, apiOrigin, copyCode, copied }: {
  guide: ClaudeGuide;
  entry: ClaudeGuide['entries'][number];
  mode: 'script' | 'manual';
  onModeChange: (mode: 'script' | 'manual') => void;
  apiOrigin: string;
  copyCode: string;
  copied: string;
}) {
  const values = guide.values.replaceAll('$STRATUS_BASE_URL', apiOrigin);
  const showScript = entry.scriptAvailable && mode === 'script';
  return <section className="docs-section docs-setup" aria-label={guide.appTitle}>
    <div className="docs-setup-label">{guide.appTitle} · {entry.title}</div>
    {entry.scriptAvailable ? <div className="docs-setup-tabs docs-setup-modes" role="tablist" aria-label={guide.methodTabsLabel}>
      <button type="button" role="tab" aria-selected={mode === 'script'} onClick={() => onModeChange('script')}>{guide.scriptLabel}</button>
      <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => onModeChange('manual')}>{guide.manualLabel}</button>
    </div> : <div className="docs-setup-tabs docs-setup-modes" role="tablist" aria-label={guide.methodTabsLabel}>
      <button type="button" role="tab" aria-selected="true">{guide.manualLabel}</button>
    </div>}
    <div className="docs-setup-panel" role="tabpanel">
      <p className="docs-setup-script-note">{guide.installNote}</p>
      <CodeBlock code={guide.installCommand} copyLabel={copyCode} copiedLabel={copied}/>
      {showScript ? <>
        <p className="docs-setup-script-note">{guide.scriptNote}</p>
        <CodeBlock code={claudeSetupScript(entry.platform, apiOrigin)} copyLabel={copyCode} copiedLabel={copied}/>
      </> : <>
        <ol className="docs-setup-steps">
          {entry.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
        <CodeBlock code={values} copyLabel={copyCode} copiedLabel={copied}/>
      </>}
    </div>
  </section>;
}

function claudeSetupScript(platform: string, apiOrigin: string) {
  if (platform === 'windows') {
    return `$secureToken = Read-Host "Stratus API key" -AsSecureString
$tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
  [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "${apiOrigin}", "User")
  [Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $token, "User")
  [Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", "claude-opus-5-5", "User")
  $env:ANTHROPIC_BASE_URL = "${apiOrigin}"
  $env:ANTHROPIC_AUTH_TOKEN = $token
  $env:ANTHROPIC_MODEL = "claude-opus-5-5"
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr)
}
Write-Host "Stratus settings saved. Restart Claude CLI."`;
  }
  return `mkdir -p "$HOME/.claude"
printf "Stratus API key: "
stty -echo
IFS= read -r ANTHROPIC_AUTH_TOKEN
stty echo
printf "\\n"

env_file="$HOME/.claude/stratus.env"
{
  printf 'export ANTHROPIC_BASE_URL=%q\\n' '${apiOrigin}'
  printf 'export ANTHROPIC_AUTH_TOKEN=%q\\n' "$ANTHROPIC_AUTH_TOKEN"
  printf 'export ANTHROPIC_MODEL=%q\\n' 'claude-opus-5-5'
} > "$env_file"
chmod 600 "$env_file"
source "$env_file"
unset ANTHROPIC_AUTH_TOKEN
echo "Stratus settings saved. Restart Claude CLI."`;
}

function CodeBlock({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };
  return <div className="docs-code-block" data-testid="code-block">
    <button className="docs-code-copy" onClick={() => void copy()} aria-label={copied ? copiedLabel : copyLabel} title={copied ? copiedLabel : copyLabel} data-testid="button-copy-code">
      {copied ? <Check size={14} color="#5ea680"/> : <Copy size={14}/>}
    </button>
    <pre><code>{code}</code></pre>
  </div>;
}
