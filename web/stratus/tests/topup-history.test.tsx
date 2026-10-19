import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopupHistory } from '../src/components/TopupHistory';
import { walletOrdersKey } from '../src/lib/wallet-history';
import { WorkspaceLocaleProvider } from '../src/lib/workspace-locale';

const fixture = {
  page: 1,
  page_size: 10,
  total: 1,
  items: [{
    id: 42,
    amount: 1,
    money: '500',
    trade_no: 'order-42',
    payment_method: 'Card',
    payment_provider: 'Test provider',
    payment_currency: 'RUB',
    wallet_packs: 1,
    create_time: 1_800_000_000,
    complete_time: 1_800_000_050,
    status: 'success',
  }],
};

function renderHistory(language: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(walletOrdersKey(1), fixture);
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => key === 'stratus-landing-language' ? language
      : key === 'stratus-landing-language-explicit' ? '1' : null, setItem: () => {} },
  } });
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}><WorkspaceLocaleProvider><TopupHistory/></WorkspaceLocaleProvider></QueryClientProvider>,
    );
  } finally {
    client.clear();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

describe('settings top-up history', () => {
  test('shows server order status, payment details, and paging from the shared wallet query', () => {
    const html = renderHistory('ru');
    expect(html).toContain('История пополнений');
    expect(html).toContain('Оплачен');
    expect(html).toContain('Test provider');
    expect(html).toContain('order-42');
    expect(html).toContain('1 000 000 токенов');
    expect(html).toContain('Перейти к пополнению');
  });

  test('shows top-up history labels and order status in English', () => {
    const html = renderHistory('en');
    expect(html).toContain('Top-up history');
    expect(html).toContain('Paid');
    expect(html).toContain('Go to top-up');
    expect(html).not.toContain('История пополнений');
  });

});
