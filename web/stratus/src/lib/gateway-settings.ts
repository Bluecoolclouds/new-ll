export const gatewayProfiles = ['ordered', 'cost', 'speed', 'reliable'] as const;
export type GatewayProfile = (typeof gatewayProfiles)[number];

import { quotaToWalletTokens, walletTokensToQuota } from './token-economy';

export function gatewayQuotaFromWalletTokens(value: string, quotaPerUnit: number): number | null {
  if (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) return null;
  if (!value.trim()) return null;
  const tokens = Number(value);
  if (!Number.isFinite(tokens) || tokens < 0) return null;
  const quota = walletTokensToQuota(tokens, quotaPerUnit);
  if (quota === null || (tokens > 0 && quota === 0)) return null;
  return Number.isSafeInteger(quota) ? quota : null;
}

export function gatewayWalletTokensInputFromQuota(quota: number | undefined, quotaPerUnit: number): string {
  if (!Number.isFinite(quota) || (quota ?? 0) <= 0 || !Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) return '0';
  const tokens = quotaToWalletTokens(quota ?? 0, quotaPerUnit);
  if (tokens === null || tokens <= 0) return '0';
  const roundedUp = Math.ceil(tokens * 1_000_000) / 1_000_000;
  return String(Number(roundedUp.toFixed(6)));
}

export function tokenModelNames(modelLimits?: string): string[] {
  if (typeof modelLimits !== 'string') return [];
  return [...new Set(modelLimits.split(',').map((model) => model.trim()).filter((model) => model && model !== 'auto'))];
}
