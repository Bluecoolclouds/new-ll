import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { GatewaySettings } from '../src/components/GatewaySettings';

describe('AI Gateway settings screen', () => {
  test('shows key-specific routing controls and only the user group models', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['stratus', 'tokens', 1], {
      page: 1, page_size: 20, total: 1,
      items: [{
        id: 7, name: 'production', key: 'sk-***', status: 1, created_time: 1, accessed_time: 0, expired_time: -1,
        remain_quota: 500_000, used_quota: 0, unlimited_quota: true, group: 'default',
        model_limits_enabled: false, model_limits: '', gateway_enabled: false, gateway_profile: 'ordered',
        gateway_daily_limit: 65_000, gateway_monthly_limit: 130_000, gateway_warning_percent: 80, gateway_concurrency_limit: 0,
      }],
    });
    client.setQueryData(['stratus', 'self'], { id: 1, username: 'test', role: 1, group: 'default', quota: 1, used_quota: 0, request_count: 0 });
    client.setQueryData(['stratus', 'status'], { quota_per_unit: 500_000, setup: true });
    client.setQueryData(['stratus', 'pricing'], {
      success: true,
      data: [
        { model_name: 'default-model', owner_by: 'Provider A', quota_type: 0, model_ratio: 1, model_price: 0, completion_ratio: 1, enable_groups: ['default'] },
        { model_name: 'vip-only-model', owner_by: 'Provider B', quota_type: 0, model_ratio: 1, model_price: 0, completion_ratio: 1, enable_groups: ['vip'] },
      ],
      vendors: [], group_ratio: { default: 1, vip: 2 }, usable_group: { default: 'Default', vip: 'VIP' },
    });
    try {
      const html = renderToStaticMarkup(<QueryClientProvider client={client}><GatewaySettings/></QueryClientProvider>);
      expect(html).toContain('AI Gateway');
      expect(html).toContain('production');
      expect(html).toContain('Включить AI Gateway для этого ключа');
      expect(html).toContain('default-model');
      expect(html).not.toContain('vip-only-model');
      expect(html).toContain('Дневной лимит, токены кошелька');
      expect(html).toContain('value="1000000"');
      expect(html).toContain('value="2000000"');
    } finally {
      client.clear();
    }
  });
});
