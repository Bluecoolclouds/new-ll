import { describe, expect, test } from 'bun:test';
import type { PricingModel } from '../src/lib/api';
import lunaBilling from '../../../testdata/stratus-luna-billing.json';
import { getModelTokenTariff, quotaToWalletTokens, TOKEN_ECONOMY, usdToWalletTokens, walletTokensToQuota } from '../src/lib/token-economy';

const model = (overrides: Partial<PricingModel> = {}): PricingModel => ({
  model_name: 'new-model', owner_by: 'test', quota_type: 0,
  model_ratio: 0.5, completion_ratio: 1, model_price: 0, enable_groups: ['default'], ...overrides,
});

describe('Stratus tariff conversion', () => {
  test('approved Luna coefficient matches the actual Go settlement vectors, including rounding', () => {
    const luna = model({
      model_name: lunaBilling.model,
      model_ratio: lunaBilling.model_ratio,
      completion_ratio: lunaBilling.completion_ratio,
    });
    for (const sample of lunaBilling.cases) {
      const tariff = getModelTokenTariff(luna, sample.group, lunaBilling.quota_per_usd);
      expect(tariff.kind).toBe('uniform');
      if (tariff.kind !== 'uniform') throw new Error('Expected Luna uniform tariff');
      expect(tariff.multiplier).toBeCloseTo(sample.group * 11 / 11.57, 12);
      const actualDebit = quotaToWalletTokens(sample.quota, lunaBilling.quota_per_usd)!;
      const displayedDebit = (sample.input + sample.output) * tariff.multiplier;
      const unit = quotaToWalletTokens(1, lunaBilling.quota_per_usd)!;
      expect(Math.abs(actualDebit - displayedDebit)).toBeLessThanOrEqual(
        sample.name === 'minimum' ? unit : unit / 2,
      );
    }
    for (const sample of lunaBilling.accounting_cases) {
      const tariff = getModelTokenTariff(model({
        model_name: lunaBilling.model,
        model_ratio: sample.model_ratio,
        completion_ratio: 1,
      }), 1, sample.quota_per_usd);
      expect(tariff.kind).toBe('uniform');
      if (tariff.kind !== 'uniform') throw new Error('Expected Luna uniform tariff');
      expect(tariff.multiplier).toBeCloseTo(11 / 11.57, 12);
      const actualDebit = quotaToWalletTokens(sample.quota, sample.quota_per_usd)!;
      const idealDebit = (sample.input + sample.output) * 11 / 11.57;
      expect(Math.abs(actualDebit - idealDebit)).toBeLessThanOrEqual(
        quotaToWalletTokens(1, sample.quota_per_usd)! / 2,
      );
    }
  });
  test('key limits convert wallet tokens to integer quota without increasing the requested budget', () => {
    const quota = walletTokensToQuota(1_000_000, 500_000)!;
    expect(quota).toBe(65000);
    expect(quotaToWalletTokens(quota, 500_000)!).toBeLessThanOrEqual(1_000_000);
    expect(1_000_000 - quotaToWalletTokens(quota, 500_000)!).toBeLessThan(usdToWalletTokens(1) / 500_000);
    expect(walletTokensToQuota(0, 500_000)).toBe(0);
    expect(walletTokensToQuota(-1, 500_000)).toBeNull();
    expect(walletTokensToQuota(Number.MAX_VALUE, 500_000)).toBeNull();
    for (const unit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(quotaToWalletTokens(1, unit)).toBeNull();
      expect(walletTokensToQuota(1, unit)).toBeNull();
    }
  });
  test('uses the agreed exchange rate and base pack, without interpreting quota as wallet tokens', () => {
    expect(TOKEN_ECONOMY.usdToRub).toBe(89);
    expect(TOKEN_ECONOMY.rubPerMillionTokens).toBe(11.57);
    expect(usdToWalletTokens(0.13)).toBe(1_000_000);
    expect(quotaToWalletTokens(65000, 500_000)).toBe(1_000_000);
    expect(quotaToWalletTokens(500_000, 500_000)).toBeCloseTo(100 / 13 * 1_000_000);
  });

  test('automatically derives a coefficient for any new model from its tariff and group', () => {
    const initial = getModelTokenTariff(model(), 1, 500_000);
    expect(initial).toMatchObject({ kind: 'uniform', specialUsage: false });
    if (initial.kind !== 'uniform') throw new Error('Expected uniform tariff');
    expect(initial.multiplier).toBeCloseTo(89 / 11.57);
    const price = getModelTokenTariff(model({ model_name: 'another-model', model_ratio: 0.25 }), 1.8, 500_000);
    expect(price.kind).toBe('uniform');
    if (price.kind === 'uniform') expect(price.multiplier).toBeCloseTo(0.25 * 1.8 * 178 / 11.57);
  });

  test('matches existing server quota settlement after conversion to wallet tokens', () => {
    const tariff = getModelTokenTariff(model(), 1.25, 500_000);
    expect(tariff.kind).toBe('uniform');
    if (tariff.kind !== 'uniform') throw new Error('Expected uniform tariff');
    const input = 1_000;
    const output = 600;
    const serverQuota = (input + output) * 0.5 * 1.25;
    expect((input + output) * tariff.multiplier).toBeCloseTo(quotaToWalletTokens(serverQuota, 500_000)!);
  });

  test('uses actual quota_per_unit rather than assuming the default 500000', () => {
    const price = getModelTokenTariff(model(), 1, 1_000_000);
    expect(price.kind).toBe('uniform');
    if (price.kind === 'uniform') expect(price.multiplier).toBeCloseTo(0.5 * 89 / 11.57);
  });

  test('does not misrepresent different completion rates as one coefficient', () => {
    const price = getModelTokenTariff(model({ completion_ratio: 4 }), 1, 500_000);
    expect(price.kind).toBe('mixed');
    if (price.kind === 'mixed') {
      expect(price.minimum).toBeCloseTo(89 / 11.57);
      expect(price.maximum).toBeCloseTo(4 * 89 / 11.57);
    }
  });

  test('supports free tariffs and zero group rates without replacing zero with one', () => {
    expect(getModelTokenTariff(model({ model_ratio: 0, completion_ratio: 4 }), 1, 500_000)).toEqual({
      kind: 'uniform', multiplier: 0, specialUsage: false,
    });
    expect(getModelTokenTariff(model(), 0, 500_000)).toEqual({
      kind: 'uniform', multiplier: 0, specialUsage: false,
    });
  });

  test('does not invent fixed coefficients for dynamic expressions', () => {
    expect(getModelTokenTariff(model({ billing_mode: 'tiered_expr', billing_expr: 'custom' }), 1, 500_000)).toEqual({ kind: 'dynamic' });
  });

  test('converts fixed per-request USD rates to wallet tokens, not token multipliers', () => {
    const price = getModelTokenTariff(model({ quota_type: 1, model_price: 0.01 }), 2, 500_000);
    expect(price.kind).toBe('request');
    if (price.kind === 'request') expect(price.tokens).toBeCloseTo(0.02 * 89 / 11.57 * 1_000_000);
  });

  test('flags special cache, image and audio rates', () => {
    for (const key of ['cache_ratio', 'create_cache_ratio', 'image_ratio', 'audio_ratio', 'audio_completion_ratio']) {
      expect(getModelTokenTariff(model({ [key]: 0.1 }), 1, 500_000)).toMatchObject({ kind: 'uniform', specialUsage: true });
    }
  });

  test('invalid or unknown tariffs never silently become free or default rates', () => {
    for (const bad of [NaN, Infinity, -1]) {
      expect(getModelTokenTariff(model({ model_ratio: bad }), 1, 500_000).kind).toBe('invalid');
      expect(getModelTokenTariff(model({ completion_ratio: bad }), 1, 500_000).kind).toBe('invalid');
      expect(getModelTokenTariff(model(), bad, 500_000).kind).toBe('invalid');
    }
    expect(getModelTokenTariff(model(), 1, 0).kind).toBe('invalid');
    expect(getModelTokenTariff(model(), 1, NaN).kind).toBe('invalid');
    expect(getModelTokenTariff(model({ quota_type: 99 }), 1, 500_000).kind).toBe('invalid');
    expect(getModelTokenTariff(model({ billing_mode: 'unknown' }), 1, 500_000).kind).toBe('invalid');
    expect(getModelTokenTariff(model({ model_ratio: Number.MAX_VALUE }), 2, 500_000).kind).toBe('invalid');
    expect(quotaToWalletTokens(1, 0)).toBeNull();
  });
});
