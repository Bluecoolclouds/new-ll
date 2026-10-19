import { describe, expect, test } from 'bun:test';
import { getAnalyticsRange } from '../src/lib/usage-analytics';
import { buildDemoUsageRows } from '../src/lib/demo-usage';

describe('admin demo usage data', () => {
  test('builds stable sample rows inside each supported chart window', () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    for (const selection of [
      { period: '24h', granularity: 'hour' },
      { period: '7d', granularity: 'day' },
      { period: '30d', granularity: 'week' },
    ] as const) {
      const range = getAnalyticsRange(selection, now);
      const rows = buildDemoUsageRows(range, 500_000);
      expect(rows).toHaveLength(range.buckets * 3);
      expect(rows.every((row) => row.created_at >= range.start && row.created_at <= range.end)).toBe(true);
      expect(rows.every((row) => Number.isSafeInteger(row.quota) && row.quota > 0
        && Number.isSafeInteger(row.count) && row.count > 0
        && Number.isSafeInteger(row.token_used) && row.token_used > 0)).toBe(true);
      expect(new Set(rows.map((row) => row.model_name)).size).toBe(3);
    }
  });

  test('uses an explicit local sample conversion when wallet configuration is unavailable', () => {
    const range = getAnalyticsRange({ period: '7d', granularity: 'day' }, Date.parse('2026-10-18T12:00:00Z'));
    expect(buildDemoUsageRows(range, 0)).toHaveLength(range.buckets * 3);
  });
});
