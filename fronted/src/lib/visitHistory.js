import { resolveFollowUp } from './visitSummary.js';

export const PRIORITY_ORDER = { 'HIGH PRIORITY': 0, 'NEEDS REVIEW': 1, 'MEDIUM PRIORITY': 2, ROUTINE: 3 };

function indiaCalendarDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function getFollowUpDate(visit, task) {
  if (task?.due_at && !Number.isNaN(new Date(task.due_at).getTime())) return task.due_at;
  const raw = visit?.ai_extraction?.follow_up_date;
  return raw ? resolveFollowUp(raw, visit.visited_at) : '';
}

export function getFollowUpStatus(visit, task, now = new Date()) {
  if (task?.done) return 'Completed';
  const dueAt = getFollowUpDate(visit, task);
  if (!dueAt) return visit?.ai_extraction?.follow_up_date || task ? 'Date not confirmed' : 'None';
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'Date not confirmed';
  const today = indiaCalendarDate(now);
  const dueDay = indiaCalendarDate(due);
  if (dueDay === today) return 'Due today';
  return dueDay < today ? 'Overdue' : 'Upcoming';
}

export function getVisitPriority(visit) {
  const ai = visit?.ai_extraction || {};
  const risk = String(ai.risk_level || 'UNKNOWN').toUpperCase();
  if (ai.urgent_referral === true || risk === 'HIGH') {
    return { label: 'HIGH PRIORITY', source: ai.urgent_referral === true ? 'Urgent referral flagged' : 'AI risk level HIGH' };
  }
  const tasks = Array.isArray(visit?.follow_ups) ? visit.follow_ups : [];
  const unresolvedFollowUp = tasks.some((task) => !task.done) || (Boolean(ai.follow_up_date) && tasks.length === 0);
  if (risk === 'MEDIUM' || (risk === 'LOW' && unresolvedFollowUp)) {
    return { label: 'MEDIUM PRIORITY', source: risk === 'MEDIUM' ? 'AI risk level MEDIUM at transcription' : 'Follow-up remains open' };
  }
  if (risk === 'UNKNOWN') return { label: 'NEEDS REVIEW', source: 'AI risk level UNKNOWN at transcription' };
  if (risk === 'LOW') return { label: 'ROUTINE', source: 'AI risk level LOW at transcription' };
  return { label: 'NEEDS REVIEW', source: 'No stored transcription risk level' };
}

export function filterAndSortVisits(visits, filters = {}, now = new Date()) {
  const search = (filters.search || '').trim().toLocaleLowerCase();
  const filtered = visits.filter((visit) => {
    const tasks = Array.isArray(visit.follow_ups) ? visit.follow_ups : [];
    const priority = getVisitPriority(visit).label;
    const risk = String(visit.ai_extraction?.risk_level || 'UNKNOWN').toUpperCase();
    const followUpStatus = tasks.length
      ? tasks.map((task) => getFollowUpStatus(visit, task, now)).join(' ')
      : getFollowUpStatus(visit, null, now);
    const visitType = visit.ai_extraction?.visit_type || '';
    const date = new Date(visit.visited_at);
    const afterFrom = !filters.fromDate || (date >= new Date(`${filters.fromDate}T00:00:00`));
    const beforeTo = !filters.toDate || (date < new Date(`${filters.toDate}T00:00:00`) || date.toDateString() === new Date(`${filters.toDate}T00:00:00`).toDateString());
    return (!search || (visit.patients?.name || '').toLocaleLowerCase().includes(search))
      && (!filters.visitType || visitType === filters.visitType)
      && (!filters.priority || priority === filters.priority)
      && (!filters.risk || risk === filters.risk)
      && (!filters.followUp || followUpStatus.includes(filters.followUp))
      && afterFrom && beforeTo;
  });
  return filtered.sort((a, b) => {
    const dateDiff = new Date(b.visited_at) - new Date(a.visited_at);
    if (filters.sort === 'oldest') return -dateDiff;
    if (filters.sort === 'newest') return dateDiff;
    const priorityDiff = PRIORITY_ORDER[getVisitPriority(a).label] - PRIORITY_ORDER[getVisitPriority(b).label];
    return priorityDiff || dateDiff;
  });
}
