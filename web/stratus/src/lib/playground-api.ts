import { request } from './api';

export type PlaygroundApiKey = {
  tokenId: number;
  key: string;
};

export class MissingDefaultPlaygroundApiKeyError extends Error {
  constructor() {
    super('No active unlimited default API key was found.');
    this.name = 'MissingDefaultPlaygroundApiKeyError';
  }
}

type PlaygroundApiPath = '/v1/models' | '/v1/chat/completions' | '/v1/images/generations';

export async function loadDefaultPlaygroundApiKey(): Promise<PlaygroundApiKey> {
  const token = await request<{ id: number }>('/api/user/playground/default-token', { method: 'POST' });
  if (!Number.isInteger(token.id) || token.id <= 0) throw new MissingDefaultPlaygroundApiKeyError();
  const result = await request<{ key: string }>(`/api/token/${token.id}/key`, { method: 'POST' });
  if (!result.key?.trim()) throw new Error('The default API key could not be retrieved.');
  return { tokenId: token.id, key: result.key };
}

export async function requestWithApiKey<T>(
  path: PlaygroundApiPath,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'omit',
    cache: 'no-store',
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new Error('The API returned an invalid JSON response.');
  }

  if (!response.ok) {
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const error = record.error;
      if (error && typeof error === 'object' && 'message' in error) {
        throw new Error(String((error as { message?: unknown }).message ?? `Request failed (${response.status}).`));
      }
      if (typeof error === 'string') throw new Error(error);
      if (typeof record.message === 'string') throw new Error(record.message);
    }
    throw new Error(`Request failed (${response.status}).`);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('The API returned an invalid response.');
  }
  return body as T;
}

export async function loadPlaygroundModels(apiKey: string): Promise<string[]> {
  const result = await requestWithApiKey<{ data?: Array<{ id?: unknown }> }>('/v1/models', apiKey);
  if (!Array.isArray(result.data)) throw new Error('The API returned an invalid model list.');
  return result.data
    .map((model) => model.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}
