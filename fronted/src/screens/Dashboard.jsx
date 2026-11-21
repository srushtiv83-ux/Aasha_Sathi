import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { LOGO_SMALL } from '../components/Logo.jsx';
import { navigate, saveDemoCorrection } from '../App.jsx';

const BASE_STATE = 'transition-colors duration-state-change ease-state-change';

const ROW = 'grid grid-cols-[116px_1fr] gap-gutter-sm px-gutter-md py-gutter-sm';
const DT = 'font-label text-label-sm text-light-on-surface-variant';

export default function Dashboard() {
  const [online, setOnline] = useState(true);
  const [correcting, setCorrecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const recognitionRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    window.clearTimeout(saveTimerRef.current);
  }, []);

  const statusBtn = online
    ? `inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs min-h-10 rounded-full bg-confirmed-container text-on-confirmed-container border border-confirmed ${BASE_STATE} shrink-0`
    : `inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs min-h-10 rounded-full bg-light-error-container text-light-on-error-container border border-light-error ${BASE_STATE} shrink-0`;
  const statusDot = online
    ? 'inline-block w-2.5 h-2.5 rounded-full bg-confirmed'
    : 'inline-block w-2.5 h-2.5 rounded-full bg-light-error';
  const statusTrack = online
    ? `w-8 h-5 rounded-full bg-confirmed p-0.5 inline-flex items-center justify-end ${BASE_STATE}`
    : `w-8 h-5 rounded-full bg-light-error p-0.5 inline-flex items-center justify-start ${BASE_STATE}`;

  const correctBtn = correcting
    ? `w-full min-h-12 px-gutter-lg rounded-full bg-uncertain-container text-on-uncertain-container border border-uncertain font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm ${BASE_STATE}`
    : `w-full min-h-12 px-gutter-lg rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm ${BASE_STATE} hover:bg-light-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-secondary`;

  const confirmBtn = saved
    ? `w-full min-h-14 px-gutter-lg rounded-full bg-confirmed text-on-confirmed font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm ${BASE_STATE}`
    : `w-full min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm ${BASE_STATE} hover:bg-light-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary`;

  const confirmAndSave = () => {
    if (saved || saveTimerRef.current !== null) return;
    saveDemoCorrection(correctionNote);
    setSaved(true);
    saveTimerRef.current = window.setTimeout(() => navigate('visit-saved'), 900);
  };

  const listenToSummary = () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setInteractionMessage('Spoken playback is not supported in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setInteractionMessage('Playback stopped.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      'Visit summary for Meera Devi, 28 years old. Location Ward 4, Rampur. Temperature 101.4 degrees Fahrenheit. Blood pressure 116 over 74. Symptoms: fever for 2 days and mild body ache. No danger signs detected. Care given: oral rehydration solution, paracetamol, and rest. Follow up today at 6 PM to re-check temperature.'
    );
    utterance.lang = 'en-IN';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setInteractionMessage('Spoken playback is unavailable here. The visit summary remains visible above.');
      }
    };
    setInteractionMessage('');
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const captureCorrection = () => {
    if (correcting) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInteractionMessage('Voice recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setCorrecting(true);
      setInteractionMessage('Listening for a correction. Speak clearly, then wait for the transcript.');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setCorrectionInput(transcript);
      setShowCorrectionForm(true);
      setInteractionMessage(transcript
        ? 'Review the transcript before adding it as a note. It will not change measurements.'
        : 'No correction was captured. Type a correction note below or try again.');
    };
    recognition.onerror = (event) => {
      const reason = event.error === 'not-allowed'
        ? 'Microphone access was denied. Allow microphone access or type a correction note below.'
        : event.error === 'network'
          ? 'Voice recognition needs a network service that is unavailable. Type a correction note below.'
          : `Voice recognition failed (${event.error}). Type a correction note below or try again.`;
      setShowCorrectionForm(true);
      setInteractionMessage(reason);
    };
    recognition.onend = () => {
      setCorrecting(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setInteractionMessage(`Voice recognition could not start: ${error.message}`);
    }
  };

  const addCorrectionNote = (event) => {
    event.preventDefault();
    const note = correctionInput.trim();
    if (!note) {
      setInteractionMessage('Enter a correction note before adding it.');
      return;
    }
    setCorrectionNote(note);
    setCorrectionInput('');
    setShowCorrectionForm(false);
    setInteractionMessage('Correction note added to this demo visit; clinical values are unchanged.');
  };

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col bg-light-surface">
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm border-b border-light-outline-variant">
        <div className="flex flex-col gap-gutter-xs">
          <div className="flex items-center gap-gutter-xs">
            <img src={LOGO_SMALL} alt="ASHA Sathi logo" className="w-6 h-6 rounded-full object-cover border border-light-outline-variant bg-light-surface-container-lowest shrink-0" />
            <span className="font-label text-label-sm text-light-primary">ASHA Sathi · Rampur PHC</span>
          </div>
          <h1 className="font-display text-display-lg-mobile text-light-on-surface text-balance">Good Afternoon, Kavita</h1>
          <div className="flex items-center gap-gutter-xs text-light-on-surface-variant">
            <Icon name="schedule" className="text-[16px]" />
            <span className="font-body text-body-md font-bold text-light-on-surface tabular-nums">Shift: 9:00 AM – 5:00 PM</span>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={online} onClick={() => setOnline(!online)} className={statusBtn}>
          <span className={statusDot}></span>
          <span className="font-label text-label-sm">{online ? 'Online' : 'Offline'}</span>
          <span className={statusTrack}>
            <span className="w-4 h-4 rounded-full bg-light-surface-container-lowest"></span>
          </span>
        </button>
      </header>

      <main className="flex-1 px-page-margin flex flex-col gap-gutter-lg pb-gutter-xl">
        {/* Primary voice CTA */}
        <section className="py-gutter-md flex flex-col items-center text-center gap-gutter-md">
          <div className="flex flex-col gap-gutter-xs">
            <h2 className="font-display text-headline-lg text-light-on-surface text-balance">Ready for a home visit?</h2>
            <p className="font-body text-body-md text-light-on-surface-variant text-pretty">Open a sample urgent-alert scenario. Live transcription is not connected in this demo.</p>
          </div>
          <div className="p-gutter-sm rounded-full bg-light-secondary-container">
            <button
              type="button"
              aria-label="View sample danger-sign alert"
              onClick={() => navigate('danger')}
              className="w-36 h-36 rounded-full bg-light-primary text-light-on-primary flex flex-col items-center justify-center gap-gutter-xs transition-colors duration-state-change ease-state-change hover:bg-light-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary"
            >
              <Icon name="emergency" className="text-[40px]" fill />
              <span className="font-label text-label-lg">View sample alert</span>
            </button>
          </div>
        </section>

        {/* Visit summary */}
        <section className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant">
          <div className="flex items-center justify-between gap-gutter-sm">
            <h2 className="font-headline text-headline-md text-light-on-surface">Sample visit summary</h2>
            <button type="button" aria-pressed={speaking} onClick={listenToSummary} className="min-h-10 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-sm inline-flex items-center gap-gutter-xs">
              <Icon name={speaking ? 'stop' : 'volume_up'} className="text-[18px]" />
              <span>{speaking ? 'Stop listening' : 'Listen'}</span>
            </button>
          </div>

          <article className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md overflow-hidden">
            <header className="px-gutter-md py-gutter-sm bg-light-surface-container-low border-b border-light-outline-variant flex items-center justify-between gap-gutter-sm">
              <span className="font-mono text-mono-md text-light-on-surface-variant tabular-nums">Visit #VS-204 · 10:42 AM</span>
              <span role="status" className="inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs rounded-full bg-confirmed-container text-on-confirmed-container font-label text-label-sm">
                <Icon name="check_circle" className="text-[16px]" fill />
                <span>Confirmed</span>
              </span>
            </header>

            <dl className="divide-y divide-light-outline-variant">
              <div className={`${ROW} items-center`}>
                <dt className={DT}>Patient</dt>
                <dd className="font-title text-title-md text-light-on-surface">Meera Devi (28 yrs)</dd>
              </div>
              <div className={`${ROW} items-center`}>
                <dt className={DT}>Location</dt>
                <dd className="font-body text-body-md text-light-on-surface">Ward 4, Rampur</dd>
              </div>
              <div className={`${ROW} items-center`}>
                <dt className={DT}>Temperature</dt>
                <dd className="font-mono text-mono-md text-light-on-surface tabular-nums">101.4 °F</dd>
              </div>
              <div className={`${ROW} items-center`}>
                <dt className={DT}>Blood pressure</dt>
                <dd className="font-mono text-mono-md text-light-on-surface tabular-nums">116/74 mmHg</dd>
              </div>
              <div className={`${ROW} items-baseline`}>
                <dt className={DT}>Symptoms</dt>
                <dd className="font-body text-body-md text-light-on-surface">Fever (2 days), mild body ache</dd>
              </div>
              <div className={`${ROW} items-center`}>
                <dt className={DT}>Danger signs</dt>
                <dd className="font-body text-body-md text-confirmed">None detected</dd>
              </div>
              <div className={`${ROW} items-baseline`}>
                <dt className={DT}>Care given</dt>
                <dd className="font-body text-body-md text-light-on-surface">ORS, paracetamol, rest</dd>
              </div>
              {correctionNote && (
                <div className={`${ROW} items-baseline`}>
                  <dt className={DT}>Correction note</dt>
                  <dd className="font-body text-body-md text-light-on-surface">{correctionNote}</dd>
                </div>
              )}
              <div className={`${ROW} items-baseline bg-light-surface-container-low`}>
                <dt className="font-label text-label-sm text-light-primary">Follow-up</dt>
                <dd className="font-body text-body-md text-light-on-surface">Today 6:00 PM · Re-check temp</dd>
              </div>
            </dl>
          </article>

          {/* Voice correction + final confirmation */}
          <div className="flex flex-col gap-gutter-sm">
            <button type="button" onClick={captureCorrection} aria-pressed={correcting} className={correctBtn}>
              <Icon name="mic" className="text-[20px]" fill />
              <span>{correcting ? 'Stop listening' : 'Is it correct? Record a correction'}</span>
            </button>

            <button type="button" onClick={confirmAndSave} className={confirmBtn}>
              <Icon name="check_circle" className="text-[22px]" fill />
              <span>{saved ? 'Confirmed & saved' : 'Confirm & save'}</span>
            </button>
          </div>
          {showCorrectionForm && (
            <form onSubmit={addCorrectionNote} className="flex flex-col gap-gutter-sm">
              <label htmlFor="visit-correction" className={DT}>Review or type a correction note</label>
              <textarea
                id="visit-correction"
                rows={3}
                value={correctionInput}
                onChange={(event) => setCorrectionInput(event.target.value)}
                className="w-full px-gutter-md py-gutter-sm rounded-sm bg-light-surface-container-lowest border border-light-outline text-light-on-surface font-body text-body-md focus:border-light-primary focus:ring-1 focus:ring-light-primary"
              />
              <button type="submit" className="w-full min-h-11 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-lg">
                Add correction note
              </button>
            </form>
          )}
          {interactionMessage && (
            <p role="status" aria-live="polite" className="font-body text-body-md text-light-on-surface-variant">
              {interactionMessage}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
