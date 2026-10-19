import { describe, expect, it } from 'bun:test';
import { getSettingsSection, settingsPath, type SettingsSection } from '../src/components/settings-route';

describe('unified settings routes', () => {
  it('keeps the existing API keys entry point and supports its explicit alias', () => {
    expect(getSettingsSection()).toBe('keys');
    expect(getSettingsSection('')).toBe('keys');
    expect(getSettingsSection('keys')).toBe('keys');
    expect(settingsPath('keys')).toBe('/settings');
  });

  it('preserves direct links to profile and security tabs', () => {
    for (const section of ['profile', 'security'] as const) {
      expect(getSettingsSection(section)).toBe(section);
      expect(settingsPath(section)).toBe(`/settings/${section}`);
    }
  });

  it('supports a direct link to top-up history', () => {
    expect(getSettingsSection('history')).toBe('history');
    expect(settingsPath('history')).toBe('/settings/history');
  });

  it('supports a direct link to AI Gateway settings', () => {
    expect(getSettingsSection('gateway')).toBe('gateway');
    expect(settingsPath('gateway')).toBe('/settings/gateway');
  });

  it('rejects unknown sections rather than mounting an unrelated panel', () => {
    for (const section of ['password', 'API', 'PROFILE', 'profile/other', '../security']) {
      expect(getSettingsSection(section)).toBeNull();
    }
  });

  it('round-trips every canonical tab URL', () => {
    for (const section of ['keys', 'profile', 'security', 'history', 'gateway'] satisfies SettingsSection[]) {
      const segment = settingsPath(section).split('/')[2];
      expect(getSettingsSection(segment)).toBe(section);
    }
  });
});
