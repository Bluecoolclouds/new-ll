import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/wallet', search: '' } } });
const { Wallet } = await import('../src/components/Wallet');
const { parseWalletInfo } = await import('../src/lib/wallet');
if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
else Reflect.deleteProperty(globalThis, 'window');

function renderWallet(info: unknown, language = 'ru') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(['stratus', 'wallet-info'], parseWalletInfo(info));
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { search: '' },
    localStorage: { getItem: (key: string) => key === 'stratus-landing-language' ? language
      : key === 'stratus-landing-language-explicit' ? '1' : null, setItem: () => {} },
  } });
  try {
    return renderToStaticMarkup(<QueryClientProvider client={client}><Wallet/></QueryClientProvider>);
  } finally {
    client.clear();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

describe('Wallet rendering', () => {
  test('empty methods render the unavailable state', () => {
    const html = renderWallet({ methods: [], redemption: false, topup_link: '' });
    expect(html).toContain('Способы оплаты пока недоступны');
    expect(html).not.toContain('Не удалось открыть страницу');
  });

  test('legacy null methods render as an empty list without crashing', () => {
    expect(renderWallet({ methods: null, redemption: false, topup_link: '' }))
      .toContain('Способы оплаты пока недоступны');
  });

  test('wallet and payment history use the saved English language', () => {
    const html = renderWallet({ methods: [], redemption: false, topup_link: '' }, 'en');
    expect(html).toContain('Balance and top-ups');
    expect(html).toContain('Payment history');
    expect(html).toContain('Payment methods are not available yet');
    expect(html).not.toContain('Баланс и пополнение');
  });

  test('configured methods and redemption remain visible', () => {
    const html = renderWallet({
      methods: [{ id: 'fixture', name: 'Fixture payment', min_usd: 1, max_usd: 10, amount_options: [] }],
      redemption: true, topup_link: '',
    });
    expect(html).toContain('Fixture payment');
    expect(html).toContain('Активировать ключ');
  });
});
