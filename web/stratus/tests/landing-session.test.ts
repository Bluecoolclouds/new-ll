import { describe, expect, test } from 'bun:test';
import { isVerifiedLandingUser, readLandingIdentity } from '../src/lib/landing-session';

function storage(values: Record<string, string> = {}) {
  return { getItem: (key: string) => values[key] ?? null };
}

describe('landing identity hints', () => {
  test('guest without identity remains a guest', () => {
    expect(readLandingIdentity(null)).toBeNull();
    expect(readLandingIdentity(storage())).toBeNull();
    expect(isVerifiedLandingUser({ id: 3 }, null)).toBe(false);
  });
  test('supports the existing uid and legacy user storage formats', () => {
    expect(readLandingIdentity(storage({ uid: '3' }))).toBe('3');
    expect(readLandingIdentity(storage({ user: '{"id":3}' }))).toBe('3');
    expect(readLandingIdentity(storage({ user: '{"id":"3"}' }))).toBe('3');
    expect(readLandingIdentity(storage({ uid: '3', user: '{"id":4}' }))).toBe('3');
  });
  test('malformed or inaccessible browser storage cannot break the public landing', () => {
    for (const user of ['{broken', 'null', '[]', '"guest"', '{"id":0}', '{"id":-3}', '{"role":100}']) {
      expect(readLandingIdentity(storage({ user }))).toBeNull();
    }
    expect(readLandingIdentity({ getItem: () => { throw new Error('Storage unavailable'); } })).toBeNull();
  });
  test('requires a positive safe integer, not arbitrary text or a role claim', () => {
    for (const uid of ['0', '-3', '3.5', 'Infinity', 'NaN', '3e2', '9007199254740992', 'admin']) {
      expect(readLandingIdentity(storage({ uid }))).toBeNull();
    }
    expect(readLandingIdentity(storage({ uid: '003' }))).toBe('3');
  });
});

describe('server-confirmed landing session', () => {
  test('only accepts an actual user matching the requested identity', () => {
    expect(isVerifiedLandingUser({ id: 3, username: 'fixture' }, '3')).toBe(true);
    expect(isVerifiedLandingUser({ id: 4 }, '3')).toBe(false);
    expect(isVerifiedLandingUser({ id: -3 }, '3')).toBe(false);
    expect(isVerifiedLandingUser({ id: null }, '3')).toBe(false);
  });
  test('empty or error-shaped responses never turn a saved identity into authentication', () => {
    for (const value of [null, undefined, [], {}, { success: false }, '3']) {
      expect(isVerifiedLandingUser(value, '3')).toBe(false);
    }
  });
});
