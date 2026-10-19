import { buildUsageAnalytics } from './usage-analytics';
import type { UsageRange, UsageRow } from './usage';

export function formatCabinetTokens(
  tokens: number | null,
  locale = 'ru-RU',
  tokenLabel = 'токенов',
  unavailable = 'Недоступно',
): string {
  return tokens === null || !Number.isFinite(tokens)
    ? unavailable
    : `${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(tokens)} ${tokenLabel}`;
}

export function summarizeCabinetUsage(rows: UsageRow[], range: UsageRange, quotaPerUnit: number) {
  return buildUsageAnalytics(rows, range, quotaPerUnit).summary;
}
