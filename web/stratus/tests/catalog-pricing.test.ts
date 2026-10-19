import { describe, expect, test } from 'bun:test';
import type { PricingModel } from '../src/lib/api';
import { getCatalogPrice, STRATUS_PUBLIC_DISCOUNT } from '../src/lib/live-catalog';

const model = (overrides: Partial<PricingModel> = {}): PricingModel => ({
  model_name: 'test-model',
  owner_by: 'Test',
  quota_type: 0,
  model_ratio: 0.625,
  completion_ratio: 4,
  model_price: 0,
  enable_groups: ['default'],
  ...overrides,
});

const pricing = {
  group_ratio: { default: 1, vip: 2 },
  usable_group: { default: 'Default', vip: 'VIP' },
};

describe('public catalog pricing', () => {
  test('uses the cabinet token coefficient and applies the 50% display discount', () => {
    const price = getCatalogPrice(model(), pricing, 500_000);
    expect(price.kind).toBe('tokens');
    if (price.kind !== 'tokens') return;
    expect(price.multiplier).toBeCloseTo(9.615384615, 6);
    expect(price.usd).toBeCloseTo(0.625, 6);
    expect(STRATUS_PUBLIC_DISCOUNT).toBe(0.5);
  });

  test('shows the minimum across enabled groups and mixed input/output rates', () => {
    const price = getCatalogPrice(model({ enable_groups: ['default', 'vip'] }), pricing, 500_000);
    expect(price.kind).toBe('tokens');
    if (price.kind !== 'tokens') return;
    expect(price.multiplier).toBeCloseTo(9.615384615, 6);
    expect(price.usd).toBeCloseTo(0.625, 6);
  });

  test('turns image token rates in a tier expression into a safe from-price', () => {
    const price = getCatalogPrice(model({
      model_name: 'gemini-3.1-flash-image-4k',
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p*1.125 + c*6.75 + img_o*135)',
    }), pricing, 500_000);
    expect(price.kind).toBe('tokens');
    if (price.kind !== 'tokens') return;
    expect(price.multiplier).toBeCloseTo(1.125 / 0.13, 6);
    expect(price.usd).toBeCloseTo(0.5625, 6);
  });

  test('uses the cheapest coefficient across long-context tiers without evaluating the expression', () => {
    const price = getCatalogPrice(model({
      billing_mode: 'tiered_expr',
      billing_expr: 'len <= 272000 ? tier("standard", p*2.5 + c*15) : tier("long_context", p*20 + c*90)',
    }), pricing, 500_000);
    expect(price.kind).toBe('tokens');
    if (price.kind !== 'tokens') return;
    expect(price.usd).toBeCloseTo(1.25, 6);
  });

  test('keeps fixed request pricing in request units', () => {
    const price = getCatalogPrice(model({ quota_type: 1, model_price: 0.08, enable_groups: ['vip'] }), pricing, 500_000);
    expect(price.kind).toBe('request');
    if (price.kind !== 'request') return;
    expect(price.usd).toBeCloseTo(0.08, 6);
    expect(price.walletTokens).toBeCloseTo(1_230_769.23, 2);
  });

  test('does not invent prices for invalid conversions or unsupported expressions', () => {
    expect(getCatalogPrice(model(), pricing, 0)).toEqual({ kind: 'unavailable' });
    expect(getCatalogPrice(model({ billing_mode: 'tiered_expr', billing_expr: 'unsupported()' }), pricing, 500_000))
      .toEqual({ kind: 'unavailable' });
    expect(getCatalogPrice(model({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p*1.125 + unknown_fee*7)',
    }), pricing, 500_000)).toEqual({ kind: 'unavailable' });
    expect(getCatalogPrice(model({ enable_groups: ['missing'] }), pricing, 500_000))
      .toEqual({ kind: 'unavailable' });
  });
});
