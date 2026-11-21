import Icon from '../components/Icon.jsx';
import { useEffect, useRef, useState } from 'react';
import { navigate } from '../App.jsx';
import { speak } from '../lib/voice.js';
import { useSession } from '../lib/session.jsx';
import { useTranslation } from '../lib/i18n.js';

export default function DangerAlert() {
  const { voiceLanguage } = useSession();
  const t = useTranslation();
  const [speaking, setSpeaking] = useState(false);
  const [referralLogged, setReferralLogged] = useState(false);
  const [message, setMessage] = useState('');

  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const speakAlert = async () => {
    if (speaking) {
      abortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setMessage('');
    setSpeaking(true);
    try {
      await speak(
        t('spokenAlertMessage'),
        { language: voiceLanguage, signal: controller.signal },
      );
    } catch {
      if (mountedRef.current) setMessage(t('spokenUnavailable'));
    } finally {
      if (mountedRef.current) {
        setSpeaking(false);
        if (controller.signal.aborted) setMessage(t('playbackStopped'));
      }
      abortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-light-error-container text-light-on-error-container font-body">
      {/* Urgent header */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md bg-light-error text-light-on-error flex items-center justify-between gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm">
          <Icon name="warning" className="text-[32px]" fill />
          <div className="flex flex-col">
            <span className="font-label text-label-sm">{t('urgentPriority')}</span>
            <h1 className="font-display text-headline-lg">{t('dangerSignDetected')}</h1>
          </div>
        </div>
        <div className="px-gutter-sm py-gutter-xs rounded-full bg-light-surface-container-lowest text-light-error">
          <span className="font-label text-label-sm">{t('sampleCase')}</span>
        </div>
      </header>

      <main className="flex-1 px-page-margin py-gutter-lg flex flex-col gap-gutter-lg">
        <section className="bg-light-surface-container-lowest border-2 border-light-error rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <span className="font-label text-label-sm text-light-error">{t('samplePatientInfo')}</span>
          <h2 className="font-headline text-headline-md text-light-on-surface">{t('possiblePneumonia')}</h2>
          <ul className="flex flex-col gap-gutter-xs text-light-on-surface">
            <li className="flex items-center gap-gutter-sm">
              <Icon name="emergency" className="text-[20px] text-light-error" fill />
              <span className="font-body text-body-lg">{t('fastBreathingAndChest')}</span>
            </li>
            <li className="flex items-center gap-gutter-sm">
              <Icon name="thermostat" className="text-[20px] text-light-error" fill />
              <span className="font-body text-body-lg">{t('highFeverVal')}</span>
            </li>
          </ul>
        </section>

        <section className="bg-light-surface-container-lowest rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <h3 className="font-title text-title-md text-light-on-surface">{t('doThisRightNow')}</h3>
          <p className="font-body text-body-lg text-light-on-surface text-pretty">
            {t('dangerStep1')}<br />
            {t('dangerStep2')}<br />
            {t('dangerStep3')}
          </p>
        </section>

        <section className="bg-light-surface-container-lowest rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <p className="font-body text-body-md text-light-on-surface text-pretty">
            {t('urgentAlertDisclaimer')}
          </p>
          <button type="button" aria-pressed={speaking} onClick={speakAlert} className="min-h-11 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-sm inline-flex items-center justify-center gap-gutter-xs">
            <Icon name={speaking ? 'stop' : 'volume_up'} className="text-[18px]" fill />
            <span>{speaking ? t('stopSpokenAlert') : t('hearSpokenAlert')}</span>
          </button>
        </section>
      </main>

      <footer className="px-page-margin py-gutter-md bg-light-surface-container-lowest border-t border-light-error flex flex-col gap-gutter-sm">
        <button type="button" onClick={() => setMessage(t('noPhcConfiguredDemo'))} className="w-full min-h-[56px] px-gutter-lg rounded-full bg-light-error text-light-on-error font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm">
          <Icon name="call" className="text-[22px]" />
          <span>{t('callPhcDoctorNow')}</span>
        </button>
        {message && <p role="status" aria-live="polite" className="font-body text-body-md text-light-on-surface">{message}</p>}
        <button type="button" disabled={referralLogged} onClick={() => {
          setReferralLogged(true);
          setMessage(t('demoReferralAckMsg'));
        }} className="w-full min-h-[48px] px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-lg inline-flex items-center justify-center disabled:opacity-70">
          <span>{referralLogged ? t('referralAcknowledged') : t('acknowledgeReferral')}</span>
        </button>
        {referralLogged && (
          <button type="button" onClick={() => navigate('dashboard')} className="w-full min-h-[48px] px-gutter-md rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center">
            <span>{t('backToDashboard')}</span>
          </button>
        )}
      </footer>
    </div>
  );
}
