export type SettingsSection = 'keys' | 'profile' | 'security' | 'history' | 'gateway';

export function getSettingsSection(value?: string): SettingsSection | null {
  if (!value || value === 'keys') return 'keys';
  if (value === 'profile' || value === 'security' || value === 'history' || value === 'gateway') return value;
  return null;
}

export function settingsPath(section: SettingsSection): string {
  return section === 'keys' ? '/settings' : `/settings/${section}`;
}
