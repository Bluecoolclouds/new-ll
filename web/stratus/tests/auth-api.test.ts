import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

let preferredLanguage: 'ru' | 'en' = 'ru'

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { origin: 'https://gateway.example.test', pathname: '/', search: '' },
    localStorage: {
      getItem: (key: string) => key === 'stratus-landing-language' ? preferredLanguage : null,
    },
  },
})

const {
  passwordLogin,
  completeTwoFactor,
  registerAccount,
  sendEmailCode,
  sendResetEmail,
  resetGeneratedPassword,
} = await import('../src/components/auth/auth-api')

const originalFetch = globalThis.fetch
let responseBody: unknown
let responseStatus: number
let requests: Array<{ path: string; init: RequestInit }>

beforeEach(() => {
  preferredLanguage = 'ru'
  requests = []
  responseBody = { success: true }
  responseStatus = 200
  globalThis.fetch = mock(async (input: string | URL | Request, init = {}) => {
    requests.push({ path: String(input), init })
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('password login uses the real request and session cookie contract', async () => {
  const user = { id: 123, username: 'test-account', role: 1 }
  responseBody = { success: true, data: user }
  expect(await passwordLogin('test-account', 'example-password', 'challenge/value')).toEqual({
    requires2FA: false,
    user,
  })
  expect(requests[0].path).toBe('/api/user/login?turnstile=challenge%2Fvalue')
  expect(requests[0].init.credentials).toBe('include')
  expect(JSON.parse(String(requests[0].init.body))).toEqual({
    username: 'test-account',
    password: 'example-password',
  })
})

test('auth requests use the locale that matches the selected UI language', async () => {
  responseBody = { success: true, data: { id: 123 } }
  await passwordLogin('test-account', 'example-password')
  expect(new Headers(requests[0].init.headers).get('Accept-Language')).toBe('en')

  preferredLanguage = 'en'
  await passwordLogin('test-account', 'example-password')
  expect(new Headers(requests[1].init.headers).get('Accept-Language')).toBe('en')
})

test('a pending two-factor session is not treated as an authenticated user', async () => {
  responseBody = { success: true, data: { require_2fa: true } }
  expect(await passwordLogin('test-account', 'example-password')).toEqual({
    requires2FA: true,
  })
})

test('two-factor confirmation sends the TOTP or recovery code unchanged', async () => {
  responseBody = { success: true, data: { id: 123 } }
  expect(await completeTwoFactor('recovery-code')).toEqual({ id: 123 })
  expect(requests[0].path).toBe('/api/user/login/2fa')
  expect(JSON.parse(String(requests[0].init.body))).toEqual({ code: 'recovery-code' })
})

test('business errors are not presented as a successful sign-in', async () => {
  responseBody = { success: false, message: 'Invalid credentials' }
  await expect(passwordLogin('test-account', 'example-password')).rejects.toThrow('Invalid credentials')
})

test('registration forwards verification and referral fields', async () => {
  await registerAccount({
    username: 'test-account',
    password: 'example-password',
    email: 'test@example.test',
    verification_code: '123456',
    aff_code: 'referral',
    turnstile: 'challenge/value',
  })
  expect(requests[0].path).toBe('/api/user/register?turnstile=challenge%2Fvalue')
  expect(JSON.parse(String(requests[0].init.body))).toMatchObject({
    verification_code: '123456',
    aff_code: 'referral',
  })
})

test('verification and recovery emails use encoded query parameters', async () => {
  await sendEmailCode('test+tag@example.test', 'challenge/value')
  await sendResetEmail('test+tag@example.test', 'challenge/value')
  expect(requests[0].path).toBe('/api/verification?email=test%2Btag%40example.test&turnstile=challenge%2Fvalue')
  expect(requests[1].path).toBe('/api/reset_password?email=test%2Btag%40example.test&turnstile=challenge%2Fvalue')
})

test('password reset requires POST and preserves the generated-password response', async () => {
  responseBody = { success: true, data: 'generated-example-password' }
  expect(await resetGeneratedPassword('test@example.test', 'example-reset-token')).toBe('generated-example-password')
  expect(requests[0].path).toBe('/api/user/reset')
  expect(requests[0].init.method).toBe('POST')
  expect(JSON.parse(String(requests[0].init.body))).toEqual({
    email: 'test@example.test',
    token: 'example-reset-token',
  })
})

test('HTTP failures are explicit even when no business error is available', async () => {
  responseStatus = 503
  responseBody = {}
  await expect(passwordLogin('test-account', 'example-password')).rejects.toThrow('503')
})
