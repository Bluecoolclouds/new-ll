import { expect, test } from 'bun:test';
import { WALLET_BONUS_FULL_RUB, walletBonusPercent } from '../src/lib/wallet-bonus';
import { formatPaymentMoney, formatUsdAmount, rublesToUsd, rublesToUsdInput, usdToRubles } from '../src/lib/wallet-currency';

test('English top-up entry round-trips the existing RUB bonus thresholds', () => {
  expect(usdToRubles(1.12)).toBe(100);
  expect(usdToRubles(280.90)).toBe(WALLET_BONUS_FULL_RUB);
  expect(usdToRubles(280.91)).toBe(WALLET_BONUS_FULL_RUB + 1);
  expect(walletBonusPercent(usdToRubles(280.90)!)).toBeCloseTo(50);
  expect(walletBonusPercent(usdToRubles(280.91)!)).toBe(70);
});

test('USD input and labels use the configured internal conversion rate', () => {
  expect(rublesToUsdInput(100)).toBe('1.12');
  expect(rublesToUsdInput(WALLET_BONUS_FULL_RUB)).toBe('280.90');
  expect(rublesToUsd(89)).toBe(1);
  expect(formatUsdAmount(11.5, 'en-US')).toBe('$11.50');
  expect(formatPaymentMoney('25000', 'RUB', 'en', 'en-US')).toBe('$280.90');
  expect(formatPaymentMoney('12.50', 'USD', 'en', 'en-US')).toBe('$12.50');
  expect(formatPaymentMoney('25000', 'RUB', 'ru', 'ru-RU')).toBe('25000 RUB');
});

