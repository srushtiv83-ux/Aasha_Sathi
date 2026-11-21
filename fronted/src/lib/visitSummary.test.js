import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFollowUp, formatPatientAge, mentionsOverdueVaccination, resolveFollowUp } from './visitSummary.js';

test('keeps infant age in months and does not round it to zero years', () => {
  assert.equal(formatPatientAge(0, 8), '8 months');
  assert.equal(formatPatientAge(0, null), '');
  assert.equal(formatPatientAge(3, null), '3');
});

test('resolves relative follow-up from a valid visit date', () => {
  assert.equal(resolveFollowUp('in one week', '2026-11-22T10:00:00.000Z'), '2026-11-29T10:00:00.000Z');
  assert.equal(resolveFollowUp('after 3 days', '2026-11-22T10:00:00.000Z'), '2026-11-25T10:00:00.000Z');
});

test('preserves relative follow-up when date cannot be calculated', () => {
  assert.equal(resolveFollowUp('in one week', ''), '');
  assert.equal(formatFollowUp('', 'In 1 week', 'en-IN'), 'In 1 week — date not calculated');
  assert.doesNotMatch(formatFollowUp('not-a-date', 'In 1 week', 'en-IN'), /Invalid Date/);
});

test('flags an explicitly overdue vaccination mention for worker review', () => {
  assert.equal(mentionsOverdueVaccination('The vaccination was due last week.'), true);
  assert.equal(mentionsOverdueVaccination('Vaccine missed in previous week.'), true);
  assert.equal(mentionsOverdueVaccination('Vaccination planned next month.'), false);
  assert.equal(mentionsOverdueVaccination('The vaccine was given last week.'), false);
  assert.equal(mentionsOverdueVaccination('The vaccine is due. Follow-up was last week.'), false);
});
