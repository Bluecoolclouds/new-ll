import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authCopyFor, readAuthLanguage, type AuthCopy, type AuthLanguage } from '../../lib/auth-copy';

type AuthLocaleValue = {
  language: AuthLanguage;
  copy: AuthCopy;
  setLanguage: (language: AuthLanguage) => void;
};

const AuthLocaleContext = createContext<AuthLocaleValue | null>(null);

export function AuthLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AuthLanguage>(() => readAuthLanguage());

  const setLanguage = (next: AuthLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem('stratus-landing-language', next);
      window.localStorage.setItem('stratus-landing-language-explicit', '1');
    } catch { /* storage can be unavailable */ }
    document.documentElement.lang = next;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <AuthLocaleContext.Provider value={{ language, copy: authCopyFor(language), setLanguage }}>
      {children}
    </AuthLocaleContext.Provider>
  );
}

export function useAuthLanguage() {
  const value = useContext(AuthLocaleContext);
  if (!value) throw new Error('Auth pages must be rendered inside AuthLanguageProvider.');
  return value;
}

export function AuthLanguageSwitch() {
  const { language, copy, setLanguage } = useAuthLanguage();
  return (
    <div className="auth-locale" role="group" aria-label={copy.language}>
      <button type="button" onClick={() => setLanguage('ru')} aria-pressed={language === 'ru'} aria-label="Русский" data-testid="auth-language-ru">RU</button>
      <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} aria-label="English" data-testid="auth-language-en">EN</button>
    </div>
  );
}
