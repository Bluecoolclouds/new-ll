import { useEffect, useMemo, useState } from 'react';
import { buildUsageAnalytics, getAnalyticsRange, type UsageGranularity, type UsageSelection } from '../lib/usage-analytics';
import type { UsagePeriod } from '../lib/usage';
import { useAccountUsage } from '../lib/use-account-usage';
import { buildDemoUsageRows, DEMO_QUOTA_PER_USD } from '../lib/demo-usage';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import { UsageAnalyticsPlot } from './UsageAnalyticsPlot';
import { UsageModelLegend } from './UsageModelLegend';

type Props = { userId: number; quotaPerUnit: number; enableDataExport?: unknown; isAdmin?: boolean };

function ChartLoading() {
  const { copy: c } = useWorkspaceLocale();
  return <div className="usage-chart-loading" role="status" aria-live="polite">
    <div className="usage-chart-skeleton-head"><i/><i/></div>
    <div className="usage-chart-skeleton-plot"><i/><i/><i/></div>
    <span>{c.loadingUsage}</span>
  </div>;
}

export function UsageChart({ userId, quotaPerUnit, enableDataExport, isAdmin = false }: Props) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const periods: { value: UsagePeriod; label: string }[] = [
    { value: '24h', label: c.last24Hours },
    { value: '7d', label: c.last7Days },
    { value: '30d', label: c.last30Days },
  ];
  const granularities: { value: UsageGranularity; label: string }[] = [
    { value: 'hour', label: c.hour },
    { value: 'day', label: c.day },
    { value: 'week', label: c.week },
  ];
  const formatStratusTokens = (value: number | null) => value === null
    ? c.unavailable
    : `${number.format(value)} ${c.walletTokensUnit}`;
  const [selection, setSelection] = useState<UsageSelection>({ period: '7d', granularity: 'day' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<{ userId: number; enabled: boolean }>(() => ({ userId, enabled: false }));
  const query = useAccountUsage(selection, userId);
  const useDemoData = isAdmin && demoMode.userId === userId && demoMode.enabled;
  const demoRange = useMemo(() => useDemoData ? getAnalyticsRange(selection) : null, [useDemoData, selection]);
  const range = useDemoData ? demoRange : query.data?.range;
  const realRows = query.data?.rows ?? [];
  const demoRows = useMemo(
    () => useDemoData && range ? buildDemoUsageRows(range, quotaPerUnit) : null,
    [useDemoData, range, quotaPerUnit],
  );
  const rows = useDemoData ? demoRows ?? [] : realRows;
  const analytics = useMemo(() => {
    if (!range) return null;
    try {
      // The demo rate is only a local visual fallback when wallet configuration is unavailable.
      const demoRate = Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : DEMO_QUOTA_PER_USD;
      return buildUsageAnalytics(rows, range, useDemoData ? demoRate : quotaPerUnit);
    } catch {
      return null;
    }
  }, [rows, range, quotaPerUnit, useDemoData]);
  const availableModels = useMemo(() => analytics?.models
    .slice()
    .sort((a, b) => (b.summary.walletTokens ?? -1) - (a.summary.walletTokens ?? -1) || a.model.localeCompare(b.model, locale))
    .map((model) => model.model) ?? [], [analytics, locale]);
  useEffect(() => {
    if (selectedModel && !availableModels.includes(selectedModel)) setSelectedModel(null);
  }, [availableModels, selectedModel]);
  const selectedModels = useMemo(
    () => selectedModel && availableModels.includes(selectedModel) ? [selectedModel] : availableModels,
    [availableModels, selectedModel],
  );
  const visibleAnalytics = useMemo(() => {
    if (!analytics || !range) return null;
    try {
      const demoRate = Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : DEMO_QUOTA_PER_USD;
      return buildUsageAnalytics(rows, range, useDemoData ? demoRate : quotaPerUnit, selectedModels);
    } catch {
      return null;
    }
  }, [analytics, rows, range, quotaPerUnit, useDemoData, selectedModels]);
  const points = analytics?.points ?? [];
  const collectionDisabled = enableDataExport === false;
  const dataLoading = !useDemoData && query.isLoading;
  const dataError = !useDemoData && query.isError;
  const dataAvailable = useDemoData || query.isSuccess;
  const activePeriod = periods.find((item) => item.value === selection.period)?.label ?? '';

  useEffect(() => {
    setSelectedIndex(Math.max(0, points.length - 1));
  }, [points.length, selection]);

  const selectPeriod = (period: UsagePeriod) => {
    setSelection((current) => ({ period, granularity: current.granularity }));
  };
  const selectGranularity = (granularity: UsageGranularity) => {
    setSelection((current) => ({ ...current, granularity }));
  };

  return <section className="usage-card workspace-card" aria-labelledby="usage-title" data-testid="card-usage-chart">
    <div className="usage-card-head">
      <div>
        <div className="workspace-card-label upper">{c.activityApi}</div>
        <h2 id="usage-title">{c.spendInStratusTokens}</h2>
      </div>
      {isAdmin && <button
        className={`usage-demo-toggle${useDemoData ? ' is-active' : ''}`}
        data-testid="button-toggle-usage-test-data"
        type="button"
        aria-pressed={useDemoData}
        onClick={() => setDemoMode((current) => ({
          userId,
          enabled: current.userId === userId ? !current.enabled : true,
        }))}
      >{useDemoData ? c.showRealData : c.demoData}</button>}
    </div>

    {useDemoData && <p className="usage-demo-banner" role="status">
      {c.demoNotice}
    </p>}

    <div className="usage-control-layout">
      <div className="usage-period-block">
        <span className="usage-control-label">{c.period}</span>
        <div className="usage-periods" role="group" aria-label={c.chartPeriod}>
          {periods.map((item) => <button
            data-testid={`button-period-${item.value}`}
            key={item.value}
            type="button"
            className={selection.period === item.value ? 'is-active' : ''}
            aria-pressed={selection.period === item.value}
            onClick={() => selectPeriod(item.value)}
          >{item.label}</button>)}
        </div>
      </div>
      <div className="usage-granularity">
        <label className="usage-control-label" htmlFor="usage-granularity">{c.chartStep}</label>
        <select
          id="usage-granularity"
          data-testid="select-usage-granularity"
          value={selection.granularity}
          onChange={(event) => selectGranularity(event.target.value as UsageGranularity)}
        >
          {granularities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
      </div>
    </div>

    {dataLoading && <ChartLoading/>}
    {dataError && <div className="usage-state usage-state-error" role="alert">
      <strong>{c.usageLoadError}</strong>
      <span>{c.usageDataUnavailable}</span>
      <button className="workspace-action" type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
        {query.isFetching ? c.loading : c.retry}
      </button>
    </div>}
    {!useDemoData && collectionDisabled && query.isSuccess && realRows.length > 0 && <p className="usage-data-warning" role="status">
      {c.collectionOffSaved}
    </p>}
    {dataAvailable && rows.length === 0 && <div className="usage-state" role="status">
      <strong>{useDemoData ? c.demoNoDataTitle : collectionDisabled ? c.statsNotCollected : c.noDataForPeriod}</strong>
      <span>{useDemoData ? c.demoNoDataHelp : collectionDisabled ? c.statsOffHelp : c.noSpendYet}</span>
    </div>}
    {dataAvailable && rows.length > 0 && !analytics && <div className="usage-state usage-state-error" role="alert">
      <strong>{c.statsProcessError}</strong>
      <span>{c.statsUnsafeNumber}</span>
      <button className="workspace-action" type="button" onClick={() => void query.refetch()}>{c.retry}</button>
    </div>}
    {dataAvailable && rows.length > 0 && analytics && visibleAnalytics && <>
      <div className="usage-chart-summary">
        <div><span>{useDemoData ? c.demoSpendPrefix : c.spendPrefix} {activePeriod}</span><strong>{formatStratusTokens(visibleAnalytics.summary.walletTokens)}</strong></div>
      </div>
      <UsageAnalyticsPlot
        view="spending-bar"
        metric="wallet"
        points={visibleAnalytics.points}
        models={visibleAnalytics.models}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelectedIndex}
        walletUnavailable={!useDemoData && (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0)}
      />
      <UsageModelLegend
        models={availableModels}
        selectedModel={selectedModel}
        onSelect={(model) => setSelectedModel((current) => current === model ? null : model)}
      />
    </>}
  </section>;
}
