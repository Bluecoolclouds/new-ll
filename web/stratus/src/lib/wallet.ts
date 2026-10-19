import { request, requestPayment } from './api';
import { basePath } from './routes';
import { paymentPendingKey } from './wallet-return';
export { paymentPendingKey } from './wallet-return';

export type WalletInfo = {
  methods: {
    id: string; name: string; min_usd: number; max_usd: number; amount_options: number[];
    notice?: string; disabled_reason?: string; quantity_kind?: 'packs'; min_amount_rub?: number;
    product?: { name: string; price: number; currency: string; quota: number };
  }[];
  redemption: boolean;
  topup_link: string;
};
export type WalletQuote = {
  money: string; currency: string; credited_quota: number;
  pay_path: string; payload: Record<string, unknown>; notice?: string;
  payment_rub?: number; bonus_percent?: number; equivalent_rub?: number; effective_rate_rub?: number;
};

export function parseWalletInfo(value: unknown): WalletInfo {
  const invalid = () => new Error('Некорректный ответ сервера способов оплаты.');
  const object = (item: unknown): item is Record<string, unknown> =>
    !!item && typeof item === 'object' && !Array.isArray(item);
  if (!object(value) || typeof value.redemption !== 'boolean' || typeof value.topup_link !== 'string') throw invalid();
  // Older servers encode an empty Go slice as null.
  const methods = value.methods === null ? [] : value.methods;
  if (!Array.isArray(methods)) throw invalid();
  for (const method of methods) {
    if (!object(method) || typeof method.id !== 'string' || !method.id ||
        typeof method.name !== 'string' || !Number.isSafeInteger(method.min_usd) ||
        !Number.isSafeInteger(method.max_usd) || !Array.isArray(method.amount_options) ||
        !method.amount_options.every((amount) => Number.isSafeInteger(amount)) ||
        (method.quantity_kind !== undefined && method.quantity_kind !== 'packs') ||
        (method.min_amount_rub !== undefined && (typeof method.min_amount_rub !== 'number' || !Number.isSafeInteger(method.min_amount_rub) || method.min_amount_rub < 100)) ||
        (method.notice !== undefined && typeof method.notice !== 'string') ||
        (method.disabled_reason !== undefined && typeof method.disabled_reason !== 'string')) throw invalid();
    if (method.product != null) {
      const product = method.product;
      if (!object(product) || typeof product.name !== 'string' ||
          typeof product.price !== 'number' || !Number.isFinite(product.price) ||
          typeof product.currency !== 'string' || !Number.isSafeInteger(product.quota)) throw invalid();
    }
  }
  return { methods: methods as WalletInfo['methods'], redemption: value.redemption, topup_link: value.topup_link };
}

export async function loadWalletInfo(): Promise<WalletInfo> {
  return parseWalletInfo(await request<unknown>('/api/user/topup/stratus/info'));
}

const paymentPaths = new Set([
  '/api/user/pay', '/api/user/stripe/pay', '/api/user/waffo/pay',
  '/api/user/waffo-pancake/pay', '/api/user/creem/pay',
  '/api/user/freekassa/pay', '/api/user/heleket/pay',
  '/api/user/pally/pay', '/api/user/plategal/pay', '/api/user/topup/stratus/pay',
]);

export function safeCheckoutUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Сервер не вернул ссылку на оплату.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Некорректная ссылка оплаты.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Небезопасная ссылка оплаты.');
  }
  return url.href;
}

export async function startWalletPayment(quote: WalletQuote): Promise<void> {
  if (!paymentPaths.has(quote.pay_path)) throw new Error('Неподдерживаемый платёжный маршрут.');
  const body = await requestPayment(quote.pay_path, quote.payload);
  const data = body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некорректный ответ создания платежа.');
  const result = data as Record<string, unknown>;
  const remember = () => {
    // A local marker is only a navigation aid, never proof of payment.
    try { sessionStorage.setItem(paymentPendingKey, JSON.stringify({ wallet: `${basePath}/wallet`, at: Date.now() })); } catch { /* navigation still works without browser storage */ }
  };
  const link = result.pay_link ?? result.checkout_url ?? result.payment_url;
  if (link) {
    const url = safeCheckoutUrl(link);
    remember();
    window.location.assign(url);
    return;
  }
  // Epay returns its form action beside data, not inside it.
  if (quote.pay_path === '/api/user/pay' && body.url) {
    const url = safeCheckoutUrl(body.url);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    for (const [name, value] of Object.entries(result)) {
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Некорректные поля платёжной формы.');
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    }
    document.body.appendChild(form);
    remember();
    // Named fields such as "submit" must not shadow the native method.
    HTMLFormElement.prototype.submit.call(form);
    return;
  }
  throw new Error('Сервер не вернул ссылку или форму оплаты. Проверьте историю заказов перед повтором.');
}
