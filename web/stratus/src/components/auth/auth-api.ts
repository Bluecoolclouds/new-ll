import {
  finishAuth,
  getAuthRedirect,
  safeAuthRedirect,
} from '../../lib/auth-session';
import { authApiLanguage, readAuthLanguage } from '../../lib/auth-copy';

export type AuthStatus = Record<string, unknown> & {
  setup?: boolean;
  system_name?: string;
  register_enabled?: boolean;
  password_register_enabled?: boolean;
  password_login_enabled?: boolean;
  email_verification?: boolean;
  turnstile_check?: boolean;
  turnstile_site_key?: string;
  passkey_login?: boolean;
  github_oauth?: boolean;
  github_client_id?: string;
  discord_oauth?: boolean;
  discord_client_id?: string;
  oidc_enabled?: boolean;
  oidc_client_id?: string;
  oidc_authorization_endpoint?: string;
  linuxdo_oauth?: boolean;
  linuxdo_client_id?: string;
  telegram_oauth?: boolean;
  telegram_bot_name?: string;
  wechat_login?: boolean;
  wechat_qrcode?: string;
  custom_oauth_providers?: Array<{
    id: number; name: string; slug: string; icon?: string; client_id: string;
    authorization_endpoint: string; scopes?: string;
  }>;
  user_agreement_enabled?: boolean;
  privacy_policy_enabled?: boolean;
  oauth_register_enabled?: boolean;
  self_use_mode_enabled?: boolean;
};

export type AuthUser = Record<string, unknown> & { id?: number; username?: string };
export type AuthResult<T = unknown> = { success?: boolean; message?: string; data?: T } & Record<string, unknown>;

async function authRequest<T = AuthResult>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Accept-Language', authApiLanguage(readAuthLanguage()));
  headers.set('Cache-Control', 'no-store');
  if (init.body) headers.set('Content-Type', 'application/json');
  const userId = getStoredUserId();
  if (userId) headers.set('New-Api-User', userId);
  const response = await fetch(path, { ...init, headers, credentials: 'include', cache: 'no-store' });
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String((body as AuthResult).message || '') : '';
    throw new Error(message || `Ошибка сервера (${response.status})`);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Сервер вернул некорректный ответ.');
  return body as T;
}

function getStoredUserId(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const storage = window.localStorage;
  const uid = storage.getItem('uid');
  if (uid && /^\d+$/.test(uid)) return uid;

  const savedUser = storage.getItem('user');
  if (!savedUser) return null;
  try {
    const user = JSON.parse(savedUser) as { id?: unknown };
    if (typeof user.id === 'number' && Number.isSafeInteger(user.id) && user.id > 0) {
      return String(user.id);
    }
    if (typeof user.id === 'string' && /^\d+$/.test(user.id)) return user.id;
  } catch {
    return null;
  }
  return null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const result = await authRequest<AuthResult<AuthStatus>>('/api/status');
  if (result.success === false) throw new Error(result.message || 'Не удалось загрузить настройки входа.');
  return (result.data && typeof result.data === 'object' ? result.data : result) as AuthStatus;
}

function requireSuccess<T>(result: AuthResult<T>): T | undefined {
  if (result.success !== true) throw new Error(result.message || 'Не удалось выполнить запрос.');
  return result.data;
}

export async function passwordLogin(username: string, password: string, turnstile = '') {
  const result = await authRequest<AuthResult<{ require_2fa?: boolean } | AuthUser>>(
    `/api/user/login?turnstile=${encodeURIComponent(turnstile)}`,
    { method: 'POST', body: JSON.stringify({ username, password }) },
  );
  const data = requireSuccess(result);
  if (data && typeof data === 'object' && 'require_2fa' in data && data.require_2fa) return { requires2FA: true as const };
  if (!data || typeof data !== 'object') throw new Error('В ответе не найден аккаунт.');
  return { requires2FA: false as const, user: data as AuthUser };
}

export async function completeTwoFactor(code: string) {
  const response = await authRequest<AuthResult<AuthUser>>('/api/user/login/2fa', {
    method: 'POST', body: JSON.stringify({ code }),
  });
  const user = requireSuccess(response);
  if (!user || typeof user !== 'object') throw new Error('Не удалось подтвердить вход.');
  return user;
}

export async function registerAccount(payload: {
  username: string; password: string; email?: string; verification_code?: string; aff_code?: string; turnstile?: string;
}) {
  const response = await authRequest<AuthResult>(`/api/user/register?turnstile=${encodeURIComponent(payload.turnstile || '')}`, {
    method: 'POST', body: JSON.stringify(payload),
  });
  requireSuccess(response);
}

export async function sendEmailCode(email: string, turnstile = '') {
  const response = await authRequest<AuthResult>(`/api/verification?email=${encodeURIComponent(email)}&turnstile=${encodeURIComponent(turnstile)}`);
  requireSuccess(response);
}

export async function sendResetEmail(email: string, turnstile = '') {
  const response = await authRequest<AuthResult>(`/api/reset_password?email=${encodeURIComponent(email)}&turnstile=${encodeURIComponent(turnstile)}`);
  requireSuccess(response);
}

export async function resetGeneratedPassword(email: string, token: string): Promise<string> {
  const response = await authRequest<AuthResult<string>>('/api/user/reset', {
    method: 'POST', body: JSON.stringify({ email, token }),
  });
  const password = requireSuccess(response);
  if (typeof password !== 'string' || !password) throw new Error('Сервер не вернул новый пароль.');
  return password;
}

export async function getLegalText(kind: 'user-agreement' | 'privacy-policy'): Promise<string> {
  const response = await authRequest<AuthResult<string>>(`/api/${kind}`);
  const content = requireSuccess(response);
  if (typeof content !== 'string') throw new Error('Текст документа недоступен.');
  return content;
}

export async function oauthState(): Promise<string> {
  const aff = localStorage.getItem('aff') || '';
  const response = await authRequest<AuthResult<string>>(`/api/oauth/state${aff ? `?aff=${encodeURIComponent(aff)}` : ''}`);
  const state = requireSuccess(response);
  if (typeof state !== 'string' || !state) throw new Error('Не удалось подготовить безопасный вход.');
  return state;
}

export async function startOAuth(provider: string, clientId: string, endpoint?: string, scopes?: string, popup?: Window | null) {
  const logout = await authRequest<AuthResult>('/api/user/logout');
  requireSuccess(logout);
  const state = await oauthState();
  sessionStorage.setItem('stratus-auth-redirect', safeAuthRedirect(getAuthRedirect(), '/dashboard'));
  if (provider === 'linuxdo') {
    const url = new URL('https://connect.linux.do/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', `${window.location.origin}/api/oauth/linuxdo`);
    if (!popup || popup.closed) throw new Error('Разрешите открытие окна входа LinuxDO и попробуйте ещё раз.');
    popup.location.assign(url.toString());
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (popup.closed) throw new Error('Окно входа LinuxDO было закрыто.');
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        const user = readLinuxDOCallback(popup);
        if (user) {
          popup.close();
          const target = sessionStorage.getItem('stratus-auth-redirect') || getAuthRedirect();
          sessionStorage.removeItem('stratus-auth-redirect');
          finishAuth(user, safeAuthRedirect(target, '/dashboard'));
          return;
        }
      }
      throw new Error('Время ожидания входа LinuxDO истекло.');
    } catch (error) {
      popup.close();
      sessionStorage.removeItem('stratus-auth-redirect');
      throw error;
    }
  }
  const callback = `${window.location.origin}/oauth/${encodeURIComponent(provider)}`;
  let url: URL;
  if (provider === 'github') {
    url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('scope', 'user:email');
  } else if (provider === 'discord') {
    url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('redirect_uri', callback);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify openid');
  } else {
    if (!endpoint) throw new Error('Для этого провайдера не настроен адрес входа.');
    url = new URL(endpoint);
    url.searchParams.set('redirect_uri', callback);
    url.searchParams.set('response_type', 'code');
    if (provider === 'oidc') url.searchParams.set('scope', scopes || 'openid profile email');
    else if (scopes) url.searchParams.set('scope', scopes);
  }
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  window.location.assign(url.toString());
}

function readLinuxDOCallback(popup: Window): AuthUser | null {
  try {
    const callbackUrl = new URL(popup.location.href);
    if (
      callbackUrl.origin !== window.location.origin ||
      callbackUrl.pathname !== '/api/oauth/linuxdo'
    ) {
      return null;
    }
    const responseText = popup.document.body?.textContent?.trim();
    if (!responseText) return null;

    let response: AuthResult<AuthUser>;
    try {
      response = JSON.parse(responseText) as AuthResult<AuthUser>;
    } catch {
      throw new Error('Сервер вернул некорректный ответ LinuxDO.');
    }
    if (response.success !== true) {
      throw new Error(response.message || 'Не удалось выполнить вход через LinuxDO.');
    }
    const user = response.data;
    if (
      !user ||
      typeof user !== 'object' ||
      typeof user.id !== 'number' ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0
    ) {
      throw new Error('В ответе LinuxDO не найден аккаунт.');
    }
    return user;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'SecurityError') {
      return null;
    }
    throw error;
  }
}

export async function finishOAuth(provider: string, code: string, state: string, redirect?: string) {
  const result = await authRequest<AuthResult<AuthUser>>(
    `/api/oauth/${encodeURIComponent(provider)}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  );
  const user = requireSuccess(result);
  if (result.message === 'bind') throw new Error('Этот вход предназначен для привязки аккаунта.');
  const target = redirect || sessionStorage.getItem('stratus-auth-redirect') || getAuthRedirect();
  sessionStorage.removeItem('stratus-auth-redirect');
  if (user && typeof user === 'object') {
    finishAuth(user, safeAuthRedirect(target, '/dashboard'));
    return;
  }
  const self = await authRequest<AuthResult<AuthUser>>('/api/user/self');
  const selfUser = requireSuccess(self);
  if (!selfUser || typeof selfUser !== 'object') throw new Error('Не удалось подтвердить созданную сессию.');
  finishAuth(selfUser, safeAuthRedirect(target, '/dashboard'));
}

function decodeCredentialOptions(payload: unknown): PublicKeyCredentialRequestOptions {
  const root = payload as Record<string, unknown>;
  const outer = (root.options || payload) as Record<string, unknown>;
  const options = (outer.publicKey || outer.PublicKey || outer.response || outer.Response || outer) as Record<string, unknown>;
  return {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge as string),
    allowCredentials: Array.isArray(options.allowCredentials)
      ? (options.allowCredentials as Array<Record<string, unknown>>).map((item) => ({ ...item, id: base64UrlToArrayBuffer(item.id as string) }))
      : undefined,
  } as PublicKeyCredentialRequestOptions;
}

export async function loginWithPasskey() {
  if (!navigator.credentials || !window.PublicKeyCredential) throw new Error('Этот браузер не поддерживает вход с ключом доступа.');
  const begin = await authRequest<AuthResult<unknown>>('/api/user/passkey/login/begin', { method: 'POST', body: '{}' });
  const options = decodeCredentialOptions(requireSuccess(begin));
  const credential = await navigator.credentials.get({ publicKey: options });
  if (!(credential instanceof PublicKeyCredential)) throw new Error('Вход с ключом доступа отменён.');
  const assertion = credential.response as AuthenticatorAssertionResponse;
  const payload = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      authenticatorData: arrayBufferToBase64Url(assertion.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
      signature: arrayBufferToBase64Url(assertion.signature),
      userHandle: assertion.userHandle ? arrayBufferToBase64Url(assertion.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  const finish = await authRequest<AuthResult<AuthUser>>('/api/user/passkey/login/finish', {
    method: 'POST', body: JSON.stringify(payload),
  });
  const user = requireSuccess(finish);
  if (!user || typeof user !== 'object') throw new Error('Ключ доступа не вернул аккаунт.');
  return user;
}

const base64UrlToArrayBuffer = (value: string | undefined): ArrayBuffer => {
  if (!value) return new ArrayBuffer(0);
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer;
};

const arrayBufferToBase64Url = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let raw = '';
  bytes.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};
