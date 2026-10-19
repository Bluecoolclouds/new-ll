import { describe, expect, test } from 'bun:test';
import { walletBonusPercent } from '../src/lib/wallet-bonus';

describe('progressive wallet top-up bonus', () => {
  test('grows linearly from zero at 100 RUB to 50 percent at 25,000 RUB', () => {
    expect(walletBonusPercent(100)).toBe(0);
    expect(walletBonusPercent(12_550)).toBe(25);
    expect(walletBonusPercent(25_000)).toBe(50);
  });

  test('switches to 70 percent above 25,000 RUB and ignores invalid amounts', () => {
    expect(walletBonusPercent(25_001)).toBe(70);
    expect(walletBonusPercent(8400)).toBeCloseTo(16.6666667);
    expect(walletBonusPercent(0)).toBe(0);
    expect(walletBonusPercent(Number.NaN)).toBe(0);
  });
});
