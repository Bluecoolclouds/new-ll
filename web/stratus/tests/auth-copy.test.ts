import { expect, test } from 'bun:test'
import {
  authCopy,
  authCopyFor,
  authApiLanguage,
  localizeAuthError,
  readAuthLanguage,
} from '../src/lib/auth-copy'

test('Russian and English auth copy stay in sync', () => {
  expect(Object.keys(authCopy.en).sort()).toEqual(Object.keys(authCopy.ru).sort())
  expect(Object.values(authCopy.en).every((value) => value.trim().length > 0)).toBe(true)
  expect(Object.values(authCopy.ru).every((value) => value.trim().length > 0)).toBe(true)
})

test('auth pages reuse the landing language preference and request a supported server locale', () => {
  expect(readAuthLanguage({ getItem: () => 'en' })).toBe('en')
  expect(readAuthLanguage({ getItem: () => 'ru' })).toBe('ru')
  expect(readAuthLanguage({ getItem: () => 'fr' })).toBe('ru')
  expect(authApiLanguage('en')).toBe('en')
  expect(authApiLanguage('ru')).toBe('en')
})

test('known server auth errors are shown in the selected language', () => {
  expect(localizeAuthError('Username or password is incorrect, or user has been banned', 'ru', 'fallback'))
    .toBe(authCopyFor('ru').invalidCredentials)
  expect(localizeAuthError('验证码错误或已过期', 'en', 'fallback'))
    .toBe(authCopyFor('en').invalidVerification)
})

test('locally displayed auth errors follow a language change', () => {
  expect(localizeAuthError(authCopyFor('ru').finishSecurityCheck, 'en', 'fallback'))
    .toBe(authCopyFor('en').finishSecurityCheck)
})
