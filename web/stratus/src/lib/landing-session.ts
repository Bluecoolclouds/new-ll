type StorageReader = { getItem(key: string): string | null };

function positiveUserId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

/** Stored identity is only a hint for a server check, never proof of sign-in. */
export function readLandingIdentity(storage: StorageReader | null | undefined): string | null {
  if (!storage) return null;
  try {
    const uid = positiveUserId(storage.getItem('uid'));
    if (uid) return uid;
    const raw = storage.getItem('user');
    if (!raw) return null;
    const user: unknown = JSON.parse(raw);
    if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
    return positiveUserId((user as Record<string, unknown>).id);
  } catch {
    return null;
  }
}

export function isVerifiedLandingUser(value: unknown, identity: string | null): boolean {
  if (!identity || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  return positiveUserId((value as Record<string, unknown>).id) === identity;
}
