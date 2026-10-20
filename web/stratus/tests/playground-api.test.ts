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

const {
  chooseDefaultChatModel,
  chooseDefaultImageModel,
  classifyPlaygroundModels,
  loadPlaygroundModels,
  PlaygroundApiError,
} = await import('../src/lib/playground-api');

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
  responseBody = {
    success: true,
    data: [
      { id: 'model-a', supported_endpoint_types: ['openai'] },
      { id: 'model-b', supported_endpoint_types: ['image-generation'] },
    ],
  };
  expect(await loadPlaygroundModels('account-api-key')).toEqual([
    { id: 'model-a', supported_endpoint_types: ['openai'] },
    { id: 'model-b', supported_endpoint_types: ['image-generation'] },
  ]);
  expect(requests[0].path).toBe('/v1/models');
  expect(new Headers(requests[0].init?.headers).get('Authorization')).toBe('Bearer account-api-key');
  expect(requests[0].init?.credentials).toBe('same-origin');
});

test('image catalog includes all key-visible image models, GPT Image 2 variants and capability-tagged providers', () => {
  const models = [
    { id: 'gpt-5.5', supported_endpoint_types: ['openai'] },
    { id: 'gpt-image-2', supported_endpoint_types: [] },
    { id: 'gpt-image-2-high', supported_endpoint_types: [] },
    { id: 'imagen-4', supported_endpoint_types: ['image-generation'] },
    { id: 'flux.1', supported_endpoint_types: [] },
    { id: 'gemini-3-pro-image-preview', supported_endpoint_types: ['gemini'] },
    { id: 'nano-banana-pro-preview', supported_endpoint_types: ['gemini'] },
    { id: 'seedream-4.5', supported_endpoint_types: ['openai'] },
    { id: 'dall-e-3', supported_endpoint_types: [] },
    { id: 'text-embedding-3-large', supported_endpoint_types: ['embeddings'] },
    { id: 'claude-opus-5-5', supported_endpoint_types: ['anthropic'] },
  ];
  const pricingModels = [
    { model_name: 'flux.1', supported_endpoint_types: ['image-generation'] },
    { model_name: 'not-in-this-key', supported_endpoint_types: ['image-generation'] },
  ];

  expect(classifyPlaygroundModels(models, pricingModels)).toEqual({
    chatModels: ['gpt-5.5', 'claude-opus-5-5'],
    imageModels: [
      'gpt-image-2',
      'gpt-image-2-high',
      'imagen-4',
      'flux.1',
      'gemini-3-pro-image-preview',
      'nano-banana-pro-preview',
      'seedream-4.5',
      'dall-e-3',
    ],
  });
});

test('playground prefers GPT-5.5 and GPT Image 2 without overriding a valid manual selection', () => {
  expect(chooseDefaultChatModel(['claude-opus-5-5', 'gpt-5.5'], '')).toBe('gpt-5.5');
  expect(chooseDefaultChatModel(['gpt-5-5', 'claude-opus-5-5'], '')).toBe('gpt-5-5');
  expect(chooseDefaultChatModel(['claude-opus-5-5', 'gpt-5.5'], 'claude-opus-5-5')).toBe('claude-opus-5-5');
  expect(chooseDefaultImageModel(['gpt-image-1', 'gpt-image-2-high', 'gpt-image-2'], '')).toBe('gpt-image-2');
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
