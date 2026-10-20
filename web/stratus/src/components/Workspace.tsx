import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, KeyRound, Network, Search, Users, Wallet } from 'lucide-react';
import { ModelPrices } from './ModelPrices';
import { UsageChart } from './UsageChart';
import { InviteDialog, TopupDialog } from './CabinetPopups';
import { AccountHeader } from './AccountHeader';
import { useAccountUsage } from '../lib/use-account-usage';
import { formatCabinetTokens, summarizeCabinetUsage } from '../lib/workspace-summary';
import { quotaToWalletTokens } from '../lib/token-economy';
import { request, type Page, type SelfUser, type SystemStatus, type UsageLog } from '../lib/api';
import { basePath, routePath } from '../lib/routes';
import { settingsPath } from './settings-route';
import { WorkspaceLocaleProvider, useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import './workspace.css';

const weeklySelection = { period: '7d', granularity: 'day' } as const;

const API = {
  user: () => request<SelfUser>('/api/user/self'),
  status: () => request<SystemStatus>('/api/status'),
  logs: (page: number) => request<Page<UsageLog>>(`/api/log/self?request_only=1&p=${page}&page_size=20`),
};

function cachedUsageTokens(other?: string) {
  if (!other) return 0;
  try {
    const value = (JSON.parse(other) as Record<string, unknown>).cache_tokens;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function WorkspaceContent() {
  const { language, copy: c, setLanguage } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const countFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const walletTokenFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const [term, setTerm] = useState('');
  const [popup, setPopup] = useState<'topup' | 'invite' | null>(null);
  const [page, setPage] = useState(1);
  const user = useQuery({ queryKey: ['stratus', 'self'], queryFn: API.user });
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: API.status });
  const logs = useQuery({ queryKey: ['stratus', 'logs', page], queryFn: () => API.logs(page) });
  const quotaUnit = status.data?.quota_per_unit ?? Number.NaN;
  const formatWalletTokens = (quota: number) => {
    const tokens = quotaToWalletTokens(quota, quotaUnit);
    return tokens === null ? c.unavailable : `${walletTokenFormat.format(tokens)} ${c.tokens}`;
  };
  const formatLogTimestamp = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const date = new Date(seconds * 1000);
    return {
      time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: date.toLocaleDateString(locale),
    };
  };
  const weeklyUsage = useAccountUsage(weeklySelection, user.data?.id ?? 0);
  const weeklySummary = useMemo(() => {
    if (!weeklyUsage.data) return null;
    try {
      return summarizeCabinetUsage(weeklyUsage.data.rows, weeklyUsage.data.range, quotaUnit);
    } catch {
      return null;
    }
  }, [weeklyUsage.data, quotaUnit]);
  const usageDisabled = status.data?.enable_data_export === false;
  const weeklyRequestsLabel = usageDisabled ? c.unavailable
    : weeklyUsage.isLoading ? c.loading
      : weeklySummary ? countFormat.format(weeklySummary.requests) : c.unavailable;
  const weeklySpentLabel = usageDisabled ? c.unavailable
    : weeklyUsage.isLoading ? c.loading
      : weeklySummary?.walletTokens != null ? `${walletTokenFormat.format(weeklySummary.walletTokens)} ${c.tokens}` : c.unavailable;
  const visible = useMemo(() => (logs.data?.items ?? []).filter((row) =>
    `${row.model_name} ${row.token_name} ${row.content} ${row.group}`.toLocaleLowerCase(locale).includes(term.trim().toLocaleLowerCase(locale))),
  [logs.data?.items, term, locale]);
  const totalPages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / (logs.data?.page_size ?? 20)));

  return <div className="workspace workspace-cabinet">
    <div className="workspace-shell">
      <AccountHeader active="cabinet" language={language} onLanguageChange={setLanguage}/>

      <header className="workspace-head">
        <h1>{c.cabinet}{user.data?.display_name ? ` ${user.data.display_name}` : user.data?.username ? ` ${user.data.username}` : ''}</h1>
        <button className="workspace-invite-button" type="button" data-testid="button-invite-friends" onClick={() => setPopup('invite')}>
          <Users size={15}/> {c.inviteFriends}
        </button>
      </header>

      <main className="workspace-main workspace-grid">
        {user.isLoading && <section className="workspace-state" role="status" aria-live="polite">
          <div className="workspace-state-skeleton"><i/><i/><i/></div><span>{c.loadingAccount}</span>
        </section>}
        {user.isError && <section className="workspace-state workspace-state-error" role="alert">
          <div><strong>{c.profileUnavailable}</strong><span>{c.profileUnavailableHelp}</span></div>
          <button className="workspace-action" onClick={() => void user.refetch()} disabled={user.isFetching}>{user.isFetching ? c.loading : c.retry}</button>
        </section>}

        {user.data && <>
          <section className="workspace-metrics" aria-label={c.accountSummary}>
            <article className="workspace-metric workspace-metric-balance" data-testid="metric-balance">
              <div className="workspace-metric-top"><span className="workspace-card-label upper">{c.walletBalance}</span><span className="workspace-metric-icon"><Wallet size={17}/></span></div>
              <strong title={formatWalletTokens(user.data.quota)}>{formatCabinetTokens(quotaToWalletTokens(user.data.quota, quotaUnit), locale, c.tokens, c.unavailable)}</strong>
              <small>{status.isLoading ? c.loadingWalletBalance : c.walletTokens}</small>
              <button className="workspace-metric-link" type="button" data-testid="button-open-topup" onClick={() => setPopup('topup')}>
                {c.topupTokens} <ArrowUpRight size={14}/>
              </button>
            </article>
            <article className="workspace-metric" data-testid="metric-requests-7d">
              <div className="workspace-metric-top"><span className="workspace-card-label upper">{c.requests7d}</span><span className="workspace-metric-icon"><Activity size={17}/></span></div>
              <strong>{weeklyRequestsLabel}</strong>
              <small>{usageDisabled ? c.statsDisabled : c.personalStats}</small>
            </article>
            <article className="workspace-metric" data-testid="metric-spend-7d">
              <div className="workspace-metric-top"><span className="workspace-card-label upper">{c.spentTokens7d}</span><span className="workspace-metric-icon"><Wallet size={17}/></span></div>
              <strong title={weeklySpentLabel}>{usageDisabled ? c.unavailable : weeklyUsage.isLoading ? c.loading : formatCabinetTokens(weeklySummary?.walletTokens ?? null, locale, c.tokens, c.unavailable)}</strong>
              <small>{usageDisabled ? c.statsDisabled : c.actualSpend}</small>
            </article>
            <article className="workspace-actions-card" aria-label={c.cabinetActions}>
              <div className="workspace-actions-meta"><span>{c.accessGroup}</span><strong>{user.data.group || '—'}</strong></div>
              <div className="workspace-actions-links">
                 <a href={routePath(settingsPath('keys'))} data-testid="link-api-keys"><KeyRound size={15}/>{c.apiKeys}<ArrowUpRight size={13}/></a>
                <a href={routePath(settingsPath('gateway'))} data-testid="link-ai-gateway"><Network size={15}/>{c.aiGateway}<ArrowUpRight size={13}/></a>
                <a href={`${basePath}/docs`} data-testid="link-docs"><BookOpen size={15}/>{c.documentation}<ArrowUpRight size={13}/></a>
                {user.data.role >= 10 && <a href={user.data.role >= 100 ? '/system-settings/site/system-info' : '/users'} data-testid="link-admin">{c.administration}<ArrowUpRight size={13}/></a>}
              </div>
            </article>
          </section>

          {usageDisabled && <div className="workspace-weekly-note" role="status">{c.weeklyStatsNote}</div>}
          {!usageDisabled && weeklyUsage.isError && <div className="workspace-weekly-note is-error" role="alert"><span>{c.weeklyStatsError}</span><button className="workspace-action" onClick={() => void weeklyUsage.refetch()} disabled={weeklyUsage.isFetching}>{weeklyUsage.isFetching ? c.loading : c.retry}</button></div>}

          {status.isLoading && <div className="workspace-status-note" role="status">{c.walletUnitsLoading}</div>}
          {status.isError && <div className="workspace-status-note is-error" role="alert"><span>{c.walletUnitsError}</span><button className="workspace-action" onClick={() => void status.refetch()} disabled={status.isFetching}>{status.isFetching ? c.loading : c.retry}</button></div>}

          <section className="workspace-overview" aria-label={c.usageAndModelRates}>
            <UsageChart userId={user.data.id} quotaPerUnit={quotaUnit} enableDataExport={status.data?.enable_data_export} isAdmin={user.data.role >= 10}/>
            <ModelPrices currentGroup={user.data.group}/>
          </section>
        </>}

        <section className="workspace-card workspace-log" id="logs" data-testid="card-request-logs">
          <div className="workspace-log-head">
            <div><div className="workspace-card-label upper">{c.history}</div><h2>{c.latestRequests}</h2><p className="workspace-section-sub">{c.historyDescription}</p></div>
            <div className="workspace-controls">
              <div className="workspace-search-wrap"><Search size={15}/><input className="workspace-search" aria-label={c.searchRequests} placeholder={c.searchPlaceholder} value={term} onChange={(event) => { setTerm(event.target.value); setPage(1); }}/></div>
            </div>
          </div>
          {logs.isLoading && <div className="workspace-empty workspace-loading" role="status"><span className="workspace-inline-skeleton"/>{c.logsLoading}</div>}
          {logs.isError && <div className="workspace-empty workspace-log-error" role="alert"><span>{c.logsError}</span><button className="workspace-action" onClick={() => void logs.refetch()} disabled={logs.isFetching}>{logs.isFetching ? c.loading : c.retry}</button></div>}
          {logs.data && (logs.data.items ?? []).length === 0 && <div className="workspace-empty workspace-log-empty"><span className="workspace-empty-mark"><Activity size={20}/></span><strong>{c.noRequests}</strong><span>{c.noRequestsHelp}</span></div>}
          {logs.data && (logs.data.items ?? []).length > 0 && visible.length === 0 && <div className="workspace-empty">{c.noMatches}</div>}
          {visible.length > 0 && <div className="workspace-table-wrap"><table className="workspace-log-table" aria-label={c.latestRequests}>
            <thead><tr><th>{c.dateTime}</th><th>{c.keyName}</th><th>{c.model}</th><th>{c.transport}</th><th>{c.status}</th><th className="workspace-log-spent-heading">{c.walletSpent}</th><th>{c.requestError}</th></tr></thead>
            <tbody>{visible.map((row) => {
              const timestamp = formatLogTimestamp(row.created_at);
              const failed = row.type === 5;
              const modelTokens = Math.max(0, row.prompt_tokens) + Math.max(0, row.completion_tokens);
              const cacheTokens = cachedUsageTokens(row.other);
              return <tr key={`${row.id}-${row.created_at}`}>
                <td className="workspace-log-timestamp">{timestamp ? <><strong>{timestamp.time}</strong><small>{timestamp.date}</small></> : '—'}</td>
                <td className="workspace-log-key-name">{row.token_name || '—'}</td>
                <td className="workspace-log-model-name">{row.model_name || '—'}</td>
                <td><span className={`workspace-log-transport${row.is_stream ? ' is-stream' : ''}`}>{row.is_stream ? 'SSE' : 'HTTP'}</span></td>
                <td><span className={`workspace-log-status ${failed ? 'is-error' : 'is-ok'}`}>{failed ? c.requestStatusError : c.requestStatusOk}</span></td>
                <td className="workspace-log-spent">
                  {failed ? <strong>—</strong> : <strong>{formatWalletTokens(row.quota)}</strong>}
                  {!failed && modelTokens > 0 && <small title={c.modelUsageTitle}>{c.modelTokensTotal} {countFormat.format(modelTokens)}</small>}
                  {!failed && cacheTokens > 0 && <small title={c.modelUsageTitle}>{c.cachedTokens} {countFormat.format(cacheTokens)}</small>}
                </td>
                <td className={`workspace-log-error-text${failed ? ' is-error' : ''}`} title={failed ? row.content : undefined}>
                  {failed ? row.content || c.requestStatusError : '—'}
                </td>
              </tr>;
            })}</tbody>
          </table></div>}
          {logs.data && logs.data.total > logs.data.page_size && <div className="workspace-pager"><span>{c.page} <strong>{page}</strong> {c.of} {totalPages} <i/> {logs.data.total.toLocaleString(locale)} {c.entries}</span><div><button aria-label={c.previousPage} disabled={page <= 1 || logs.isFetching} onClick={() => setPage((n) => n - 1)}><ChevronLeft size={17}/></button><button aria-label={c.nextPage} disabled={page >= totalPages || logs.isFetching} onClick={() => setPage((n) => n + 1)}><ChevronRight size={17}/></button></div></div>}
        </section>
      </main>
      <footer className="workspace-footer"><span>{c.cabinetFooter}</span><span>{c.separateBalances}</span></footer>
    </div>
    {popup === 'topup' && <TopupDialog isAdmin={user.data?.role != null && user.data.role >= 10} onClose={() => setPopup(null)}/>}
    {popup === 'invite' && <InviteDialog user={user.data} quotaPerUnit={quotaUnit} referralPercent={status.data?.referral_topup_percent} onClose={() => setPopup(null)}/>}
  </div>;
}

export function Workspace() {
  return <WorkspaceLocaleProvider><WorkspaceContent/></WorkspaceLocaleProvider>;
}
