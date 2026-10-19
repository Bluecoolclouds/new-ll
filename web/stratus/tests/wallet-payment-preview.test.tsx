import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WalletPaymentPreview } from '../src/components/WalletPaymentPreview';
import { WorkspaceLocaleProvider } from '../src/lib/workspace-locale';

test('payment preview shows the sample methods and keeps checkout disabled', () => {
  const markup = renderToStaticMarkup(<WalletPaymentPreview/>);

  expect(markup).toContain('Тестовый предпросмотр');
  expect(markup).toContain('Platega');
  expect(markup).toContain('RollyPay');
  expect(markup).toContain('Visa / Mastercard');
  expect(markup).toContain('Heleket');
  expect(markup).toContain('CryptoBot');
  expect(markup).toContain('Форум Lolz');
  expect(markup).toContain('Ползунок суммы пополнения');
  expect(markup).toContain('Бонус токенов');
  expect(markup).toContain('25 000 ₽ · +50%');
  expect(markup.match(/role="radio"/g)).toHaveLength(6);
  expect(markup).toMatch(/data-testid="button-demo-payment-disabled"[^>]*disabled=""/);
});

test('English top-up preview shows USD amounts and converts the bonus slider', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => key === 'stratus-landing-language' ? 'en'
        : key === 'stratus-landing-language-explicit' ? '1' : null,
    },
  } });
  try {
    const markup = renderToStaticMarkup(<WorkspaceLocaleProvider><WalletPaymentPreview/></WorkspaceLocaleProvider>);
    expect(markup).toContain('Amount in USD');
    expect(markup).toContain('$280.90 · +50%');
    expect(markup).toContain('$5.62');
    expect(markup).not.toContain('₽');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
