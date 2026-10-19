import { describe, expect, test } from 'bun:test';
import { copyFor, landingCopy } from '../src/lib/landing-copy';

describe('public landing RU/EN copy', () => {
  test('both language options have the same complete non-empty copy keys', () => {
    expect(Object.keys(landingCopy.en).sort()).toEqual(Object.keys(landingCopy.ru).sort());
    for (const locale of ['ru', 'en'] as const) {
      expect(Object.values(copyFor(locale)).every((value) => typeof value === 'string' && value.trim().length > 0)).toBe(true);
    }
  });
  test('English is translated UI, not a cosmetic selected-language badge', () => {
    expect(Object.values(landingCopy.en).some((value) => /[А-Яа-яЁё]/.test(value))).toBe(false);
    expect(landingCopy.en.catalog).toBe('Catalog');
    expect(landingCopy.ru.catalog).toBe('Каталог');
    expect(landingCopy.en.createAccount).not.toBe(landingCopy.en.cabinet);
    expect(landingCopy.ru.createAccount).not.toBe(landingCopy.ru.cabinet);
  });
  test('Gateway is identified in both the hero and the features introduction', () => {
    for (const locale of ['ru', 'en'] as const) {
      expect(copyFor(locale).heroBody).toContain('AI Gateway');
      expect(copyFor(locale).featuresTitle).toContain('AI Gateway');
    }
  });
});
