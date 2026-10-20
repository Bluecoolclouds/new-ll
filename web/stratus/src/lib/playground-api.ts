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

export class PlaygroundApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PlaygroundApiError';
  }
}

export type PlaygroundApiPath =
  | '/v1/models'
  | '/v1/chat/completions'
  | '/v1/images/generations'
  | '/v1/images/edits';

export type PlaygroundChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
};

export type PlaygroundImageSettings = {
  quality: 'auto' | 'low' | 'medium' | 'high';
  size: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  format: 'png' | 'jpeg' | 'webp';
};

export type PlaygroundImageResponse = {
  model?: string;
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
};

export function isGptImageModel(model: string) {
  return /(?:^|\/)gpt[-_]?image(?:[-_]|$)/i.test(model);
}

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
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

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
        throw new PlaygroundApiError(String((error as { message?: unknown }).message ?? `Request failed (${response.status}).`), response.status);
      }
      if (typeof error === 'string') throw new PlaygroundApiError(error, response.status);
      if (typeof record.message === 'string') throw new PlaygroundApiError(record.message, response.status);
    }
    throw new PlaygroundApiError(`Request failed (${response.status}).`, response.status);
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (record.success === false) {
      const error = record.error;
      if (error && typeof error === 'object' && 'message' in error) {
        throw new PlaygroundApiError(String((error as { message?: unknown }).message ?? 'The API rejected the request.'), response.status);
      }
      throw new PlaygroundApiError(typeof record.message === 'string' ? record.message : 'The API rejected the request.', response.status);
    }
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

export async function streamPlaygroundChat(
  apiKey: string,
  model: string,
  messages: PlaygroundChatMessage[],
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<{ model: string; totalTokens?: number }> {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    credentials: 'omit',
    cache: 'no-store',
    signal,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try { errorBody = await response.json(); } catch { /* use status below */ }
    if (errorBody && typeof errorBody === 'object') {
      const record = errorBody as Record<string, unknown>;
      const error = record.error;
      if (error && typeof error === 'object' && 'message' in error) {
        throw new Error(String((error as { message?: unknown }).message ?? `Request failed (${response.status}).`));
      }
      if (typeof record.message === 'string') throw new Error(record.message);
    }
    throw new Error(`Request failed (${response.status}).`);
  }

  if (!response.body) throw new Error('The API returned an empty stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usedModel = model;
  let totalTokens: number | undefined;
  let complete = false;

  const consumeEvent = (event: string) => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data) return;
    if (data === '[DONE]') {
      complete = true;
      return;
    }

    let chunk: {
      model?: unknown;
      usage?: { total_tokens?: unknown };
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    try {
      chunk = JSON.parse(data) as typeof chunk;
    } catch {
      return;
    }
    if (typeof chunk.model === 'string' && chunk.model) usedModel = chunk.model;
    const tokens = chunk.usage?.total_tokens;
    if (typeof tokens === 'number' && Number.isFinite(tokens)) totalTokens = tokens;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) onDelta(delta);
  };

  try {
    while (!complete) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const event of events) {
        consumeEvent(event);
        if (complete) break;
      }
    }
    buffer += decoder.decode();
    if (!complete && buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  return { model: usedModel, ...(totalTokens === undefined ? {} : { totalTokens }) };
}

export async function generatePlaygroundImage(
  apiKey: string,
  model: string,
  prompt: string,
  settings: PlaygroundImageSettings,
  references: readonly File[] = [],
  signal?: AbortSignal,
): Promise<PlaygroundImageResponse> {
  if (references.length > 0) {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('n', '1');
    if (isGptImageModel(model)) {
      form.set('quality', settings.quality);
      form.set('size', settings.size);
      form.set('output_format', settings.format);
    }
    references.forEach((file) => form.append('image[]', file, file.name));
    return requestWithApiKey<PlaygroundImageResponse>('/v1/images/edits', apiKey, {
      method: 'POST',
      body: form,
      signal,
    });
  }

  const body: Record<string, unknown> = { model, prompt, n: 1 };
  if (isGptImageModel(model)) {
    body.quality = settings.quality;
    body.size = settings.size;
    body.output_format = settings.format;
  }
  return requestWithApiKey<PlaygroundImageResponse>('/v1/images/generations', apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}
