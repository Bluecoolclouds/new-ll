import { request, requestFormData } from './api';

export type PlaygroundChatRecord = {
  id: number;
  title: string;
  messages?: string;
  created_at: number;
  updated_at: number;
};

export type PlaygroundChatPage = {
  items: PlaygroundChatRecord[];
  total: number;
  page: number;
  page_size: number;
};

export type PlaygroundMediaRecord = {
  id: number;
  chat_id?: number | null;
  mime_type: string;
  model: string;
  prompt: string;
  created_at: number;
  content_url?: string;
};

export type PlaygroundMediaPage = {
  items: PlaygroundMediaRecord[];
  total: number;
  page: number;
  page_size: number;
};

export function listPlaygroundChats(page = 1) {
  return request<PlaygroundChatPage>(`/api/user/playground/chats?page=${page}`);
}

export function createPlaygroundChat(title: string) {
  return request<PlaygroundChatRecord>(`/api/user/playground/chats?title=${encodeURIComponent(title)}`, { method: 'POST' });
}

export function loadPlaygroundChat(id: number) {
  return request<PlaygroundChatRecord>(`/api/user/playground/chats/${id}`);
}

export function savePlaygroundChat(id: number, title: string, messages: unknown[]) {
  return request<{ saved: boolean }>(`/api/user/playground/chats/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, messages }),
  });
}

export function deletePlaygroundChat(id: number) {
  return request<{ deleted: boolean }>(`/api/user/playground/chats/${id}`, { method: 'DELETE' });
}

export function listPlaygroundMedia(page = 1) {
  return request<PlaygroundMediaPage>(`/api/user/playground/library?page=${page}`);
}

export function deletePlaygroundMedia(id: number) {
  return request<{ deleted: boolean }>(`/api/user/playground/library/${id}`, { method: 'DELETE' });
}

export async function savePlaygroundMedia(file: Blob, fileName: string, model: string, prompt: string, chatId?: number) {
  const form = new FormData();
  form.set('file', file, fileName);
  form.set('model', model);
  form.set('prompt', prompt);
  if (chatId) form.set('chat_id', String(chatId));
  return requestFormData<PlaygroundMediaRecord & { content_url: string }>('/api/user/playground/library', form);
}

export async function imageUrlToBlob(src: string): Promise<Blob> {
  const response = await fetch(src, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось сохранить файл изображения.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Модель вернула файл не в формате изображения.');
  return blob;
}

export async function loadPlaygroundMediaDataUrl(id: number): Promise<string> {
  const response = await fetch(`/api/user/playground/library/${id}/content`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'image/*' },
  });
  if (!response.ok) throw new Error('Could not load the attached image.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the attached image.'));
    reader.onerror = () => reject(new Error('Could not read the attached image.'));
    reader.readAsDataURL(blob);
  });
}

export function playgroundMediaUrl(media: PlaygroundMediaRecord) {
  return media.content_url || `/api/user/playground/library/${media.id}/content`;
}
