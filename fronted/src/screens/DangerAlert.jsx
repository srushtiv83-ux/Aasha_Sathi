import Icon from '../components/Icon.jsx';
import { useEffect, useState } from 'react';
import { navigate } from '../App.jsx';

export default function DangerAlert() {
  const [speaking, setSpeaking] = useState(false);
  const [referralLogged, setReferralLogged] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speakAlert = () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setMessage('Spoken playback is not supported in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setMessage('Playback stopped.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      'Sample urgent alert. Danger sign detected. Refer Ramesh to Rampur PHC immediately. Call the PHC doctor or emergency services using the official local number.'
    );
    utterance.lang = 'en-IN';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setMessage('Spoken playback is unavailable here. The alert text remains visible above.');
      }
    };
    setMessage('');
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-light-error-container text-light-on-error-container font-body">
      {/* Urgent header */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md bg-light-error text-light-on-error flex items-center justify-between gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm">
          <Icon name="warning" className="text-[32px]" fill />
          <div className="flex flex-col">
            <span className="font-label text-label-sm">URGENT PRIORITY</span>
            <h1 className="font-display text-headline-lg">Danger sign detected</h1>
          </div>
        </div>
        <div className="px-gutter-sm py-gutter-xs rounded-full bg-light-surface-container-lowest text-light-error">
          <span className="font-label text-label-sm">Sample case</span>
        </div>
      </header>

      <main className="flex-1 px-page-margin py-gutter-lg flex flex-col gap-gutter-lg">
        <section className="bg-light-surface-container-lowest border-2 border-light-error rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <span className="font-label text-label-sm text-light-error">Sample patient: Ramesh Kumar (4 yrs)</span>
          <h2 className="font-headline text-headline-md text-light-on-surface">Possible severe pneumonia</h2>
          <ul className="flex flex-col gap-gutter-xs text-light-on-surface">
            <li className="flex items-center gap-gutter-sm">
              <Icon name="emergency" className="text-[20px] text-light-error" fill />
              <span className="font-body text-body-lg">Fast breathing &amp; chest indrawing</span>
            </li>
            <li className="flex items-center gap-gutter-sm">
              <Icon name="thermostat" className="text-[20px] text-light-error" fill />
              <span className="font-body text-body-lg">High fever (103.2°F)</span>
            </li>
          </ul>
        </section>

        <section className="bg-light-surface-container-lowest rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <h3 className="font-title text-title-md text-light-on-surface">Do this right now</h3>
          <p className="font-body text-body-lg text-light-on-surface text-pretty">
            1. Stop routine paperwork and keep the child warm.<br />
            2. Refer immediately to Rampur PHC.<br />
            3. Call the PHC doctor or 108 ambulance now.
          </p>
        </section>

        <section className="bg-light-surface-container-lowest rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <p className="font-body text-body-md text-light-on-surface text-pretty">
            This sample screen demonstrates an urgent referral alert. It does not contact a doctor or emergency service.
          </p>
          <button type="button" aria-pressed={speaking} onClick={speakAlert} className="min-h-11 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-sm inline-flex items-center justify-center gap-gutter-xs">
            <Icon name={speaking ? 'stop' : 'volume_up'} className="text-[18px]" fill />
            <span>{speaking ? 'Stop spoken alert' : 'Hear spoken alert'}</span>
          </button>
        </section>
      </main>

      <footer className="px-page-margin py-gutter-md bg-light-surface-container-lowest border-t border-light-error flex flex-col gap-gutter-sm">
        <button type="button" onClick={() => setMessage('No PHC contact number is configured in this demo. Use the official local PHC or emergency-services number.')} className="w-full min-h-[56px] px-gutter-lg rounded-full bg-light-error text-light-on-error font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm">
          <Icon name="call" className="text-[22px]" />
          <span>Call PHC doctor now</span>
        </button>
        {message && <p role="status" aria-live="polite" className="font-body text-body-md text-light-on-surface">{message}</p>}
        <button type="button" disabled={referralLogged} onClick={() => {
          setReferralLogged(true);
          setMessage('Referral acknowledged in this demo only. No patient record was sent or saved.');
        }} className="w-full min-h-[48px] px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-lg inline-flex items-center justify-center disabled:opacity-70">
          <span>{referralLogged ? 'Referral acknowledged' : 'Acknowledge referral'}</span>
        </button>
        {referralLogged && (
          <button type="button" onClick={() => navigate('dashboard')} className="w-full min-h-[48px] px-gutter-md rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center">
            <span>Back to dashboard</span>
          </button>
        )}
      </footer>
    </div>
  );
}
