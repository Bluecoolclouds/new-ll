import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  readWorkspaceLanguage,
  workspaceCopyFor,
  type WorkspaceCopy,
  type WorkspaceLanguage,
} from './workspace-copy';

type WorkspaceLocale = {
  language: WorkspaceLanguage;
  copy: WorkspaceCopy;
  setLanguage: (language: WorkspaceLanguage) => void;
};

const fallbackLocale: WorkspaceLocale = {
  language: 'ru',
  copy: workspaceCopyFor('ru'),
  setLanguage: () => {},
};

const WorkspaceLocaleContext = createContext<WorkspaceLocale>(fallbackLocale);

export function WorkspaceLocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<WorkspaceLanguage>(() => readWorkspaceLanguage());
  const setLanguage = useCallback((nextLanguage: WorkspaceLanguage) => {
    setLanguageState(nextLanguage);
    try {
      window.localStorage.setItem('stratus-landing-language', nextLanguage);
      window.localStorage.setItem('stratus-landing-language-explicit', '1');
      document.documentElement.lang = nextLanguage;
    } catch {
      // The UI still switches if browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, copy: workspaceCopyFor(language), setLanguage }), [language, setLanguage]);
  return <WorkspaceLocaleContext.Provider value={value}>{children}</WorkspaceLocaleContext.Provider>;
}

export function useWorkspaceLocale() {
  return useContext(WorkspaceLocaleContext);
}
