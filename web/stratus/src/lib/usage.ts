import { quotaToWalletTokens } from './token-economy';

export type UsagePeriod = '24h' | '7d' | '14d' | '29d' | '30d';
export type UsageRange = { start: number; end: number; step: number; buckets: number; bucketStart?: number };
export type UsageRow = {
  created_at: number;
  model_name?: string;
  quota: number;
  count: number;
  token_used: number;
};
export type UsagePoint = {
  timestamp: number;
  quota: number;
  requests: number;
  usageTokens: number;
  walletTokens: number | null;
};

export function getUsageRange(period: UsagePeriod, now = Date.now()): UsageRange {
  if (!Number.isFinite(now) || now < 0) throw new Error('Некорректное время статистики.');
  const end = Math.floor(now / 1000);
  const step = period === '24h' ? 3600 : 86400;
  const buckets = period === '24h' ? 24 : period === '7d' ? 7 : period === '14d' ? 14
    : period === '29d' ? 29 : period === '30d' ? 30 : 0;
  if (!buckets) throw new Error('Неизвестный период статистики.');
  return { start: Math.floor(end / step) * step - (buckets - 1) * step, end, step, buckets };
}

export function normalizeUsageRows(value: unknown): UsageRow[] {
  // A nil Go slice is encoded as null when there is no recorded usage.
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error('Сервер вернул некорректную статистику потребления.');
  return value.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Некорректная запись статистики.');
    const item = row as Record<string, unknown>;
    for (const key of ['created_at', 'quota', 'count', 'token_used']) {
      if (typeof item[key] !== 'number' || !Number.isSafeInteger(item[key]) || item[key] < 0) {
        throw new Error('Статистика содержит некорректные числовые значения.');
      }
    }
    return {
      created_at: item.created_at as number,
      quota: item.quota as number,
      count: item.count as number,
      token_used: item.token_used as number,
      ...(typeof item.model_name === 'string' ? { model_name: item.model_name } : {}),
    };
  });
}

export function buildUsageSeries(rows: UsageRow[], range: UsageRange, quotaPerUsd: number): UsagePoint[] {
  const bucketStart = range.bucketStart ?? range.start;
  const points: UsagePoint[] = Array.from({ length: range.buckets }, (_, index) => ({
    timestamp: bucketStart + index * range.step, quota: 0, requests: 0, usageTokens: 0, walletTokens: null,
  }));
  for (const row of rows) {
    if (row.created_at < range.start || row.created_at > range.end) continue;
    const index = Math.min(Math.floor((row.created_at - bucketStart) / range.step), range.buckets - 1);
    const point = points[index];
    if (!point) continue;
    point.quota += row.quota;
    point.requests += row.count;
    point.usageTokens += row.token_used;
    if (![point.quota, point.requests, point.usageTokens].every(Number.isSafeInteger)) {
      throw new Error('Статистика превышает точность числового расчёта.');
    }
  }
  return points.map((point) => ({ ...point, walletTokens: quotaToWalletTokens(point.quota, quotaPerUsd) }));
}

export function summarizeUsage(points: UsagePoint[]) {
  const summary = points.reduce<{ quota: number; requests: number; usageTokens: number; walletTokens: number | null }>(
    (total, point) => ({
      quota: total.quota + point.quota,
      requests: total.requests + point.requests,
      usageTokens: total.usageTokens + point.usageTokens,
      walletTokens: total.walletTokens === null || point.walletTokens === null ? null : total.walletTokens + point.walletTokens,
    }),
    { quota: 0, requests: 0, usageTokens: 0, walletTokens: 0 },
  );
  if (![summary.quota, summary.requests, summary.usageTokens].every(Number.isSafeInteger)) {
    throw new Error('Итоги статистики превышают точность числового расчёта.');
  }
  return summary;
}
