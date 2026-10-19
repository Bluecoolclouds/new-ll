import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Database, RefreshCw } from 'lucide-react';
import { request, requestPricing, type PricingModel, type SystemStatus } from '../lib/api';
import { formatTariffNumber, getModelTokenTariff, type ModelTokenTariff } from '../lib/token-economy';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import type { WorkspaceCopy } from '../lib/workspace-copy';

function tariffLabel(tariff: ModelTokenTariff, copy: WorkspaceCopy) {
  switch (tariff.kind) {
    case 'uniform': return `×${formatTariffNumber(tariff.multiplier)}`;
    case 'mixed': return `×${formatTariffNumber(tariff.minimum)}–×${formatTariffNumber(tariff.maximum)}`;
    case 'request': return `${formatTariffNumber(tariff.tokens)} ${copy.requestRate}`;
    case 'dynamic': return copy.dynamicRate;
    case 'invalid': return copy.notCalculated;
  }
}

function ModelRow({
  model, enabled, tariff,
  copy,
}: {
  model: PricingModel;
  enabled: boolean;
  tariff: ModelTokenTariff;
  copy: WorkspaceCopy;
}) {
  return <li className={`model-prices-row ${enabled ? '' : 'is-unavailable'}`}>
    <div className="model-prices-row-main">
      <div className="model-prices-model">
        <strong>{model.model_name}</strong>
        {model.description && <small>{model.description}</small>}
      </div>
      <span className={`model-prices-value ${tariff.kind === 'invalid' || !enabled ? 'is-muted' : ''}`}>
        {enabled ? tariffLabel(tariff, copy) : copy.modelUnavailable}
      </span>
    </div>
    {!enabled && <div className="model-prices-row-sub">{copy.notAvailableToGroup}</div>}
  </li>;
}

export function ModelPrices({ currentGroup }: { currentGroup: string }) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = language === 'ru' ? 'ru' : 'en';
  const [filter, setFilter] = useState('');
  const query = useQuery({ queryKey: ['stratus', 'pricing'], queryFn: () => requestPricing('/api/pricing'), staleTime: 20_000, refetchInterval: 60_000 });
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: () => request<SystemStatus>('/api/status'), staleTime: 20_000, refetchInterval: 60_000 });
  const groups = useMemo(() => Object.keys(query.data?.group_ratio ?? {}).filter((group) => group in (query.data?.usable_group ?? {})), [query.data]);
  const activeGroup = groups.includes(currentGroup) ? currentGroup : groups.includes('default') ? 'default' : groups[0] ?? '';
  const rows = (query.data?.data ?? []).filter((model) => model.model_name.toLocaleLowerCase(locale).includes(filter.trim().toLocaleLowerCase(locale)));
  const providerGroups = useMemo(() => {
    const grouped = new Map<string, PricingModel[]>();
    for (const model of rows) {
      const provider = model.owner_by?.trim() || '—';
      const items = grouped.get(provider);
      if (items) items.push(model);
      else grouped.set(provider, [model]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, locale));
  }, [rows, locale]);
  const groupRatio = activeGroup ? query.data?.group_ratio[activeGroup] : undefined;

  return <section className="workspace-card model-prices" data-testid="card-model-prices" aria-labelledby="model-prices-title">
    <div className="model-prices-heading">
      <div>
        <div className="workspace-card-label upper">{c.modelRateTitle}</div>
        <h2 id="model-prices-title">{c.modelRates}</h2>
      </div>
      <span className="model-prices-heading-icon" aria-hidden="true"><ArrowDownUp size={16}/></span>
    </div>
    {query.isLoading && <p className="model-prices-state" role="status">{c.loadingPublishedRates}</p>}
    {query.isError && <p className="model-prices-state is-error" role="alert">{c.ratesLoadError} <button className="workspace-action" onClick={() => void query.refetch()} disabled={query.isFetching}>{query.isFetching ? c.loading : c.retry}</button></p>}
    {status.isLoading && <p className="model-prices-state" role="status">{c.loadingBalanceUnits}</p>}
    {status.isError && <p className="model-prices-state is-error" role="alert">{c.balanceUnitsError} <button className="workspace-action" onClick={() => void status.refetch()} disabled={status.isFetching}>{status.isFetching ? c.loading : c.retry}</button></p>}
    {query.data && <>
      <div className="model-prices-controls">
        <input aria-label={c.searchModel} placeholder={c.searchModelPlaceholder} value={filter} onChange={(event) => setFilter(event.target.value)}/>
        <button className="workspace-action model-prices-refresh" disabled={query.isFetching || status.isFetching} onClick={() => { void query.refetch(); void status.refetch(); }}><RefreshCw size={13} className={query.isFetching || status.isFetching ? 'is-spinning' : ''}/><span>{query.isFetching || status.isFetching ? c.updating : c.refreshRates}</span></button>
      </div>
      {groupRatio === undefined && <p className="model-prices-state">{c.noPublishedRatio}</p>}
      {groupRatio !== undefined && rows.length === 0 && <p className="model-prices-empty">{filter.trim() ? c.modelNotFound : c.noPublishedModels}</p>}
      {groupRatio !== undefined && rows.length > 0 && <div className="model-prices-groups">
        {providerGroups.map(([provider, models]) => <section className="model-prices-provider" key={provider} aria-label={`${c.provider} ${provider}`}>
          <h3>{provider}</h3>
          <ul>{models.map((model) => {
            const enabled = (model.enable_groups ?? []).includes('all') || (model.enable_groups ?? []).includes(activeGroup);
            const tariff = getModelTokenTariff(model, groupRatio, status.data?.quota_per_unit ?? NaN);
            return <ModelRow key={model.model_name} model={model} enabled={enabled} tariff={tariff} copy={c}/>;
          })}</ul>
        </section>)}
      </div>}
      <div className="model-prices-footer">
        <div className="model-prices-footer-item">
          <Database size={15} aria-hidden="true"/>
          <span>{c.cachedInput}</span>
          <strong>40%</strong>
        </div>
      </div>
    </>}
  </section>;
}
