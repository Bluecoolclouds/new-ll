import { expect, test } from 'bun:test';
import { clearWalletReturnMarker, paymentPendingKey, walletReturnTarget } from '../src/lib/wallet-return';

test('theme-aware log returns preserve the originating wallet and neutral return notice', () => {
  for (const wallet of ['/wallet', '/stratus/wallet']) {
    const values = new Map([[paymentPendingKey, JSON.stringify({ wallet, at: Date.now() })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(walletReturnTarget(storage)).toBe(`${wallet}?payment=return`);
    expect(values.has(paymentPendingKey)).toBe(true);
    clearWalletReturnMarker(storage);
    expect(walletReturnTarget(storage)).toBeNull();
    expect(values.size).toBe(0);
  }
});

test('absent or malformed navigation markers do not imply payment or redirect', () => {
  for (const value of [null, '{broken', '{}', 'null', '3', '{"wallet":"https://evil.example/wallet"}', '{"wallet":"//evil.example"}', '{"wallet":"/wallet?paid=true"}']) {
    expect(walletReturnTarget({ getItem: () => value })).toBeNull();
  }
  expect(walletReturnTarget({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  expect(() => clearWalletReturnMarker({ removeItem: () => { throw new Error('blocked'); } })).not.toThrow();
});
