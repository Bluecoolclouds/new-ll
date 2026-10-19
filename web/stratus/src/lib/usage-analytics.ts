import {
  buildUsageSeries, summarizeUsage,
  type UsagePeriod, type UsageRange, type UsageRow,
} from './usage';

export type UsageGranularity = 'hour' | 'day' | 'week';
export type UsageSelection = {
  period: UsagePeriod | 'custom';
  granularity: UsageGranularity;
  start?: number;
  end?: number;
};

export const MAX_USAGE_WINDOW_SECONDS = 30 * 86400;
const steps: Record<UsageGranularity, number> = { hour: 3600, day: 86400, week: 604800 };
const periodDays: Record<UsagePeriod, number> = { '24h': 1, '7d': 7, '14d': 14, '29d': 29, '30d': 30 };

/**
 * Query boundaries and bucket boundaries are deliberately distinct. A weekly
 * bucket may start before the selected date, but must never widen the API query.
 */
export function getAnalyticsRange(selection: UsageSelection, now = Date.now()): UsageRange {
  if (!Number.isFinite(now) || now < 0) throw new Error('Некорректное время статистики.');
  if (!Object.hasOwn(steps, selection.granularity)) throw new Error('Неизвестная группировка статистики.');
  if (selection.period !== 'custom' && !Object.hasOwn(periodDays, selection.period)) {
    throw new Error('Неизвестный период статистики.');
  }
  const step = steps[selection.granularity];
  const nowSeconds = Math.floor(now / 1000);
  const presetBuckets = selection.period !== 'custom' && selection.granularity !== 'week'
    ? periodDays[selection.period] * 86400 / step : null;
  const window = selection.period === 'custom'
    ? { start: selection.start, end: selection.end }
    : { start: nowSeconds - periodDays[selection.period] * 86400, end: nowSeconds };
  const { start, end } = window;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start === undefined || end === undefined || start <= 0 || end <= start) {
    throw new Error('Укажите корректные даты: начало должно быть раньше конца периода.');
  }
  if (end - start > MAX_USAGE_WINDOW_SECONDS) {
    throw new Error('Период статистики не может превышать 30 дней.');
  }
  if (end > Math.floor(now / 1000)) throw new Error('Конец периода не может быть в будущем.');
  // Unix epoch was a Thursday. This offset anchors weeks on Monday 00:00 UTC.
  const offset = selection.granularity === 'week' ? 3 * 86400 : 0;
  // Preset queries keep identical start/end timestamps across granularities;
  // their daily/hourly bins are rolling intervals anchored to the range start.
  const bucketStart = presetBuckets !== null ? start : Math.floor((start + offset) / step) * step - offset;
  const buckets = presetBuckets ?? Math.floor((end - bucketStart) / step) + 1;
  return { start, end, step, buckets, bucketStart };
}

/** datetime-local inputs are explicitly interpreted as UTC, never browser time. */
export function parseUsageUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(milliseconds)) return null;
  if (new Date(milliseconds).toISOString().slice(0, 16) !== value) return null;
  return Math.floor(milliseconds / 1000);
}

export function formatUsageUtc(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error('Некорректная дата статистики.');
  return new Date(seconds * 1000).toISOString().slice(0, 16);
}

function isInRange(row: UsageRow, range: UsageRange) {
  return row.created_at >= range.start && row.created_at <= range.end;
}

export function getUsageModelNames(rows: UsageRow[], range: UsageRange): string[] {
  return [...new Set(rows.filter((row) => isInRange(row, range)).map((row) => row.model_name ?? ''))]
    .sort((a, b) => a.localeCompare(b));
}

export function buildUsageAnalytics(
  rows: UsageRow[], range: UsageRange, quotaPerUnit: number, selectedModels?: readonly string[],
) {
  const selected = selectedModels === undefined ? null : new Set(selectedModels);
  const groups = new Map<string, UsageRow[]>();
  const filtered: UsageRow[] = [];
  for (const row of rows) {
    if (!isInRange(row, range)) continue;
    const model = row.model_name ?? '';
    if (selected && !selected.has(model)) continue;
    const group = groups.get(model);
    if (group) group.push(row);
    else groups.set(model, [row]);
    filtered.push(row);
  }
  const points = buildUsageSeries(filtered, range, quotaPerUnit);
  const models = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, modelRows]) => {
      const modelPoints = buildUsageSeries(modelRows, range, quotaPerUnit);
      return { model, points: modelPoints, summary: summarizeUsage(modelPoints) };
    });
  return { points, summary: summarizeUsage(points), models };
}

export type UsageAnalytics = ReturnType<typeof buildUsageAnalytics>;

/** Both API endpoints are inclusive: shift by the number of included seconds. */
export function getPreviousUsageRange(range: UsageRange): UsageRange {
  const duration = range.end - range.start + 1;
  const end = range.start - 1;
  const start = end - duration + 1;
  if (start <= 0 || duration <= 0 || duration - 1 > MAX_USAGE_WINDOW_SECONDS) {
    throw new Error('Не удалось определить предыдущий период статистики.');
  }
  const offset = range.step === steps.week ? 3 * 86400 : 0;
  const bucketStart = Math.floor((start + offset) / range.step) * range.step - offset;
  return { start, end, step: range.step, bucketStart, buckets: Math.floor((end - bucketStart) / range.step) + 1 };
}

export function compareUsageValue(current: number | null, previous: number | null) {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  const percent = previous === 0 ? (current === 0 ? 0 : null) : delta / previous * 100;
  if (!Number.isFinite(delta) || (percent !== null && !Number.isFinite(percent))) return null;
  return { current, previous, delta, percent };
}
