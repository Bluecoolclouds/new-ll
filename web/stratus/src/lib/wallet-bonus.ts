export const WALLET_BONUS_START_RUB = 100;
export const WALLET_BONUS_FULL_RUB = 25_000;
export const WALLET_BONUS_MAX_PERCENT = 50;
export const WALLET_BONUS_HIGH_TIER_PERCENT = 70;

export function walletBonusPercent(amountRub: number): number {
  if (!Number.isFinite(amountRub) || amountRub <= WALLET_BONUS_START_RUB) return 0;
  if (amountRub > WALLET_BONUS_FULL_RUB) return WALLET_BONUS_HIGH_TIER_PERCENT;
  return Math.min(
    WALLET_BONUS_MAX_PERCENT,
    ((amountRub - WALLET_BONUS_START_RUB) / (WALLET_BONUS_FULL_RUB - WALLET_BONUS_START_RUB)) * WALLET_BONUS_MAX_PERCENT,
  );
}
