import { describe, expect, test } from 'bun:test';
import { getApiKeyQuotaUsage } from '../src/lib/api-key-quota';

describe('API key quota usage', () => {
  test('calculates used quota against the granted amount', () => {
    expect(getApiKeyQuotaUsage(20, 80)).toEqual({ used: 20, remaining: 80, total: 100, percentage: 20 });
    expect(getApiKeyQuotaUsage(0, 100)).toEqual({ used: 0, remaining: 100, total: 100, percentage: 0 });
    expect(getApiKeyQuotaUsage(100, 0)).toEqual({ used: 100, remaining: 0, total: 100, percentage: 100 });
  });

  test('keeps invalid or negative quota values from producing an invalid progress bar', () => {
    expect(getApiKeyQuotaUsage(-5, 100)).toEqual({ used: 0, remaining: 100, total: 100, percentage: 0 });
    expect(getApiKeyQuotaUsage(Number.NaN, 0)).toEqual({ used: 0, remaining: 0, total: 0, percentage: 0 });
  });
});
