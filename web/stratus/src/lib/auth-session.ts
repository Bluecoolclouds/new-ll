import { basePath, routePath } from './routes'

const DEFAULT_REDIRECT = () => routePath('/dashboard')
const AUTH_PATHS = new Set([
  '/sign-in',
  '/sign-up',
  '/login',
  '/register',
  '/forgot-password',
  '/reset',
  '/user/reset',
  '/reset-password-confirm',
  '/otp',
  '/oauth',
])

function isAuthPath(pathname: string): boolean {
  let path = pathname.replace(/\/+$/, '') || '/'
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
    path = path.slice(basePath.length) || '/'
  }
  if (AUTH_PATHS.has(path)) return true
  return path.startsWith('/oauth/')
}

function isSafePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return false

  try {
    const parsed = new URL(value, window.location.origin)
    return (
      parsed.origin === window.location.origin &&
      !isAuthPath(parsed.pathname)
    )
  } catch {
    return false
  }
}

export function safeAuthRedirect(
  input: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT(),
): string {
  if (typeof input === 'string' && isSafePath(input)) return input
  if (isSafePath(fallback)) return fallback
  return DEFAULT_REDIRECT()
}

function withoutSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSensitiveFields)
  if (value === null || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (/(?:password|token|secret)/i.test(key)) continue
    result[key] = withoutSensitiveFields(item)
  }
  return result
}

export function persistAuthUser(user: Record<string, unknown>): void {
  if (typeof window === 'undefined') return

  const safeUser = withoutSensitiveFields(user) as Record<string, unknown>
  window.localStorage.setItem('user', JSON.stringify(safeUser))
  const id = safeUser.id
  if ((typeof id === 'string' && id.length > 0) || typeof id === 'number') {
    window.localStorage.setItem('uid', String(id))
  }
}

export function finishAuth(
  user: Record<string, unknown>,
  redirect?: string | null,
): void {
  persistAuthUser(user)
  window.location.assign(safeAuthRedirect(redirect))
}

export function getAuthRedirect(): string {
  if (typeof window === 'undefined') return DEFAULT_REDIRECT()
  return safeAuthRedirect(new URLSearchParams(window.location.search).get('redirect'))
}

export function authUrl(path: string, redirect?: string | null): string {
  const target = routePath(path.startsWith('/') ? path : `/${path}`)
  if (redirect == null) return target
  const separator = target.includes('?') ? '&' : '?'
  return `${target}${separator}redirect=${encodeURIComponent(safeAuthRedirect(redirect))}`
}
