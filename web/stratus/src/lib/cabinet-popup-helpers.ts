import type { WalletInfo, WalletQuote } from './wallet';

export function normalizeWalletInfo(value: unknown): WalletInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Сервер вернул некорректные способы оплаты.');
  }
  const source = value as Partial<WalletInfo>;
  // Go encodes an empty nil slice as null; malformed/missing fields are not an empty list.
  if (source.methods !== null && !Array.isArray(source.methods)) {
    throw new Error('Сервер вернул некорректный список способов оплаты.');
  }
  const methods = source.methods ?? [];
  if (!methods.every((method) =>
    !!method && typeof method.id === 'string' && !!method.id.trim()
    && typeof method.name === 'string'
    && Number.isSafeInteger(method.min_usd) && method.min_usd > 0
    && Number.isSafeInteger(method.max_usd) && method.max_usd >= method.min_usd
    && Array.isArray(method.amount_options)
    && method.amount_options.every((amount) => Number.isSafeInteger(amount) && amount > 0)
    && (method.notice == null || typeof method.notice === 'string')
    && (method.disabled_reason == null || typeof method.disabled_reason === 'string')
    && (method.min_amount_rub == null || (Number.isSafeInteger(method.min_amount_rub) && method.min_amount_rub >= 100))
    && (!method.product || (typeof method.product.name === 'string'
      && Number.isFinite(method.product.price) && method.product.price >= 0
      && typeof method.product.currency === 'string'
      && Number.isFinite(method.product.quota) && method.product.quota >= 0))
    && (method.quantity_kind == null || method.quantity_kind === 'packs')
  )) throw new Error('Данные способа оплаты неполные или не поддерживаются.');
  return {
    methods,
    redemption: source.redemption === true,
    topup_link: typeof source.topup_link === 'string' ? source.topup_link : '',
  };
}

export function walletQuotePayload(method: WalletInfo['methods'][number], quantity: number) {
  return method.quantity_kind === 'packs'
    ? { method: method.id, amount_rub: quantity }
    : { method: method.id, usd: quantity };
}

export function isValidWalletQuote(value: unknown): value is WalletQuote {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const quote = value as Partial<WalletQuote>;
  return typeof quote.money === 'string'
    && /^\d+(?:\.\d+)?$/.test(quote.money) && Number.isFinite(Number(quote.money)) && Number(quote.money) > 0
    && typeof quote.currency === 'string' && !!quote.currency.trim()
    && typeof quote.credited_quota === 'number'
    && Number.isSafeInteger(quote.credited_quota) && quote.credited_quota > 0
    && (quote.payment_rub == null || (typeof quote.payment_rub === 'number' && Number.isFinite(quote.payment_rub) && quote.payment_rub > 0))
    && (quote.bonus_percent == null || (typeof quote.bonus_percent === 'number' && Number.isFinite(quote.bonus_percent) && quote.bonus_percent >= 0 && quote.bonus_percent <= 70))
    && (quote.equivalent_rub == null || (typeof quote.equivalent_rub === 'number' && Number.isFinite(quote.equivalent_rub) && quote.equivalent_rub > 0))
    && (quote.effective_rate_rub == null || (typeof quote.effective_rate_rub === 'number' && Number.isFinite(quote.effective_rate_rub) && quote.effective_rate_rub > 0))
    && typeof quote.pay_path === 'string'
    && !!quote.pay_path
    && !!quote.payload && typeof quote.payload === 'object' && !Array.isArray(quote.payload);
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameWalletQuote(a: WalletQuote, b: WalletQuote): boolean {
  return a.money === b.money
    && a.currency === b.currency
    && a.credited_quota === b.credited_quota
    && a.payment_rub === b.payment_rub
    && a.bonus_percent === b.bonus_percent
    && a.equivalent_rub === b.equivalent_rub
    && a.effective_rate_rub === b.effective_rate_rub
    && a.pay_path === b.pay_path
    && stableValue(a.payload) === stableValue(b.payload);
}

export function buildReferralUrl(origin: string, pathPrefix: string, code: string): string {
  const prefix = pathPrefix.replace(/\/+$/, '');
  return `${origin.replace(/\/+$/, '')}${prefix}/register?aff=${encodeURIComponent(code)}`;
}
