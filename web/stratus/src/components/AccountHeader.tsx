import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { logout, request, type SelfUser } from '../lib/api';
import { basePath } from '../lib/routes';
import { workspaceCopyFor, type WorkspaceLanguage } from '../lib/workspace-copy';
import './account-header.css';

type Area = 'cabinet' | 'settings' | 'docs' | 'wallet';

export function AccountHeader({ active, language, onLanguageChange }: {
  active: Area;
  language?: WorkspaceLanguage;
  onLanguageChange?: (language: WorkspaceLanguage) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const copy = workspaceCopyFor(language ?? 'ru');
  const user = useQuery({
    queryKey: ['stratus', 'self'],
    queryFn: () => request<SelfUser>('/api/user/self'),
    retry: false,
  });
  const username = user.data?.display_name || user.data?.username || copy.account;
  const links = [
    { href: `${basePath}/dashboard`, label: copy.cabinet, id: 'cabinet' },
    { href: `${basePath}/settings`, label: copy.settings, id: 'settings' },
    { href: `${basePath}/docs`, label: copy.docs, id: 'docs' },
  ];

  return <div className="account-header-wrap">
    <nav className="account-header" aria-label={copy.navLabel} data-testid="account-header">
      <a href={`${basePath}/`} className="account-header-brand" aria-label={copy.home}>stratus<span>/</span>hub</a>
      <div className="account-header-links">
        {links.map((link) => <a key={link.id} href={link.href} aria-current={active === link.id ? 'page' : undefined} className={active === link.id ? 'is-active' : ''}>{link.label}</a>)}
      </div>
      <div className="account-header-user">
        <span className="account-header-name" title={username}>{username}</span>
        {language && onLanguageChange && <div className="account-header-language" role="group" aria-label={copy.language}>
          <button type="button" aria-label={copy.russian} aria-pressed={language === 'ru'} onClick={() => onLanguageChange('ru')}>RU</button>
          <button type="button" aria-label={copy.english} aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
        </div>}
        <button type="button" className="account-header-logout" aria-label={copy.logoutAria} onClick={() => void logout(language ?? 'ru')}><LogOut size={15}/><span>{copy.logout}</span></button>
        <button type="button" className="account-header-menu" aria-label={menuOpen ? copy.closeMenu : copy.openMenu} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
          {menuOpen ? <X size={17}/> : <Menu size={17}/>}
        </button>
      </div>
    </nav>
    {menuOpen && <nav className="account-header-mobile" aria-label={copy.sectionNavigation}>
      {links.map((link) => <a key={link.id} href={link.href} aria-current={active === link.id ? 'page' : undefined} className={active === link.id ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
      <span className="account-header-mobile-user">{username}</span>
      <button type="button" onClick={() => void logout(language ?? 'ru')}><LogOut size={15}/>{copy.logoutAria}</button>
    </nav>}
  </div>;
}
