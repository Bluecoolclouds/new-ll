import { describe, expect, test } from 'bun:test';
import { effectiveCatalogUsd, estimateLandingTopup } from '../src/lib/landing-topup';

describe('landing top-up estimate', () => {
  test('uses the approved gradual bonus at the lower and upper thresholds', () => {
    expect(estimateLandingTopup(100)?.bonusPercent).toBe(0);
    expect(estimateLandingTopup(25_000)?.bonusPercent).toBe(50);
    expect(estimateLandingTopup(25_001)?.bonusPercent).toBe(70);
  });

  test('estimates credited wallet tokens and the effective rate', () => {
    const estimate = estimateLandingTopup(2_000);
    expect(estimate).not.toBeNull();
    expect(estimate!.walletTokens).toBeGreaterThan(Math.floor(2_000 / 11.57 * 1_000_000));
    expect(estimate!.effectiveRateRub).toBeCloseTo(2_000 / estimate!.walletTokens * 1_000_000);
  });

  test('adjusts public catalog estimates by the selected purchase bonus', () => {
    expect(effectiveCatalogUsd(10, 0)).toBe(10);
    expect(effectiveCatalogUsd(10, 50)).toBeCloseTo(10 / 1.5);
    expect(effectiveCatalogUsd(-1, 50)).toBeNull();
  });

  test('rejects invalid top-up amounts', () => {
    expect(estimateLandingTopup(0)).toBeNull();
    expect(estimateLandingTopup(-1)).toBeNull();
    expect(estimateLandingTopup(100.5)).toBeNull();
  });
});
