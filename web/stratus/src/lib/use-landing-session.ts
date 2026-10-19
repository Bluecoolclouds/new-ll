import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request, type SelfUser } from './api';
import { isVerifiedLandingUser, readLandingIdentity } from './landing-session';

function savedIdentity() {
  try {
    return typeof window === 'undefined' ? null : readLandingIdentity(window.localStorage);
  } catch {
    return null;
  }
}

export function useLandingSession() {
  const [identity, setIdentity] = useState(savedIdentity);
  useEffect(() => {
    const refreshIdentity = () => setIdentity(savedIdentity());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'uid' || event.key === 'user') refreshIdentity();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshIdentity);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refreshIdentity);
    };
  }, []);

  const session = useQuery({
    queryKey: ['stratus', 'landing-session', identity],
    enabled: identity !== null,
    queryFn: async () => {
      // A public landing must never redirect guests merely because a saved
      // identity has outlived its actual server session.
      const user = await request<SelfUser>('/api/user/self', {}, false);
      if (!isVerifiedLandingUser(user, identity)) throw new Error('Сессия аккаунта изменилась.');
      return user;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60_000,
  });
  const isAuthenticated = identity !== null && session.isSuccess
    && isVerifiedLandingUser(session.data, identity);
  return {
    isAuthenticated,
    isChecking: identity !== null && session.isPending,
    hasSavedIdentity: identity !== null,
    user: isAuthenticated ? session.data! : null,
    sessionError: session.error,
  };
}
