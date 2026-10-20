import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { origin: 'https://stratus.example.test', pathname: '/' },
    localStorage: { getItem: () => null },
  },
});

const originalFetch = globalThis.fetch;
let responseBody: unknown;
let responseStatus: number;
let requests: Array<{ path: string; init?: RequestInit }>;

const { loadPlaygroundModels, PlaygroundApiError } = await import('../src/lib/playground-api');

beforeEach(() => {
  requests = [];
  responseBody = { success: true, data: [{ id: 'model-a' }, { id: 'model-b' }] };
  responseStatus = 200;
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ path: String(input), init });
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('model list uses the account API key and reads the OpenAI data envelope', async () => {
  expect(await loadPlaygroundModels('account-api-key')).toEqual(['model-a', 'model-b']);
  expect(requests[0].path).toBe('/v1/models');
  expect(new Headers(requests[0].init?.headers).get('Authorization')).toBe('Bearer account-api-key');
  expect(requests[0].init?.credentials).toBe('same-origin');
});

test('model list reports application errors returned with HTTP 200', async () => {
  responseBody = { success: false, message: 'get user group failed' };

  await expect(loadPlaygroundModels('account-api-key')).rejects.toMatchObject({
    name: 'PlaygroundApiError',
    message: 'get user group failed',
    status: 200,
  });
});

test('model list keeps the HTTP status for authentication recovery', async () => {
  responseStatus = 401;
  responseBody = { error: { message: 'Invalid token' } };

  try {
    await loadPlaygroundModels('stale-key');
    throw new Error('expected model request to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(PlaygroundApiError);
    expect(error).toMatchObject({ message: 'Invalid token', status: 401 });
  }
});
