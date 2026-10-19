import type { PricingModel } from './api';

export const TOKEN_ECONOMY = Object.freeze({
  usdToRub: 89,
  rubPerMillionTokens: 11.57,
  tokensPerPack: 1_000_000,
});

export type ModelTokenTariff =
  | { kind: 'uniform'; multiplier: number; specialUsage: boolean }
  | { kind: 'mixed'; minimum: number; maximum: number; specialUsage: boolean }
  | { kind: 'request'; tokens: number }
  | { kind: 'dynamic' }
  | { kind: 'invalid' };

const nonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function usdToWalletTokens(usd: number): number {
  // 11.57 RUB / 89 RUB per USD = exactly 0.13 USD per pack.
  return usd * 100 / 13 * TOKEN_ECONOMY.tokensPerPack;
}

export function quotaToWalletTokens(quota: number, quotaPerUsd: number): number | null {
  if (!Number.isFinite(quota) || !Number.isFinite(quotaPerUsd) || quotaPerUsd <= 0) return null;
  const result = quota / (quotaPerUsd * 13 / 100) * TOKEN_ECONOMY.tokensPerPack;
  return Number.isFinite(result) ? result : null;
}

export function walletTokensToQuota(tokens: number, quotaPerUsd: number): number | null {
  if (!nonNegative(tokens) || !Number.isFinite(quotaPerUsd) || quotaPerUsd <= 0) return null;
  // Exact integer budgets must not lose one quota unit to binary float division.
  if (Number.isSafeInteger(tokens) && Number.isSafeInteger(quotaPerUsd)) {
    const exact = BigInt(tokens) * BigInt(quotaPerUsd) * 13n / 100_000_000n;
    return exact <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(exact) : null;
  }
  const quota = Math.floor(tokens / TOKEN_ECONOMY.tokensPerPack * (quotaPerUsd * 13 / 100));
  return Number.isSafeInteger(quota) ? quota : null;
}

export function getModelTokenTariff(
  model: PricingModel,
  groupRatio: number,
  quotaPerUsd: number,
): ModelTokenTariff {
  if (!nonNegative(groupRatio)) return { kind: 'invalid' };
  if (model.billing_mode === 'tiered_expr') return { kind: 'dynamic' };
  if (model.billing_mode && model.billing_mode !== 'ratio') return { kind: 'invalid' };
  if (model.quota_type === 1) {
    if (!nonNegative(model.model_price)) return { kind: 'invalid' };
    const tokens = usdToWalletTokens(model.model_price * groupRatio);
    return Number.isFinite(tokens) ? { kind: 'request', tokens } : { kind: 'invalid' };
  }
  if (model.quota_type !== 0 || !nonNegative(model.model_ratio) || !nonNegative(model.completion_ratio)) {
    return { kind: 'invalid' };
  }
  const input = quotaToWalletTokens(model.model_ratio * groupRatio, quotaPerUsd);
  const output = input === null ? null : input * model.completion_ratio;
  if (input === null || output === null || !Number.isFinite(output)) return { kind: 'invalid' };
  const modifiers = [model.cache_ratio, model.create_cache_ratio, model.image_ratio, model.audio_ratio, model.audio_completion_ratio];
  if (modifiers.some((value) => value != null && !nonNegative(value))) return { kind: 'invalid' };
  const specialUsage = modifiers.some((value) => value != null && value !== 1);
  if (input === output) return { kind: 'uniform', multiplier: input, specialUsage };
  return { kind: 'mixed', minimum: Math.min(input, output), maximum: Math.max(input, output), specialUsage };
}

const tariffNumber = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 8 });
export const formatTariffNumber = (value: number) => tariffNumber.format(value);
