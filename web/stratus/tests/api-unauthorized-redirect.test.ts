import { expect, test } from 'bun:test';

const redirects: string[] = [];
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      origin: 'https://stratus.example.test',
      pathname: '/stratus/settings',
      search: '',
      replace: (url: string) => redirects.push(url),
    },
    localStorage: { getItem: () => null },
  },
});

const { request } = await import('../src/lib/api');

test('an expired session returns to the current Stratus settings page', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'expired' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    await expect(request('/api/user/self')).rejects.toThrow('Сессия не активна');
    expect(redirects).toHaveLength(1);
    const login = new URL(redirects[0], 'https://stratus.example.test');
    expect(login.pathname.endsWith('/sign-in')).toBe(true);
    expect(login.searchParams.get('redirect')).toBe('/stratus/settings');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
