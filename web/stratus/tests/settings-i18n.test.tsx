import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceLocaleProvider } from '../src/lib/workspace-locale';

describe('settings pages in English', () => {
  test('translates API keys, profile, security, and AI Gateway without changing account data', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['stratus', 'tokens', 1], {
      page: 1, page_size: 20, total: 1,
      items: [{
        id: 7, name: 'production', key: 'sk-***', status: 1, created_time: 1, accessed_time: 0, expired_time: -1,
        remain_quota: 500_000, used_quota: 0, unlimited_quota: false, group: 'default',
        model_limits_enabled: false, model_limits: '', gateway_enabled: false, gateway_profile: 'ordered',
        gateway_daily_limit: 65_000, gateway_monthly_limit: 130_000, gateway_warning_percent: 80, gateway_concurrency_limit: 0,
      }],
    });
    client.setQueryData(['stratus', 'self'], {
      id: 1, username: 'test-user', display_name: 'Test User', email: 'test@example.com',
      role: 1, group: 'default', quota: 1, used_quota: 0, request_count: 0,
    });
    client.setQueryData(['stratus', 'status'], {
      quota_per_unit: 500_000, setup: true, turnstile_check: false, passkey_login: true,
    });
    client.setQueryData(['stratus', 'twofa'], { enabled: false, locked: false, backup_codes_remaining: 0 });
    client.setQueryData(['stratus', 'passkey'], { enabled: false, last_used_at: null });
    client.setQueryData(['stratus', 'pricing'], {
      success: true,
      data: [{ model_name: 'model-a', owner_by: 'Provider A', quota_type: 0, model_ratio: 1, model_price: 0, completion_ratio: 1, enable_groups: ['default'] }],
      vendors: [], group_ratio: { default: 1 }, usable_group: { default: 'Default' },
    });

    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/stratus/settings', search: '' },
        localStorage: { getItem: (key: string) => key === 'stratus-landing-language' ? 'en' : null, setItem: () => {} },
      },
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { credentials: undefined } });
    try {
      const [{ GatewaySettings }, { ProfileSettings, SecuritySettings }, { Settings }] = await Promise.all([
        import('../src/components/GatewaySettings'),
        import('../src/components/ProfileSecurity'),
        import('../src/components/Settings'),
      ]);
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <WorkspaceLocaleProvider>
            <Settings/><ProfileSettings/><SecuritySettings/><GatewaySettings/>
          </WorkspaceLocaleProvider>
        </QueryClientProvider>,
      );
      expect(html).toContain('API keys');
      expect(html).toContain('Wallet-token limit');
      expect(html).toContain('Profile details');
      expect(html).toContain('Email address');
      expect(html).toContain('Two-factor verification');
      expect(html).toContain('Secrets are not stored');
      expect(html).toContain('Routing profile');
      expect(html).toContain('Daily limit, wallet tokens');
      expect(html).toContain('test-user');
      expect(html).not.toContain('Данные профиля');
      expect(html).not.toContain('Двухэтапная проверка');
      expect(html).not.toContain('Дневной лимит, токены кошелька');
      expect(html).not.toMatch(/[А-Яа-яЁё]/);
    } finally {
      client.clear();
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
      if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });
});
