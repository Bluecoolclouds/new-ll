import { useEffect, type KeyboardEvent } from 'react';
import { useLocation, useParams } from 'wouter';
import { History, KeyRound, Network, ShieldCheck, UserRound } from 'lucide-react';
import { AccountHeader } from './AccountHeader';
import { Settings as ApiKeysPanel } from './Settings';
import { ProfileSettings, SecuritySettings } from './ProfileSecurity';
import { TopupHistory } from './TopupHistory';
import { GatewaySettings } from './GatewaySettings';
import { getSettingsSection, settingsPath, type SettingsSection } from './settings-route';
import { routePath } from '../lib/routes';
import { WorkspaceLocaleProvider, useWorkspaceLocale } from '../lib/workspace-locale';
import type { WorkspaceCopy } from '../lib/workspace-copy';
import './settings-hub.css';

const tabs: { section: SettingsSection; label: keyof WorkspaceCopy; icon: typeof KeyRound }[] = [
  { section: 'keys', label: 'settingsKeysTab', icon: KeyRound },
  { section: 'profile', label: 'settingsProfileTab', icon: UserRound },
  { section: 'security', label: 'settingsSecurityTab', icon: ShieldCheck },
  { section: 'history', label: 'settingsHistoryTab', icon: History },
  { section: 'gateway', label: 'settingsGatewayTab', icon: Network },
];

function SettingsHubContent() {
  const { language, copy: c, setLanguage } = useWorkspaceLocale();
  const params = useParams<{ section?: string }>();
  const [location, setLocation] = useLocation();
  const section = getSettingsSection(params.section);

  useEffect(() => {
    if (!section) setLocation(settingsPath('keys'), { replace: true });
  }, [section, setLocation]);

  if (!section) return <div className="settings-hub-loading" role="status">{c.settingsLoading}</div>;

  const selectTab = (next: SettingsSection) => setLocation(settingsPath(next));
  const onTabKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.section === section);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    document.getElementById(`settings-tab-${next.section}`)?.focus();
    selectTab(next.section);
  };

  return <div className="account-settings settings-hub">
    <div className="settings-hub-shell">
      <AccountHeader active="settings" language={language} onLanguageChange={setLanguage}/>
      <header className="settings-hub-heading">
        <div className="settings-hub-kicker">{c.settingsKicker}</div>
        <h1>{c.settingsHeading}</h1>
        <p>{c.settingsIntro}</p>
      </header>
      <div className="settings-tabs" role="tablist" aria-label={c.settingsTabsAria}>
        {tabs.map(({ section: key, label, icon: Icon }) => <a
          key={key}
          id={`settings-tab-${key}`}
          className={`settings-tab ${section === key ? 'is-selected' : ''}`}
          href={routePath(settingsPath(key))}
          role="tab"
          aria-selected={section === key}
          aria-controls="settings-panel"
          tabIndex={section === key ? 0 : -1}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            selectTab(key);
          }}
          onKeyDown={onTabKeyDown}
        ><Icon size={15}/><span>{c[label]}</span></a>)}
      </div>
      <main id="settings-panel" className="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${section}`} tabIndex={0} key={section} data-route={location}>
        {section === 'keys' ? <ApiKeysPanel/> : section === 'profile' ? <ProfileSettings/> : section === 'security' ? <SecuritySettings/> : section === 'history' ? <TopupHistory/> : <GatewaySettings/>}
      </main>
    </div>
  </div>;
}

export function SettingsHub() {
  return <WorkspaceLocaleProvider><SettingsHubContent/></WorkspaceLocaleProvider>;
}
