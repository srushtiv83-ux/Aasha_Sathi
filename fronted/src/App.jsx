import { useEffect, useState } from 'react';
import Splash from './screens/Splash.jsx';
import Auth from './screens/Auth.jsx';
import Dashboard from './screens/Dashboard.jsx';
import VisitSaved from './screens/VisitSaved.jsx';
import DangerAlert from './screens/DangerAlert.jsx';
import { SessionProvider, useSession } from './lib/session.jsx';
import { useTranslation } from './lib/i18n.js';

// Tiny hash router (no extra dependency).
// Routes: #/splash  #/login  #/register  #/dashboard  #/visit-saved/<visit id>  #/danger
const getRoute = () => (window.location.hash.replace(/^#\/?/, '') || 'splash');

export function navigate(route) {
  window.location.hash = '/' + route;
}

const PUBLIC_ROUTES = new Set(['splash', 'login', 'register']);

function Notice({ title, children }) {
  return (
    <main className="min-h-screen max-w-md mx-auto px-page-margin py-gutter-xl flex flex-col items-center justify-center text-center gap-gutter-sm bg-light-surface">
      <h1 className="font-display text-headline-lg text-light-on-surface">{title}</h1>
      <div className="font-body text-body-md text-light-on-surface-variant text-pretty">{children}</div>
    </main>
  );
}

function Router() {
  const { configured, session, profile, loading, profileLoading } = useSession();
  const t = useTranslation();
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [page, param] = route.split('/');
  const isPublic = PUBLIC_ROUTES.has(page);
  const signedIn = Boolean(session && profile);

  // Redirects run in an effect so the URL stays in sync with what is shown.
  useEffect(() => {
    if (!configured || loading || profileLoading) return;
    if (signedIn && isPublic) navigate('dashboard');
    else if (!signedIn && !isPublic) navigate(session ? 'register' : 'login');
  }, [configured, loading, profileLoading, signedIn, isPublic, session]);

  if (!configured) {
    return (
      <Notice title={t('backendNotConnected')}>
        {t('backendNote')}
      </Notice>
    );
  }
  if (loading || (profileLoading && !isPublic)) return <Notice title="ASHA Sathi">{t('loading')}</Notice>;
  // Public screens stay mounted while a profile loads, so a half-filled form is never lost.
  if (signedIn && isPublic) return null;
  if (!signedIn && !isPublic) return null;

  switch (page) {
    case 'login':
    case 'register':
      return <Auth key={page} initialMode={page} />;
    case 'dashboard':
      return <Dashboard />;
    case 'visit-saved':
      return <VisitSaved visitId={param} />;
    case 'danger':
      return <DangerAlert />;
    default:
      return <Splash />;
  }
}

export default function App() {
  return (
    <SessionProvider>
      <Router />
    </SessionProvider>
  );
}
