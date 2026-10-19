import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Info, Plus, RefreshCw, Trash2, Wallet, Pencil, Eye } from 'lucide-react';
import { basePath } from '../lib/routes';
import { quotaToWalletTokens, usdToWalletTokens, walletTokensToQuota } from '../lib/token-economy';
import { formatCabinetTokens } from '../lib/workspace-summary';
import { getApiKeyQuotaUsage } from '../lib/api-key-quota';
import { formatQuotaMoney, formatTimestamp, request, type ApiToken, type Page, type SelfUser, type SystemStatus } from '../lib/api';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import { SettingsTextTree, settingsCopyFor } from '../lib/settings-copy';
import './settings.css';

const KEYS_QUERY = ['stratus', 'tokens'];
const loadTokens = (page: number) => request<Page<ApiToken>>(`/api/token/?p=${page}&page_size=20`);
function ApiKeyQuotaUsage({ token, quotaPerUnit, locale, language }: {
  token: ApiToken; quotaPerUnit: number; locale: string; language: 'ru' | 'en';
}) {
  const usage = getApiKeyQuotaUsage(token.used_quota, token.remain_quota);
  const usedTokens = quotaToWalletTokens(usage.used, quotaPerUnit);
  const totalTokens = quotaToWalletTokens(usage.total, quotaPerUnit);
  const c = settingsCopyFor(language);
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(usage.percentage);
  const usedLabel = formatCabinetTokens(usedTokens, locale, c.tokenLabel, c.unavailable);
  const totalLabel = formatCabinetTokens(totalTokens, locale, c.tokenLabel, c.unavailable);
  const valueText = c.usageText.replace('{{percent}}', percent).replace('{{used}}', usedLabel).replace('{{total}}', totalLabel);
  const fillClass = usage.percentage >= 90 ? 'is-critical' : usage.percentage >= 75 ? 'is-warning' : '';

  return <div className="settings-quota-usage">
     <div className="settings-quota-meta"><span>{c.usagePercent}</span><strong>{percent}%</strong></div>
    <div
      className="settings-quota-track"
      role="progressbar"
      aria-label={c.usageAria.replace('{{name}}', token.name)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(usage.percentage)}
      aria-valuetext={valueText}
      title={valueText}
    ><span className={`settings-quota-fill ${fillClass}`} style={{ width: `${usage.percentage}%` }}/></div>
  </div>;
}

export function Settings() {
  const { language } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const c = settingsCopyFor(language);
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [unlimited, setUnlimited] = useState(true);
  const [quotaTokens, setQuotaTokens] = useState('1000000');
  const [newTokenId, setNewTokenId] = useState<number | null>(null);
  const [secret, setSecret] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const tokens = useQuery({ queryKey: [...KEYS_QUERY, page], queryFn: () => loadTokens(page) });
  const tokenItems = tokens.data?.items ?? [];
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: () => request<SystemStatus>('/api/status') });
  const user = useQuery({ queryKey: ['stratus', 'self'], queryFn: () => request<SelfUser>('/api/user/self') });
  const unit = status.data?.quota_per_unit ?? Number.NaN;
  const create = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const formData = new FormData(form);
      const tokenName = String(formData.get('name') ?? '').trim();
      const expire = String(formData.get('expiry') ?? 'never');
      const expiry = expire === 'never' ? -1 : Math.floor(new Date(expire).getTime() / 1000);
      const remain = unlimited ? 0 : walletTokensToQuota(Number(quotaTokens), unit);
      if (remain === null || (!unlimited && Number(quotaTokens) > 0 && remain === 0)) {
        throw new Error('Лимит слишком мал или выходит за допустимый диапазон.');
      }
      await request<unknown>('/api/token/', { method: 'POST', body: JSON.stringify({
        name: tokenName, remain_quota: remain, expired_time: expiry, unlimited_quota: unlimited,
        model_limits_enabled: false, group: user.data?.group || '',
      }) });
      return tokenName;
    },
    onSuccess: async (tokenName) => {
      setName('');
      setNotice(`Ключ «${tokenName}» сохранён. Нажмите значок глаза в строке ключа, чтобы показать секрет.`);
      setNewTokenId(null);
      setSecret('');
      setPage(1);
      // A failed list refresh must not report an already-created key as a failed creation.
      await client.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: (error: Error) => setNotice(`Не удалось создать ключ: ${error.message}`),
  });
  const update = useMutation({
    mutationFn: async ({ token, payload, query = '' }: { token: ApiToken; payload: Record<string, unknown>; query?: string }) => {
      // Full token updates replace model/IP/group restrictions: preserve the current server values.
      const current = query ? {} : await request<ApiToken>(`/api/token/${token.id}`);
      return request<unknown>(`/api/token/${query ? `?${query}` : ''}`, {
        method: 'PUT', body: JSON.stringify({ ...current, id: token.id, ...payload }),
      });
    },
    onSuccess: async () => { setNotice('Изменения сохранены.'); await client.invalidateQueries({ queryKey: KEYS_QUERY }); },
    onError: (error: Error) => setNotice(`Не удалось обновить ключ: ${error.message}`),
  });
  const remove = useMutation({
    mutationFn: (token: ApiToken) => request<unknown>(`/api/token/${token.id}`, { method: 'DELETE' }),
    onSuccess: async (_, token) => {
      setNotice(`Ключ «${token.name}» удалён.`);
      if (newTokenId === token.id) { setNewTokenId(null); setSecret(''); }
      await client.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: (error: Error) => setNotice(`Не удалось удалить ключ: ${error.message}`),
  });
  const reveal = useMutation({
    mutationFn: (id: number) => request<{ key: string }>(`/api/token/${id}/key`, { method: 'POST' }),
    onSuccess: (result) => { setSecret(result.key); setNotice('Секрет показан только в этой сессии страницы. Он не сохраняется в браузере.'); },
    onError: (error: Error) => setNotice(`Не удалось получить секрет: ${error.message}`),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || create.isPending) return;
    setNotice('');
    setSecret('');
    const form = event.currentTarget;
    create.mutate(form);
  };
  const copySecret = async () => {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setNotice('Буфер обмена недоступен. Выделите секрет и скопируйте вручную.'); }
  };
  const editName = (token: ApiToken) => {
    const value = window.prompt(c.newKeyNamePrompt, token.name);
    const next = value?.trim();
    if (next && next !== token.name) update.mutate({ token, payload: { name: next } });
  };
  const toggleEnabled = (token: ApiToken) => update.mutate({ token, payload: { status: token.status === 1 ? 2 : 1 }, query: 'status_only=1' });
  const deleteToken = (token: ApiToken) => {
    if (window.confirm(c.deleteKeyConfirm.replace('{{name}}', token.name))) remove.mutate(token);
  };

  return <SettingsTextTree language={language}><section className="settings-card" data-testid="card-api-keys">
        <div className="settings-label">{c.integration}</div><h2>{c.apiKeysTitle}</h2><p className="settings-copy">{c.apiKeysDescription}</p>
        <div className="settings-note"><Info size={16} style={{ flex: 'none' }}/><span>{c.secretSafetyNote}</span></div>
        {status.isLoading && <div className="settings-state" role="status">Получаем системные настройки…</div>}
        {tokens.isLoading && <div className="settings-state" role="status">Загружаем сохранённые ключи…</div>}
        {(tokens.isError || status.isError) && <div className="settings-alert" role="alert">Не удалось загрузить ключи или quota_per_unit. <button type="button" onClick={() => { void tokens.refetch(); void status.refetch(); }}>Повторить</button></div>}
        {notice && <div className="settings-alert" role="status">{notice}</div>}
        {newTokenId !== null && <div className="secret-box" role="region" aria-label="Секрет API-ключа"><div className="secret-title">API-ключ #{newTokenId}</div><p className="secret-warning">Не передавайте секрет посторонним. Он не сохраняется в браузере.</p>{secret ? <><div className="secret-value"><span>{secret}</span><button type="button" aria-label="Скопировать секрет" onClick={() => void copySecret()}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button></div><button className="settings-button" style={{ marginTop: 12 }} type="button" onClick={() => { setSecret(''); setNewTokenId(null); }}>Скрыть секрет</button></> : <button className="settings-button" type="button" disabled={reveal.isPending} onClick={() => reveal.mutate(newTokenId)}><Eye size={14}/>{reveal.isPending ? 'Запрашиваем…' : 'Явно показать секрет'}</button>}</div>}
         {tokens.data && <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Название</th><th>Статус</th><th>Секрет / ID</th><th>Баланс ключа</th><th>Создан</th><th aria-label="Действия"/></tr></thead><tbody>
            {tokenItems.map((token) => <tr key={token.id}><td><strong>{token.name}</strong><small style={{ display: 'block', marginTop: 4, color: '#829da5' }}>{token.group || '—'}</small></td><td><span className={`settings-status ${token.status === 1 ? '' : 'off'}`}>{token.status === 1 ? 'Активен' : 'Отключён'}</span></td><td><span className="key-prefix">{token.key || `ID ${token.id}`}</span></td><td>{token.unlimited_quota ? 'Без ограничения' : <div className="settings-quota-cell"><span>{formatQuotaMoney(token.remain_quota, unit, status.data, locale, c.unavailable)}</span><ApiKeyQuotaUsage token={token} quotaPerUnit={unit} locale={locale} language={language}/></div>}</td><td>{formatTimestamp(token.created_time, locale)}</td><td><div className="settings-row-actions"><button className="settings-tool" title="Показать секрет" aria-label={`Показать секрет ${token.name}`} disabled={reveal.isPending} onClick={() => { setSecret(''); setNewTokenId(token.id); reveal.mutate(token.id); }}><Eye size={14}/></button><button className="settings-tool" title="Переименовать" aria-label={`Переименовать ${token.name}`} disabled={update.isPending} onClick={() => editName(token)}><Pencil size={14}/></button><button className="settings-tool" title={token.status === 1 ? 'Отключить' : 'Включить'} aria-label={token.status === 1 ? `Отключить ${token.name}` : `Включить ${token.name}`} disabled={update.isPending} onClick={() => toggleEnabled(token)}><RefreshCw size={14}/></button><button className="settings-revoke" type="button" aria-label={`Удалить ${token.name}`} title="Удалить ключ" disabled={remove.isPending} onClick={() => deleteToken(token)}><Trash2 size={15}/></button></div></td></tr>)}
          {tokenItems.length === 0 && <tr><td colSpan={6} className="settings-empty">Ключей пока нет. Создайте первый ниже.</td></tr>}
        </tbody></table></div>}
        {tokens.data && (page > 1 || tokens.data.total > tokens.data.page_size) && <nav aria-label="Страницы ключей" className="workspace-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button className="settings-tool" disabled={page <= 1 || tokens.isFetching} onClick={() => { setPage((n) => n - 1); setSecret(''); setNewTokenId(null); }}>Назад</button>
          <span className="settings-copy">Страница {page} из {Math.max(1, Math.ceil(tokens.data.total / tokens.data.page_size))} · {tokens.data.total} ключей</span>
          <button className="settings-tool" disabled={page * tokens.data.page_size >= tokens.data.total || tokens.isFetching} onClick={() => { setPage((n) => n + 1); setSecret(''); setNewTokenId(null); }}>Далее</button>
        </nav>}
        {status.data && <form className="settings-form" onSubmit={submit}>
          <input className="settings-input" name="name" maxLength={50} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Название ключа, например production" aria-label="Название ключа"/>
          <select className="settings-select" aria-label="Лимит квоты" value={unlimited ? 'unlimited' : 'limited'} onChange={(event) => setUnlimited(event.target.value === 'unlimited')}><option value="unlimited">Без лимита</option><option value="limited">Лимит в токенах</option></select>
          <input className="settings-input" aria-label="Лимит в токенах кошелька" type="number" min="0" step="any" value={quotaTokens} disabled={unlimited} onChange={(event) => setQuotaTokens(event.target.value)} placeholder="Токены кошелька"/>
          <select className="settings-select" name="expiry" aria-label="Срок действия"><option value="never">Без срока</option><option value={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}>30 дней</option><option value={new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}>90 дней</option></select>
          <button className="settings-button" type="submit" disabled={!name.trim() || create.isPending}><Plus size={14}/>{create.isPending ? 'Создаём…' : 'Создать ключ'}</button>
        </form>}
         {!unlimited && <p className="settings-copy">{c.minimumStepNote.replace('{{step}}', Number.isFinite(unit) && unit > 0 ? (usdToWalletTokens(1) / unit).toLocaleString(locale, { maximumFractionDigits: 4 }) : '—')}</p>}
       <a className="settings-wallet-link" href={`${basePath}/wallet`}><Wallet size={14}/> Открыть баланс и способы пополнения</a>
   </section></SettingsTextTree>;
}
