import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

const navigations: string[] = [];
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { location: { origin: 'https://gateway.example.test', pathname: '/stratus/wallet', search: '', assign: (url: string) => navigations.push(url) } },
});
const { safeCheckoutUrl, startWalletPayment } = await import('../src/lib/wallet');
const originalFetch = globalThis.fetch;
let responseBody: unknown;
let sent: { path: string; init: RequestInit }[];
const quote = {
  money: '1.00', currency: 'USD', credited_quota: 500000,
  pay_path: '/api/user/waffo-pancake/pay', payload: { amount: 1 },
};
beforeEach(() => {
  sent = [];
  navigations.length = 0;
  responseBody = { message: 'success', data: { checkout_url: 'https://checkout.example.test/order' } };
  globalThis.fetch = mock(async (input: string | URL | Request, init = {}) => {
    sent.push({ path: String(input), init });
    return new Response(JSON.stringify(responseBody), { headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('uses existing pay path and integer contract, not displayed wallet-token quantity', async () => {
  await startWalletPayment(quote);
  expect(sent).toHaveLength(1);
  expect(sent[0].path).toBe('/api/user/waffo-pancake/pay');
  expect(JSON.parse(String(sent[0].init.body))).toEqual({ amount: 1 });
  expect(sent[0].init.credentials).toBe('include');
  expect(navigations).toEqual(['https://checkout.example.test/order']);
});
test('custom gateways use the server quote unchanged and follow their pay_link response', async () => {
  for (const [path, payload] of [
    ['/api/user/freekassa/pay', { amount: 5000000, payment_method: 'freekassa_card' }],
    ['/api/user/heleket/pay', { amount: 10, payment_method: 'heleket' }],
    ['/api/user/pally/pay', { amount: 10, payment_method: 'pally' }],
    ['/api/user/plategal/pay', { amount: 10, payment_method: 'plategal', sub_method: 'plategal_intl' }],
  ] as const) {
    responseBody = { message: 'success', data: { pay_link: 'https://checkout.example.test/custom', order_id: 'test' } };
    await startWalletPayment({ ...quote, pay_path: path, payload });
    expect(sent.at(-1)?.path).toBe(path);
    expect(JSON.parse(String(sent.at(-1)?.init.body))).toEqual(payload);
    expect(navigations.at(-1)).toBe('https://checkout.example.test/custom');
  }
  expect(sent).toHaveLength(4);
});
test('payment business errors propagate, without navigation or automatic retries', async () => {
  responseBody = { message: 'error', data: 'Configured payment minimum not met' };
  await expect(startWalletPayment(quote)).rejects.toThrow('Configured payment minimum not met');
  expect(sent).toHaveLength(1);
  expect(navigations).toEqual([]);
});
test('exact packs use the dedicated contract and preserve the server confirmation snapshot', async () => {
  const payload = {
    method: 'packs:pally', packs: 1, expected_money: '11.57',
    expected_currency: 'RUB', expected_quota: 65000,
  };
  responseBody = { message: 'success', data: { pay_link: 'https://checkout.example.test/pack' } };
  await startWalletPayment({
    money: '11.57', currency: 'RUB', credited_quota: 65000,
    pay_path: '/api/user/topup/stratus/pay', payload,
  });
  expect(sent[0].path).toBe('/api/user/topup/stratus/pay');
  expect(JSON.parse(String(sent[0].init.body))).toEqual(payload);
  expect(JSON.parse(String(sent[0].init.body))).not.toHaveProperty('amount');
  expect(navigations).toEqual(['https://checkout.example.test/pack']);
});
test('does not accept success:false even with a success message or URL', async () => {
  responseBody = { success: false, message: 'success', data: { checkout_url: 'https://checkout.example.test/order' } };
  await expect(startWalletPayment(quote)).rejects.toThrow();
  expect(navigations).toEqual([]);
});
test('rejects malformed successful payment responses', async () => {
  responseBody = { message: 'success', data: {} };
  await expect(startWalletPayment(quote)).rejects.toThrow('не вернул ссылку');
  expect(navigations).toEqual([]);
});
test('unsafe checkout URLs and unknown endpoints cannot cause navigation', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//checkout.example.test', '/relative', 'https://user:password@example.test']) {
    expect(() => safeCheckoutUrl(url)).toThrow();
  }
  responseBody = { message: 'success', data: { checkout_url: 'javascript:alert(1)' } };
  await expect(startWalletPayment(quote)).rejects.toThrow();
  await expect(startWalletPayment({ ...quote, pay_path: 'https://other.example.test/pay' })).rejects.toThrow('маршрут');
  expect(sent).toHaveLength(1);
  expect(navigations).toEqual([]);
});
