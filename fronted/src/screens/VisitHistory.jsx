import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { navigate } from '../App.jsx';
import { supabase } from '../lib/supabase.js';
import { getFollowUpDate, getFollowUpStatus, getVisitPriority, filterAndSortVisits } from '../lib/visitHistory.js';

const EMPTY_FILTERS = { search: '', visitType: '', priority: '', risk: '', followUp: '', fromDate: '', toDate: '', sort: 'newest' };
const VISIT_SELECT = 'id, visited_at, status, confirmed_at, temperature_f, bp_systolic, bp_diastolic, symptoms, danger_signs, care_given, correction_note, transcript, visit_summary, ai_extraction, patients(name, age_years, location), follow_ups(id, title, detail, due_at, done)';
const display = (value) => value == null || value === '' ? 'Not recorded' : String(value);
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function formatFollowUp(visit, task) {
  const status = getFollowUpStatus(visit, task);
  if (status === 'None') return 'Not recorded';
  const dueAt = getFollowUpDate(visit, task);
  const date = dueAt ? formatDate(dueAt) : visit.ai_extraction?.follow_up_date || task?.title || 'Date not confirmed';
  return `${status} · ${date}`;
}

function DetailRow({ label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const content = Array.isArray(value) ? value.join(', ') : String(value);
  return <div className="grid grid-cols-[minmax(7rem,0.7fr)_1fr] gap-3 border-b border-white/20 py-2"><dt className="font-label text-label-sm text-white/70">{label}</dt><dd className="font-body text-body-md text-white whitespace-pre-wrap break-words">{content}</dd></div>;
}

function VisitDetails({ visit, onClose }) {
  const ai = visit.ai_extraction || {};
  const pregnancy = ['pregnancy_month', 'pregnancy_status', 'expected_delivery_date'];
  const newborn = ['newborn_birth_date', 'newborn_weight_kg', 'breastfeeding_status'];
  const immunization = ['immunization_name', 'immunization_status'];
  const extraFields = [...pregnancy, ...newborn, ...immunization];
  const labels = {
    pregnancy_month: 'Pregnancy month', pregnancy_status: 'Pregnancy status', expected_delivery_date: 'Expected delivery date',
    newborn_birth_date: 'Newborn birth date', newborn_weight_kg: 'Newborn weight (kg)', breastfeeding_status: 'Breastfeeding status',
    immunization_name: 'Vaccines', immunization_status: 'Vaccination status',
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-2 sm:p-6 flex items-end sm:items-center justify-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="visit-details-title" className="w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-xl bg-light-inverse-surface p-gutter-md sm:p-gutter-lg text-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/20 pb-3">
          <div><p className="font-label text-label-sm text-white">Confirmed visit</p><h2 id="visit-details-title" className="font-headline text-headline-md text-white">{visit.patients?.name || 'Not recorded'}</h2><p className="font-body text-body-sm text-white/75">{formatDate(visit.visited_at)} · {formatTime(visit.visited_at)}</p></div>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-full px-3 font-label text-label-sm text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Icon name="arrow_back" className="mr-2" />Back to Visit History</button>
        </header>
        <div className="mt-4 flex flex-col gap-4">
          {visit.visit_summary && <article className="rounded-md bg-light-primary p-gutter-md"><h3 className="font-title text-title-md text-white">Saved summary · ASHA confirmed</h3><p className="mt-2 font-body text-body-md text-white whitespace-pre-wrap">{visit.visit_summary}</p></article>}
          <section><h3 className="font-title text-title-md text-white">Confirmed visit record</h3><dl className="mt-2">
            <DetailRow label="Beneficiary" value={visit.patients?.name} /><DetailRow label="Age (years)" value={visit.patients?.age_years} /><DetailRow label="Age (months, AI extracted)" value={ai.age_months} /><DetailRow label="Location" value={visit.patients?.location} />
            <DetailRow label="Visit date and time" value={`${formatDate(visit.visited_at)} · ${formatTime(visit.visited_at)}`} /><DetailRow label="Visit type" value={ai.visit_type} />
            <DetailRow label="Temperature (°F)" value={visit.temperature_f} /><DetailRow label="Blood pressure" value={visit.bp_systolic != null && visit.bp_diastolic != null ? `${visit.bp_systolic}/${visit.bp_diastolic} mmHg` : null} />
            <DetailRow label="Symptoms" value={visit.symptoms} /><DetailRow label="Danger signs reported" value={visit.danger_signs} />
            <DetailRow label="Danger assessment" value={ai.danger_assessment === 'absent' ? 'Worker marked assessed and absent' : ai.danger_assessment === 'present' ? 'Reported / present' : 'Not mentioned / not assessed'} />
            <DetailRow label="Advice / care given" value={visit.care_given} /><DetailRow label="Risk level (AI)" value={ai.risk_level} /><DetailRow label="Risk reasoning (AI)" value={ai.risk_reasoning} />
            <DetailRow label="Recommended action (AI)" value={ai.recommended_action} /><DetailRow label="Urgent referral flagged (AI)" value={ai.urgent_referral === true ? 'Yes' : ai.urgent_referral === false ? 'No' : null} />
            <DetailRow label="Safety alerts (AI)" value={list(ai.safety_alerts)} /><DetailRow label="Missing information (AI)" value={list(ai.missing_information)} /><DetailRow label="Uncertain information (AI)" value={list(ai.uncertain_information)} />
            {extraFields.map((key) => <DetailRow key={key} label={`${labels[key]} (AI)`} value={ai[key]} />)}
            <DetailRow label="Follow-up (AI)" value={ai.follow_up_date} /><DetailRow label="Correction note" value={visit.correction_note} />
            <DetailRow label="Record status" value={visit.status === 'confirmed' ? 'Confirmed and saved' : visit.status} />
          </dl></section>
          {list(visit.follow_ups).length > 0 && <section><h3 className="font-title text-title-md text-white">Follow-up actions</h3><ul className="mt-2 space-y-2">{visit.follow_ups.map((task) => <li key={task.id} className="rounded-md bg-light-primary-container p-3 font-body text-body-md text-white"><strong>{task.title}</strong><p>{formatFollowUp(visit, task)}{task.detail ? ` · ${task.detail}` : ''}</p></li>)}</ul></section>}
          {visit.transcript && <section><h3 className="font-title text-title-md text-white">Original transcript</h3><p className="mt-2 rounded-md bg-light-primary-container p-3 font-body text-body-md text-white whitespace-pre-wrap">{visit.transcript}</p></section>}
          <p className="font-body text-body-sm text-white/75">AI-extracted suggestions are shown separately from the confirmed visit record; this record does not indicate clinical clearance.</p>
        </div>
      </section>
    </div>
  );
}

export default function VisitHistory() {
  const [visits, setVisits] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: queryError } = await supabase.from('visits').select(VISIT_SELECT).eq('status', 'confirmed').order('visited_at', { ascending: false });
      if (!active) return;
      if (queryError) { setError(queryError.message); setState('error'); return; }
      setVisits(data || []);
      setState('ready');
    })();
    return () => { active = false; };
  }, []);

  const filteredVisits = useMemo(() => filterAndSortVisits(visits, filters, now), [visits, filters, now]);
  const visitTypes = [...new Set(visits.map((visit) => visit.ai_extraction?.visit_type).filter(Boolean))].sort();
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const inputClass = 'min-h-11 w-full rounded-md border border-white/25 bg-light-inverse-surface px-3 font-body text-body-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

  return (
    <div className="min-h-screen bg-light-surface text-light-on-surface">
      <header className="border-b border-light-outline-variant bg-light-surface px-page-margin py-3">
        <div className="mx-auto max-w-2xl"><button type="button" onClick={() => navigate('dashboard')} className="min-h-11 rounded-full px-3 font-label text-label-sm text-light-primary hover:bg-light-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-primary"><Icon name="arrow_back" className="mr-2" />Back to Home</button><h1 className="mt-2 font-headline text-headline-md text-light-on-surface">Visit History</h1></div>
      </header>
      <main className="mx-auto max-w-2xl px-page-margin py-4">
        {state === 'loading' && <p role="status" className="py-8 text-center font-body text-body-md text-white/75">Loading saved visits…</p>}
        {state === 'error' && <p role="alert" className="py-8 text-center font-body text-body-md text-white">Could not load visit history: {error}</p>}
        {state === 'ready' && visits.length === 0 && <section className="mx-auto mt-8 rounded-xl border border-white/20 bg-light-inverse-surface p-6 text-center"><h2 className="font-headline text-headline-md text-white">No saved visits yet</h2><p className="mt-2 font-body text-body-md text-white/75">Confirmed visit records will appear here.</p><button type="button" onClick={() => navigate('dashboard')} className="mt-4 min-h-12 rounded-full bg-light-primary-container px-5 font-label text-label-md text-white">Start a Home Visit</button></section>}
        {state === 'ready' && visits.length > 0 && <>
          <details className="mt-4 rounded-xl border border-light-outline-variant bg-light-surface-container-low p-3 text-light-on-surface">
            <summary className="min-h-10 cursor-pointer font-label text-label-md text-light-on-surface">Search and filters</summary>
            <div aria-label="Visit history filters" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="font-label text-label-sm text-light-on-surface-variant">Search beneficiary<input className={`${inputClass} mt-1`} value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Name" /></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">Visit type<select className={`${inputClass} mt-1`} value={filters.visitType} onChange={(event) => setFilter('visitType', event.target.value)}><option value="">All visit types</option>{visitTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">Priority<select className={`${inputClass} mt-1`} value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}><option value="">All priorities</option>{['HIGH PRIORITY', 'NEEDS REVIEW', 'MEDIUM PRIORITY', 'ROUTINE'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">Risk level<select className={`${inputClass} mt-1`} value={filters.risk} onChange={(event) => setFilter('risk', event.target.value)}><option value="">All risk levels</option>{['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">Follow-up<select className={`${inputClass} mt-1`} value={filters.followUp} onChange={(event) => setFilter('followUp', event.target.value)}><option value="">All follow-ups</option>{['Upcoming', 'Due today', 'Overdue', 'Completed', 'Date not confirmed'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">From date<input type="date" className={`${inputClass} mt-1`} value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">To date<input type="date" className={`${inputClass} mt-1`} value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></label>
              <label className="font-label text-label-sm text-light-on-surface-variant">Sort<select className={`${inputClass} mt-1`} value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
            </div>
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="mt-3 min-h-10 rounded-full border border-light-outline-variant px-4 font-label text-label-sm text-light-primary hover:bg-light-surface-container">Reset filters</button>
          </details>
          <section className="mt-5 space-y-3" aria-label="Saved visits">
            {filteredVisits.length === 0 && <p className="rounded-lg border border-white/20 bg-light-inverse-surface p-5 text-center font-body text-body-md text-white/75">No visits match these filters.</p>}
            {filteredVisits.map((visit) => {
              const priority = getVisitPriority(visit);
              const followUps = visit.follow_ups || [];
              const followUpDisplay = followUps.length ? followUps.map((task) => `${task.title}: ${formatFollowUp(visit, task)}`).join(' · ') : visit.ai_extraction?.follow_up_date ? formatFollowUp(visit, null) : 'Not recorded';
              return <article key={visit.id} className="rounded-xl border border-light-outline-variant bg-light-surface-container-low p-4 text-light-on-surface transition-colors hover:bg-light-surface-container">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-title text-title-md text-light-on-surface">{visit.patients?.name || 'Not recorded'}</h2><p className="mt-1 break-words font-body text-body-sm text-light-on-surface-variant">{display(visit.ai_extraction?.visit_type)} · {formatDate(visit.visited_at)} · {formatTime(visit.visited_at)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 font-label text-label-xs ${priority.label === 'HIGH PRIORITY' ? 'bg-red-100 text-red-900' : priority.label === 'NEEDS REVIEW' ? 'bg-amber-100 text-amber-950' : priority.label === 'MEDIUM PRIORITY' ? 'bg-yellow-100 text-yellow-950' : 'bg-green-100 text-green-950'}`}>{priority.label}</span></div>
                {visit.ai_extraction?.risk_level && <p className="mt-2 font-body text-body-sm text-light-on-surface">Risk: {visit.ai_extraction.risk_level} · {priority.source}</p>}
                {(followUps.length > 0 || visit.ai_extraction?.follow_up_date) && <p className="mt-1 break-words font-body text-body-sm text-light-on-surface">Follow-up: {followUpDisplay}</p>}
                {visit.visit_summary && <p className="mt-2 line-clamp-3 break-words font-body text-body-md text-light-on-surface">{visit.visit_summary}</p>}
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => setSelectedVisit(visit)} className="min-h-11 rounded-full bg-light-primary-container px-4 font-label text-label-sm text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">View Details</button></div>
              </article>;
            })}
          </section>
        </>}
      </main>
      {selectedVisit && <VisitDetails visit={selectedVisit} onClose={() => setSelectedVisit(null)} />}
    </div>
  );
}
