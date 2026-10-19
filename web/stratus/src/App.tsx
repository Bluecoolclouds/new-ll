import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import { ErrorBoundary } from './components/error-boundary';
import { request, type SelfUser, type SystemStatus, loginHref } from './lib/api';
import { basePath } from './lib/routes';
import { readWorkspaceLanguage } from './lib/workspace-copy';
import { useParams } from 'wouter';
import { walletReturnTarget } from './lib/wallet-return';

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const LegalPage = lazy(() => import('./components/LegalPages').then((module) => ({ default: module.LegalPage })));
const Docs = lazy(() => import('./components/Docs').then((module) => ({ default: module.Docs })));
const Workspace = lazy(() => import('./components/Workspace').then((module) => ({ default: module.Workspace })));
const SettingsHub = lazy(() => import('./components/SettingsHub').then((module) => ({ default: module.SettingsHub })));
const Wallet = lazy(() => import('./components/Wallet').then((module) => ({ default: module.Wallet })));

const SignInPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordConfirmPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.ResetPasswordConfirmPage })));
const OtpPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.OtpPage })));
const OAuthCallbackPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.OAuthCallbackPage })));
const OAuthLegacyPage = lazy(() => import('./components/auth/AuthPages').then((module) => ({ default: module.OAuthLegacyPage })));

function ProviderCallback() {
  const params = useParams<{ provider: string }>();
  return <OAuthCallbackPage provider={params.provider}/>;
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true, refetchInterval: 30_000 } } });
function PublicLanding() {
  const [setup, setSetup] = useState<boolean | null>(null);
  const language = readWorkspaceLanguage();
  useEffect(() => { request<SystemStatus>('/api/status').then((status) => setSetup(status.setup)).catch(() => setSetup(null)); }, []);
  return <><div className="setup-nudge" aria-live="polite">{setup === false && <a href="/setup">{language === 'en' ? 'Complete Stratus setup before continuing' : 'Завершите настройку Stratus, чтобы продолжить'}</a>}</div><Dashboard/></>;
}

function FullPageRedirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return <div className="guard-state" role="status"><div className="skeleton-bar"/><div className="skeleton-bar short"/>Переходим…</div>;
}

function RouteSkeleton() {
  return <div className="route-skeleton" role="status" aria-label="Загружаем страницу">
    <div className="route-skeleton-nav"/>
    <div className="route-skeleton-hero"/>
    <div className="route-skeleton-line"/>
    <div className="route-skeleton-line short"/>
  </div>;
}

function PaymentReturn() {
  let wallet: string | null = null;
  try { wallet = walletReturnTarget(sessionStorage); } catch { /* Browser storage may be disabled. */ }
  return wallet ? <FullPageRedirect to={wallet}/> : <Workspace/>;
}

function Guard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ok' | 'guest' | 'setup' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    request<SystemStatus>('/api/status')
      .then((status) => status.setup ? request<SelfUser>('/api/user/self') : Promise.reject(new Error('setup-required')))
      .then(() => { if (active) setState('ok'); })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === 'setup-required') setState('setup');
        else if (error instanceof Error && error.message.includes('Сессия')) setState('guest');
        else setState('error');
      });
    return () => { active = false; };
  }, []);
  if (state === 'loading') return <div className="guard-state"><div className="skeleton-bar"/><div className="skeleton-bar short"/>Проверяем сессию…</div>;
  if (state === 'guest') return <FullPageRedirect to={loginHref(window.location.pathname)}/>;
  if (state === 'setup') return <FullPageRedirect to="/setup"/>;
  if (state === 'error') return <div className="guard-state" role="alert">Не удалось проверить аккаунт и статус сервера. Обновите страницу или проверьте соединение. <button onClick={() => window.location.reload()}>Повторить</button></div>;
  return <>{children}</>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <Router base={basePath}>
      <ErrorBoundary>
        <Suspense fallback={<RouteSkeleton/>}>
          <Switch>
            <Route path="/sign-in"><SignInPage/></Route>
            <Route path="/login"><SignInPage/></Route>
            <Route path="/sign-up"><SignUpPage/></Route>
            <Route path="/register"><SignUpPage/></Route>
            <Route path="/forgot-password"><ForgotPasswordPage/></Route>
            <Route path="/reset-password-confirm"><ResetPasswordConfirmPage/></Route>
            <Route path="/reset"><ResetPasswordConfirmPage/></Route>
            <Route path="/user/reset"><ResetPasswordConfirmPage/></Route>
            <Route path="/otp"><OtpPage/></Route>
            <Route path="/oauth"><OAuthLegacyPage/></Route>
            <Route path="/oauth/:provider"><ProviderCallback/></Route>
            <Route path="/"><PublicLanding/></Route>
            <Route path="/privacy"><LegalPage page="privacy"/></Route>
            <Route path="/offer"><LegalPage page="offer"/></Route>
            <Route path="/refund"><LegalPage page="refund"/></Route>
            <Route path="/contacts"><LegalPage page="contacts"/></Route>
            <Route path="/dashboard"><Guard><Workspace/></Guard></Route>
            <Route path="/wallet"><Guard><Wallet/></Guard></Route>
            <Route path="/console/topup"><Guard><Wallet/></Guard></Route>
            <Route path="/console/log"><Guard><PaymentReturn/></Guard></Route>
            <Route path="/usage-logs"><Guard><PaymentReturn/></Guard></Route>
            <Route path="/settings/:section?"><Guard><SettingsHub/></Guard></Route>
            <Route path="/docs"><Docs/></Route>
            <Route path="/docs/:slug"><Docs/></Route>
            <Route><PublicLanding/></Route>
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </Router>
  </QueryClientProvider>;
}
export default App;
