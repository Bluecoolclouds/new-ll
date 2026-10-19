import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

const storage = new Map<string, string>()
const session = new Map<string, string>()
const assigned: string[] = []
const location = {
  origin: 'https://gateway.example.test',
  pathname: '/stratus/sign-in',
  search: '',
  assign: (url: string) => assigned.push(url),
}
const mockWindow = {
  location,
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  sessionStorage: {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  },
  setTimeout: (callback: TimerHandler) => {
    if (typeof callback === 'function') callback()
    return 1
  },
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: mockWindow,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: mockWindow.sessionStorage,
})
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: mockWindow.localStorage,
})

const { finishOAuth, startOAuth } = await import('../src/components/auth/auth-api')

const originalFetch = globalThis.fetch
let requests: Array<{ path: string; init: RequestInit }>

beforeEach(() => {
  storage.clear()
  session.clear()
  assigned.length = 0
  location.search = '?redirect=%2Fdashboard'
  requests = []
  globalThis.fetch = mock(async (input: string | URL | Request, init = {}) => {
    const path = String(input)
    requests.push({ path, init })
    const body = path === '/api/oauth/state'
      ? { success: true, data: 'csrf-state' }
      : path === '/api/user/self'
        ? { success: true, data: { id: 42, username: 'fresh-user' } }
        : { success: true }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('LinuxDO completes from its same-origin API callback document', async () => {
  let popupPhase: 'blank' | 'external' | 'callback' = 'blank'
  let closed = false
  const callbackResponse = JSON.stringify({
    success: true,
    data: { id: 57, username: 'linuxdo-user', role: 1 },
  })
  const popup = {
    get closed() { return closed },
    close: () => { closed = true },
    location: {
      assign: (url: string) => {
        popupPhase = 'external'
        expect(new URL(url).searchParams.get('redirect_uri')).toBe(
          'https://gateway.example.test/api/oauth/linuxdo',
        )
      },
      get href() {
        if (popupPhase === 'external') {
          popupPhase = 'callback'
          throw Object.assign(new Error('cross-origin document'), { name: 'SecurityError' })
        }
        return 'https://gateway.example.test/api/oauth/linuxdo'
      },
    },
    document: {
      body: { textContent: callbackResponse },
    },
  } as unknown as Window

  await startOAuth('linuxdo', 'linuxdo-client', undefined, undefined, popup)

  expect(closed).toBe(true)
  expect(storage.get('uid')).toBe('57')
  expect(JSON.parse(storage.get('user')!)).toMatchObject({ username: 'linuxdo-user' })
  expect(assigned).toEqual(['/dashboard'])
  expect(requests.map(({ path }) => path)).toEqual(['/api/user/logout', '/api/oauth/state'])
  expect(requests.some(({ path }) => path === '/api/user/self')).toBe(false)
})

test('LinuxDO does not finish from a success response without a valid user id', async () => {
  let popupPhase: 'blank' | 'external' | 'callback' = 'blank'
  let closed = false
  const popup = {
    get closed() { return closed },
    close: () => { closed = true },
    location: {
      assign: () => { popupPhase = 'external' },
      get href() {
        if (popupPhase === 'external') {
          popupPhase = 'callback'
          throw Object.assign(new Error('cross-origin document'), { name: 'SecurityError' })
        }
        return 'https://gateway.example.test/api/oauth/linuxdo'
      },
    },
    document: {
      body: { textContent: JSON.stringify({ success: true, data: { username: 'missing-id' } }) },
    },
  } as unknown as Window

  await expect(startOAuth('linuxdo', 'linuxdo-client', undefined, undefined, popup))
    .rejects.toThrow('не найден аккаунт')
  expect(closed).toBe(true)
  expect(assigned).toEqual([])
})

test('OIDC and Discord use backend canonical callback URIs from Stratus preview', async () => {
  await startOAuth('oidc', 'oidc-client', 'https://identity.example.test/authorize')
  const oidcUrl = new URL(assigned.pop()!)
  expect(oidcUrl.searchParams.get('redirect_uri')).toBe('https://gateway.example.test/oauth/oidc')
  expect(oidcUrl.searchParams.get('scope')).toBe('openid profile email')

  await startOAuth('discord', 'discord-client')
  const discordUrl = new URL(assigned.pop()!)
  expect(discordUrl.searchParams.get('redirect_uri')).toBe('https://gateway.example.test/oauth/discord')
})

test('generic provider callbacks use the server exchange URI without the preview prefix', async () => {
  await startOAuth('custom-slug', 'custom-client', 'https://identity.example.test/authorize', 'openid')
  const providerUrl = new URL(assigned[0])
  expect(providerUrl.searchParams.get('redirect_uri')).toBe('https://gateway.example.test/oauth/custom-slug')
})

test('self verification includes the stored backend user id, never a bearer token', async () => {
  storage.set('uid', '42')
  const response = await finishOAuth('provider', 'callback-code', 'csrf-state')

  expect(response).toBeUndefined()
  const selfRequest = requests.find(({ path }) => path === '/api/user/self')
  expect(selfRequest).toBeDefined()
  const headers = new Headers(selfRequest?.init.headers)
  expect(headers.get('New-Api-User')).toBe('42')
  expect(headers.has('Authorization')).toBe(false)
  expect(assigned).toEqual(['/dashboard'])
})
