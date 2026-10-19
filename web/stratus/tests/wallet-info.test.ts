import { describe, expect, test } from 'bun:test';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/wallet' } } });
const { parseWalletInfo } = await import('../src/lib/wallet');
if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
else Reflect.deleteProperty(globalThis, 'window');

const method = { id: 'packs:heleket', name: 'Fixture', min_usd: 1, max_usd: 100, amount_options: [], quantity_kind: 'packs', min_amount_rub: 100 };
const info = { methods: [method], redemption: true, topup_link: '' };

describe('Wallet info contract', () => {
  test('preserves configured methods, minima, packages and products', () => {
    const data = { ...info, methods: [
      { ...method, notice: 'Notice', disabled_reason: 'Unavailable', amount_options: [10, 20] },
      { id: 'creem:fixture', name: 'Product', min_usd: 1, max_usd: 1, amount_options: [],
        product: { name: 'Configured product', price: 5, currency: 'EUR', quota: 12345 } },
    ] };
    expect(parseWalletInfo(data)).toEqual(data);
  });

  test('accepts both current and legacy empty arrays', () => {
    expect(parseWalletInfo({ ...info, methods: [] }).methods).toEqual([]);
    expect(parseWalletInfo({ ...info, methods: null }).methods).toEqual([]);
  });

  test('rejects malformed data before it reaches rendering without echoing the response', () => {
    for (const data of [
      undefined, null, {}, { ...info, methods: {} }, { ...info, methods: [null] },
      { ...info, methods: [{ ...method, amount_options: null }] },
      { ...info, methods: [{ ...method, name: { secret: 'never-log-this' } }] },
      { ...info, methods: [{ ...method, product: {} }] },
      { ...info, methods: [{ ...method, notice: {} }] },
      { ...info, methods: [{ ...method, min_amount_rub: 50 }] },
    ]) {
      expect(() => parseWalletInfo(data)).toThrow('Некорректный ответ сервера способов оплаты.');
    }
  });
});
