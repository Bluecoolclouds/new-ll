import { describe, expect, test } from 'bun:test';
import { copyFor } from '../src/lib/landing-copy';
import { settingsCopyFor } from '../src/lib/settings-copy';
import { workspaceCopyFor } from '../src/lib/workspace-copy';

describe('Stratus user-facing branding', () => {
  test('does not expose the backend product name in either supported language', () => {
    for (const language of ['ru', 'en'] as const) {
      const visibleCopy = [
        ...Object.values(copyFor(language)),
        ...Object.values(workspaceCopyFor(language)),
        ...Object.values(settingsCopyFor(language)),
      ].join('\n');

      expect(visibleCopy).not.toMatch(/new api/i);
    }
  });
});
