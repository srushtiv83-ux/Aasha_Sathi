import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortVisits, getFollowUpDate, getFollowUpStatus, getVisitPriority } from './visitHistory.js';

const makeVisit = (id, risk, visited_at, extra = {}) => ({
  id, visited_at, status: 'confirmed', patients: { name: `Person ${id}`, location: 'Bangalore' },
  ai_extraction: { risk_level: risk, danger_assessment: risk === 'LOW' ? 'absent' : 'not_assessed' }, follow_ups: [], ...extra,
});

test('keeps urgent referrals high priority and unconfirmed risk in needs review', () => {
  assert.equal(getVisitPriority(makeVisit('a', 'LOW', '2026-11-20', { ai_extraction: { risk_level: 'LOW', urgent_referral: true, danger_assessment: 'absent' } })).label, 'HIGH PRIORITY');
  assert.equal(getVisitPriority(makeVisit('b', 'UNKNOWN', '2026-11-20')).label, 'NEEDS REVIEW');
  assert.equal(getVisitPriority(makeVisit('c', 'LOW', '2026-11-20')).label, 'ROUTINE');
  assert.equal(getVisitPriority(makeVisit('d', 'MEDIUM', '2026-11-20')).label, 'MEDIUM PRIORITY');
});

test('resolves relative follow-up from the visit date and handles missing dates safely', () => {
  const visit = makeVisit('a', 'MEDIUM', '2026-11-22T10:00:00.000Z', { ai_extraction: { risk_level: 'MEDIUM', danger_assessment: 'absent', follow_up_date: 'in one week' } });
  assert.equal(getFollowUpDate(visit, null), '2026-11-29T10:00:00.000Z');
  assert.equal(getFollowUpDate({ ...visit, ai_extraction: { ...visit.ai_extraction, follow_up_date: 'after three days' } }, null), '2026-11-25T10:00:00.000Z');
  assert.equal(getFollowUpDate({ ...visit, visited_at: '' }, null), '');
  assert.equal(getFollowUpStatus({ ...visit, visited_at: '' }, null), 'Date not confirmed');
});

test('filters by beneficiary and priority, sorts by priority or chronology', () => {
  const visits = [
    makeVisit('routine', 'LOW', '2026-11-22T10:00:00.000Z'),
    makeVisit('unknown', 'UNKNOWN', '2026-11-21T10:00:00.000Z'),
    makeVisit('high', 'HIGH', '2026-11-20T10:00:00.000Z'),
  ];
  assert.deepEqual(filterAndSortVisits(visits).map((visit) => visit.id), ['high', 'unknown', 'routine']);
  assert.deepEqual(filterAndSortVisits(visits, { sort: 'newest' }).map((visit) => visit.id), ['routine', 'unknown', 'high']);
  assert.deepEqual(filterAndSortVisits(visits, { search: 'person high', priority: 'HIGH PRIORITY' }).map((visit) => visit.id), ['high']);
});
