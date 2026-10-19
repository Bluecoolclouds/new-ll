import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { Settings } from '../src/components/Settings';

describe('API key quota meter', () => {
  test('renders a usage bar only for keys with a finite quota', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['stratus', 'tokens', 1], {
      page: 1, page_size: 20, total: 2,
      items: [
        {
          id: 1, name: 'limited-key', key: 'sk-***', status: 1, created_time: 1, accessed_time: 0, expired_time: -1,
          remain_quota: 80, used_quota: 20, unlimited_quota: false, group: 'default',
        },
        {
          id: 2, name: 'unlimited-key', key: 'sk-***', status: 1, created_time: 1, accessed_time: 0, expired_time: -1,
          remain_quota: 0, used_quota: 0, unlimited_quota: true, group: 'default',
        },
      ],
    });
    client.setQueryData(['stratus', 'status'], { quota_per_unit: 500_000, setup: true });
    client.setQueryData(['stratus', 'self'], { id: 1, username: 'test', role: 1, group: 'default', quota: 1, used_quota: 0, request_count: 0 });

    try {
      const html = renderToStaticMarkup(<QueryClientProvider client={client}><Settings/></QueryClientProvider>);
      expect(html.match(/role="progressbar"/g)).toHaveLength(1);
      expect(html).toContain('aria-label="Использование лимита limited-key"');
      expect(html).toContain('aria-valuenow="20"');
      expect(html).toContain('Без ограничения');
    } finally {
      client.clear();
    }
  });
});
