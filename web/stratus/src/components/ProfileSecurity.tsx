import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, LockKeyhole, Mail, ShieldCheck, Download, RefreshCw } from 'lucide-react';
import { request, type SelfUser, type SystemStatus } from '../lib/api';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import { localizeSettingsText, SettingsTextTree, settingsCopyFor } from '../lib/settings-copy';
import './account-settings.css';

type TwoFAStatus = { enabled: boolean; locked?: boolean; backup_codes_remaining?: number };
type PasskeyStatus = { enabled: boolean; last_used_at?: string | null };
type SetupData = { secret: string; qr_code_data?: string; backup_codes: string[] };
type AuthSettings = SystemStatus & { turnstile_check?: boolean; turnstile_site_key?: string; email_verification?: boolean };

const selfKey = ['stratus', 'self'];
const statusKey = ['stratus', 'status'];
const twoFaKey = ['stratus', 'twofa'];
const passkeyKey = ['stratus', 'passkey'];
const fetchSelf = () => request<SelfUser>('/api/user/self');
const fetchTwoFA = () => request<TwoFAStatus>('/api/user/2fa/status');
const fetchPasskey = () => request<PasskeyStatus>('/api/user/passkey');

function useFreshQueries() {
  const self = useQuery({ queryKey: selfKey, queryFn: fetchSelf, staleTime: 0, refetchOnMount: 'always' });
  const status = useQuery({ queryKey: statusKey, queryFn: () => request<AuthSettings>('/api/status'), staleTime: 0, refetchOnMount: 'always' });
  return { self, status };
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="account-panel-frame">{children}</div>;
}

function Notice({ text, error = false, language }: { text: string; error?: boolean; language: 'ru' | 'en' }) {
  if (!text) return null;
  const copy = settingsCopyFor(language);
  return <div className={`account-alert ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{localizeSettingsText(text, language, copy.genericActionFailed)}</div>;
}

export function ProfileSettings() {
  const { language } = useWorkspaceLocale();
  const client = useQueryClient();
  const { self, status } = useFreshQueries();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [originalPassword, setOriginalPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [wait, setWait] = useState(0);
  const initialised = useRef(false);
  useEffect(() => {
    if (self.data && !initialised.current) {
      initialised.current = true;
      setUsername(self.data.username || '');
      setDisplayName(self.data.display_name || '');
      setEmail(self.data.email || '');
    }
  }, [self.data]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);
  const saveProfile = useMutation({
    mutationFn: () => request<unknown>('/api/user/self', { method: 'PUT', body: JSON.stringify({ username: username.trim(), display_name: displayName.trim() }) }),
    onSuccess: async () => { setMessage('Данные профиля сохранены.'); setFailed(false); await client.invalidateQueries({ queryKey: selfKey }); },
    onError: (error: Error) => { setMessage(error.message); setFailed(true); },
  });
  const changePassword = useMutation({
    mutationFn: () => request<unknown>('/api/user/self', { method: 'PUT', body: JSON.stringify({ username: username.trim(), display_name: displayName.trim(), original_password: originalPassword, password }) }),
    onSuccess: async () => { setMessage('Пароль обновлён.'); setFailed(false); setOriginalPassword(''); setPassword(''); setConfirmPassword(''); await client.invalidateQueries({ queryKey: selfKey }); },
    onError: (error: Error) => { setMessage(error.message); setFailed(true); },
  });
  const bindEmail = useMutation({
    mutationFn: () => request<unknown>('/api/oauth/email/bind', { method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }) }),
    onSuccess: async () => { setMessage('Адрес электронной почты подтверждён и привязан.'); setFailed(false); setCode(''); await client.invalidateQueries({ queryKey: selfKey }); },
    onError: (error: Error) => { setMessage(error.message); setFailed(true); },
  });
  const sendCode = useMutation({
    mutationFn: () => request<unknown>(`/api/verification?email=${encodeURIComponent(email.trim())}&turnstile=${encodeURIComponent(turnstile)}`),
    onSuccess: () => { setMessage('Код отправлен на почту. Проверьте входящие и папку «Спам».'); setFailed(false); setCodeSent(true); setWait(60); setTurnstile(''); window.dispatchEvent(new Event('stratus:reset-turnstile')); },
    onError: (error: Error) => { setMessage(error.message); setFailed(true); setTurnstile(''); window.dispatchEvent(new Event('stratus:reset-turnstile')); },
  });
  const submitProfile = (event: FormEvent) => { event.preventDefault(); setMessage(''); setFailed(false); saveProfile.mutate(); };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setFailed(true); setMessage('Новые пароли не совпадают.'); return; }
    if (password.length < 8 || password.length > 20) { setFailed(true); setMessage('Пароль должен содержать от 8 до 20 символов.'); return; }
    setMessage(''); setFailed(false); changePassword.mutate();
  };
  const turnstileEnabled = Boolean(status.data?.turnstile_check && status.data.turnstile_site_key);
  return <SettingsTextTree language={language}><Frame>
    {(self.isLoading || status.isLoading) && <section className="account-card" role="status"><div className="account-loading"/><p className="account-copy" style={{ marginTop: 12 }}>Загружаем профиль…</p></section>}
    {(self.isError || status.isError) && <div className="account-alert error" role="alert">Не удалось загрузить профиль или настройки проверки. <button className="account-btn secondary" type="button" onClick={() => { void self.refetch(); void status.refetch(); }}>Повторить</button></div>}
    {self.data && status.data && <div className="account-grid"><main className="account-main">
      <section className="account-card"><div className="account-label">Идентификация</div><h2>Данные профиля</h2><p className="account-copy">Имя пользователя и отображаемое имя используются в кабинете и интерфейсах Stratus Hub.</p>
        <form className="account-form" onSubmit={submitProfile}><div className="account-fields">
          <div className="account-field"><label htmlFor="profile-username">Имя пользователя</label><input id="profile-username" className="account-input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} required autoComplete="username"/></div>
          <div className="account-field"><label htmlFor="profile-display">Отображаемое имя</label><input id="profile-display" className="account-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="Как вас показывать"/></div>
        </div><div className="account-row"><button className="account-btn" type="submit" disabled={saveProfile.isPending || !username.trim()}><Check size={14}/>{saveProfile.isPending ? 'Сохраняем…' : 'Сохранить профиль'}</button><span className="account-hint">До 20 символов</span></div></form>
      </section>
      <section className="account-card"><div className="account-label">Доступ</div><h2>Сменить пароль</h2><p className="account-copy">Для подтверждения серверу отправляются текущий пароль, новое значение и актуальные имя пользователя с отображаемым именем.</p>
        <form className="account-form" onSubmit={submitPassword}><div className="account-fields">
          <div className="account-field"><label htmlFor="current-password">Текущий пароль</label><input id="current-password" className="account-input" type="password" autoComplete="current-password" value={originalPassword} onChange={(e) => setOriginalPassword(e.target.value)} required/></div>
          <div className="account-field"><label htmlFor="new-password">Новый пароль</label><input id="new-password" className="account-input" type="password" autoComplete="new-password" minLength={8} maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} required/><span className="account-hint">От 8 до 20 символов</span></div>
          <div className="account-field"><label htmlFor="confirm-password">Повторите новый пароль</label><input id="confirm-password" className="account-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required/></div>
        </div><div className="account-row"><button className="account-btn" type="submit" disabled={changePassword.isPending || !originalPassword || !password || !confirmPassword}><LockKeyhole size={14}/>{changePassword.isPending ? 'Обновляем…' : 'Обновить пароль'}</button></div></form>
      </section>
      <section className="account-card"><div className="account-label">Контакт</div><h2>Электронная почта</h2><p className="account-copy">{self.data.email ? `Сейчас привязан адрес ${self.data.email}.` : 'Адрес пока не привязан.'} Чтобы привязать или заменить адрес, запросите код подтверждения.</p>
        <div className="account-form"><div className="account-field"><label htmlFor="profile-email">Адрес электронной почты</label><input id="profile-email" className="account-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"/></div>
          {turnstileEnabled && <Turnstile siteKey={status.data.turnstile_site_key!} onToken={setTurnstile} label={settingsCopyFor(language).securityCheck}/>}
          <div className="account-fields"><div className="account-field"><label htmlFor="email-code">Код подтверждения</label><input id="email-code" className="account-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код из письма"/></div><div className="account-row" style={{ alignSelf: 'end' }}><button type="button" className="account-btn secondary" disabled={!email.trim() || sendCode.isPending || wait > 0 || (turnstileEnabled && !turnstile)} onClick={() => sendCode.mutate()}><Mail size={14}/>{sendCode.isPending ? 'Отправляем…' : wait ? `Повторить через ${wait} с` : codeSent ? 'Отправить снова' : 'Получить код'}</button><button type="button" className="account-btn" disabled={!email.trim() || !code.trim() || bindEmail.isPending} onClick={() => bindEmail.mutate()}>{bindEmail.isPending ? 'Подтверждаем…' : 'Подтвердить адрес'}</button></div></div>
        </div>
      </section>
      <Notice text={message} error={failed} language={language}/>
    </main><aside className="account-aside"><div className="account-aside-card"><strong>Ваш аккаунт</strong><p>Имя: {self.data.display_name || 'не задано'}<br/>Логин: {self.data.username}<br/>Группа: {self.data.group || '—'}</p></div><div className="account-aside-card"><strong>Изменения сразу в кабинете</strong><p>После сохранения имя профиля обновится во всех разделах Stratus Hub.</p></div></aside></div>}
  </Frame></SettingsTextTree>;
}

function Turnstile({ siteKey, onToken, label }: { siteKey: string; onToken: (token: string) => void; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const tokenCallback = useRef(onToken);
  tokenCallback.current = onToken;
  useEffect(() => {
    let disposed = false;
    const mount = () => {
      if (!disposed && window.turnstile && container.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(container.current, { sitekey: siteKey, callback: (token: string) => tokenCallback.current(token), 'expired-callback': () => tokenCallback.current(''), 'error-callback': () => tokenCallback.current('') });
      }
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-stratus-turnstile]');
    if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.dataset.stratusTurnstile = 'true'; document.head.appendChild(script); }
    script.addEventListener('load', mount); mount();
    const reset = () => { if (widgetId.current) window.turnstile?.reset(widgetId.current); };
    window.addEventListener('stratus:reset-turnstile', reset);
    return () => { disposed = true; script?.removeEventListener('load', mount); window.removeEventListener('stratus:reset-turnstile', reset); if (widgetId.current) window.turnstile?.remove(widgetId.current); widgetId.current = undefined; };
  }, [siteKey]);
  return <div className="account-turnstile" ref={container} aria-label={label}/>;
}

declare global {
  interface Window { turnstile?: { render: (node: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void }; }
}

function base64ToBuffer(value?: string): ArrayBuffer {
  if (!value) return new ArrayBuffer(0);
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}
function bufferToBase64(value: ArrayBuffer): string {
  let binary = '';
  new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function registrationOptions(payload: unknown): PublicKeyCredentialCreationOptions {
  const root = payload as Record<string, unknown>;
  const outer = (root.options || payload) as Record<string, unknown>;
  const options = (outer.publicKey || outer.PublicKey || outer) as Record<string, any>;
  return { ...options, challenge: base64ToBuffer(options.challenge), user: { ...options.user, id: base64ToBuffer(options.user?.id) }, excludeCredentials: Array.isArray(options.excludeCredentials) ? options.excludeCredentials.map((item: Record<string, unknown>) => ({ ...item, id: base64ToBuffer(String(item.id || '')) })) : undefined } as PublicKeyCredentialCreationOptions;
}
function assertionOptions(payload: unknown): PublicKeyCredentialRequestOptions {
  const root = payload as Record<string, unknown>;
  const outer = (root.options || payload) as Record<string, unknown>;
  const options = (outer.publicKey || outer.PublicKey || outer) as Record<string, any>;
  return { ...options, challenge: base64ToBuffer(options.challenge), allowCredentials: Array.isArray(options.allowCredentials) ? options.allowCredentials.map((item: Record<string, unknown>) => ({ ...item, id: base64ToBuffer(String(item.id || '')) })) : undefined } as PublicKeyCredentialRequestOptions;
}
function totpAccountDetails(uri: string | undefined, username: string | undefined, fallbackUser = 'пользователь') {
  if (!uri) return { issuer: 'Stratus Hub', account: username || fallbackUser };
  try {
    const parsed = new URL(uri);
    const label = decodeURIComponent(parsed.pathname.split(':').pop() || '');
    return { issuer: parsed.searchParams.get('issuer') || 'Stratus Hub', account: label || username || fallbackUser };
  } catch {
    return { issuer: 'Stratus Hub', account: username || fallbackUser };
  }
}
function credentialPayload(credential: PublicKeyCredential, registration: boolean) {
  const response = credential.response as AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
  const common = { id: credential.id, rawId: bufferToBase64(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment, clientExtensionResults: credential.getClientExtensionResults() };
  return registration ? { ...common, response: { attestationObject: bufferToBase64((response as AuthenticatorAttestationResponse).attestationObject), clientDataJSON: bufferToBase64(response.clientDataJSON) } } : { ...common, response: { authenticatorData: bufferToBase64((response as AuthenticatorAssertionResponse).authenticatorData), clientDataJSON: bufferToBase64(response.clientDataJSON), signature: bufferToBase64((response as AuthenticatorAssertionResponse).signature), userHandle: (response as AuthenticatorAssertionResponse).userHandle ? bufferToBase64((response as AuthenticatorAssertionResponse).userHandle!) : null } };
}

export function SecuritySettings() {
  const { language } = useWorkspaceLocale();
  const c = settingsCopyFor(language);
  const client = useQueryClient();
  const { self, status } = useFreshQueries();
  const twoFa = useQuery({ queryKey: twoFaKey, queryFn: fetchTwoFA, staleTime: 0, refetchOnMount: 'always' });
  const passkey = useQuery({ queryKey: passkeyKey, queryFn: fetchPasskey, staleTime: 0, refetchOnMount: 'always' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [totp, setTotp] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [showPasskeyRemove, setShowPasskeyRemove] = useState(false);
  const [copied, setCopied] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const totpDetails = totpAccountDetails(setup?.qr_code_data, self.data?.username, c.userFallback);
  const setSuccess = (text: string) => { setNotice(text); setError(false); };
  const setFailure = (reason: unknown) => { setNotice(reason instanceof Error ? reason.message : c.genericActionFailed); setError(true); };
  const refreshSecurity = async () => { await Promise.all([client.invalidateQueries({ queryKey: twoFaKey }), client.invalidateQueries({ queryKey: passkeyKey })]); };
  const enableMutation = useMutation({ mutationFn: () => request<unknown>('/api/user/2fa/enable', { method: 'POST', body: JSON.stringify({ code: totp.trim() }) }), onSuccess: async () => { setSetup(null); setTotp(''); setSuccess('Двухэтапная проверка включена.'); await refreshSecurity(); }, onError: setFailure });
  const disableMutation = useMutation({ mutationFn: () => request<unknown>('/api/user/2fa/disable', { method: 'POST', body: JSON.stringify({ code: disableCode.trim() }) }), onSuccess: async () => { setDisableCode(''); setShowDisable(false); setSuccess('Двухэтапная проверка отключена.'); await refreshSecurity(); }, onError: setFailure });
  const createTwoFASetup = async () => {
    setSetupBusy(true); setNotice(''); setError(false);
    try {
      const data = await request<SetupData>('/api/user/2fa/setup', { method: 'POST', body: '{}' });
      setSetup(data);
      setSuccess('Ключ создан. Сохраните резервные коды до включения двухэтапной проверки.');
    } catch (reason) { setFailure(reason); }
    finally { setSetupBusy(false); }
  };
  const regenerateBackupCodes = async () => {
    setRegenerateBusy(true); setNotice(''); setError(false);
    try {
      const result = await request<{ backup_codes: string[] }>('/api/user/2fa/backup_codes', { method: 'POST', body: JSON.stringify({ code: regenCode.trim() }) });
      setSetup({ secret: '', backup_codes: result.backup_codes });
      setShowRegenerate(false); setRegenCode('');
      setSuccess('Новые резервные коды созданы. Предыдущие коды больше не действуют.');
      await refreshSecurity();
    } catch (reason) { setFailure(reason); }
    finally { setRegenerateBusy(false); }
  };
  const secureVerify = async (method: '2fa' | 'passkey', codeValue = '') => request<unknown>('/api/verify', { method: 'POST', body: JSON.stringify({ method, ...(codeValue ? { code: codeValue } : {}) }) });
  const verifyPasskey = async () => {
    const start = await request<{ options: unknown }>('/api/user/passkey/verify/begin', { method: 'POST', body: '{}' });
    const credential = await navigator.credentials.get({ publicKey: assertionOptions(start.options) });
    if (!(credential instanceof PublicKeyCredential)) throw new Error('Проверка ключом доступа отменена.');
    await request<unknown>('/api/user/passkey/verify/finish', { method: 'POST', body: JSON.stringify(credentialPayload(credential, false)) });
    await secureVerify('passkey');
  };
  const prove = async (method: '2fa' | 'passkey', codeValue: string) => {
    if (method === '2fa') await secureVerify(method, codeValue.trim());
    else await verifyPasskey();
  };
  const registerPasskey = async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    setNotice(''); setError(false);
    try {
      if (!navigator.credentials || !window.PublicKeyCredential) throw new Error('Этот браузер не поддерживает ключи доступа.');
      if (twoFa.data?.enabled) { await prove('2fa', verifyCode); setVerifyCode(''); }
      const begin = await request<{ options: unknown }>('/api/user/passkey/register/begin', { method: 'POST', body: '{}' });
      const credential = await navigator.credentials.create({ publicKey: registrationOptions(begin.options) });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('Создание ключа доступа отменено.');
      await request<unknown>('/api/user/passkey/register/finish', { method: 'POST', body: JSON.stringify(credentialPayload(credential, true)) });
      setSuccess('Ключ доступа зарегистрирован.'); await refreshSecurity();
    } catch (reason) { setFailure(reason); }
    finally { setPasskeyBusy(false); }
  };
  const removePasskey = async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    setNotice(''); setError(false);
    try {
      await prove(twoFa.data?.enabled ? '2fa' : 'passkey', verifyCode);
      await request<unknown>('/api/user/passkey', { method: 'DELETE' });
      setShowPasskeyRemove(false); setVerifyCode(''); setSuccess('Ключ доступа удалён.'); await refreshSecurity();
    } catch (reason) { setFailure(reason); }
    finally { setPasskeyBusy(false); }
  };
  const copyCodes = async () => { if (!setup?.backup_codes.length) return; try { await navigator.clipboard.writeText(setup.backup_codes.join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setFailure(new Error(c.copyCodesFailed)); } };
  const downloadCodes = () => { if (!setup?.backup_codes.length) return; const blob = new Blob([`${c.backupFileTitle}\n${c.backupFileAdvice}\n\n${setup.backup_codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'stratus-backup-codes.txt'; anchor.click(); URL.revokeObjectURL(url); };
  const clearSecretData = () => { setSetup(null); setTotp(''); setDisableCode(''); setRegenCode(''); setVerifyCode(''); };
  const loading = self.isLoading || status.isLoading || twoFa.isLoading || passkey.isLoading;
  const pageError = self.isError || status.isError || twoFa.isError || passkey.isError;
  return <SettingsTextTree language={language}><Frame>
    {loading && <section className="account-card" role="status"><div className="account-loading"/><p className="account-copy" style={{ marginTop: 12 }}>Проверяем настройки безопасности…</p></section>}
    {pageError && <div className="account-alert error" role="alert">Не удалось получить свежий статус безопасности. <button type="button" className="account-btn secondary" onClick={() => { void Promise.all([self.refetch(), status.refetch(), twoFa.refetch(), passkey.refetch()]); }}>Повторить</button></div>}
    <Notice text={notice} error={error} language={language}/>
    {twoFa.data?.locked && <div className="account-alert error" role="alert">Проверка 2FA временно заблокирована после неудачных попыток. Подождите и обновите статус, прежде чем повторять действие.</div>}
    {!loading && !pageError && <div className="account-grid"><main className="account-main">
      <section className="account-card"><div className="account-label">Защита входа</div><h2>Двухэтапная проверка</h2><p className="account-copy">Используйте приложение-аутентификатор. Резервный код пригодится, если устройство потеряно.</p><div className="account-row" style={{ marginTop: 14 }}><span className="account-status"><span className={`account-dot ${twoFa.data?.enabled ? '' : 'off'}`}/>{twoFa.data?.enabled ? 'Включена' : 'Не настроена'}</span>{twoFa.data?.enabled && <span className="account-hint">{twoFa.data.backup_codes_remaining ?? 0} резервных кодов осталось</span>}</div>
        {!twoFa.data?.enabled && !setup && <div className="account-row" style={{ marginTop: 14 }}><button className="account-btn" type="button" disabled={setupBusy} onClick={() => void createTwoFASetup()}><ShieldCheck size={14}/>{setupBusy ? 'Создаём секрет…' : 'Настроить 2FA'}</button></div>}
        {setup && <div className="account-alert" role="region" aria-label="Секрет настройки и резервные коды">
          {setup.secret && <><strong>{c.authenticatorSecret}</strong><p className="account-copy">{c.authenticatorPrefix}<b>{totpDetails.issuer}</b>{c.authenticatorAccountDivider}<b>{totpDetails.account}</b>{c.authenticatorSuffix}</p><div className="account-secret" style={{ marginTop: 9 }}>{setup.secret}</div></>}
          <strong style={{ display: 'block', marginTop: 14 }}>Резервные коды · показываются только сейчас</strong><div className="account-codes">{setup.backup_codes.map((item, index) => <code key={`${index}-${item}`}>{item}</code>)}</div><p className="account-copy">Скачайте файл и храните его отдельно. После закрытия этой страницы повторно показать эти коды нельзя.</p><div className="account-row" style={{ marginTop: 10 }}><button type="button" className="account-btn secondary" onClick={() => void copyCodes()}><Copy size={14}/>{copied ? 'Скопировано' : 'Скопировать'}</button><button type="button" className="account-btn secondary" onClick={downloadCodes}><Download size={14}/>Скачать файл</button></div>
          {setup.secret && <form className="account-form" onSubmit={(event) => { event.preventDefault(); enableMutation.mutate(); }}><div className="account-field"><label htmlFor="totp-code">Код из приложения</label><input id="totp-code" className="account-input" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} placeholder="6 цифр"/></div><div className="account-row"><button className="account-btn" disabled={enableMutation.isPending || !totp.trim()}>{enableMutation.isPending ? 'Проверяем…' : 'Включить защиту'}</button><button className="account-btn secondary" type="button" onClick={() => { if (window.confirm(c.closeSetupConfirm)) clearSecretData(); }}>Отмена</button></div></form>}
          {!setup.secret && <button className="account-btn secondary" type="button" style={{ marginTop: 10 }} onClick={() => clearSecretData()}>Скрыть коды</button>}
        </div>}
        {twoFa.data?.enabled && <div className="account-form">
          {showRegenerate ? <div className="account-alert"><strong>Создать новые резервные коды?</strong><p className="account-copy">Все прежние коды сразу перестанут работать. Сохраните новые коды после подтверждения.</p><div className="account-field" style={{ marginTop: 10 }}><label htmlFor="regen-code">Код приложения</label><input id="regen-code" className="account-input" inputMode="numeric" autoComplete="one-time-code" value={regenCode} onChange={(e) => setRegenCode(e.target.value)}/></div><div className="account-row" style={{ marginTop: 10 }}><button type="button" className="account-btn" disabled={!regenCode.trim() || regenerateBusy} onClick={() => { if (window.confirm(c.replaceCodesConfirm)) void regenerateBackupCodes(); }}>{regenerateBusy ? 'Создаём…' : 'Заменить коды'}</button><button type="button" className="account-btn secondary" onClick={() => { setShowRegenerate(false); setRegenCode(''); }}>Отмена</button></div></div> : <button type="button" className="account-btn secondary" onClick={() => setShowRegenerate(true)}><RefreshCw size={14}/>Обновить резервные коды</button>}
          {showDisable ? <div className="account-alert error"><strong>Отключить двухэтапную проверку?</strong><p className="account-copy">Это снизит защиту аккаунта. Подтвердите кодом приложения или резервным кодом. Действие необратимо без повторной настройки.</p><div className="account-field" style={{ marginTop: 10 }}><label htmlFor="disable-code">Код приложения или резервный код</label><input id="disable-code" className="account-input" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} autoComplete="one-time-code"/></div><div className="account-row" style={{ marginTop: 10 }}><button type="button" className="account-btn danger" disabled={!disableCode.trim() || disableMutation.isPending} onClick={() => { if (window.confirm(c.confirmDisablePermanently)) disableMutation.mutate(); }}>{disableMutation.isPending ? 'Отключаем…' : 'Подтвердить отключение'}</button><button type="button" className="account-btn secondary" onClick={() => { setShowDisable(false); setDisableCode(''); }}>Отмена</button></div></div> : <button type="button" className="account-btn secondary" onClick={() => setShowDisable(true)}>Отключить 2FA</button>}
        </div>}
      </section>
      <section className="account-card"><div className="account-label">Без пароля</div><h2>Ключ доступа (Passkey)</h2><p className="account-copy">Используйте встроенный ключ устройства или аппаратный ключ с поддержкой WebAuthn. Для регистрации при включённой 2FA потребуется свежий код.</p><div className="account-row" style={{ marginTop: 14 }}><span className="account-status"><span className={`account-dot ${passkey.data?.enabled ? '' : 'off'}`}/>{passkey.data?.enabled ? 'Ключ зарегистрирован' : 'Ключ не добавлен'}</span>{passkey.data?.last_used_at && <span className="account-hint">Использован: {new Date(passkey.data.last_used_at).toLocaleString(workspaceLocale(language))}</span>}</div>
        {twoFa.data?.enabled && <div className="account-field" style={{ marginTop: 14 }}><label htmlFor="passkey-proof">Код приложения для подтверждения</label><input id="passkey-proof" className="account-input" inputMode="numeric" autoComplete="one-time-code" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Нужен при включённой 2FA"/></div>}
        {!status.data?.passkey_login && <p className="account-hint">Регистрация ключей доступа отключена администратором.</p>}
        {(!window.PublicKeyCredential || !navigator.credentials) && <p className="account-hint">Этот браузер не поддерживает ключи доступа. Используйте совместимый браузер через HTTPS.</p>}
        <div className="account-row" style={{ marginTop: 14 }}>{!passkey.data?.enabled && <button className="account-btn" type="button" onClick={() => void registerPasskey()} disabled={passkeyBusy || !status.data?.passkey_login || !window.PublicKeyCredential || !navigator.credentials || Boolean(twoFa.data?.enabled && !verifyCode.trim())}><KeyRound size={14}/>{passkeyBusy ? 'Ожидаем ключ…' : 'Добавить ключ доступа'}</button>}{passkey.data?.enabled && !showPasskeyRemove && <button className="account-btn danger" type="button" disabled={passkeyBusy} onClick={() => setShowPasskeyRemove(true)}>Удалить Passkey</button>}</div>
        {showPasskeyRemove && <div className="account-alert error" style={{ marginTop: 14 }}><strong>Удалить ключ доступа?</strong><p className="account-copy">Операция необратима. {twoFa.data?.enabled ? 'Подтвердите её кодом 2FA.' : 'Сначала подтвердите владение существующим Passkey.'}</p>{!twoFa.data?.enabled && <p className="account-copy">Браузер запросит зарегистрированный ключ доступа после нажатия.</p>}<div className="account-row" style={{ marginTop: 10 }}><button type="button" className="account-btn danger" disabled={passkeyBusy || Boolean(twoFa.data?.enabled && !verifyCode.trim())} onClick={() => { if (window.confirm(c.confirmDeletePasskey)) void removePasskey(); }}>{passkeyBusy ? 'Проверяем…' : 'Подтвердить удаление'}</button><button type="button" className="account-btn secondary" disabled={passkeyBusy} onClick={() => setShowPasskeyRemove(false)}>Отмена</button></div></div>}
      </section>
    </main><aside className="account-aside"><div className="account-aside-card"><strong>Секреты не сохраняются</strong><p>Пароли, TOTP-секреты, коды подтверждения и WebAuthn-ответы не попадают в localStorage или query cache. Настройка 2FA хранится только в состоянии этой страницы.</p></div><div className="account-aside-card"><strong>Проверка на 5 минут</strong><p>Для чувствительных действий сервер требует свежую проверку личности. Passkey или 2FA подтверждают её в текущей сессии.</p></div><button className="account-btn secondary" type="button" onClick={() => { clearSecretData(); void Promise.all([twoFa.refetch(), passkey.refetch(), self.refetch(), status.refetch()]); }}>Обновить статус</button></aside></div>}
  </Frame></SettingsTextTree>;
}
