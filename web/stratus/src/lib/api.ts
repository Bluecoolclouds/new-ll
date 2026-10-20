import { authUrl } from './auth-session';
import { quotaToWalletTokens } from './token-economy';
import { readWorkspaceLanguage } from './workspace-copy';

export type ApiEnvelope<T> = { success: boolean; message?: string; data: T };
export type Page<T> = { page: number; page_size: number; total: number; items: T[] };
export type SelfUser = {
  id: number; username: string; display_name?: string; role: number; group: string;
  quota: number; used_quota: number; request_count: number; email?: string;
};
export type SystemStatus = {
  quota_per_unit: number;
  referral_topup_percent?: number;
  setup: boolean;
  quota_display_type?: 'USD' | 'CNY' | 'TOKENS' | 'CUSTOM';
  usd_exchange_rate?: number;
  custom_currency_symbol?: string;
  custom_currency_exchange_rate?: number;
  [key: string]: unknown;
};
export type ApiToken = {
  id: number; name: string; key: string; status: number; created_time: number;
  accessed_time: number; expired_time: number; remain_quota: number; used_quota: number;
  unlimited_quota: boolean; group: string;
  model_limits_enabled?: boolean; model_limits?: string;
  gateway_enabled?: boolean; gateway_profile?: 'cost' | 'ordered' | 'speed' | 'reliable';
  gateway_daily_limit?: number; gateway_monthly_limit?: number;
  gateway_warning_percent?: number; gateway_concurrency_limit?: number;
  gateway_daily_used?: number; gateway_monthly_used?: number; gateway_active_requests?: number;
};
export type UsageLog = {
  id: number; created_at: number; type: number; content: string; token_name: string;
  model_name: string; quota: number; prompt_tokens: number; completion_tokens: number;
  use_time: number; is_stream: boolean; group: string; request_id?: string;
};
export type PricingModel = {
  model_name: string; description?: string; owner_by: string; quota_type: number;
  model_ratio: number; model_price: number; completion_ratio: number;
  cache_ratio?: number | null; create_cache_ratio?: number | null; image_ratio?: number | null;
  audio_ratio?: number | null; audio_completion_ratio?: number | null;
  enable_groups: string[] | null; billing_mode?: string; billing_expr?: string;
  vendor_id?: number; supported_endpoint_types?: string[];
};
export type PricingVendor = { id: number; name: string; description?: string; icon?: string };
export type PricingResponse = {
  success: true;
  data: PricingModel[];
  vendors: PricingVendor[];
  group_ratio: Record<string, number>;
  usable_group: Record<string, string>;
  supported_endpoint?: Record<string, unknown>;
  auto_groups?: unknown;
  pricing_version?: string;
  [key: string]: unknown;
};

function userId(): string | null {
  try {
    const uid = localStorage.getItem('uid');
    if (uid) return uid;
    const stored = localStorage.getItem('user');
    if (stored) {
      const id = (JSON.parse(stored) as { id?: number }).id;
      return id ? String(id) : null;
    }
  } catch { /* malformed auth cache is not trusted */ }
  return null;
}

async function responseBody(path: string, init: RequestInit, redirectOnUnauthorized: boolean): Promise<Record<string, unknown>> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Stratus-Language', readWorkspaceLanguage());
  headers.set('Cache-Control', 'no-store');
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const uid = userId();
  if (uid) headers.set('New-Api-User', uid);
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  let body: unknown;
  try { body = await response.json(); }
  catch {
    if (response.ok) throw new Error('Некорректный ответ сервера: ожидался JSON.');
    body = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      const currentPath = window.location.pathname.replace(/^\/stratus(?=\/|$)/, '') || '/';
      const publicAuthPath = ['/sign-in', '/sign-up', '/login', '/register', '/forgot-password', '/reset', '/user/reset', '/reset-password-confirm', '/otp', '/oauth'].some((path) => currentPath === path || currentPath.startsWith(`${path}/`));
      if (redirectOnUnauthorized && !publicAuthPath) {
        window.location.replace(loginHref(window.location.pathname));
      }
      throw new Error('Сессия не активна. Войдите в аккаунт.');
    }
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message ?? '') : '';
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message ?? '') : '';
    throw new Error(message || errorMessage || `Ошибка сервера (${response.status})`);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Некорректный ответ сервера: ожидался JSON-объект.');
  }
  return body as Record<string, unknown>;
}

export async function request<T>(path: string, init: RequestInit = {}, redirectOnUnauthorized = true): Promise<T> {
  const body = await responseBody(path, init, redirectOnUnauthorized);
  if (typeof body.success === 'boolean') {
    if (!body.success) throw new Error(String(body.message || 'Не удалось выполнить запрос.'));
    return body.data as T;
  }
  return body as T;
}

export async function requestFormData<T>(path: string, body: FormData, redirectOnUnauthorized = true): Promise<T> {
  const response = await responseBody(path, { method: 'POST', body }, redirectOnUnauthorized);
  if (typeof response.success === 'boolean') {
    if (!response.success) throw new Error(String(response.message || 'Не удалось загрузить файл.'));
    return response.data as T;
  }
  return response as T;
}

export async function requestPricing(path: string): Promise<PricingResponse> {
  const body = await responseBody(path, {}, false);
  if (body.success !== true || !Array.isArray(body.data)) {
    throw new Error(String(body.message || 'Некорректный ответ каталога цен.'));
  }
  if (!body.group_ratio || typeof body.group_ratio !== 'object' || Array.isArray(body.group_ratio) ||
      !body.usable_group || typeof body.usable_group !== 'object' || Array.isArray(body.usable_group)) {
    throw new Error('Ответ каталога не содержит групповые коэффициенты.');
  }
  return body as unknown as PricingResponse;
}

export async function requestPayment(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body = await responseBody(path, { method: 'POST', body: JSON.stringify(payload) }, true);
  if (body.success === false || !(body.success === true || body.message === 'success')) {
    throw new Error(typeof body.data === 'string' ? body.data : String(body.message || 'Не удалось создать платёж.'));
  }
  return body;
}

const numberFormat = (maximumFractionDigits: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits, minimumFractionDigits: 0 });

export const formatBillingMoney = (usd: number, status?: SystemStatus) => {
  const display = status?.quota_display_type ?? 'USD';
  const precision = Math.abs(usd) < 1 ? 6 : 4;
  if (display === 'CNY') {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'CNY', maximumFractionDigits: precision })
      .format(usd * Math.max(status?.usd_exchange_rate ?? 1, 0.000001));
  }
  if (display === 'CUSTOM') {
    const symbol = status?.custom_currency_symbol?.trim() || '$';
    return `${symbol}${numberFormat(precision).format(usd * Math.max(status?.custom_currency_exchange_rate ?? 1, 0.000001))}`;
  }
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: precision }).format(usd);
};

export const formatQuotaMoney = (
  quota: number,
  quotaPerUnit: number,
  _status?: SystemStatus,
  locale = 'ru-RU',
  unavailable = locale === 'en-US' ? 'Unavailable' : 'Недоступно',
) => {
  const tokens = quotaToWalletTokens(quota, quotaPerUnit);
  const tokenLabel = locale === 'en-US' ? 'tokens' : 'токенов';
  return tokens === null ? unavailable : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(tokens)} ${tokenLabel}`;
};
export const formatTimestamp = (seconds: number, locale = 'ru-RU') => seconds > 0
  ? new Date(seconds * 1000).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  : '—';
export const loginHref = (pathname: string) => authUrl('/sign-in', pathname);
export async function logout(language: 'ru' | 'en' = 'ru') {
  try {
    await request<unknown>('/api/user/logout', { method: 'GET' }, false);
    for (const key of ['user', 'uid', 'userId', 'auth', 'auth-storage']) localStorage.removeItem(key);
    window.location.href = window.location.pathname.startsWith('/stratus') ? '/stratus' : '/';
  } catch {
    window.alert(language === 'en'
      ? 'Could not end the session on the server. Please try logging out again.'
      : 'Не удалось завершить сессию на сервере. Повторите выход.');
  }
}
