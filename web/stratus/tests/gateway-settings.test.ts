import { describe, expect, test } from 'bun:test';
import { gatewayQuotaFromWalletTokens, gatewayWalletTokensInputFromQuota, tokenModelNames } from '../src/lib/gateway-settings';

describe('AI Gateway settings conversions', () => {
  test('converts wallet-token budgets to internal quota and preserves the unlimited zero', () => {
    expect(gatewayQuotaFromWalletTokens('1000000', 500_000)).toBe(65_000);
    expect(gatewayQuotaFromWalletTokens('20', 500_000)).toBe(1);
    expect(gatewayQuotaFromWalletTokens('0', 500_000)).toBe(0);
    expect(gatewayQuotaFromWalletTokens('1', 500_000)).toBeNull();
    expect(gatewayQuotaFromWalletTokens('', 500_000)).toBeNull();
    expect(gatewayWalletTokensInputFromQuota(750_000, 500_000)).toBe('11538461.538462');
    expect(gatewayQuotaFromWalletTokens(gatewayWalletTokensInputFromQuota(750_000, 500_000), 500_000)).toBe(750_000);
    expect(gatewayWalletTokensInputFromQuota(0, 500_000)).toBe('0');
  });

  test('rejects invalid and unsafe quota conversions', () => {
    expect(gatewayQuotaFromWalletTokens('-1', 500_000)).toBeNull();
    expect(gatewayQuotaFromWalletTokens('nope', 500_000)).toBeNull();
    expect(gatewayQuotaFromWalletTokens('1', 0)).toBeNull();
    expect(gatewayQuotaFromWalletTokens('999999999999999999', 500_000)).toBeNull();
  });

  test('parses explicit allowed models without duplicates or the auto sentinel', () => {
    expect(tokenModelNames('gpt-4o, claude-sonnet-4,gpt-4o,auto,,')).toEqual(['gpt-4o', 'claude-sonnet-4']);
    expect(tokenModelNames(undefined)).toEqual([]);
  });
});
