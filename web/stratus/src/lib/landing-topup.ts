import { TOKEN_ECONOMY } from './token-economy';
import { walletBonusPercent } from './wallet-bonus';

export type LandingTopupEstimate = {
  bonusPercent: number;
  walletTokens: number;
  effectiveRateRub: number;
};

export function estimateLandingTopup(amountRub: number): LandingTopupEstimate | null {
  if (!Number.isSafeInteger(amountRub) || amountRub <= 0) return null;

  const bonusPercent = walletBonusPercent(amountRub);
  const walletTokens = Math.floor(
    amountRub / TOKEN_ECONOMY.rubPerMillionTokens *
    TOKEN_ECONOMY.tokensPerPack *
    (1 + bonusPercent / 100),
  );
  if (!Number.isSafeInteger(walletTokens) || walletTokens <= 0) return null;

  return {
    bonusPercent,
    walletTokens,
    effectiveRateRub: amountRub / walletTokens * TOKEN_ECONOMY.tokensPerPack,
  };
}

export function effectiveCatalogUsd(baseUsd: number, bonusPercent: number): number | null {
  if (!Number.isFinite(baseUsd) || baseUsd < 0 || !Number.isFinite(bonusPercent) || bonusPercent < 0) return null;
  const result = baseUsd / (1 + bonusPercent / 100);
  return Number.isFinite(result) ? result : null;
}
