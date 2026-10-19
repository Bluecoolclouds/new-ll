import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Info, Network, Save, ShieldCheck, Zap } from 'lucide-react';
import { request, requestPricing, type ApiToken, type PricingModel, type PricingResponse, type SelfUser, type SystemStatus, type Page } from '../lib/api';
import { routePath } from '../lib/routes';
import { gatewayProfiles, gatewayQuotaFromWalletTokens, gatewayWalletTokensInputFromQuota, tokenModelNames, type GatewayProfile } from '../lib/gateway-settings';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import { SettingsTextTree, settingsCopyFor, type SettingsCopy } from '../lib/settings-copy';
import './gateway-settings.css';

type GatewayDraft = {
  enabled: boolean;
  profile: GatewayProfile;
  models: string[];
  dailyTokens: string;
  monthlyTokens: string;
  warningPercent: string;
  concurrencyLimit: string;
};

const tokenQueryKey = ['stratus', 'tokens'];
const profileLabels: Record<GatewayProfile, { title: keyof SettingsCopy; description: keyof SettingsCopy }> = {
  ordered: { title: 'profileOrdered', description: 'profileOrderedDescription' },
  cost: { title: 'profileCost', description: 'profileCostDescription' },
  speed: { title: 'profileSpeed', description: 'profileSpeedDescription' },
  reliable: { title: 'profileReliable', description: 'profileReliableDescription' },
};

function modelIsAvailable(model: PricingModel, group: string) {
  const enabledGroups = model.enable_groups ?? [];
  return enabledGroups.length === 0 || enabledGroups.includes('all') || (group !== '' && enabledGroups.includes(group));
}

function allowedModelsFor(token: ApiToken, user: SelfUser | undefined, pricing: PricingResponse | undefined, locale: string) {
  const group = token.group && token.group !== 'auto' ? token.group : user?.group ?? '';
  return (pricing?.data ?? [])
    .filter((model) => modelIsAvailable(model, group))
    .sort((a, b) => `${a.owner_by ?? ''}/${a.model_name}`.localeCompare(`${b.owner_by ?? ''}/${b.model_name}`, locale));
}

function initialDraft(token: ApiToken, unit: number): GatewayDraft {
  const profile = gatewayProfiles.includes(token.gateway_profile as GatewayProfile)
    ? token.gateway_profile as GatewayProfile
    : 'ordered';
  return {
    enabled: token.gateway_enabled === true,
    profile,
    models: tokenModelNames(token.model_limits),
    dailyTokens: gatewayWalletTokensInputFromQuota(token.gateway_daily_limit, unit),
    monthlyTokens: gatewayWalletTokensInputFromQuota(token.gateway_monthly_limit, unit),
    warningPercent: String(token.gateway_warning_percent || 80),
    concurrencyLimit: String(token.gateway_concurrency_limit ?? 0),
  };
}

function TokenGatewayEditor({
  token, user, pricing, quotaPerUnit, onSaved, language, locale,
}: {
  token: ApiToken;
  user?: SelfUser;
  pricing?: PricingResponse;
  quotaPerUnit: number;
  onSaved: () => void;
  language: 'ru' | 'en';
  locale: string;
}) {
  const c = settingsCopyFor(language);
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => initialDraft(token, quotaPerUnit));
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const availableModels = useMemo(() => allowedModelsFor(token, user, pricing, locale), [token, user, pricing, locale]);
  const models = useMemo(() => {
    const filtered = availableModels.filter((model) => model.model_name.toLocaleLowerCase(locale).includes(filter.trim().toLocaleLowerCase(locale)));
    const listed = new Set(availableModels.map((model) => model.model_name));
    const legacy = draft.models.filter((name) => !listed.has(name) && name.toLocaleLowerCase(locale).includes(filter.trim().toLocaleLowerCase(locale)))
      .map((model_name) => ({ model_name, owner_by: c.previouslyConfigured } as PricingModel));
    return [...legacy, ...filtered];
  }, [availableModels, draft.models, filter, locale, c.previouslyConfigured]);

  const save = useMutation({
    mutationFn: async (values: GatewayDraft) => {
      if (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) throw new Error(c.quotaUnitLoadError);
      if (values.enabled && values.models.length === 0) throw new Error(c.chooseAtLeastOneModel);
      const warning = Number(values.warningPercent);
      const concurrency = Number(values.concurrencyLimit);
      if (!Number.isInteger(warning) || warning < 1 || warning > 100) throw new Error(c.warningRangeError);
      if (!Number.isInteger(concurrency) || concurrency < 0 || concurrency > 10_000) throw new Error(c.concurrencyRangeError);
      const daily = values.enabled ? gatewayQuotaFromWalletTokens(values.dailyTokens, quotaPerUnit) : 0;
      const monthly = values.enabled ? gatewayQuotaFromWalletTokens(values.monthlyTokens, quotaPerUnit) : 0;
      if (daily === null || monthly === null) throw new Error(c.walletTokenLimitError);

      const current = await request<ApiToken>(`/api/token/${token.id}`);
      return request<ApiToken>('/api/token/', {
        method: 'PUT',
        body: JSON.stringify({
          ...current,
          id: token.id,
          model_limits_enabled: values.enabled ? true : current.model_limits_enabled,
          model_limits: values.enabled ? values.models.join(',') : current.model_limits ?? '',
          gateway_enabled: values.enabled,
          gateway_profile: values.enabled ? values.profile : 'ordered',
          gateway_daily_limit: daily,
          gateway_monthly_limit: monthly,
          gateway_warning_percent: values.enabled ? warning : 80,
          gateway_concurrency_limit: values.enabled ? concurrency : 0,
        }),
      });
    },
    onSuccess: async () => {
      setNotice({ kind: 'success', text: c.gatewaySaved });
      await client.invalidateQueries({ queryKey: tokenQueryKey });
      onSaved();
    },
    onError: (error: Error) => setNotice({ kind: 'error', text: error.message }),
  });

  const toggleModel = (name: string) => setDraft((current) => ({
    ...current,
    models: current.models.includes(name) ? current.models.filter((model) => model !== name) : [...current.models, name],
  }));
  const moveModel = (index: number, delta: -1 | 1) => setDraft((current) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.models.length) return current;
    const models = [...current.models];
    [models[index], models[nextIndex]] = [models[nextIndex], models[index]];
    return { ...current, models };
  });

  return <SettingsTextTree language={language}><div className="gateway-editor">
    <header className="gateway-editor-head">
      <div><span className="gateway-kicker">{c.keySetup}</span><h2>{token.name}</h2><p>{token.group || user?.group || '—'} · {token.status === 1 ? c.active : c.disabled}</p></div>
      <span className={`gateway-state ${draft.enabled ? 'is-on' : ''}`}>{draft.enabled ? 'Gateway включён' : 'Gateway выключен'}</span>
    </header>

    <div className="gateway-note"><Info size={16}/><span>{c.gatewayClientNote}</span></div>

    <label className="gateway-switch">
      <span><strong>Включить AI Gateway для этого ключа</strong><small>Обычные ключи и запросы с явным названием модели продолжат работать как раньше.</small></span>
      <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((value) => ({ ...value, enabled: event.target.checked }))}/>
    </label>

    <fieldset className="gateway-fieldset" disabled={!draft.enabled}>
      <legend>Профиль маршрутизации</legend>
      <div className="gateway-profiles">
        {gatewayProfiles.map((profile) => <label key={profile} className={`gateway-profile ${draft.profile === profile ? 'is-selected' : ''}`}>
          <input type="radio" name={`gateway-profile-${token.id}`} value={profile} checked={draft.profile === profile} onChange={() => setDraft((value) => ({ ...value, profile }))}/>
          <span><strong>{c[profileLabels[profile].title]}</strong><small>{c[profileLabels[profile].description]}</small></span>
        </label>)}
      </div>

      <section className="gateway-model-picker" aria-labelledby="gateway-models-title">
        <div className="gateway-model-picker-head"><div><h3 id="gateway-models-title">{c.allowedModels}</h3><p>{c.autoNeedsModel}</p></div><span>{c.selectedCount.replace('{{count}}', draft.models.length.toLocaleString(locale))}</span></div>
        <div className="gateway-selected-models" aria-label="Порядок моделей">
          {draft.models.length === 0 && <span className="gateway-model-empty">Выберите модели из каталога ниже.</span>}
          {draft.models.map((name, index) => <div className="gateway-selected-model" key={name}>
            <span><b>{index + 1}</b>{name}</span>
            <div>
              <button type="button" aria-label={`Переместить ${name} выше`} disabled={index === 0} onClick={() => moveModel(index, -1)}><ArrowUp size={13}/></button>
              <button type="button" aria-label={`Переместить ${name} ниже`} disabled={index === draft.models.length - 1} onClick={() => moveModel(index, 1)}><ArrowDown size={13}/></button>
              <button type="button" aria-label={`Убрать ${name}`} onClick={() => toggleModel(name)}>×</button>
            </div>
          </div>)}
        </div>
        <input className="gateway-model-search" aria-label="Поиск модели для AI Gateway" placeholder="Найти модель" value={filter} onChange={(event) => setFilter(event.target.value)}/>
        <div className="gateway-model-catalog">
          {models.length === 0
            ? <p className="gateway-model-empty">Подходящих моделей не найдено.</p>
            : models.map((model) => <label key={model.model_name} className="gateway-model-option">
              <input type="checkbox" checked={draft.models.includes(model.model_name)} onChange={() => toggleModel(model.model_name)}/>
              <span><strong>{model.model_name}</strong><small>{model.owner_by || 'Другой провайдер'}</small></span>
            </label>)}
        </div>
        <p className="gateway-model-foot">Сервер дополнительно проверяет фактическую доступность и совместимость канала для каждого запроса.</p>
      </section>

      <section className="gateway-budget" aria-labelledby="gateway-budget-title">
        <div><h3 id="gateway-budget-title">Лимиты ключа</h3><p>Лимиты вводятся в токенах кошелька, сбрасываются по UTC; 0 — без ограничения.</p></div>
        <label>Дневной лимит, токены кошелька<input type="number" min="0" step="any" value={draft.dailyTokens} onChange={(event) => setDraft((value) => ({ ...value, dailyTokens: event.target.value }))}/></label>
        <label>Месячный лимит, токены кошелька<input type="number" min="0" step="any" value={draft.monthlyTokens} onChange={(event) => setDraft((value) => ({ ...value, monthlyTokens: event.target.value }))}/></label>
        <label>Одновременные запросы<input type="number" min="0" max="10000" step="1" value={draft.concurrencyLimit} onChange={(event) => setDraft((value) => ({ ...value, concurrencyLimit: event.target.value }))}/></label>
        <label>{c.warningThreshold}<input type="number" min="1" max="100" step="1" value={draft.warningPercent} onChange={(event) => setDraft((value) => ({ ...value, warningPercent: event.target.value }))}/></label>
      </section>
    </fieldset>

    {notice && <div className={`gateway-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    <div className="gateway-actions"><button type="button" className="gateway-save" disabled={save.isPending || !Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0} onClick={() => save.mutate(draft)}><Save size={15}/>{save.isPending ? 'Сохраняем…' : 'Сохранить настройки'}</button><span><ShieldCheck size={14}/> Сервер проверит настройки и права ключа</span></div>
  </div></SettingsTextTree>;
}

export function GatewaySettings() {
  const { language } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const c = settingsCopyFor(language);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const tokens = useQuery({ queryKey: [...tokenQueryKey, page], queryFn: () => request<Page<ApiToken>>(`/api/token/?p=${page}&page_size=20`) });
  const user = useQuery({ queryKey: ['stratus', 'self'], queryFn: () => request<SelfUser>('/api/user/self'), retry: false });
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: () => request<SystemStatus>('/api/status'), retry: false });
  const pricing = useQuery({ queryKey: ['stratus', 'pricing'], queryFn: () => requestPricing('/api/pricing'), staleTime: 20_000, refetchInterval: 60_000 });
  const items = tokens.data?.items ?? [];
  const token = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const quotaPerUnit = status.data?.quota_per_unit ?? Number.NaN;
  const tokenConfigKey = token
    ? [token.id, token.gateway_enabled, token.gateway_profile, token.gateway_daily_limit, token.gateway_monthly_limit, token.gateway_warning_percent, token.gateway_concurrency_limit, token.model_limits].join(':')
    : '';
  const totalPages = Math.max(1, Math.ceil((tokens.data?.total ?? 0) / (tokens.data?.page_size ?? 20)));

  return <SettingsTextTree language={language}><section className="settings-card gateway-settings" data-testid="card-ai-gateway">
    <div className="settings-label">Маршрутизация запросов</div>
    <h2><Network size={20}/> AI Gateway</h2>
    <p className="settings-copy">Настройте умный выбор модели для конкретного API-ключа. Обычные API-ключи не изменятся, пока вы отдельно не включите Gateway.</p>
    <div className="settings-note"><Zap size={16}/><span>{c.gatewayRequestNote}</span></div>
    {(tokens.isLoading || status.isLoading || pricing.isLoading) && <div className="settings-state" role="status">Загружаем ключи, модели и параметры маршрутизации…</div>}
    {(tokens.isError || status.isError || pricing.isError) && <div className="settings-alert" role="alert">Не удалось загрузить данные AI Gateway. <button type="button" onClick={() => { void tokens.refetch(); void status.refetch(); void pricing.refetch(); }}>Повторить</button></div>}
    {user.isError && <div className="settings-alert" role="alert">Не удалось определить группу доступа аккаунта. <button type="button" onClick={() => void user.refetch()}>Повторить</button></div>}
    {tokens.data && items.length === 0 && <div className="gateway-no-tokens"><strong>Сначала создайте API-ключ</strong><span>AI Gateway включается для отдельного ключа.</span><a href={routePath('/settings')}>Открыть API-ключи</a></div>}
    {tokens.data && items.length > 0 && <>
      <label className="gateway-token-select">{c.apiKeyLabel}
        <select aria-label={c.gatewayKeySelect} value={token?.id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
          {items.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.status === 1 ? c.activeKey : c.inactiveKey}</option>)}
        </select>
      </label>
      {token && Number.isFinite(quotaPerUnit) && pricing.data && <TokenGatewayEditor
        key={`${tokenConfigKey}:${quotaPerUnit}`}
        token={token}
        user={user.data}
        pricing={pricing.data}
        quotaPerUnit={quotaPerUnit}
        onSaved={() => setSelectedId(token.id)}
        language={language}
        locale={locale}
      />}
      {tokens.data && (page > 1 || tokens.data.total > tokens.data.page_size) && <nav className="gateway-pager" aria-label={c.gatewayKeyPages}>
        <button type="button" disabled={page <= 1 || tokens.isFetching} onClick={() => { setPage((value) => value - 1); setSelectedId(null); }}>Назад</button>
        <span>Страница {page} из {totalPages} · {tokens.data.total} ключей</span>
        <button type="button" disabled={page >= totalPages || tokens.isFetching} onClick={() => { setPage((value) => value + 1); setSelectedId(null); }}>Далее</button>
      </nav>}
    </>}
  </section></SettingsTextTree>;
}
