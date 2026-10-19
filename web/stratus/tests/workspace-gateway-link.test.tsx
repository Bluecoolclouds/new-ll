import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { Workspace } from '../src/components/Workspace';
import { routePath } from '../src/lib/routes';

describe('cabinet AI Gateway entry point', () => {
  test('shows a direct AI Gateway settings link in the personal cabinet actions', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['stratus', 'self'], {
      id: 0, username: 'test-user', display_name: 'Test User', role: 1, group: 'default',
      quota: 100_000, used_quota: 0, request_count: 0,
    });
    client.setQueryData(['stratus', 'status'], {
      setup: true, quota_per_unit: 500_000, enable_data_export: false,
    });
    client.setQueryData(['stratus', 'logs', 1], { items: [], total: 0, page: 1, page_size: 20 });
    client.setQueryData(['stratus', 'pricing'], {
      success: true, data: [], vendors: [], group_ratio: { default: 1 }, usable_group: { default: 'Default' },
    });

    try {
      const html = renderToStaticMarkup(<QueryClientProvider client={client}><Workspace/></QueryClientProvider>);
      expect(html).toContain('data-testid="link-ai-gateway"');
      expect(html).toContain(`href="${routePath('/settings/gateway')}"`);
      expect(html).toContain('AI Gateway');
    } finally {
      client.clear();
    }
  });
});
