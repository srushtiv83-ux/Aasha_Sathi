import { useEffect, useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import EmergencyGuidance from '../components/EmergencyGuidance.jsx';
import { navigate } from '../App.jsx';
import { supabase } from '../lib/supabase.js';
import { useTranslation } from '../lib/i18n.js';
import { useSession } from '../lib/session.jsx';

const sameDay = (a, b) => a.toDateString() === b.toDateString();

function describeVisit(visit, t) {
  const parts = [];
  if (visit.temperature_f != null) parts.push(`${t('fieldTemperature')} ${visit.temperature_f}°F`);
  if (visit.symptoms) parts.push(visit.symptoms);
  if (visit.bp_systolic != null && visit.bp_diastolic != null) {
    parts.push(`BP ${visit.bp_systolic}/${visit.bp_diastolic} mmHg`);
  }
  parts.push(visit.danger_signs.length > 0 ? t('dangerSignsPrefix', { signs: visit.danger_signs.join(', ') }) : t('noDangerSignsText'));
  return `${parts.join(' · ')}.`;
}

export default function VisitSaved({ visitId }) {
  const t = useTranslation();
  const { voiceLanguage } = useSession();
  const [state, setState] = useState({ status: 'loading', visit: null, tasks: [] });
  const [message, setMessage] = useState('');

  const timeFormat = useMemo(() => new Intl.DateTimeFormat(voiceLanguage, { hour: 'numeric', minute: '2-digit', hour12: true }), [voiceLanguage]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(voiceLanguage, { day: 'numeric', month: 'short' }), [voiceLanguage]);

  const formatDue = (iso) => {
    if (!iso) return '';
    const due = new Date(iso);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = sameDay(due, new Date()) ? t('today') : sameDay(due, tomorrow) ? t('tomorrow') : dateFormat.format(due);
    return `${day} · ${timeFormat.format(due).toUpperCase()}`;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [visitRes, tasksRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, visited_at, temperature_f, bp_systolic, bp_diastolic, symptoms, danger_signs, correction_note, transcript, visit_summary, ai_extraction, patients(name, age_years)')
          .eq('id', visitId)
          .maybeSingle(),
        supabase
          .from('follow_ups')
          .select('id, title, detail, due_at, done')
          .eq('visit_id', visitId)
          .order('due_at', { ascending: true, nullsFirst: false }),
      ]);
      if (!active) return;
      if (visitRes.error || tasksRes.error || !visitRes.data) {
        setState({ status: visitRes.error || tasksRes.error ? 'error' : 'missing', visit: null, tasks: [] });
        return;
      }
      setState({ status: 'ready', visit: visitRes.data, tasks: tasksRes.data });
    })();
    return () => {
      active = false;
    };
  }, [visitId]);

  const toggleTask = async (task) => {
    const done = !task.done;
    setMessage('');
    setState((s) => ({ ...s, tasks: s.tasks.map((tItem) => (tItem.id === task.id ? { ...tItem, done } : tItem)) }));
    const { error } = await supabase.from('follow_ups').update({ done }).eq('id', task.id);
    if (error) {
      setState((s) => ({ ...s, tasks: s.tasks.map((tItem) => (tItem.id === task.id ? { ...tItem, done: task.done } : tItem)) }));
      setMessage(t('errUpdateTask'));
    }
  };

  const { status, visit, tasks } = state;
  const aiRecord = visit?.ai_extraction && typeof visit.ai_extraction === 'object'
    ? visit.ai_extraction
    : null;
  const aiSafetyAlerts = Array.isArray(aiRecord?.safety_alerts) ? aiRecord.safety_alerts : [];
  const aiDangerSigns = Array.isArray(aiRecord?.danger_signs) ? aiRecord.danger_signs : [];
  const aiUncertainInformation = Array.isArray(aiRecord?.uncertain_information) ? aiRecord.uncertain_information : [];
  const aiMissingInformation = Array.isArray(aiRecord?.missing_information) ? aiRecord.missing_information : [];
  const hasAiGuidance = aiRecord && (
    aiRecord.risk_level && aiRecord.risk_level !== 'UNKNOWN'
    || aiRecord.recommended_action
    || aiRecord.urgent_referral
    || aiSafetyAlerts.length > 0
    || aiDangerSigns.length > 0
    || aiUncertainInformation.length > 0
    || aiMissingInformation.length > 0
    || aiRecord.follow_up_date
  );

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-light-surface">
      <header className="px-page-margin pt-gutter-lg pb-gutter-md bg-confirmed-container text-on-confirmed-container flex items-center gap-gutter-sm">
        <Icon name="check_circle" className="text-[32px]" fill />
        <div className="flex flex-col">
          <span className="font-label text-label-sm">{t('visitConfirmed')}</span>
          <h1 className="font-display text-headline-lg">{t('visitSaved')}</h1>
        </div>
      </header>

      <main className="flex-1 px-page-margin py-gutter-lg flex flex-col gap-gutter-lg">
        {status === 'loading' && (
          <p role="status" className="font-body text-body-md text-light-on-surface-variant">{t('loadingVisit')}</p>
        )}
        {(status === 'error' || status === 'missing') && (
          <p role="alert" className="font-body text-body-md text-light-error">
            {status === 'error' ? t('errLoadVisit') : t('errVisitNotFound')}
          </p>
        )}

        {status === 'ready' && (
          <>
            <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex flex-col gap-gutter-sm">
              <header className="flex items-center justify-between gap-gutter-sm">
                <h2 className="font-title text-title-md text-light-on-surface">
                  {visit.patients.name}{visit.patients.age_years != null ? ` (${visit.patients.age_years} ${t('yearsUnit')})` : ''}
                </h2>
                <span className="font-mono text-mono-md text-light-on-surface-variant tabular-nums">
                  {timeFormat.format(new Date(visit.visited_at)).toUpperCase()}
                </span>
              </header>
              <p className="font-body text-body-md text-light-on-surface-variant">{describeVisit(visit, t)}</p>
            </article>

            {visit.visit_summary && (
              <article className="w-full bg-light-secondary-container rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-secondary-container">{t('visitSummaryTitle')}</h2>
                <p className="font-body text-body-md text-light-on-secondary-container mt-gutter-xs whitespace-pre-wrap">{visit.visit_summary}</p>
                <p className="font-body text-body-sm text-light-on-secondary-container mt-gutter-sm">{t('aiDraftNote')}</p>
              </article>
            )}

            {visit.transcript && (
              <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-surface">{t('visitTranscript')}</h2>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs whitespace-pre-wrap">{visit.transcript}</p>
              </article>
            )}

            {hasAiGuidance && (
              <article className="w-full bg-light-error-container rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-error-container">{t('aiSuggestionsReview')}</h2>
                {aiRecord.risk_level && aiRecord.risk_level !== 'UNKNOWN' && (
                  <p className={`mt-gutter-xs inline-flex rounded-md px-3 py-2 font-headline text-headline-md font-bold ${aiRecord.risk_level === 'HIGH' || aiRecord.urgent_referral === true ? 'bg-red-100 text-red-900' : aiRecord.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-950' : 'bg-green-100 text-green-950'}`}>{t('potentialRisk', { level: aiRecord.risk_level })}</p>
                )}
                {aiRecord.risk_reasoning && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{aiRecord.risk_reasoning}</p>}
                {aiRecord.recommended_action && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{t('suggestedNextStep', { action: aiRecord.recommended_action })}</p>}
                {aiRecord.follow_up_date && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{t('aiFollowUpDate', { date: aiRecord.follow_up_date })}</p>}
                {(aiRecord.urgent_referral === true || aiRecord.risk_level === 'HIGH') && <div role="alert" className="mt-gutter-sm flex items-start gap-gutter-sm rounded-md border border-light-error/30 bg-white/70 p-gutter-sm text-light-on-error-container"><Icon name="warning" className="mt-0.5 text-[22px] text-light-error" /><p className="font-headline text-headline-md font-bold">{t('aiFlaggedUrgency')}</p></div>}
                {(aiRecord.risk_level === 'HIGH' || aiRecord.urgent_referral === true) && <EmergencyGuidance />}
                {aiDangerSigns.length > 0 && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{t('aiFlaggedDangerSigns', { signs: aiDangerSigns.join('; ') })}</p>}
                {aiSafetyAlerts.map((alert) => (
                  <p key={alert} className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{alert}</p>
                ))}
                {aiUncertainInformation.length > 0 && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{t('uncertainDetails', { details: aiUncertainInformation.join('; ') })}</p>}
                {aiMissingInformation.length > 0 && <p className="font-body text-body-md text-light-on-error-container mt-gutter-xs">{t('infoToReview', { info: aiMissingInformation.join('; ') })}</p>}
                <p className="font-body text-body-sm text-light-on-error-container mt-gutter-sm">{t('notADiagnosis')}</p>
              </article>
            )}

            {visit.correction_note && (
              <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-surface">{t('correctionNote')}</h2>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">{visit.correction_note}</p>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">{t('correctionNoteDisclaimer')}</p>
              </article>
            )}

            <section className="flex flex-col gap-gutter-sm">
              <div className="flex items-center justify-between gap-gutter-sm">
                <h2 className="font-headline text-headline-md text-light-on-surface">{t('followUpActions')}</h2>
                <span className="font-label text-label-sm text-light-primary">
                  {tasks.length === 1
                    ? t('tasksCreated', { n: tasks.length })
                    : t('tasksCreatedPlural', { n: tasks.length })}
                </span>
              </div>

              <div className="flex flex-col gap-gutter-sm">
                {tasks.map((taskItem) => {
                  const sub = [formatDue(taskItem.due_at), taskItem.detail].filter(Boolean).join(' · ');
                  return (
                    <label key={taskItem.id} className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex items-center gap-gutter-sm cursor-pointer">
                      <input type="checkbox" checked={taskItem.done} onChange={() => toggleTask(taskItem)} className="w-5 h-5 rounded-sm text-light-primary border-light-outline shrink-0" />
                      <div className="flex flex-col gap-gutter-xs">
                        <span className="font-title text-title-md text-light-on-surface">{taskItem.title}</span>
                        {sub && <span className="font-body text-body-md text-light-on-surface-variant">{sub}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
              {message && <p role="alert" className="font-body text-body-md text-light-error">{message}</p>}
            </section>
          </>
        )}
      </main>

      <footer className="px-page-margin py-gutter-md bg-light-surface-container-lowest border-t border-light-outline-variant">
        <button type="button" onClick={() => navigate('dashboard')} className="w-full min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm">
          <Icon name="home" className="text-[22px]" />
          <span>{t('backToDashboard')}</span>
        </button>
      </footer>
    </div>
  );
}
