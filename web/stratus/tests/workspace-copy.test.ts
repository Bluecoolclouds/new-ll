import { expect, test } from 'bun:test'
import {
  localizeWorkspaceText,
  readWorkspaceLanguage,
  workspaceCopy,
  workspaceCopyFor,
  workspaceLocale,
} from '../src/lib/workspace-copy'
import { formatCabinetTokens } from '../src/lib/workspace-summary'

test('workspace Russian and English copy have matching, non-empty keys', () => {
  expect(Object.keys(workspaceCopy.en).sort()).toEqual(Object.keys(workspaceCopy.ru).sort())
  expect(Object.values(workspaceCopy.en).every((value) => value.trim().length > 0)).toBe(true)
  expect(Object.values(workspaceCopy.ru).every((value) => value.trim().length > 0)).toBe(true)
})

test('workspace language shares the landing preference', () => {
  expect(readWorkspaceLanguage({ getItem: () => 'en' })).toBe('en')
  expect(readWorkspaceLanguage({ getItem: () => 'ru' })).toBe('ru')
  expect(readWorkspaceLanguage({ getItem: () => 'fr' })).toBe('ru')
  expect(readWorkspaceLanguage({ getItem: () => null }, ['en-US'])).toBe('en')
  expect(readWorkspaceLanguage({ getItem: () => null }, ['fr-FR', 'ru-RU'])).toBe('ru')
  expect(readWorkspaceLanguage({ getItem: () => null }, ['fr-FR'])).toBe('en')
  expect(readWorkspaceLanguage({
    getItem: (key) => key === 'stratus-landing-language' ? 'ru'
      : key === 'stratus-landing-language-explicit' ? '1' : null,
  }, ['en-US'])).toBe('ru')
  expect(workspaceLocale('ru')).toBe('ru-RU')
  expect(workspaceLocale('en')).toBe('en-US')
})

test('saved local workspace messages follow language changes', () => {
  expect(localizeWorkspaceText(workspaceCopyFor('ru').retry, 'en', 'fallback')).toBe(workspaceCopyFor('en').retry)
  expect(localizeWorkspaceText(workspaceCopyFor('en').logsError, 'ru', 'fallback')).toBe(workspaceCopyFor('ru').logsError)
})

test('compact wallet-token values use the selected locale and translated labels', () => {
  expect(formatCabinetTokens(1_200_000, 'ru-RU', 'токенов', 'Недоступно')).toContain('токенов')
  expect(formatCabinetTokens(1_200_000, 'en-US', 'tokens', 'Unavailable')).toContain('tokens')
  expect(formatCabinetTokens(null, 'en-US', 'tokens', 'Unavailable')).toBe('Unavailable')
})
