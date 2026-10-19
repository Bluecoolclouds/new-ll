import { describe, expect, it } from 'bun:test';
import { buildReferralUrl, isValidWalletQuote, normalizeWalletInfo, sameWalletQuote, walletQuotePayload } from '../src/lib/cabinet-popup-helpers';
import type { WalletInfo, WalletQuote } from '../src/lib/wallet';

const pack: WalletInfo['methods'][number] = {
  id: 'packs:pally', name: 'Пакеты', min_usd: 1, max_usd: 1000, amount_options: [1, 3, 10], quantity_kind: 'packs',
};
const legacy = { ...pack, id: 'alipay', quantity_kind: undefined };
const quote: WalletQuote = {
  money: '11.57', currency: 'RUB', credited_quota: 65000, pay_path: '/api/user/topup/stratus/pay',
  payload: { method: pack.id, amount_rub: 100, nested: { b: 2, a: 1 } },
};

describe('cabinet popup contracts', () => {
  it('keeps pack and legacy units separate', () => {
    expect(walletQuotePayload(pack, 100)).toEqual({ method: pack.id, amount_rub: 100 });
    expect(walletQuotePayload(legacy, 10)).toEqual({ method: legacy.id, usd: 10 });
  });
  it('accepts Go nil or empty method slices without hiding malformed responses', () => {
    expect(normalizeWalletInfo({ methods: null }).methods).toEqual([]);
    expect(normalizeWalletInfo({ methods: [], redemption: true }).redemption).toBe(true);
    expect(normalizeWalletInfo({ methods: [pack] }).methods).toEqual([pack]);
    for (const value of [null, {}, { methods: 'invalid' }, { methods: [{ ...pack, min_usd: 0 }] }]) {
      expect(() => normalizeWalletInfo(value)).toThrow();
    }
  });
  it('rejects unsafe amounts and uncredited purchases', () => {
    expect(isValidWalletQuote(quote)).toBe(true);
    expect(isValidWalletQuote({ ...quote, bonus_percent: 70 })).toBe(true);
    expect(isValidWalletQuote({ ...quote, bonus_percent: 70.01 })).toBe(false);
    for (const money of ['', '0', '-1', 'free', '11,57', 'Infinity']) {
      expect(isValidWalletQuote({ ...quote, money })).toBe(false);
    }
    for (const credited_quota of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isValidWalletQuote({ ...quote, credited_quota })).toBe(false);
    }
    expect(isValidWalletQuote({ ...quote, payload: [] })).toBe(false);
  });
  it('requires reconfirmation when any financial term changes, not JSON key order', () => {
    expect(sameWalletQuote(quote, { ...quote, payload: { nested: { a: 1, b: 2 }, amount_rub: 100, method: pack.id } })).toBe(true);
    for (const changed of [
      { money: '12.00' }, { currency: 'USD' }, { credited_quota: 130000 },
      { pay_path: '/api/user/pay' }, { bonus_percent: 25 }, { payload: { amount_rub: 200, method: pack.id } },
    ]) expect(sameWalletQuote(quote, { ...quote, ...changed })).toBe(false);
  });
  it('builds registration links with the backend aff parameter for both themes', () => {
    expect(buildReferralUrl('https://stratus.example/', '', 'code')).toBe('https://stratus.example/register?aff=code');
    expect(buildReferralUrl('https://stratus.example/', '/stratus/', 'a+b /?'))
      .toBe('https://stratus.example/stratus/register?aff=a%2Bb%20%2F%3F');
  });
});
