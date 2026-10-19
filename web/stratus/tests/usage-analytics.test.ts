import { describe, expect, test } from 'bun:test';
import {
  buildUsageAnalytics, formatUsageUtc, getAnalyticsRange, getUsageModelNames,
  parseUsageUtc, type UsageGranularity, type UsageSelection,
} from '../src/lib/usage-analytics';
import { type UsageRow } from '../src/lib/usage';
import { quotaToWalletTokens } from '../src/lib/token-economy';

const now = Date.parse('2026-10-17T12:34:56Z');
const seconds = (value: string) => Date.parse(value) / 1000;
const row = (model: string, created_at: number, quota = 100, count = 2, token_used = 50): UsageRow =>
  ({ model_name: model, created_at, quota, count, token_used });

describe('analytics range and UTC form contract', () => {
  test('supports every server preset without exceeding the server window', () => {
    for (const period of ['24h', '7d', '14d', '29d', '30d'] as const) {
      for (const granularity of ['hour', 'day', 'week'] as const) {
        const range = getAnalyticsRange({ period, granularity }, now);
        const periodSeconds = (period === '24h' ? 1 : Number.parseInt(period, 10)) * 86400;
        expect(range.end - range.start).toBeLessThanOrEqual(30 * 86400);
        expect(range.end - range.start).toBe(periodSeconds);
        expect(range.end).toBe(Math.floor(now / 1000));
        expect(range.buckets).toBeGreaterThan(0);
        expect(range.buckets).toBeLessThanOrEqual(721);
        if (granularity !== 'week') {
          const step = granularity === 'hour' ? 3600 : 86400;
          const expectedBuckets = periodSeconds / step;
          expect(range.buckets).toBe(expectedBuckets);
          expect(range.bucketStart).toBe(range.start);
        }
      }
    }
  });

  test('keeps custom query boundaries exact while aligning buckets', () => {
    const start = seconds('2026-10-14T10:30:00Z');
    const end = seconds('2026-10-17T11:15:00Z');
    const range = getAnalyticsRange({ period: 'custom', granularity: 'hour', start, end }, now);
    expect(range.start).toBe(start);
    expect(range.end).toBe(end);
    expect(range.bucketStart).toBe(seconds('2026-10-14T10:00:00Z'));
    expect(range.buckets).toBe(74);
  });

  test('weekly buckets start Monday UTC without expanding an exact 30-day query', () => {
    const end = Math.floor(now / 1000);
    const start = end - 30 * 86400;
    const range = getAnalyticsRange({ period: 'custom', granularity: 'week', start, end }, now);
    expect(range.start).toBe(start);
    expect(range.end - range.start).toBe(30 * 86400);
    expect(new Date(range.bucketStart! * 1000).getUTCDay()).toBe(1);
    expect(new Date(range.bucketStart! * 1000).getUTCHours()).toBe(0);
    expect(range.bucketStart).toBeLessThanOrEqual(start);
  });

  test('rejects missing, reversed, invalid, oversized and future dates', () => {
    const end = Math.floor(now / 1000);
    for (const input of [
      { start: undefined, end }, { start: NaN, end }, { start: 0, end },
      { start: end, end }, { start: end + 1, end }, { start: end - 1, end: Infinity },
      { start: end - 30 * 86400 - 1, end }, { start: end - 1000, end: end + 1 },
    ]) {
      expect(() => getAnalyticsRange({ period: 'custom', granularity: 'day', ...input }, now)).toThrow();
    }
    expect(() => getAnalyticsRange({ period: '7d', granularity: 'month' as UsageGranularity }, now)).toThrow();
    expect(() => getAnalyticsRange({ period: 'invalid', granularity: 'day' } as UsageSelection, now)).toThrow();
  });

  test('parses local-looking form values as UTC and rejects impossible dates', () => {
    expect(parseUsageUtc('2026-10-17T12:34')).toBe(seconds('2026-10-17T12:34:00Z'));
    expect(formatUsageUtc(seconds('2026-10-17T12:34:56Z'))).toBe('2026-10-17T12:34');
    for (const value of ['', '2026-02-30T12:00', '2026-13-01T00:00', '2026-10-17', '2026-10-17T24:10']) {
      expect(parseUsageUtc(value)).toBeNull();
    }
  });
});

describe('historical per-model consumption', () => {
  const range = getAnalyticsRange({ period: '7d', granularity: 'day' }, now);
  const rows = [
    row('model-b', seconds('2026-10-16T01:00:00Z'), 200, 4, 70),
    row('model-a', seconds('2026-10-16T02:00:00Z'), 300, 3, 80),
    row('model-a', seconds('2026-10-17T01:00:00Z'), 400, 5, 90),
    row('outside', range.start - 1, 9000, 9000, 9000),
    row('future', range.end + 1, 9000, 9000, 9000),
  ];

  test('discovers every in-range model, sorted and without invented names', () => {
    expect(getUsageModelNames(rows, range)).toEqual(['model-a', 'model-b']);
    expect(getUsageModelNames([{ created_at: range.start, quota: 0, count: 0, token_used: 0 }], range)).toEqual(['']);
  });

  test('aggregates all selected model series into exactly the same totals and intervals', () => {
    const result = buildUsageAnalytics(rows, range, 500000);
    expect(result.summary.quota).toBe(900);
    expect(result.summary.requests).toBe(12);
    expect(result.summary.usageTokens).toBe(240);
    expect(result.summary.walletTokens).toBeCloseTo(quotaToWalletTokens(900, 500000)!);
    expect(result.models.map((model) => model.model)).toEqual(['model-a', 'model-b']);
    for (let index = 0; index < result.points.length; index++) {
      expect(result.models.reduce((sum, model) => sum + model.points[index].quota, 0)).toBe(result.points[index].quota);
      expect(result.models.reduce((sum, model) => sum + model.points[index].requests, 0)).toBe(result.points[index].requests);
      expect(result.models.every((model) => model.points[index].timestamp === result.points[index].timestamp)).toBe(true);
    }
  });

  test('filters graph, totals, table points and ranking inputs by the same model set', () => {
    const result = buildUsageAnalytics(rows, range, 500000, ['model-a', 'model-a']);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].model).toBe('model-a');
    expect(result.summary.quota).toBe(700);
    expect(result.summary.requests).toBe(8);
    expect(result.summary.usageTokens).toBe(170);
    expect(result.points.reduce((sum, point) => sum + point.quota, 0)).toBe(700);
    expect(result.summary.walletTokens).not.toBe(result.summary.usageTokens);
  });

  test('empty selection means none, not all; absent models do not create phantom usage', () => {
    for (const selection of [[], ['missing']]) {
      const result = buildUsageAnalytics(rows, range, 500000, selection);
      expect(result.models).toHaveLength(0);
      expect(result.summary.requests).toBe(0);
      expect(result.points).toHaveLength(range.buckets);
      expect(result.points.every((point) => point.quota === 0)).toBe(true);
    }
  });

  test('same historical totals survive regrouping to hours, days or weeks', () => {
    for (const granularity of ['hour', 'day', 'week'] as const) {
      const grouped = getAnalyticsRange({ period: '7d', granularity }, now);
      const result = buildUsageAnalytics(rows, grouped, 500000);
      expect(result.summary.quota).toBe(900);
      expect(result.summary.requests).toBe(12);
      expect(result.summary.usageTokens).toBe(240);
    }
  });

  test('does not include rows before a custom start merely because their bucket overlaps', () => {
    const start = seconds('2026-10-16T01:30:00Z');
    const end = seconds('2026-10-16T03:00:00Z');
    const custom = getAnalyticsRange({ period: 'custom', granularity: 'week', start, end }, now);
    const result = buildUsageAnalytics(rows, custom, 500000);
    expect(result.summary.quota).toBe(300);
    expect(result.summary.requests).toBe(3);
    expect(result.models.map((model) => model.model)).toEqual(['model-a']);
  });

  test('missing conversion never hides real requests or pretends wallet spend is zero', () => {
    const result = buildUsageAnalytics(rows, range, NaN);
    expect(result.summary.walletTokens).toBeNull();
    expect(result.summary.requests).toBe(12);
    expect(result.models.every((model) => model.summary.walletTokens === null)).toBe(true);
  });

  test('keeps more than twenty models and rows instead of silently truncating to log pagination', () => {
    const many = Array.from({ length: 35 }, (_, index) => row(`model-${index}`, range.start));
    const result = buildUsageAnalytics(many, range, 500000);
    expect(result.models).toHaveLength(35);
    expect(result.summary.requests).toBe(70);
  });
});
