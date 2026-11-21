import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { LOGO_SMALL } from '../components/Logo.jsx';
import { navigate } from '../App.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/session.jsx';
import { speak, startRecording, transcribe } from '../lib/voice.js';

const BASE_STATE = 'transition-colors duration-state-change ease-state-change';
const INPUT =
  'w-full min-h-11 px-gutter-md py-gutter-xs rounded-sm bg-light-surface-container-lowest border border-light-outline text-light-on-surface font-body text-body-md focus:border-light-primary focus:ring-1 focus:ring-light-primary';
const LABEL = 'font-label text-label-sm text-light-on-surface-variant';

const EMPTY_DRAFT = {
  patientName: '',
  patientAge: '',
  location: '',
  temperature: '',
  bpSystolic: '',
  bpDiastolic: '',
  symptoms: '',
  dangerStatus: '',
  dangerSigns: '',
  careGiven: '',
  transcript: '',
  followUpTitle: '',
  followUpDetail: '',
  followUpDueAt: '',
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function optionalNumber(value) {
  return value.trim() === '' ? null : Number(value);
}

function buildVisitPayload(draft) {
  const dangerSigns = draft.dangerSigns
    .split(/[,\n]/)
    .map((sign) => sign.trim())
    .filter(Boolean);
  const followUps = draft.followUpTitle.trim()
    ? [{
        title: draft.followUpTitle.trim(),
        detail: draft.followUpDetail.trim() || null,
        due_at: draft.followUpDueAt ? new Date(draft.followUpDueAt).toISOString() : null,
      }]
    : [];

  return {
    p_patient_name: draft.patientName.trim(),
    p_patient_age: optionalNumber(draft.patientAge),
    p_location: draft.location.trim() || null,
    p_temperature_f: optionalNumber(draft.temperature),
    p_bp_systolic: optionalNumber(draft.bpSystolic),
    p_bp_diastolic: optionalNumber(draft.bpDiastolic),
    p_symptoms: draft.symptoms.trim() || null,
    p_danger_signs: draft.dangerStatus === 'observed' ? dangerSigns : [],
    p_care_given: draft.careGiven.trim() || null,
    p_correction_note: null,
    p_transcript: draft.transcript.trim() || null,
    p_follow_ups: followUps,
  };
}

function describeDraft(draft) {
  const dangerSigns = draft.dangerSigns
    .split(/[,\n]/)
    .map((sign) => sign.trim())
    .filter(Boolean);
  const parts = [
    draft.patientName && `Patient ${draft.patientName.trim()}`,
    draft.patientAge && `${draft.patientAge} years old`,
    draft.location && `Location ${draft.location.trim()}`,
    draft.temperature && `Temperature ${draft.temperature} degrees Fahrenheit`,
    draft.bpSystolic && draft.bpDiastolic && `Blood pressure ${draft.bpSystolic} over ${draft.bpDiastolic}`,
    draft.symptoms && `Symptoms: ${draft.symptoms.trim()}`,
    draft.dangerStatus === 'none' && 'Worker marked no danger signs',
    draft.dangerStatus === 'observed' && dangerSigns.length > 0 && `Danger signs noted: ${dangerSigns.join(', ')}`,
    draft.careGiven && `Care given: ${draft.careGiven.trim()}`,
    draft.followUpTitle && `Follow-up: ${draft.followUpTitle.trim()}`,
  ].filter(Boolean);
  const transcript = draft.transcript.trim();
  return `Visit draft. ${parts.join('. ')}${parts.length ? '.' : ''}${transcript ? ` Transcript: ${transcript}` : ''}`;
}

const ROW = 'grid grid-cols-[116px_1fr] gap-gutter-sm px-gutter-md py-gutter-sm';
const DT = 'font-label text-label-sm text-light-on-surface-variant';

export default function Dashboard() {
  const { profile, voiceLanguage, signOut } = useSession();
  const [online, setOnline] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const recorderRef = useRef(null);
  const speechAbortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recorderRef.current?.stop();
      speechAbortRef.current?.abort();
    };
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const statusBtn = online
    ? `inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs min-h-10 rounded-full bg-confirmed-container text-on-confirmed-container border border-confirmed ${BASE_STATE} shrink-0`
    : `inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs min-h-10 rounded-full bg-light-error-container text-light-on-error-container border border-light-error ${BASE_STATE} shrink-0`;
  const statusDot = online
    ? 'inline-block w-2.5 h-2.5 rounded-full bg-confirmed'
    : 'inline-block w-2.5 h-2.5 rounded-full bg-light-error';
  const statusTrack = online
    ? `w-8 h-5 rounded-full bg-confirmed p-0.5 inline-flex items-center justify-end ${BASE_STATE}`
    : `w-8 h-5 rounded-full bg-light-error p-0.5 inline-flex items-center justify-start ${BASE_STATE}`;

  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const confirmAndSave = async (event) => {
    event.preventDefault();
    if (saving || recording || transcribing) return;
    if (!draft.patientName.trim()) {
      setInteractionMessage('Enter the patient name before saving this visit.');
      setEditing(true);
      return;
    }
    if (!draft.dangerStatus) {
      setInteractionMessage('Review the danger-sign assessment before saving.');
      setEditing(true);
      return;
    }
    if (draft.dangerStatus === 'observed' && !draft.dangerSigns.trim()) {
      setInteractionMessage('Enter the observed danger signs before saving.');
      setEditing(true);
      return;
    }
    if (Boolean(draft.bpSystolic) !== Boolean(draft.bpDiastolic)) {
      setInteractionMessage('Enter both blood-pressure values, or leave both blank.');
      setEditing(true);
      return;
    }
    if (draft.followUpDueAt && !draft.followUpTitle.trim()) {
      setInteractionMessage('Enter a follow-up action or clear its due time.');
      setEditing(true);
      return;
    }

    setSaving(true);
    setInteractionMessage('');

    const { data, error } = await supabase.rpc('confirm_visit', buildVisitPayload(draft));
    if (!mountedRef.current) return;
    if (error || !data) {
      setSaving(false);
      setInteractionMessage(error?.message
        ? `Could not save this visit: ${error.message}`
        : 'Could not save this visit. The server returned no visit ID.');
      return;
    }

    navigate(`visit-saved/${data}`);
  };

  const listenToSummary = async () => {
    if (speaking) {
      speechAbortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    speechAbortRef.current = controller;
    setInteractionMessage('');
    setSpeaking(true);
    try {
      await speak(describeDraft(draft), { language: voiceLanguage, signal: controller.signal });
    } catch (err) {
      if (mountedRef.current) setInteractionMessage(err.message);
    } finally {
      if (mountedRef.current) {
        setSpeaking(false);
        if (controller.signal.aborted) setInteractionMessage('Playback stopped.');
      }
      if (speechAbortRef.current === controller) speechAbortRef.current = null;
    }
  };

  const captureVisit = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (transcribing || saving) return;

    setInteractionMessage('');
    let recorder;
    try {
      recorder = await startRecording();
    } catch (err) {
      setInteractionMessage(err.message);
      return;
    }

    if (!mountedRef.current) {
      recorder.stop();
      return;
    }
    recorderRef.current = recorder;
    setRecording(true);
    setInteractionMessage('Listening. Tap again to stop; recordings stop automatically after 28 seconds.');

    try {
      const { wav } = await recorder.result;
      if (!mountedRef.current) return;
      setRecording(false);
      setTranscribing(true);
      setInteractionMessage('Transcribing your visit…');

      const transcript = await transcribe(wav, voiceLanguage);
      if (!mountedRef.current) return;
      if (!transcript) {
        setInteractionMessage('No speech was recognized. Try again or enter the visit details manually.');
        return;
      }
      setDraft((current) => ({
        ...current,
        transcript: [current.transcript.trim(), transcript].filter(Boolean).join('\n'),
      }));
      setEditing(true);
      setInteractionMessage('Transcript added. Review it and enter or correct the structured visit details before saving.');
    } catch (err) {
      if (!mountedRef.current) return;
      setInteractionMessage(err.message);
    } finally {
      recorderRef.current = null;
      if (mountedRef.current) {
        setRecording(false);
        setTranscribing(false);
      }
    }
  };

  const dangerSigns = draft.dangerSigns
    .split(/[,\n]/)
    .map((sign) => sign.trim())
    .filter(Boolean);
  const summaryText = describeDraft(draft);
  const hasDraftContent = Object.entries(draft).some(([key, value]) => key !== 'dangerStatus' && value.trim());
  const dangerSummary = draft.dangerStatus === 'none'
    ? 'No danger signs observed (worker confirmed)'
    : draft.dangerStatus === 'observed'
      ? dangerSigns.join(', ') || 'Enter the observed signs'
      : 'Not assessed';
  const followUpSummary = draft.followUpTitle.trim()
    ? `${draft.followUpTitle.trim()}${draft.followUpDueAt ? ` · ${new Date(draft.followUpDueAt).toLocaleString()}` : ''}`
    : 'Not entered';

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col bg-light-surface">
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm border-b border-light-outline-variant">
        <div className="flex flex-col gap-gutter-xs">
          <div className="flex items-center gap-gutter-xs">
            <img src={LOGO_SMALL} alt="ASHA Sathi logo" className="w-6 h-6 rounded-full object-cover border border-light-outline-variant bg-light-surface-container-lowest shrink-0" />
            <span className="font-label text-label-sm text-light-primary">ASHA Sathi{profile?.place ? ` · ${profile.place}` : ''}</span>
          </div>
          <h1 className="font-display text-display-lg-mobile text-light-on-surface text-balance">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
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
        <section className="py-gutter-md flex flex-col items-center text-center gap-gutter-md">
          <div className="flex flex-col gap-gutter-xs">
            <h2 className="font-display text-headline-lg text-light-on-surface text-balance">Ready for a home visit?</h2>
            <p className="font-body text-body-md text-light-on-surface-variant text-pretty">
              Tap to record the visit. Review the transcript and confirm every clinical detail before saving.
            </p>
          </div>
          <div className="p-gutter-sm rounded-full bg-light-secondary-container">
            <button
              type="button"
              aria-label={recording ? 'Stop visit recording' : 'Tap to speak and record a visit'}
              aria-pressed={recording}
              onClick={captureVisit}
              disabled={transcribing || saving}
              className={`w-36 h-36 rounded-full ${recording ? 'bg-light-error text-light-on-error' : 'bg-light-primary text-light-on-primary'} flex flex-col items-center justify-center gap-gutter-xs transition-colors duration-state-change ease-state-change hover:bg-light-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary disabled:opacity-60`}
            >
              <Icon name={recording ? 'stop' : 'mic'} className="text-[40px]" fill />
              <span className="font-label text-label-lg">
                {recording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Tap to speak'}
              </span>
            </button>
          </div>
          <p className="max-w-sm font-body text-body-sm text-light-on-surface-variant">
            Speech is transcribed only. It does not detect danger signs or fill measurements; enter and verify those yourself.
          </p>
        </section>

        <section className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant">
          <div className="flex items-center justify-between gap-gutter-sm">
            <h2 className="font-headline text-headline-md text-light-on-surface">Visit summary draft</h2>
            <button
              type="button"
              aria-pressed={speaking}
              onClick={listenToSummary}
              disabled={!hasDraftContent}
              className="min-h-10 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-sm inline-flex items-center gap-gutter-xs disabled:opacity-60"
            >
              <Icon name={speaking ? 'stop' : 'volume_up'} className="text-[18px]" />
              <span>{speaking ? 'Stop speaking' : 'Listen to draft'}</span>
            </button>
          </div>

          <article className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md overflow-hidden">
            <header className="px-gutter-md py-gutter-sm bg-light-surface-container-low border-b border-light-outline-variant flex items-center justify-between gap-gutter-sm">
              <span className="font-label text-label-sm text-light-on-surface-variant">Not saved</span>
              <span role="status" className="inline-flex items-center gap-gutter-xs px-gutter-sm py-gutter-xs rounded-full bg-uncertain-container text-on-uncertain-container font-label text-label-sm">
                <Icon name="edit_note" className="text-[16px]" />
                <span>Draft</span>
              </span>
            </header>

            <dl className="divide-y divide-light-outline-variant">
              <div className={`${ROW} items-center`}><dt className={DT}>Patient</dt><dd className="font-title text-title-md text-light-on-surface">{draft.patientName.trim() || 'Not entered'}{draft.patientAge ? ` (${draft.patientAge} yrs)` : ''}</dd></div>
              <div className={`${ROW} items-center`}><dt className={DT}>Location</dt><dd className="font-body text-body-md text-light-on-surface">{draft.location.trim() || 'Not entered'}</dd></div>
              <div className={`${ROW} items-center`}><dt className={DT}>Temperature</dt><dd className="font-mono text-mono-md text-light-on-surface tabular-nums">{draft.temperature ? `${draft.temperature} °F` : 'Not entered'}</dd></div>
              <div className={`${ROW} items-center`}><dt className={DT}>Blood pressure</dt><dd className="font-mono text-mono-md text-light-on-surface tabular-nums">{draft.bpSystolic && draft.bpDiastolic ? `${draft.bpSystolic}/${draft.bpDiastolic} mmHg` : 'Not entered'}</dd></div>
              <div className={`${ROW} items-baseline`}><dt className={DT}>Symptoms</dt><dd className="font-body text-body-md text-light-on-surface">{draft.symptoms.trim() || 'Not entered'}</dd></div>
              <div className={`${ROW} items-baseline`}><dt className={DT}>Danger signs</dt><dd className="font-body text-body-md text-light-on-surface">{dangerSummary}</dd></div>
              <div className={`${ROW} items-baseline`}><dt className={DT}>Care given</dt><dd className="font-body text-body-md text-light-on-surface">{draft.careGiven.trim() || 'Not entered'}</dd></div>
              <div className={`${ROW} items-baseline`}><dt className={DT}>Follow-up</dt><dd className="font-body text-body-md text-light-on-surface">{followUpSummary}</dd></div>
              <div className={`${ROW} items-baseline bg-light-surface-container-low`}>
                <dt className="font-label text-label-sm text-light-primary">Transcript</dt>
                <dd className="font-body text-body-md text-light-on-surface whitespace-pre-wrap">{draft.transcript.trim() || 'Tap to speak or edit visit details to begin.'}</dd>
              </div>
            </dl>
          </article>

          <form onSubmit={confirmAndSave} className="flex flex-col gap-gutter-md">
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              aria-expanded={editing}
              className="w-full min-h-11 px-gutter-md rounded-full bg-light-secondary-container text-light-on-secondary-container font-label text-label-lg"
            >
              {editing ? 'Done editing details' : 'Edit visit details'}
            </button>

            {editing && (
              <div className="flex flex-col gap-gutter-md bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
                <p className="font-body text-body-sm text-light-on-surface-variant">
                  The transcript is not interpreted as clinical measurements. Review it and enter each value accurately.
                </p>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Patient name *</span>
                  <input name="patientName" value={draft.patientName} onChange={updateDraft} required maxLength={100} className={INPUT} autoComplete="off" />
                </label>
                <div className="grid grid-cols-2 gap-gutter-sm">
                  <label className="flex flex-col gap-gutter-xs">
                    <span className={LABEL}>Age (years)</span>
                    <input name="patientAge" type="number" min="0" max="120" step="1" value={draft.patientAge} onChange={updateDraft} className={INPUT} />
                  </label>
                  <label className="flex flex-col gap-gutter-xs">
                    <span className={LABEL}>Temperature (°F)</span>
                    <input name="temperature" type="number" min="85" max="115" step="0.1" value={draft.temperature} onChange={updateDraft} className={INPUT} />
                  </label>
                </div>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Patient location</span>
                  <input name="location" value={draft.location} onChange={updateDraft} maxLength={200} className={INPUT} />
                </label>
                <div className="grid grid-cols-2 gap-gutter-sm">
                  <label className="flex flex-col gap-gutter-xs">
                    <span className={LABEL}>Systolic BP</span>
                    <input name="bpSystolic" type="number" min="50" max="260" step="1" value={draft.bpSystolic} onChange={updateDraft} className={INPUT} />
                  </label>
                  <label className="flex flex-col gap-gutter-xs">
                    <span className={LABEL}>Diastolic BP</span>
                    <input name="bpDiastolic" type="number" min="30" max="160" step="1" value={draft.bpDiastolic} onChange={updateDraft} className={INPUT} />
                  </label>
                </div>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Symptoms</span>
                  <textarea name="symptoms" rows={2} maxLength={2000} value={draft.symptoms} onChange={updateDraft} className={INPUT} />
                </label>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Danger-sign assessment *</span>
                  <select name="dangerStatus" value={draft.dangerStatus} onChange={updateDraft} required className={INPUT}>
                    <option value="">Select after assessment</option>
                    <option value="none">No danger signs observed</option>
                    <option value="observed">Danger signs observed</option>
                  </select>
                </label>
                {draft.dangerStatus === 'observed' && (
                  <label className="flex flex-col gap-gutter-xs">
                    <span className={LABEL}>Observed danger signs *</span>
                    <textarea name="dangerSigns" rows={2} maxLength={1000} value={draft.dangerSigns} onChange={updateDraft} className={INPUT} placeholder="Separate signs with commas or new lines" />
                  </label>
                )}
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Care given</span>
                  <textarea name="careGiven" rows={2} maxLength={2000} value={draft.careGiven} onChange={updateDraft} className={INPUT} />
                </label>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Visit transcript (editable)</span>
                  <textarea name="transcript" rows={5} maxLength={10000} value={draft.transcript} onChange={updateDraft} className={INPUT} />
                </label>
                <label className="flex flex-col gap-gutter-xs">
                  <span className={LABEL}>Follow-up action (optional)</span>
                  <input name="followUpTitle" value={draft.followUpTitle} onChange={updateDraft} maxLength={200} className={INPUT} />
                </label>
                {draft.followUpTitle.trim() && (
                  <>
                    <label className="flex flex-col gap-gutter-xs">
                      <span className={LABEL}>Follow-up details</span>
                      <input name="followUpDetail" value={draft.followUpDetail} onChange={updateDraft} maxLength={500} className={INPUT} />
                    </label>
                    <label className="flex flex-col gap-gutter-xs">
                      <span className={LABEL}>Follow-up date and time</span>
                      <input name="followUpDueAt" type="datetime-local" value={draft.followUpDueAt} onChange={updateDraft} className={INPUT} />
                    </label>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || recording || transcribing}
              className="w-full min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm disabled:opacity-60"
            >
              <Icon name="check_circle" className="text-[22px]" fill />
              <span>{saving ? 'Saving…' : 'Confirm & save'}</span>
            </button>
          </form>

          {interactionMessage && (
            <p role="status" aria-live="polite" className="font-body text-body-md text-light-on-surface-variant">
              {interactionMessage}
            </p>
          )}
        </section>

        <button type="button" onClick={signOut} className="self-center min-h-11 px-gutter-md font-label text-label-lg text-light-primary underline underline-offset-4">
          Log out
        </button>
      </main>
    </div>
  );
}
