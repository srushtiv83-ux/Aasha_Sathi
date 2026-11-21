import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { navigate } from '../App.jsx';
import { supabase } from '../lib/supabase.js';

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

const sameDay = (a, b) => a.toDateString() === b.toDateString();

function formatDue(iso) {
  if (!iso) return '';
  const due = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = sameDay(due, new Date()) ? 'Today' : sameDay(due, tomorrow) ? 'Tomorrow' : dateFormat.format(due);
  return `${day} · ${timeFormat.format(due).toUpperCase()}`;
}

function describeVisit(visit) {
  const parts = [];
  if (visit.temperature_f != null) parts.push(`Temperature ${visit.temperature_f}°F`);
  if (visit.symptoms) parts.push(visit.symptoms);
  if (visit.bp_systolic != null && visit.bp_diastolic != null) {
    parts.push(`BP ${visit.bp_systolic}/${visit.bp_diastolic} mmHg`);
  }
  parts.push(visit.danger_signs.length > 0 ? `Danger signs: ${visit.danger_signs.join(', ')}` : 'No danger signs');
  return `${parts.join(' · ')}.`;
}

export default function VisitSaved({ visitId }) {
  const [state, setState] = useState({ status: 'loading', visit: null, tasks: [] });
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const [visitRes, tasksRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, visited_at, temperature_f, bp_systolic, bp_diastolic, symptoms, danger_signs, correction_note, transcript, patients(name, age_years)')
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
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) }));
    const { error } = await supabase.from('follow_ups').update({ done }).eq('id', task.id);
    if (error) {
      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)) }));
      setMessage('Could not update that task. Check your connection and try again.');
    }
  };

  const { status, visit, tasks } = state;

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-light-surface">
      <header className="px-page-margin pt-gutter-lg pb-gutter-md bg-confirmed-container text-on-confirmed-container flex items-center gap-gutter-sm">
        <Icon name="check_circle" className="text-[32px]" fill />
        <div className="flex flex-col">
          <span className="font-label text-label-sm">Visit confirmed</span>
          <h1 className="font-display text-headline-lg">Visit saved</h1>
        </div>
      </header>

      <main className="flex-1 px-page-margin py-gutter-lg flex flex-col gap-gutter-lg">
        {status === 'loading' && (
          <p role="status" className="font-body text-body-md text-light-on-surface-variant">Loading the saved visit…</p>
        )}
        {(status === 'error' || status === 'missing') && (
          <p role="alert" className="font-body text-body-md text-light-error">
            {status === 'error'
              ? 'Could not load this visit. Check your connection and try again.'
              : 'This visit could not be found.'}
          </p>
        )}

        {status === 'ready' && (
          <>
            <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex flex-col gap-gutter-sm">
              <header className="flex items-center justify-between gap-gutter-sm">
                <h2 className="font-title text-title-md text-light-on-surface">
                  {visit.patients.name}{visit.patients.age_years != null ? ` (${visit.patients.age_years} yrs)` : ''}
                </h2>
                <span className="font-mono text-mono-md text-light-on-surface-variant tabular-nums">
                  {timeFormat.format(new Date(visit.visited_at)).toUpperCase()}
                </span>
              </header>
              <p className="font-body text-body-md text-light-on-surface-variant">{describeVisit(visit)}</p>
            </article>

            {visit.transcript && (
              <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-surface">Visit transcript</h2>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs whitespace-pre-wrap">{visit.transcript}</p>
              </article>
            )}

            {visit.correction_note && (
              <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
                <h2 className="font-title text-title-md text-light-on-surface">Correction note</h2>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">{visit.correction_note}</p>
                <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">This note does not change the recorded measurements.</p>
              </article>
            )}

            <section className="flex flex-col gap-gutter-sm">
              <div className="flex items-center justify-between gap-gutter-sm">
                <h2 className="font-headline text-headline-md text-light-on-surface">Follow-up actions</h2>
                <span className="font-label text-label-sm text-light-primary">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} created
                </span>
              </div>

              <div className="flex flex-col gap-gutter-sm">
                {tasks.map((t) => {
                  const sub = [formatDue(t.due_at), t.detail].filter(Boolean).join(' · ');
                  return (
                    <label key={t.id} className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex items-center gap-gutter-sm cursor-pointer">
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} className="w-5 h-5 rounded-sm text-light-primary border-light-outline shrink-0" />
                      <div className="flex flex-col gap-gutter-xs">
                        <span className="font-title text-title-md text-light-on-surface">{t.title}</span>
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
          <span>Back to dashboard</span>
        </button>
      </footer>
    </div>
  );
}
