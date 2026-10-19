import { beforeEach, describe, expect, test } from 'bun:test'

const storage = new Map<string, string>()
const assigned: string[] = []
const location = {
  origin: 'https://gateway.example.test',
  pathname: '/',
  search: '',
  assign: (path: string) => assigned.push(path),
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  },
})

const {
  authUrl,
  finishAuth,
  getAuthRedirect,
  persistAuthUser,
  safeAuthRedirect,
} = await import('../src/lib/auth-session')

beforeEach(() => {
  storage.clear()
  assigned.length = 0
  location.search = ''
})

describe('same-origin authentication redirects', () => {
  test('preserves a valid protected destination and its query', () => {
    expect(safeAuthRedirect('/settings?tab=keys')).toBe('/settings?tab=keys')
    expect(safeAuthRedirect('/wallet')).toBe('/wallet')
  })

  test('rejects external, malformed and auth-loop destinations', () => {
    for (const input of [
      'https://other.example.test/',
      '//other.example.test/',
      '/\\other.example.test/',
      'javascript:alert(1)',
      '/\n/other.example.test/',
      '/sign-in',
      '/sign-in/?redirect=/wallet',
      '/oauth/github?code=example',
      '/user/reset',
    ]) {
      expect(safeAuthRedirect(input)).toBe('/dashboard')
    }
    expect(safeAuthRedirect(null, '//other.example.test')).toBe('/dashboard')
  })

  test('reads and encodes the intended return destination', () => {
    location.search = '?redirect=%2Fsettings%3Ftab%3Dkeys'
    expect(getAuthRedirect()).toBe('/settings?tab=keys')
    expect(authUrl('/sign-in', getAuthRedirect())).toBe(
      '/sign-in?redirect=%2Fsettings%3Ftab%3Dkeys',
    )
  })
})

describe('compatible session metadata', () => {
  test('persists identity without sensitive fields', () => {
    persistAuthUser({
      id: 123,
      username: 'test-account',
      role: 1,
      password: 'must-not-persist',
      access_token: 'must-not-persist',
      nested: { secret: 'must-not-persist', display_name: 'Test' },
    })
    expect(storage.get('uid')).toBe('123')
    expect(JSON.parse(storage.get('user')!)).toEqual({
      id: 123,
      username: 'test-account',
      role: 1,
      nested: { display_name: 'Test' },
    })
  })

  test('finishes authentication with a full page load', () => {
    finishAuth({ id: 123, username: 'test-account' }, '/settings')
    expect(assigned).toEqual(['/settings'])
    expect(storage.get('uid')).toBe('123')
  })
})
