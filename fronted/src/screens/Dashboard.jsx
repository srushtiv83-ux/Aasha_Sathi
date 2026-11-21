import { useEffect, useRef, useState } from 'react';
import { navigate } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { LOGO_SMALL } from '../components/Logo.jsx';
import VoiceCaptureButton from '../components/VoiceCaptureButton';
import EmergencyGuidance from '../components/EmergencyGuidance.jsx';
import { extractVisit } from '../lib/ai.js';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/session.jsx';
import { speak, startRecording, transcribe } from '../lib/voice.js';
import { useTranslation } from '../lib/i18n.js';
import { formatFollowUp, formatPatientAge, mentionsOverdueVaccination, resolveFollowUp } from '../lib/visitSummary.js';
import { getIndiaGreetingKey, msUntilNextIndiaGreetingBoundary } from '../lib/timeGreeting.js';

const ROW = 'grid grid-cols-[116px_1fr] gap-gutter-sm px-gutter-md py-gutter-sm';
const DT = 'font-label text-label-sm text-light-on-surface-variant';

const EMPTY_DRAFT = {
  visitSummary: '',
  visitDate: '',
  visitType: '',
  aiExtraction: null,
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

function optionalNumber(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str === '' || isNaN(Number(str)) ? null : Number(str);
}

function textList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function parseBloodPressure(value) {
  const match = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg)?\s*$/i.exec(String(value ?? ''));
  if (!match) return { systolic: '', diastolic: '' };
  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (systolic < 50 || systolic > 260 || diastolic < 30 || diastolic > 160) {
    return { systolic: '', diastolic: '' };
  }
  return { systolic: String(systolic), diastolic: String(diastolic) };
}

function temperatureInFahrenheit(record) {
  if (typeof record.temperature !== 'number' || !Number.isFinite(record.temperature)) return '';
  const fahrenheit = record.temperature_unit === 'F'
    ? record.temperature
    : record.temperature_unit === 'C'
      ? (record.temperature * 9) / 5 + 32
      : null;
  return fahrenheit != null && fahrenheit >= 85 && fahrenheit <= 115
    ? String(Number(fahrenheit.toFixed(1)))
    : '';
}

function mergeExtractedVisit(current, record, transcript, preferRecord = false) {
  const bloodPressure = parseBloodPressure(record.blood_pressure);
  const symptoms = textList(record.symptoms);
  const duration = typeof record.duration_of_symptoms === 'string' ? record.duration_of_symptoms.trim() : '';
  const extractedSymptoms = [symptoms.join('; '), duration && `Duration: ${duration}`].filter(Boolean).join('. ');
  const advice = textList(record.advice_given).join('; ');
  const dangerSignsList = textList(record.danger_signs);

  return {
    ...current,
    transcript,
    visitSummary: record.visit_summary?.trim() || current.visitSummary,
    visitType: record.visit_type || current.visitType,
    patientName: preferRecord ? record.beneficiary_name || current.patientName : current.patientName.trim() || record.beneficiary_name || '',
    patientAge: preferRecord ? formatPatientAge(record.age, record.age_months) || current.patientAge : current.patientAge || formatPatientAge(record.age, record.age_months),
    location: preferRecord ? record.beneficiary_location || current.location : current.location.trim() || record.beneficiary_location || '',
    temperature: preferRecord ? temperatureInFahrenheit(record) || current.temperature : current.temperature || temperatureInFahrenheit(record),
    bpSystolic: preferRecord ? bloodPressure.systolic || current.bpSystolic : current.bpSystolic || bloodPressure.systolic,
    bpDiastolic: preferRecord ? bloodPressure.diastolic || current.bpDiastolic : current.bpDiastolic || bloodPressure.diastolic,
    symptoms: preferRecord ? extractedSymptoms || current.symptoms : current.symptoms.trim() || extractedSymptoms,
    dangerStatus: dangerSignsList.length > 0 ? 'observed' : current.dangerStatus,
    dangerSigns: preferRecord ? dangerSignsList.join(', ') || current.dangerSigns : current.dangerSigns.trim() || dangerSignsList.join(', '),
    careGiven: preferRecord ? advice || current.careGiven : current.careGiven.trim() || advice,
    followUpTitle: preferRecord ? record.recommended_action || current.followUpTitle : current.followUpTitle.trim() || record.recommended_action || '',
    followUpDueAt: preferRecord
      ? record.follow_up_date ? resolveFollowUp(record.follow_up_date, current.visitDate) : current.followUpDueAt
      : current.followUpDueAt || resolveFollowUp(record.follow_up_date, current.visitDate),
    aiExtraction: record,
  };
}

function buildVisitPayload(draft) {
  const dangerSigns = draft.dangerSigns
    ? draft.dangerSigns.split(/[,\n]/).map((sign) => sign.trim()).filter(Boolean)
    : [];
  const followUps = draft.followUpTitle?.trim()
    ? [{
        title: draft.followUpTitle.trim(),
        detail: draft.followUpDetail?.trim() || null,
        due_at: draft.followUpDueAt ? new Date(draft.followUpDueAt).toISOString() : null,
      }]
    : [];

  const patientName = draft.patientName?.trim() || 'Beneficiary';
  const systolic = optionalNumber(draft.bpSystolic);
  const diastolic = optionalNumber(draft.bpDiastolic);

  return {
    p_patient_name: patientName,
    p_patient_age: optionalNumber(draft.patientAge),
    p_location: draft.location?.trim() || null,
    p_temperature_f: optionalNumber(draft.temperature),
    p_bp_systolic: (systolic != null && diastolic != null) ? systolic : null,
    p_bp_diastolic: (systolic != null && diastolic != null) ? diastolic : null,
    p_symptoms: draft.symptoms?.trim() || null,
    p_danger_signs: dangerSigns,
    p_care_given: draft.careGiven?.trim() || null,
    p_correction_note: null,
    p_transcript: draft.transcript?.trim() || null,
    p_visit_summary: draft.visitSummary?.trim() || null,
    p_ai_extraction: { ...(draft.aiExtraction || {}), danger_assessment: draft.dangerStatus || 'not_assessed' },
    p_follow_ups: followUps,
  };
}

function describeDraft(draft, t) {
  if (draft.visitSummary.trim()) return `${t('visitSummaryDraft')}. ${draft.visitSummary.trim()}`;
  const dangerSigns = draft.dangerSigns
    ? draft.dangerSigns.split(/[,\n]/).map((sign) => sign.trim()).filter(Boolean)
    : [];
  const parts = [
    draft.patientName && `${t('fieldPatient')} ${draft.patientName.trim()}`,
    draft.patientAge && (draft.patientAge.endsWith(' months') ? draft.patientAge : t('yearsOld', { age: draft.patientAge })),
    draft.location && `${t('fieldLocation')} ${draft.location.trim()}`,
    draft.temperature && t('tempFahrenheitText', { temp: draft.temperature }),
    draft.bpSystolic && draft.bpDiastolic && t('bpText', { sys: draft.bpSystolic, dia: draft.bpDiastolic }),
    draft.symptoms && `${t('fieldSymptoms')}: ${draft.symptoms.trim()}`,
    draft.dangerStatus === 'none' && t('noDangerObserved'),
    draft.dangerStatus === 'observed' && dangerSigns.length > 0 && `${t('fieldDangerSigns')}: ${dangerSigns.join(', ')}`,
    draft.careGiven && `${t('fieldCareGiven')}: ${draft.careGiven.trim()}`,
    draft.followUpTitle && `${t('fieldFollowUp')}: ${draft.followUpTitle.trim()}`,
  ].filter(Boolean);
  const transcript = draft.transcript.trim();
  return `${t('visitSummaryDraft')}. ${parts.join('. ')}${parts.length ? '.' : ''}${transcript ? ` ${t('fieldTranscript')}: ${transcript}` : ''}`;
}

const SPEECH_MODES = [
  { id: 'kanglish', label: 'Kanglish', sub: 'ಕನ್ನಡ + Eng', code: 'kn-IN' },
  { id: 'hunglish', label: 'Hinglish', sub: 'हिंदी + Eng', code: 'hi-IN' },
  { id: 'english', label: 'English', sub: 'Eng', code: 'en-IN' },
];

export default function Dashboard() {
  const { profile, voiceLanguage, signOut, appLanguage } = useSession();
  const t = useTranslation();

  const getInitialSpeechMode = () => {
    try {
      const saved = localStorage.getItem('speech_mode');
      if (saved && SPEECH_MODES.some((m) => m.id === saved)) return saved;
    } catch {
      // ignore
    }
    if (appLanguage === 'Kannada') return 'kanglish';
    if (appLanguage === 'Hindi') return 'hunglish';
    return 'kanglish';
  };

  const [speechMode, setSpeechMode] = useState(getInitialSpeechMode);
  const [shiftId, setShiftId] = useState(() => {
    try {
      return localStorage.getItem('asha_shift') === 'early' ? 'early' : 'standard';
    } catch {
      return 'standard';
    }
  });
  const [greetingKey, setGreetingKey] = useState(() => getIndiaGreetingKey());

  useEffect(() => {
    let timer;
    const updateAtNextBoundary = () => {
      setGreetingKey(getIndiaGreetingKey());
      timer = window.setTimeout(updateAtNextBoundary, msUntilNextIndiaGreetingBoundary());
    };
    timer = window.setTimeout(updateAtNextBoundary, msUntilNextIndiaGreetingBoundary());
    return () => window.clearTimeout(timer);
  }, []);

  const selectSpeechMode = (modeId) => {
    setSpeechMode(modeId);
    try {
      localStorage.setItem('speech_mode', modeId);
    } catch {
      // ignore
    }
  };

  const selectShift = (value) => {
    setShiftId(value);
    try {
      localStorage.setItem('asha_shift', value);
    } catch {
      // Keep the current choice for this session if storage is unavailable.
    }
  };

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [showVaccinationReminder, setShowVaccinationReminder] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const saveInProgressRef = useRef(false);
  const draftRef = useRef(draft);
  const recorderRef = useRef(null);
  const speechAbortRef = useRef(null);
  const mountedRef = useRef(true);
  draftRef.current = draft;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recorderRef.current?.stop();
      speechAbortRef.current?.abort();
    };
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const discardDraft = () => {
    speechAbortRef.current?.abort();
    setDraft(EMPTY_DRAFT);
    setShowSummary(false);
    setInteractionMessage('');
  };

  const confirmAndSave = async (event) => {
    event.preventDefault();
    if (saveInProgressRef.current || saving || recording || transcribing) return;

    saveInProgressRef.current = true;
    setSaving(true);
    setInteractionMessage('');

    try {
      const payload = buildVisitPayload(draft);
      const { data, error } = await supabase.rpc('confirm_visit_with_ai', payload);
      if (!mountedRef.current) return;
      if (error || !data) {
        setInteractionMessage(error?.message
          ? t('errSaveFailed', { msg: error.message })
          : t('errSaveNoId'));
        return;
      }

      setDraft(EMPTY_DRAFT);
      setShowSummary(false);
      setInteractionMessage('');
      navigate('visit-history');
    } catch (err) {
      if (mountedRef.current) setInteractionMessage(t('errSaveFailed', { msg: err?.message || 'Please try again.' }));
    } finally {
      saveInProgressRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
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
      await speak(describeDraft(draft, t), { language: voiceLanguage, signal: controller.signal });
    } catch (err) {
      if (mountedRef.current) setInteractionMessage(err.message);
    } finally {
      if (mountedRef.current) {
        setSpeaking(false);
        if (controller.signal.aborted) setInteractionMessage(t('playbackStopped'));
      }
      if (speechAbortRef.current === controller) speechAbortRef.current = null;
    }
  };

  const captureVisit = async (editingDraft = false) => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (transcribing || saving) return;

    setSuccessMessage('');
    setInteractionMessage('');
    const visitDate = new Date().toISOString();
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
    setDraft((current) => ({ ...current, visitDate: current.visitDate || visitDate }));
    setRecording(true);
    setInteractionMessage(t('listening'));

    try {
      const { wav } = await recorder.result;
      if (!mountedRef.current) return;
      setRecording(false);
      setTranscribing(true);
      setInteractionMessage(t('transcribing'));

      const activeSpeech = SPEECH_MODES.find((m) => m.id === speechMode) || SPEECH_MODES[0];
      const transcript = await transcribe(wav, activeSpeech.code);
      if (!mountedRef.current) return;
      if (!transcript) {
        setInteractionMessage(t('noSpeechRecognized'));
        return;
      }
      const combinedTranscript = [draftRef.current.transcript.trim(), transcript].filter(Boolean).join('\n');
      setDraft((current) => ({ ...current, transcript: combinedTranscript }));
      setShowSummary(true);
      setInteractionMessage(t('transcriptReceived'));

      let extraction;
      try {
        // AI service processes the transcript and predicts the structured visit record
        extraction = await extractVisit(combinedTranscript, { language: speechMode === 'hunglish' ? 'hinglish' : speechMode });
      } catch (err) {
        if (!mountedRef.current) return;
        setInteractionMessage(t('errTranscriptFailed', { msg: err.message }));
        return;
      }
      if (!mountedRef.current) return;
      setDraft((current) => mergeExtractedVisit(current, extraction, combinedTranscript, editingDraft));
      if (mentionsOverdueVaccination(combinedTranscript)) setShowVaccinationReminder(true);
      setInteractionMessage(t('aiSummaryCreated'));
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
    ? draft.dangerSigns.split(/[,\n]/).map((sign) => sign.trim()).filter(Boolean)
    : [];
  const dangerSummary = draft.dangerStatus === 'none'
    ? t('noDangerObserved')
    : draft.dangerStatus === 'observed'
      ? dangerSigns.join(', ') || t('enterObservedSigns')
      : draft.dangerSigns.trim()
        ? t('aiFlaggedReview', { signs: draft.dangerSigns })
        : t('notAssessed');
  const followUpSummary = draft.followUpTitle.trim()
    ? `${draft.followUpTitle.trim()}${draft.aiExtraction?.follow_up_date ? ` · ${formatFollowUp(draft.followUpDueAt, draft.aiExtraction.follow_up_date, voiceLanguage)}` : draft.followUpDueAt ? ` · ${formatFollowUp(draft.followUpDueAt, '', voiceLanguage)}` : ''}`
    : t('notEntered');

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col bg-light-surface">
      {showVaccinationReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-gutter-md" onClick={() => setShowVaccinationReminder(false)}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="vaccination-reminder-title" aria-describedby="vaccination-reminder-description" className="w-full max-w-sm rounded-lg border border-light-outline-variant bg-light-surface-container-lowest p-gutter-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-gutter-sm">
              <Icon name="warning" className="mt-0.5 text-[24px] text-amber-700" />
              <div>
                <h2 id="vaccination-reminder-title" className="font-headline text-headline-md font-bold text-light-on-surface">Vaccination may be overdue</h2>
                <p id="vaccination-reminder-description" className="mt-gutter-xs font-body text-body-md text-light-on-surface-variant">The transcript mentions a vaccination due or missed last week. Please check the vaccination card and confirm the vaccine and due date before saving.</p>
              </div>
            </div>
            <button type="button" autoFocus onClick={() => setShowVaccinationReminder(false)} className="mt-gutter-md min-h-12 w-full rounded-full bg-light-primary px-gutter-md font-label text-label-md text-light-on-primary hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary">Review visit details</button>
          </section>
        </div>
      )}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm border-b border-light-outline-variant">
        <div className="flex flex-col gap-gutter-xs">
          <div className="flex items-center gap-gutter-xs">
            <img src={LOGO_SMALL} alt="ASHA Sathi logo" className="w-6 h-6 rounded-full object-cover border border-light-outline-variant bg-light-surface-container-lowest shrink-0" />
            <span className="font-label text-label-sm text-light-primary">ASHA Sathi</span>
          </div>
          <h1 className="font-display text-display-lg-mobile text-light-on-surface text-balance">{t(greetingKey)}{firstName ? `, ${firstName}` : ''}</h1>
          <div className="flex items-center gap-gutter-xs text-light-on-surface-variant">
            <Icon name="schedule" className="text-[16px]" />
            <select aria-label="Select shift time" value={shiftId} onChange={(event) => selectShift(event.target.value)} className="min-h-10 max-w-full cursor-pointer rounded-md border-0 bg-transparent p-0 pr-1 font-body text-body-md font-bold tabular-nums text-light-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary">
              <option value="standard">{t('shiftTime')}</option>
              <option value="early">{t('shiftTimeEarly')}</option>
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 px-page-margin flex flex-col gap-gutter-lg pb-gutter-xl">
        <section className="py-gutter-md flex flex-col items-center text-center gap-gutter-md">
          <div className="flex flex-col gap-gutter-xs">
            <h2 className="font-display text-headline-lg text-light-on-surface text-balance">{t('readyForVisit')}</h2>
            <p className="font-body text-body-md text-light-on-surface-variant text-pretty">
              {t('tapToRecord')}
            </p>
          </div>
          <VoiceCaptureButton
            state={recording ? 'recording' : transcribing ? 'transcribing' : 'idle'}
            onActivate={captureVisit}
            disabled={saving}
          />
          {/* Options like Kanglish, Hinglish, English */}
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <span className="font-label text-label-xs text-light-on-surface-variant font-medium">
              {t('speechLanguage')}:
            </span>
            <div className="inline-flex p-1 rounded-full bg-light-surface-container-low border border-light-outline-variant gap-1 shadow-inner">
              {SPEECH_MODES.map((mode) => {
                const active = speechMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => selectSpeechMode(mode.id)}
                    className={`px-3 py-1.5 rounded-full font-label text-label-sm transition-all duration-state-change ease-state-change flex items-center gap-1 cursor-pointer ${
                      active
                        ? 'bg-light-primary text-light-on-primary font-bold shadow-sm'
                        : 'text-light-on-surface-variant hover:text-light-on-surface hover:bg-light-surface-container-lowest'
                    }`}
                  >
                    <span>{mode.label}</span>
                    <span className={`text-[10px] ${active ? 'text-light-on-primary/80' : 'text-light-on-surface-variant/70'}`}>
                      ({mode.sub})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {successMessage && (
            <div role="status" className="w-full max-w-sm p-gutter-sm rounded-md bg-confirmed-container text-on-confirmed-container flex items-center justify-center gap-gutter-xs font-body text-body-md">
              <Icon name="check_circle" className="text-[20px] text-confirmed" fill />
              <span>{successMessage}</span>
            </div>
          )}
          {interactionMessage && (
            <p role="status" aria-live="polite" className="font-body text-body-md text-light-on-surface-variant max-w-sm text-center">
              {interactionMessage}
            </p>
          )}
        </section>

        {/* Structured summary displayed exclusively from Speech to Text + AI logic */}
        {showSummary && (
          <section className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant">
            <p className="font-body text-body-sm text-light-on-surface-variant">Review and verify every AI-extracted detail, including danger signs, before confirming and saving.</p>
            <div className="flex items-center justify-between gap-gutter-sm">
              <h2 className="font-headline text-headline-md text-light-on-surface">{t('visitSummaryTitle')}</h2>
              <button
                type="button"
                aria-pressed={speaking}
                onClick={listenToSummary}
                disabled={recording || transcribing || saving}
                className="min-h-10 px-gutter-md rounded-full bg-light-primary text-light-on-primary font-label text-label-sm inline-flex items-center gap-gutter-xs transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name={speaking ? 'stop' : 'volume_up'} className="text-[18px]" />
                <span>{speaking ? t('stopSpeaking') : t('listenToDraft')}</span>
              </button>
            </div>

            <article className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md overflow-hidden">
              <header className="px-gutter-md py-gutter-sm bg-light-surface-container-low border-b border-light-outline-variant flex items-center justify-between gap-gutter-sm">
                <span className="font-label text-label-sm text-light-on-surface-variant">{t('notSaved')}</span>
              </header>

              {draft.visitSummary.trim() && (
                <section className="mx-gutter-md mt-gutter-md p-gutter-md rounded-md bg-light-secondary-container">
                  <h3 className="font-title text-title-md text-light-on-secondary-container">{t('aiGeneratedSummary')}</h3>
                  <p className="mt-gutter-xs font-body text-body-md text-light-on-secondary-container whitespace-pre-wrap">{draft.visitSummary}</p>
                </section>
              )}

              {draft.aiExtraction && (
                <section className="mx-gutter-md mt-gutter-md p-gutter-md rounded-md border border-light-outline-variant bg-light-surface-container-low">
                  <h3 className="font-title text-title-md text-light-on-surface">{t('aiSuggestions')}</h3>
                  <p className="mt-gutter-xs font-body text-body-sm text-light-on-surface-variant">{t('notADiagnosis')}</p>
                  {draft.aiExtraction.risk_level && (
                    <p className="mt-gutter-sm font-headline text-headline-md font-bold text-light-on-surface">{t('potentialRisk', { level: draft.aiExtraction.risk_level })}</p>
                  )}
                  {draft.aiExtraction.risk_reasoning && <p className="mt-gutter-xs font-body text-body-sm text-light-on-surface">{draft.aiExtraction.risk_reasoning}</p>}
                  {draft.aiExtraction.recommended_action && <p className="mt-gutter-xs font-body text-body-sm text-light-on-surface">{t('suggestedNextStep', { action: draft.aiExtraction.recommended_action })}</p>}
                  {draft.aiExtraction.follow_up_date && (
                    <p className="mt-gutter-xs font-body text-body-sm text-light-on-surface">
                      {t('aiFollowUpDate', { date: formatFollowUp(draft.followUpDueAt, draft.aiExtraction.follow_up_date, voiceLanguage) })}
                    </p>
                  )}
                  {(draft.aiExtraction.urgent_referral === true || draft.aiExtraction.risk_level === 'HIGH') && (
                    <div role="alert" className="mt-gutter-sm flex items-start gap-gutter-sm rounded-md border border-light-error/30 bg-light-error-container p-gutter-sm text-light-on-error-container">
                      <Icon name="warning" className="mt-0.5 text-[22px] text-light-error" />
                      <p className="font-headline text-headline-md font-bold">{t('aiFlaggedUrgency')}</p>
                    </div>
                  )}
                  {(draft.aiExtraction.risk_level === 'HIGH' || draft.aiExtraction.urgent_referral === true) && <EmergencyGuidance />}
                  {textList(draft.aiExtraction.safety_alerts).map((alert) => <p key={alert} className="mt-gutter-xs font-body text-body-sm text-light-error">{alert}</p>)}
                  {textList(draft.aiExtraction.danger_signs).length > 0 && (
                    <p className="mt-gutter-sm font-body text-body-sm text-light-error">
                      {t('aiFlaggedDangerSigns', { signs: textList(draft.aiExtraction.danger_signs).join('; ') })}
                    </p>
                  )}
                  {textList(draft.aiExtraction.uncertain_information).length > 0 && (
                    <p className="mt-gutter-sm font-body text-body-sm text-light-on-surface">
                      {t('uncertainDetails', { details: textList(draft.aiExtraction.uncertain_information).join('; ') })}
                    </p>
                  )}
                  {textList(draft.aiExtraction.missing_information).length > 0 && (
                    <p className="mt-gutter-xs font-body text-body-sm text-light-on-surface">
                      {t('infoToReview', { info: textList(draft.aiExtraction.missing_information).join('; ') })}
                    </p>
                  )}
                </section>
              )}

              <dl className="divide-y divide-light-outline-variant">
                {draft.visitType && <div className={`${ROW} items-center`}><dt className={DT}>{t('fieldVisitType')}</dt><dd className="font-body text-body-md text-light-on-surface">{draft.visitType}</dd></div>}
                <div className={`${ROW} items-center`}><dt className={DT}>{t('fieldPatient')}</dt><dd className="font-title text-title-md text-light-on-surface">{draft.patientName.trim() || t('notEntered')}{draft.patientAge ? ` (${draft.patientAge.endsWith(' months') ? draft.patientAge : `${draft.patientAge} ${t('yearsUnit')}`})` : ''}</dd></div>
                {draft.aiExtraction?.immunization_name?.length > 0 && <div className={`${ROW} items-baseline`}><dt className={DT}>Vaccination</dt><dd className="font-body text-body-md text-light-on-surface">{draft.aiExtraction.immunization_name.join(', ')}{draft.aiExtraction.immunization_status ? ` — ${draft.aiExtraction.immunization_status}` : ''}</dd></div>}
                <div className={`${ROW} items-center`}><dt className={DT}>{t('fieldLocation')}</dt><dd className="font-body text-body-md text-light-on-surface">{draft.location.trim() || t('notEntered')}</dd></div>
                <div className={`${ROW} items-center`}><dt className={DT}>{t('fieldTemperature')}</dt><dd className="font-mono text-mono-md text-light-on-surface tabular-nums">{draft.temperature ? `${draft.temperature} °F` : t('notEntered')}</dd></div>
                <div className={`${ROW} items-center`}><dt className={DT}>{t('fieldBloodPressure')}</dt><dd className="font-mono text-mono-md text-light-on-surface tabular-nums">{draft.bpSystolic && draft.bpDiastolic ? `${draft.bpSystolic}/${draft.bpDiastolic} mmHg` : t('notEntered')}</dd></div>
                <div className={`${ROW} items-baseline`}><dt className={DT}>{t('fieldSymptoms')}</dt><dd className="font-body text-body-md text-light-on-surface">{draft.symptoms.trim() || t('notEntered')}</dd></div>
                <div className={`${ROW} items-baseline`}><dt className={DT}>{t('fieldDangerSigns')}</dt><dd className="font-body text-body-md text-light-on-surface">{dangerSummary}</dd></div>
                <div className={`${ROW} items-baseline`}><dt className={DT}>{t('fieldCareGiven')}</dt><dd className="font-body text-body-md text-light-on-surface">{draft.careGiven.trim() || t('notEntered')}</dd></div>
                <div className={`${ROW} items-baseline`}><dt className={DT}>{t('fieldFollowUp')}</dt><dd className="font-body text-body-md text-light-on-surface">{followUpSummary}</dd></div>
                <div className={`${ROW} items-baseline bg-light-surface-container-low`}>
                  <dt className="font-label text-label-sm text-light-primary">{t('fieldTranscript')}</dt>
                  <dd className="font-body text-body-md text-light-on-surface whitespace-pre-wrap">{draft.transcript.trim() || t('tapToSpeak')}</dd>
                </div>
              </dl>
            </article>

            <form onSubmit={confirmAndSave} className="flex flex-col gap-gutter-md">
              <div className="flex items-center gap-gutter-sm">
                <button
                  type="button"
                  onClick={discardDraft}
                  disabled={saving}
                  className="min-w-0 flex-1 min-h-14 px-gutter-md rounded-full bg-light-surface-container-low text-light-on-surface-variant font-label text-label-md transition-colors hover:bg-light-surface-container-lowest border border-light-outline-variant"
                >
                  {t('discardDraft')}
                </button>
                <button
                  type="button"
                  onClick={() => captureVisit(true)}
                  disabled={saving || recording || transcribing}
                  className="min-w-0 flex-1 min-h-14 px-gutter-md rounded-full bg-light-surface-container-low text-light-on-surface-variant font-label text-label-md transition-colors hover:bg-light-surface-container-lowest border border-light-outline-variant disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  type="submit"
                  disabled={saving || recording || transcribing}
                  className="min-w-0 flex-[2] min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm disabled:opacity-60 transition-colors hover:bg-light-primary-container"
                >
                  <Icon name="check_circle" className="text-[22px]" fill />
                  <span>{saving ? t('saving') : t('confirmSave')}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="self-center flex flex-col items-center gap-gutter-xs">
          <button type="button" onClick={() => navigate('visit-history')} className="min-h-11 px-gutter-md rounded-full border border-light-primary font-label text-label-md text-light-primary inline-flex items-center gap-gutter-xs hover:bg-light-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary">
            <Icon name="history" className="text-[18px]" /> Visit History
          </button>
          <button type="button" onClick={signOut} className="min-h-11 px-gutter-md font-label text-label-lg text-light-primary underline underline-offset-4">
            {t('logOut')}
          </button>
        </div>
      </main>
    </div>
  );
}
