import { describe, expect, test } from 'bun:test';
import { buildUsageSeries, getUsageRange, normalizeUsageRows, summarizeUsage, type UsageRow } from '../src/lib/usage';
import { quotaToWalletTokens } from '../src/lib/token-economy';

const now = Date.parse('2026-10-17T12:34:56Z');
const row = (created_at: number, quota = 100, count = 2, token_used = 50, model_name = 'model-a'): UsageRow =>
  ({ created_at, quota, count, token_used, model_name });

describe('Stratus consumption statistics', () => {
  test('24 hour view contains 24 UTC hours including the current partial hour', () => {
    const range = getUsageRange('24h', now);
    expect(range.buckets).toBe(24);
    expect(new Date(range.start * 1000).toISOString()).toBe('2026-10-16T13:00:00.000Z');
    expect(new Date(range.end * 1000).toISOString()).toBe('2026-10-17T12:34:56.000Z');
    expect(range.step).toBe(3600);
  });
  test('seven day view includes today and six previous UTC days', () => {
    const range = getUsageRange('7d', now);
    expect(range.buckets).toBe(7);
    expect(new Date(range.start * 1000).toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });
  test('30 day range never exceeds the server maximum, even at the end of a day', () => {
    for (const time of [now, Date.parse('2026-10-17T23:59:59Z'), Date.parse('2026-03-01T00:00:00Z')]) {
      const range = getUsageRange('30d', time);
      expect(range.buckets).toBe(30);
      expect(range.end - range.start).toBeLessThanOrEqual(2_592_000);
    }
  });
  test('invalid periods and timestamps are rejected', () => {
    expect(() => getUsageRange('7d', NaN)).toThrow();
    expect(() => getUsageRange('invalid' as '7d', now)).toThrow();
  });
  test('empty Go slices are accepted, malformed or partial records are not treated as zero usage', () => {
    expect(normalizeUsageRows(null)).toEqual([]);
    expect(normalizeUsageRows([])).toEqual([]);
    for (const bad of [undefined, {}, [null], [{ created_at: 1 }], [row(1, NaN)], [row(1, -10)], [row(1, 0, 0, Infinity)], [row(1, Number.MAX_SAFE_INTEGER + 1)]]) {
      expect(() => normalizeUsageRows(bad)).toThrow();
    }
  });
  test('aggregates multiple models in one bucket without mixing usage and billed tokens', () => {
    const range = getUsageRange('7d', now);
    const rows = [row(range.start + 10), row(range.start + 60, 200, 3, 75, 'model-b')];
    const points = buildUsageSeries(rows, range, 500_000);
    expect(points).toHaveLength(7);
    expect(points[0].quota).toBe(300);
    expect(points[0].requests).toBe(5);
    expect(points[0].usageTokens).toBe(125);
    expect(points[0].walletTokens).toBeCloseTo(quotaToWalletTokens(300, 500_000)!);
    expect(points[0].walletTokens).not.toBe(points[0].usageTokens);
  });
  test('fills only missing buckets within the selected window with zeroes', () => {
    const range = getUsageRange('7d', now);
    const points = buildUsageSeries([row(range.start + 2 * 86400)], range, 500_000);
    expect(points.map((point) => point.requests)).toEqual([0, 0, 2, 0, 0, 0, 0]);
    expect(points[6].timestamp).toBeLessThanOrEqual(range.end);
  });
  test('includes both endpoint boundaries and excludes rows outside the window', () => {
    const range = getUsageRange('24h', now);
    const points = buildUsageSeries([row(range.start - 1), row(range.start), row(range.end), row(range.end + 1)], range, 500_000);
    expect(summarizeUsage(points).requests).toBe(4);
    expect(points[0].requests).toBe(2);
    expect(points[23].requests).toBe(2);
  });
  test('totals all models and dates rather than using the first page of request logs', () => {
    const range = getUsageRange('7d', now);
    const points = buildUsageSeries([row(range.start, 100, 200, 1000), row(range.end, 200, 300, 2000)], range, 500_000);
    expect(summarizeUsage(points)).toMatchObject({ quota: 300, requests: 500, usageTokens: 3000 });
    expect(summarizeUsage(points).walletTokens).toBeCloseTo(quotaToWalletTokens(300, 500_000)!);
  });
  test('invalid conversion never fabricates a wallet token value but keeps raw usage available', () => {
    const range = getUsageRange('7d', now);
    const points = buildUsageSeries([row(range.start)], range, NaN);
    expect(points[0].walletTokens).toBeNull();
    expect(summarizeUsage(points).walletTokens).toBeNull();
    expect(summarizeUsage(points).usageTokens).toBe(50);
  });
  test('zero usage is retained as zero, never replaced with a plausible sample curve', () => {
    const range = getUsageRange('24h', now);
    const points = buildUsageSeries([], range, 500_000);
    expect(points.every((point) => point.walletTokens === 0 && point.requests === 0 && point.usageTokens === 0)).toBe(true);
    expect(summarizeUsage(points)).toEqual({ quota: 0, requests: 0, usageTokens: 0, walletTokens: 0 });
  });
  test('aggregation rejects integer overflow instead of plotting corrupted amounts', () => {
    const range = getUsageRange('7d', now);
    expect(() => buildUsageSeries([row(range.start, Number.MAX_SAFE_INTEGER), row(range.start, 1)], range, 500_000)).toThrow();
  });
});
