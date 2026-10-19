import { TOKEN_ECONOMY } from './token-economy';
import type { WorkspaceLanguage } from './workspace-copy';

export function rublesToUsd(rubles: number): number | null {
  if (!Number.isFinite(rubles)) return null;
  return rubles / TOKEN_ECONOMY.usdToRub;
}

export function usdToRubles(usd: number): number | null {
  if (!Number.isFinite(usd) || usd < 0) return null;
  const rubles = Math.round(usd * TOKEN_ECONOMY.usdToRub);
  return Number.isSafeInteger(rubles) ? rubles : null;
}

export function rublesToUsdInput(rubles: number): string {
  const usd = rublesToUsd(rubles);
  if (usd === null || usd < 0) return '';
  const cents = Math.round(usd * 100);
  return (cents / 100).toFixed(2);
}

export function formatUsdAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPaymentMoney(
  amount: number | string,
  currency: string,
  language: WorkspaceLanguage,
  locale: string,
): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);
  const normalizedCurrency = currency.trim().toUpperCase();
  if (language === 'en' && Number.isFinite(numericAmount)) {
    if (normalizedCurrency === 'RUB' || normalizedCurrency === '₽') {
      return formatUsdAmount(numericAmount / TOKEN_ECONOMY.usdToRub, locale);
    }
    if (normalizedCurrency === 'USD' || normalizedCurrency === '$') {
      return formatUsdAmount(numericAmount, locale);
    }
  }
  return `${amount} ${currency}`;
}
