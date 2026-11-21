import { useEffect, useState } from 'react';
import Splash from './screens/Splash.jsx';
import Auth from './screens/Auth.jsx';
import Dashboard from './screens/Dashboard.jsx';
import VisitSaved from './screens/VisitSaved.jsx';
import DangerAlert from './screens/DangerAlert.jsx';

// Tiny hash router (no extra dependency).
// Routes: #/splash  #/login  #/register  #/dashboard  #/visit-saved  #/danger
const getRoute = () => (window.location.hash.replace(/^#\/?/, '') || 'splash');

let pendingDemoCorrection = '';

export function navigate(route) {
  window.location.hash = '/' + route;
}

export function saveDemoCorrection(note) {
  pendingDemoCorrection = note;
}

export function consumeDemoCorrection() {
  const note = pendingDemoCorrection;
  pendingDemoCorrection = '';
  return note;
}

export default function App() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  switch (route) {
    case 'login':
    case 'register':
      return <Auth key={route} initialMode={route} />;
    case 'dashboard':
      return <Dashboard />;
    case 'visit-saved':
      return <VisitSaved />;
    case 'danger':
      return <DangerAlert />;
    default:
      return <Splash />;
  }
}
