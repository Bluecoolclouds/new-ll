import { describe, expect, test } from 'bun:test';
import { legalCopy, type LegalPageKind } from '../src/lib/legal-copy';

const pages: LegalPageKind[] = ['privacy', 'offer', 'refund', 'contacts'];

describe('Stratus information pages', () => {
  test('all four pages have complete Russian and English copy', () => {
    for (const page of pages) {
      for (const language of ['ru', 'en'] as const) {
        const copy = legalCopy[language].pages[page];
        expect(copy.title.trim().length).toBeGreaterThan(0);
        expect(copy.intro.trim().length).toBeGreaterThan(0);
        expect(copy.sections.length).toBeGreaterThan(0);
        expect(copy.sections.every((section) =>
          section.title.trim().length > 0 &&
          section.paragraphs.length > 0 &&
          section.paragraphs.every((paragraph) => paragraph.trim().length > 0),
        )).toBe(true);
      }
    }
  });

  test('refund policy includes the approved usage threshold and time windows', () => {
    const russian = legalCopy.ru.pages.refund.sections.flatMap((section) => section.paragraphs).join(' ');
    const english = legalCopy.en.pages.refund.sections.flatMap((section) => section.paragraphs).join(' ');

    expect(russian).toContain('35%');
    expect(russian).toContain('24 часов');
    expect(russian).toContain('48 часов');
    expect(russian).toContain('72 часов');
    expect(english).toContain('35%');
    expect(english).toContain('24 hours');
    expect(english).toContain('48 hours');
    expect(english).toContain('72 hours');
  });

  test('contact page uses only the supplied Stratus support handle', () => {
    for (const language of ['ru', 'en'] as const) {
      const contactCopy = legalCopy[language].pages.contacts.sections.flatMap((section) => section.paragraphs).join(' ');
      expect(contactCopy).toContain('@wpnetwork_sup');
      expect(contactCopy).not.toMatch(/codex|@Codexalo/i);
    }
  });
});
