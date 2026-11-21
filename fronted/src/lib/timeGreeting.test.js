import test from 'node:test';
import assert from 'node:assert/strict';
import { getIndiaGreeting, getIndiaGreetingKey, msUntilNextIndiaGreetingBoundary } from './timeGreeting.js';

const atIndiaTime = (hour, minute = 0) => new Date(Date.UTC(2026, 0, 1, hour, minute) - (5 * 60 + 30) * 60_000);

test('uses India local morning, afternoon, and evening windows including midnight/noon boundaries', () => {
  assert.equal(getIndiaGreeting(atIndiaTime(4, 59)), 'Good Evening');
  assert.equal(getIndiaGreeting(atIndiaTime(5)), 'Good Morning');
  assert.equal(getIndiaGreeting(atIndiaTime(11, 59)), 'Good Morning');
  assert.equal(getIndiaGreeting(atIndiaTime(12)), 'Good Afternoon');
  assert.equal(getIndiaGreeting(atIndiaTime(16, 59)), 'Good Afternoon');
  assert.equal(getIndiaGreeting(atIndiaTime(17)), 'Good Evening');
  assert.equal(getIndiaGreeting(atIndiaTime(0)), 'Good Evening');
  assert.equal(getIndiaGreetingKey(atIndiaTime(12)), 'greeting_afternoon');
});

test('schedules the next India greeting boundary', () => {
  assert.equal(msUntilNextIndiaGreetingBoundary(atIndiaTime(4, 59)), 60_000);
  assert.equal(msUntilNextIndiaGreetingBoundary(atIndiaTime(16, 59)), 60_000);
});
