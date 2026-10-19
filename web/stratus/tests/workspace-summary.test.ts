import { describe, expect, test } from 'bun:test';
import { getAnalyticsRange } from '../src/lib/usage-analytics';
import { summarizeCabinetUsage } from '../src/lib/workspace-summary';

describe('cabinet seven-day summary', () => {
  test('sums only returned personal usage rows into requests and historical wallet tokens', () => {
    const range = getAnalyticsRange({ period: '7d', granularity: 'day' }, Date.UTC(2026, 4, 20, 12));
    const summary = summarizeCabinetUsage([
      { created_at: range.start, quota: 100_000, count: 2, token_used: 410 },
      { created_at: range.end, quota: 50_000, count: 1, token_used: 120 },
      { created_at: range.start - 1, quota: 9_000_000, count: 99, token_used: 99_000 },
    ], range, 500_000);

    expect(summary.requests).toBe(3);
    expect(summary.usageTokens).toBe(530);
    expect(summary.walletTokens).toBeCloseTo((150_000 / (500_000 * 0.13)) * 1_000_000, 6);
  });

  test('keeps request totals while wallet conversion is unavailable', () => {
    const range = getAnalyticsRange({ period: '7d', granularity: 'day' }, Date.UTC(2026, 4, 20, 12));
    const summary = summarizeCabinetUsage([
      { created_at: range.end, quota: 1_000, count: 4, token_used: 80 },
    ], range, Number.NaN);

    expect(summary.requests).toBe(4);
    expect(summary.walletTokens).toBeNull();
  });
});
