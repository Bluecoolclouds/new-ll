import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  completeTwoFactor, finishOAuth, getAuthStatus, getLegalText, loginWithPasskey,
  passwordLogin, registerAccount, resetGeneratedPassword,
  sendEmailCode, sendResetEmail, startOAuth,
  type AuthStatus,
} from './auth-api';
import { authUrl, finishAuth, getAuthRedirect, safeAuthRedirect } from '../../lib/auth-session';
import { request, type SelfUser } from '../../lib/api';
import { authApiLanguage, localizeAuthError } from '../../lib/auth-copy';
import { AuthLanguageProvider, AuthLanguageSwitch, useAuthLanguage } from './auth-locale';
import './auth.css';

declare global {
  interface Window { turnstile?: { render: (node: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void }; onStratusTelegramAuth?: (data: Record<string, string>) => void }
}

const redirectFromLocation = () => new URLSearchParams(window.location.search).get('redirect') || getAuthRedirect();
const authLink = (path: string, redirect = redirectFromLocation()) => authUrl(path, redirect);
function Brand() {
  return <a className="auth-brand" href={authUrl('/')} aria-label="Stratus Hub"><span className="auth-brand-mark">s</span><span>stratus<span style={{ fontWeight: 500 }}> / hub</span></span></a>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  const { copy: c } = useAuthLanguage();
  return <main className="auth-page">
    <aside className="auth-aside">
      <Brand />
      <div className="auth-orbit" aria-hidden="true"><span className="auth-orbit-core">API / 01</span></div>
      <div className="auth-aside-copy">
        <span className="auth-kicker">{c.asideKicker}</span>
        <h1>{c.asideTitleFirst}<br/>{c.asideTitleSecond}</h1>
        <p>{c.asideBody}</p>
      </div>
      <div className="auth-aside-foot">{c.asideFoot}</div>
    </aside>
    <section className="auth-main"><div className="auth-card">
      <div className="auth-card-head"><div className="auth-mobile-brand"><Brand /></div><AuthLanguageSwitch/></div>
      {children}
    </div></section>
  </main>;
}

function StatusFrame({ children }: { children: (status: AuthStatus) => ReactNode }) {
  const { language, copy: c } = useAuthLanguage();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true); setError('');
    getAuthStatus().then(setStatus).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  return <AuthFrame>
    {loading ? <div aria-live="polite"><div className="auth-kicker">{c.authKicker}</div><h2 style={{ marginTop: 14 }}>{c.connecting}</h2><p className="auth-intro">{c.loadingAuthSettings}</p><div className="auth-success" style={{ opacity: .55 }}>{c.checkingAuthMethods}</div></div>
      : error ? <><div className="auth-kicker">{c.authKicker}</div><h2 style={{ marginTop: 14 }}>{c.openSignInFailed}</h2><p className="auth-intro">{c.serverConnection}</p><div className="auth-error" role="alert">{localizeAuthError(error, language, c.serverSettingsError)}</div><button className="auth-button" style={{ marginTop: 16 }} onClick={load}>{c.retry}</button></>
      : status ? children(status) : null}
  </AuthFrame>;
}

function TurnstileField({ status, onToken }: { status: AuthStatus; onToken: (token: string) => void }) {
  const { copy: c } = useAuthLanguage();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const enabled = Boolean(status.turnstile_check && status.turnstile_site_key);
  useEffect(() => {
    if (!enabled || !container.current) return;
    let disposed = false;
    const render = () => {
      if (!disposed && window.turnstile && container.current && !widgetId.current) {
        setLoadError(false);
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: status.turnstile_site_key,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
          theme: 'light',
        });
      }
    };
    const reset = () => {
      onToken('');
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-stratus-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.stratusTurnstile = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    const failed = () => setLoadError(true);
    script.addEventListener('error', failed);
    window.addEventListener('stratus:reset-turnstile', reset);
    render();
    const interval = window.setInterval(render, 250);
    return () => {
      disposed = true; window.clearInterval(interval); script?.removeEventListener('load', render); script?.removeEventListener('error', failed);
      window.removeEventListener('stratus:reset-turnstile', reset);
      if (widgetId.current) { window.turnstile?.remove(widgetId.current); widgetId.current = undefined; }
      onToken('');
    };
  }, [enabled, status.turnstile_site_key]);
  if (!enabled) return null;
  return <div className="auth-turnstile" ref={container} aria-label={c.securityCheck}>
    {loadError && <span className="auth-error" role="alert">{c.captchaLoadError}</span>}
  </div>;
}

function LegalConsent({ status, checked, onChange }: { status: AuthStatus; checked: boolean; onChange: (value: boolean) => void }) {
  const { language, copy: c } = useAuthLanguage();
  const [documentKind, setDocumentKind] = useState<'user-agreement' | 'privacy-policy' | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasTerms = Boolean(status.user_agreement_enabled);
  const hasPrivacy = Boolean(status.privacy_policy_enabled);
  const open = async (kind: 'user-agreement' | 'privacy-policy') => {
    setDocumentKind(kind); setDocumentText(''); setDocumentError(''); setLoading(true);
    try { setDocumentText(await getLegalText(kind)); } catch (error) { setDocumentError(localizeAuthError(error instanceof Error ? error.message : '', language, c.documentLoadError)); } finally { setLoading(false); }
  };
  if (!hasTerms && !hasPrivacy) return null;
  return <>
    <div className="auth-legal"><input id="auth-legal-consent" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <div><label htmlFor="auth-legal-consent">{c.consentPrefix}</label>{hasTerms && <button className="auth-inline-button" type="button" onClick={() => void open('user-agreement')}>{c.terms}</button>}{hasTerms && hasPrivacy ? c.conjunction : ''}{hasPrivacy && <button className="auth-inline-button" type="button" onClick={() => void open('privacy-policy')}>{c.privacy}</button>}.</div>
    </div>
    {documentKind && <div className="auth-legal-dialog" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDocumentKind(null); }}>
      <section className="auth-legal-panel" role="dialog" aria-modal="true" aria-labelledby="auth-document-title">
        <h3 id="auth-document-title">{documentKind === 'user-agreement' ? c.terms : c.privacy}</h3>
        <div className="auth-legal-content" aria-live="polite">{loading ? c.loadingDocument : documentError ? <span role="alert">{documentError}</span> : documentText || c.documentUnavailable}</div>
        <button className="auth-button" onClick={() => setDocumentKind(null)}>{c.close}</button>
      </section>
    </div>}
  </>;
}

function ProviderOptions({ status, onWeChat, disabled = false }: { status: AuthStatus; onWeChat?: () => void; disabled?: boolean }) {
  const { language, copy: c } = useAuthLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);
  const standard: Array<{ key: string; name: string; mark: string; enabled?: unknown; id?: unknown; endpoint?: unknown; scopes?: string }> = [
    { key: 'github', name: 'GitHub', mark: 'GH', enabled: status.github_oauth, id: status.github_client_id },
    { key: 'discord', name: 'Discord', mark: 'D', enabled: status.discord_oauth, id: status.discord_client_id },
    { key: 'oidc', name: 'OpenID Connect', mark: 'ID', enabled: status.oidc_enabled, id: status.oidc_client_id, endpoint: status.oidc_authorization_endpoint },
    { key: 'linuxdo', name: 'LinuxDO', mark: 'L', enabled: status.linuxdo_oauth, id: status.linuxdo_client_id },
  ];
  const providers = standard.filter((item) => item.enabled && item.id);
  const custom = (status.custom_oauth_providers || []).filter((provider) => provider.client_id && provider.authorization_endpoint);
  const has = providers.length || custom.length || (status.wechat_login && onWeChat) || status.telegram_oauth;
  if (!has) return null;
  const launch = async (provider: string, clientId: string, endpoint?: string, scopes?: string) => {
    setBusy(true); setError('');
    const popup = provider === 'linuxdo' ? window.open('about:blank', 'stratus-linuxdo', 'popup,width=520,height=700') : undefined;
    try { await startOAuth(provider, clientId, endpoint, scopes, popup); } catch (reason) { popup?.close(); setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.providerStartError)); setBusy(false); }
  };
  const telegram = () => {
    if (!status.telegram_bot_name) { setError(c.telegramNotConfigured); return; }
    setTelegramLoading(true); setError('');
    window.onStratusTelegramAuth = async (data) => {
      try {
        const query = new URLSearchParams(data);
        const response = await fetch(`/api/oauth/telegram/login?${query}`, { credentials: 'include', headers: { Accept: 'application/json', 'Accept-Language': authApiLanguage(language) } });
        const body = await response.json() as { success?: boolean; message?: string; data?: Record<string, unknown> };
        if (!response.ok || !body.success || !body.data) throw new Error(localizeAuthError(body.message || '', language, c.telegramLoginError));
        finishAuth(body.data, safeAuthRedirect(redirectFromLocation(), '/dashboard'));
      } catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.telegramConfirmError)); setTelegramLoading(false); }
    };
    const script = document.createElement('script');
    script.async = true; script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.dataset.telegramLogin = status.telegram_bot_name;
    script.dataset.size = 'large'; script.dataset.userpic = 'false';
    script.dataset.onauth = 'onStratusTelegramAuth(user)';
    script.dataset.requestAccess = 'write';
    const wrapper = document.getElementById('stratus-telegram-widget');
    wrapper?.replaceChildren(script);
  };
  return <div>
    <div className="auth-divider"><span>{c.providerDivider}</span></div>
    <div className="auth-provider-grid">
      {providers.map((item) => <button key={item.key} className="auth-provider" disabled={busy || disabled} onClick={() => void launch(item.key, String(item.id), item.endpoint as string | undefined)}><span className="auth-provider-mark">{item.mark}</span>{item.name}</button>)}
      {custom.map((item) => <button key={item.slug} className="auth-provider" disabled={busy || disabled} onClick={() => void launch(item.slug, item.client_id, item.authorization_endpoint, item.scopes)}><span className="auth-provider-mark">{item.icon || item.name.slice(0, 1)}</span>{item.name}</button>)}
      {status.wechat_login && onWeChat && <button className="auth-provider" disabled={disabled} onClick={onWeChat}><span className="auth-provider-mark">W</span>WeChat</button>}
      {status.telegram_oauth && <button className="auth-provider" disabled={telegramLoading || disabled} onClick={telegram}><span className="auth-provider-mark">TG</span>Telegram</button>}
    </div>
    <div id="stratus-telegram-widget" className="auth-turnstile" aria-live="polite" />
    {busy && <p className="auth-note" aria-live="polite">{c.providerRedirect}</p>}
    {error && <div className="auth-error" role="alert" style={{ marginTop: 10 }}>{localizeAuthError(error, language, c.providerStartError)}</div>}
  </div>;
}

function AuthTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <><p className="auth-eyebrow">{kicker}</p><h2>{title}</h2>{children && <p className="auth-intro">{children}</p>}</>;
}
function AuthFooter({ children }: { children: ReactNode }) { return <div className="auth-foot">{children}</div>; }
function ErrorLine({ error }: { error: string }) {
  const { language, copy: c } = useAuthLanguage();
  return error ? <div className="auth-error" role="alert">{localizeAuthError(error, language, c.serverError)}</div> : null;
}

export function SignInPage() {
  return <AuthLanguageProvider><SignInPageContent/></AuthLanguageProvider>;
}

function SignInPageContent() {
  return <StatusFrame>{(status) => <SignInForm status={status} />}</StatusFrame>;
}

function SignInForm({ status }: { status: AuthStatus }) {
  const { language, copy: c } = useAuthLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wechatCode, setWechatCode] = useState('');
  const [showWechat, setShowWechat] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const needsLegal = Boolean(status.user_agreement_enabled || status.privacy_policy_enabled);
  const passwordEnabled = status.password_login_enabled !== false;
  const alternatives = Boolean(
    passkeyAvailable || status.wechat_login || (status.telegram_oauth && status.telegram_bot_name) ||
    (status.github_oauth && status.github_client_id) || (status.discord_oauth && status.discord_client_id) ||
    (status.oidc_enabled && status.oidc_client_id && status.oidc_authorization_endpoint) ||
    (status.linuxdo_oauth && status.linuxdo_client_id) ||
    status.custom_oauth_providers?.some((provider) => provider.client_id && provider.authorization_endpoint),
  );
  useEffect(() => { setPasskeyAvailable(Boolean(status.passkey_login && window.PublicKeyCredential && navigator.credentials)); }, [status.passkey_login]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (needsLegal && !agreed) { setError(c.agreeToDocuments); return; }
    if (status.turnstile_check && status.turnstile_site_key && !turnstile) { setError(c.finishSecurityCheck); return; }
    setBusy(true);
    try {
      const result = await passwordLogin(username.trim(), password, turnstile);
      if (result.requires2FA) { window.location.assign(authUrl('/otp', redirectFromLocation())); return; }
      finishAuth(result.user, safeAuthRedirect(redirectFromLocation(), '/dashboard'));
    } catch (reason) {
      setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.signInError));
      if (status.turnstile_check && status.turnstile_site_key) window.dispatchEvent(new Event('stratus:reset-turnstile'));
      setBusy(false);
    }
  };
  const passkey = async () => {
    setError(''); setBusy(true);
    try { const user = await loginWithPasskey(); finishAuth(user, safeAuthRedirect(redirectFromLocation(), '/dashboard')); }
    catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.passkeyError)); setBusy(false); }
  };
  const wechat = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await fetch(`/api/oauth/wechat?code=${encodeURIComponent(wechatCode.trim())}`, { credentials: 'include', headers: { Accept: 'application/json', 'Accept-Language': authApiLanguage(language) } });
      const body = await result.json() as { success?: boolean; message?: string; data?: Record<string, unknown> };
      if (!result.ok || !body.success || !body.data) throw new Error(localizeAuthError(body.message || '', language, c.wechatError));
      finishAuth(body.data, safeAuthRedirect(redirectFromLocation(), '/dashboard'));
    } catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.wechatConfirmError)); setBusy(false); }
  };
  const wechatQr = String(status.wechat_qrcode || status.wechat_qr_code || status.wechat_qrcode_image_url || status.wechat_qr_code_image_url || status.wechat_account_qrcode_image_url || status.WeChatAccountQRCodeImageURL || '');
  return <>
    <AuthTitle kicker={c.signInKicker} title={c.welcomeBack}>{c.signInIntro}</AuthTitle>
    {!passwordEnabled && !alternatives && <div className="auth-error" role="status">{c.signInNotConfigured}</div>}
    {!passwordEnabled && <LegalConsent status={status} checked={agreed} onChange={setAgreed} />}
    {passwordEnabled && <form className="auth-form" onSubmit={submit}>
      <div className="auth-field"><label htmlFor="auth-username">{c.usernameOrEmail}</label><input id="auth-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus placeholder={c.usernamePlaceholder} /></div>
      <div className="auth-field"><div className="auth-row"><label htmlFor="auth-password">{c.password}</label><a href={authUrl('/forgot-password')}>{c.forgotPassword}</a></div><input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder={c.passwordPlaceholder} /></div>
      <LegalConsent status={status} checked={agreed} onChange={setAgreed} />
      <TurnstileField status={status} onToken={setTurnstile} />
      <ErrorLine error={error} />
      <button className="auth-button" disabled={busy || !username || !password || (needsLegal && !agreed) || (Boolean(status.turnstile_check && status.turnstile_site_key) && !turnstile)}>{busy ? <><span className="auth-spinner"/> {c.checking}</> : <>{c.signIn} <ArrowRight size={15}/></>}</button>
    </form>}
    {passkeyAvailable && <button className="auth-button secondary" style={{ marginTop: 12 }} disabled={busy || (needsLegal && !agreed)} onClick={() => void passkey()}><KeyRound size={16}/> {c.signInWithPasskey}</button>}
    {status.wechat_login && showWechat && <form className="auth-form" style={{ marginTop: 14 }} onSubmit={wechat}>{wechatQr && <img src={wechatQr} alt={c.qrCodeAlt} style={{ display: 'block', width: 150, height: 150, objectFit: 'contain', margin: '0 auto', borderRadius: 14, border: '1px solid var(--auth-line)', padding: 8, background: '#fff' }} />}<div className="auth-field"><label htmlFor="wechat-code">{c.wechatCode}</label><input id="wechat-code" value={wechatCode} onChange={(event) => setWechatCode(event.target.value)} required placeholder={c.wechatCodePlaceholder} /></div><button className="auth-button" disabled={busy || !wechatCode.trim()}>{c.confirmCode}</button><button type="button" className="auth-inline-button" onClick={() => setShowWechat(false)}>{c.backToSignInMethods}</button></form>}
    {!passwordEnabled && <ErrorLine error={error} />}
    <ProviderOptions status={status} onWeChat={showWechat ? undefined : () => setShowWechat(true)} disabled={needsLegal && !agreed} />
    <AuthFooter>
      {!status.self_use_mode_enabled && status.register_enabled !== false && <span>{c.noAccount} <a href={authLink('/sign-up')}>{c.createAccount}</a></span>}
      <a href={authUrl('/')}>{c.home}</a>
    </AuthFooter>
  </>;
}

export function SignUpPage() {
  return <AuthLanguageProvider><SignUpPageContent/></AuthLanguageProvider>;
}

function SignUpPageContent() {
  return <StatusFrame>{(status) => <SignUpForm status={status} />}</StatusFrame>;
}

function SignUpForm({ status }: { status: AuthStatus }) {
  const { language, copy: c } = useAuthLanguage();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verification, setVerification] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showWechat, setShowWechat] = useState(false);
  const [wechatCode, setWechatCode] = useState('');
  const [wait, setWait] = useState(0);
  const emailRequired = Boolean(status.email_verification);
  const unavailable = status.register_enabled === false || status.self_use_mode_enabled === true;
  const passwordRegistrationEnabled = status.password_register_enabled !== false;
  const oauthRegistrationEnabled = status.oauth_register_enabled !== false;
  const needsLegal = Boolean(status.user_agreement_enabled || status.privacy_policy_enabled);
  const wechatQr = String(status.wechat_qrcode || status.wechat_qr_code || status.wechat_qrcode_image_url || status.wechat_qr_code_image_url || status.wechat_account_qrcode_image_url || status.WeChatAccountQRCodeImageURL || '');
  useEffect(() => { if (wait <= 0) return; const timer = window.setTimeout(() => setWait((value) => value - 1), 1000); return () => window.clearTimeout(timer); }, [wait]);
  useEffect(() => { const aff = new URLSearchParams(window.location.search).get('aff'); if (aff) localStorage.setItem('aff', aff); }, []);
  const sendCode = async () => {
    setError('');
    if (!email.trim()) { setError(c.enterEmailForCode); return; }
    if (status.turnstile_check && status.turnstile_site_key && !turnstile) { setError(c.finishSecurityCheck); return; }
    setSendingCode(true);
    try { await sendEmailCode(email.trim(), turnstile); setSent(true); setWait(60); window.dispatchEvent(new Event('stratus:reset-turnstile')); }
    catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.sendCodeError)); window.dispatchEvent(new Event('stratus:reset-turnstile')); }
    finally { setSendingCode(false); }
  };
  const submitWechat = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/oauth/wechat?code=${encodeURIComponent(wechatCode.trim())}`, { credentials: 'include', headers: { Accept: 'application/json', 'Accept-Language': authApiLanguage(language) } });
      const body = await response.json() as { success?: boolean; message?: string; data?: Record<string, unknown> };
      if (!response.ok || !body.success || !body.data) throw new Error(localizeAuthError(body.message || '', language, c.wechatError));
      finishAuth(body.data, safeAuthRedirect(redirectFromLocation(), '/dashboard'));
    } catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.wechatConfirmError)); setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('');
    if (password.length < 8) { setError(c.passwordMinLength); return; }
    if (password !== confirm) { setError(c.passwordMismatch); return; }
    if (emailRequired && (!email.trim() || !verification.trim())) { setError(c.enterEmailAndCode); return; }
    if (needsLegal && !agreed) { setError(c.agreeToDocuments); return; }
    if (status.turnstile_check && status.turnstile_site_key && !turnstile) { setError(c.finishSecurityCheck); return; }
    setBusy(true);
    try {
      await registerAccount({ username: username.trim(), password, email: email.trim() || undefined, verification_code: verification || undefined, aff_code: localStorage.getItem('aff') || undefined, turnstile: turnstile || undefined });
      if (status.turnstile_check && status.turnstile_site_key) {
        setSuccess(c.accountCreatedStartAgain);
        setPassword('');
        setConfirm('');
        setBusy(false);
        return;
      }
      try {
        const result = await passwordLogin(username.trim(), password, turnstile);
        if (result.requires2FA) { window.location.assign(authUrl('/otp', redirectFromLocation())); return; }
        finishAuth(result.user, safeAuthRedirect(redirectFromLocation(), '/dashboard'));
      } catch {
        setSuccess(c.accountCreatedSignIn);
        setPassword('');
        setConfirm('');
        setBusy(false);
      }
    } catch (reason) {
      setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.createAccountError));
      if (status.turnstile_check && status.turnstile_site_key) window.dispatchEvent(new Event('stratus:reset-turnstile'));
      setBusy(false);
    }
  };
  if (unavailable || (!passwordRegistrationEnabled && !oauthRegistrationEnabled)) return <><AuthTitle kicker={c.signUpKicker} title={c.signUpUnavailableTitle}>{c.signUpUnavailableBody}</AuthTitle><AuthFooter><a href={authUrl('/sign-in')}>{c.returnToSignIn}</a></AuthFooter></>;
  return <>
    <AuthTitle kicker={c.signUpKicker} title={passwordRegistrationEnabled ? c.signUpStartTitle : c.signUpCreateTitle}>{passwordRegistrationEnabled ? c.signUpStartBody : c.signUpPasswordDisabledBody}</AuthTitle>
    {!passwordRegistrationEnabled && <LegalConsent status={status} checked={agreed} onChange={setAgreed} />}
    {passwordRegistrationEnabled && <>
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-field"><label htmlFor="register-username">{c.username}</label><input id="register-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={20} placeholder={c.usernameMinPlaceholder} /></div>
      <div className="auth-field"><label htmlFor="register-email">{c.email}{emailRequired ? '' : ` (${c.optional})`}</label><input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required={emailRequired} placeholder="you@example.com" /></div>
      {emailRequired && <div className="auth-field"><label htmlFor="register-code">{c.verificationCode}</label><div className="auth-row"><input id="register-code" style={{ flex: 1 }} inputMode="numeric" autoComplete="one-time-code" value={verification} onChange={(event) => setVerification(event.target.value)} required placeholder={c.emailCodePlaceholder} /><button type="button" className="auth-inline-button" disabled={sendingCode || wait > 0 || !email.trim()} onClick={() => void sendCode()}>{sendingCode ? c.sending : wait ? c.resendIn.replace('{seconds}', String(wait)) : sent ? c.sendAgain : c.getCode}</button></div></div>}
      <div className="auth-field"><label htmlFor="register-password">{c.password}</label><input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={20} placeholder={c.passwordLengthPlaceholder} /></div>
      <div className="auth-field"><label htmlFor="register-confirm">{c.repeatPassword}</label><input id="register-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required placeholder={c.passwordAgainPlaceholder} /></div>
      <LegalConsent status={status} checked={agreed} onChange={setAgreed} />
      <TurnstileField status={status} onToken={setTurnstile} />
      <ErrorLine error={error} />{success && <div className="auth-success" role="status">{localizeAuthError(success, language, c.accountCreatedSignIn)}</div>}
      <button className="auth-button" disabled={busy || !username.trim() || !password || !confirm || (needsLegal && !agreed) || (emailRequired && (!email.trim() || !verification.trim())) || (Boolean(status.turnstile_check && status.turnstile_site_key) && !turnstile)}>{busy ? <><span className="auth-spinner"/> {c.creatingAccount}</> : <>{c.createAccount} <ArrowRight size={15}/></>}</button>
    </form>
    </>}
    {(status.wechat_login && showWechat) && <form className="auth-form" style={{ marginTop: 14 }} onSubmit={submitWechat}>{wechatQr && <img src={wechatQr} alt={c.qrCodeAlt} style={{ display: 'block', width: 150, height: 150, objectFit: 'contain', margin: '0 auto', borderRadius: 14, border: '1px solid var(--auth-line)', padding: 8, background: '#fff' }} />}<div className="auth-field"><label htmlFor="register-wechat-code">{c.wechatCode}</label><input id="register-wechat-code" value={wechatCode} onChange={(event) => setWechatCode(event.target.value)} required placeholder={c.wechatCodePlaceholder} /></div><button className="auth-button" disabled={busy || !wechatCode.trim()}>{c.continueWithWechat}</button></form>}
    {oauthRegistrationEnabled && <ProviderOptions status={status} onWeChat={status.wechat_login ? () => setShowWechat(true) : undefined} disabled={needsLegal && !agreed} />}
    <AuthFooter><span>{c.alreadyRegistered} <a href={authLink('/sign-in')}>{c.signIn}</a></span></AuthFooter>
  </>;
}

export function ForgotPasswordPage() {
  return <AuthLanguageProvider><ForgotPasswordPageContent/></AuthLanguageProvider>;
}

function ForgotPasswordPageContent() {
  return <StatusFrame>{(status) => <ForgotForm status={status} />}</StatusFrame>;
}

function ForgotForm({ status }: { status: AuthStatus }) {
  const { language, copy: c } = useAuthLanguage();
  const [email, setEmail] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (status.turnstile_check && status.turnstile_site_key && !turnstile) { setError(c.finishSecurityCheck); return; }
    setBusy(true);
    try { await sendResetEmail(email.trim(), turnstile); setSent(true); }
    catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.sendEmailError)); }
    finally { setBusy(false); }
  };
  return <>
    <AuthTitle kicker={c.forgotKicker} title={c.resetPasswordTitle}>{c.forgotIntro}</AuthTitle>
    {sent ? <div className="auth-success" role="status">{c.resetEmailSent}</div>
      : <form className="auth-form" onSubmit={submit}>
        <div className="auth-field"><label htmlFor="reset-email">{c.accountEmail}</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></div>
        <TurnstileField status={status} onToken={setTurnstile} />
        <ErrorLine error={error} />
        <button className="auth-button" disabled={busy || !email.trim() || (Boolean(status.turnstile_check && status.turnstile_site_key) && !turnstile)}>{busy ? <><span className="auth-spinner"/> {c.sendingEmail}</> : <>{c.sendEmail} <ArrowRight size={15}/></>}</button>
      </form>}
    <AuthFooter><a href={authUrl('/sign-in')}><ArrowLeft size={12}/> {c.returnToSignIn}</a></AuthFooter>
  </>;
}

export function ResetPasswordConfirmPage() {
  return <AuthLanguageProvider><ResetPasswordConfirmPageContent/></AuthLanguageProvider>;
}

function ResetPasswordConfirmPageContent() {
  const { language, copy: c } = useAuthLanguage();
  const [resetLink] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { email: params.get('email') || '', token: params.get('token') || '' };
  });
  const { email, token } = resetLink;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const valid = Boolean(email && token);
  const submit = async () => {
    setError(''); setBusy(true);
    try {
      setPassword(await resetGeneratedPassword(email, token));
      window.history.replaceState(null, '', window.location.pathname);
      setRevealed(true);
    }
    catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.serverError)); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(password); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError(c.copyPasswordError); }
  };
  return <AuthFrame>
    <AuthTitle kicker={c.forgotKicker} title={revealed ? c.passwordUpdated : c.confirmReset}>{revealed ? c.passwordUpdatedIntro : c.resetLinkIntro}</AuthTitle>
    {!valid && <div className="auth-error" role="alert">{c.resetLinkInvalid}</div>}
    {valid && !revealed && <><div className="auth-field"><label htmlFor="reset-confirm-email">{c.account}</label><input id="reset-confirm-email" value={email} disabled /></div><button className="auth-button" style={{ marginTop: 18 }} disabled={busy} onClick={() => void submit()}>{busy ? <><span className="auth-spinner"/> {c.updating}</> : <><LockKeyhole size={15}/> {c.createNewPassword}</>}</button></>}
    {revealed && <><div className="auth-generated" aria-label={c.generatedPassword}>{password}</div><p className="auth-note">{c.copyPasswordNow}</p><button className="auth-button secondary" onClick={() => void copy()}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? c.copied : c.copyPassword}</button></>}
    <ErrorLine error={error} />
    <AuthFooter><a href={authUrl('/sign-in')}><ArrowLeft size={12}/> {c.backToSignIn}</a></AuthFooter>
  </AuthFrame>;
}

export function OtpPage() {
  return <AuthLanguageProvider><OtpPageContent/></AuthLanguageProvider>;
}

function OtpPageContent() {
  const { language, copy: c } = useAuthLanguage();
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const normalized = code.trim().replace(/-/g, '');
    if (backup ? normalized.length < 8 : !/^\d{6}$/.test(normalized)) { setError(backup ? c.invalidBackupCode : c.invalidOtp); return; }
    setBusy(true);
    try { const user = await completeTwoFactor(normalized); finishAuth(user, safeAuthRedirect(redirectFromLocation(), '/dashboard')); }
    catch (reason) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', language, c.invalidOtp)); setBusy(false); }
  };
  return <AuthFrame>
    <AuthTitle kicker={c.otpKicker} title={c.otpTitle}>{c.otpIntro}</AuthTitle>
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-field"><label htmlFor="otp-code">{backup ? c.backupCode : c.codePlaceholder}</label><input id="otp-code" autoFocus inputMode={backup ? 'text' : 'numeric'} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required placeholder={backup ? c.backupCodePlaceholder : c.otpPlaceholder} /></div>
      <ErrorLine error={error} />
      <button className="auth-button" disabled={busy || !code.trim()}>{busy ? <><span className="auth-spinner"/> {c.checking}</> : <>{c.confirm} <ShieldCheck size={15}/></>}</button>
    </form>
    <AuthFooter><button className="auth-inline-button" onClick={() => { setBackup(!backup); setCode(''); setError(''); }}>{backup ? c.useAuthenticatorCode : c.useBackupCode}</button><a href={authUrl('/sign-in')}>{c.startOver}</a></AuthFooter>
  </AuthFrame>;
}

export function OAuthCallbackPage({ provider }: { provider: string }) {
  return <AuthLanguageProvider><OAuthCallbackPageContent provider={provider}/></AuthLanguageProvider>;
}

function OAuthCallbackPageContent({ provider }: { provider: string }) {
  const { language, copy: c } = useAuthLanguage();
  const localeRef = useRef({ language, copy: c });
  localeRef.current = { language, copy: c };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || '';
    const state = params.get('state') || '';
    window.history.replaceState(null, '', window.location.pathname);
    if (!code) { setError(localizeAuthError(params.get('error_description') || params.get('error') || '', localeRef.current.language, localeRef.current.copy.providerDidNotSendCode)); setBusy(false); return; }
    finishOAuth(provider, code, state, params.get('redirect') || undefined)
      .catch((reason: unknown) => { if (active) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', localeRef.current.language, localeRef.current.copy.completeSignInError)); setBusy(false); } });
    return () => { active = false; };
  }, [provider]);
  return <div className="auth-callback"><div className="auth-card"><div className="auth-card-head"><Brand/><AuthLanguageSwitch/></div><div style={{ paddingTop: 46 }}><AuthTitle kicker={c.secureSignIn} title={error ? c.signInFailed : c.completingSignIn}>{error ? c.providerErrorIntro : c.providerResponseCheck}</AuthTitle>{busy && <div className="auth-success" role="status">{c.checkingAuthorization}</div>}<ErrorLine error={error}/>{error && <a className="auth-button" style={{ marginTop: 16, textDecoration: 'none' }} href={authUrl('/sign-in')}>{c.returnToSignIn}</a>}</div></div></div>;
}

export function OAuthLegacyPage() {
  return <AuthLanguageProvider><OAuthLegacyPageContent/></AuthLanguageProvider>;
}

function OAuthLegacyPageContent() {
  const { language, copy: c } = useAuthLanguage();
  const localeRef = useRef({ language, copy: c });
  localeRef.current = { language, copy: c };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || '';
    const provider = params.get('provider');
    const redirect = params.get('redirect');
    window.history.replaceState(null, '', window.location.pathname);
    const target = safeAuthRedirect(redirect || getAuthRedirect(), '/dashboard');
    (async () => {
      if (provider === 'wechat' && code) {
        const response = await fetch(`/api/oauth/wechat?code=${encodeURIComponent(code)}`, { credentials: 'include', headers: { Accept: 'application/json', 'Accept-Language': authApiLanguage(localeRef.current.language) } });
        const body = await response.json() as { success?: boolean; message?: string };
        if (!response.ok || !body.success) throw new Error(localizeAuthError(body.message || '', localeRef.current.language, localeRef.current.copy.completeWechatSignInError));
      }
      // The legacy callback may arrive without a code after the backend has already
      // established the session. Use the existing uid/header-aware self request to
      // verify that session rather than assuming an identity or fabricating an ID.
      const user = await request<SelfUser>('/api/user/self', {}, false);
      finishAuth(user as unknown as Record<string, unknown>, target);
    })().catch((reason: unknown) => {
      if (active) { setError(localizeAuthError(reason instanceof Error ? reason.message : '', localeRef.current.language, localeRef.current.copy.completeSignInError)); setBusy(false); }
    });
    return () => { active = false; };
  }, []);
  return <div className="auth-callback"><div className="auth-card"><div className="auth-card-head"><Brand/><AuthLanguageSwitch/></div><div style={{ paddingTop: 46 }}><AuthTitle kicker={c.secureSignIn} title={error ? c.signInFailed : c.completingSignIn}>{error ? c.providerRetryIntro : c.confirmSession}</AuthTitle>{busy && <div className="auth-success" role="status">{c.checkingAuthorization}</div>}<ErrorLine error={error}/>{error && <a className="auth-button" style={{ marginTop: 16, textDecoration: 'none' }} href={authUrl('/sign-in')}>{c.returnToSignIn}</a>}</div></div></div>;
}

