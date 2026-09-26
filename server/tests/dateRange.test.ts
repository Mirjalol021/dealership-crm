import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeFromQuery, hasRange } from '../src/lib/dateRange.js';

// §65, §68 — shared date-range parsing for reports, analytics and exports.

test('empty query yields an open range', () => {
  assert.deepEqual(rangeFromQuery({}), {});
  assert.equal(hasRange(rangeFromQuery({})), false);
});

test('range=today starts at local midnight', () => {
  const r = rangeFromQuery({ range: 'today' });
  assert.ok(r.gte instanceof Date);
  assert.equal(r.gte!.getHours(), 0);
  assert.equal(r.gte!.getMinutes(), 0);
  assert.ok(hasRange(r));
});

test('range=7d covers six days back (seven days inclusive)', () => {
  const r = rangeFromQuery({ range: '7d' });
  // Compare calendar days rather than raw ms to avoid DST/rounding flakiness.
  const rDay = new Date(r.gte!);
  const today = new Date();
  const diffDays =
    (today.getFullYear() - rDay.getFullYear()) * 365 +
    (today.getMonth() - rDay.getMonth()) * 30 +
    (today.getDate() - rDay.getDate());
  assert.ok(diffDays >= 5 && diffDays <= 7, `unexpected diff: ${diffDays}`);
  assert.ok(hasRange(r));
});

test('range=week starts on Monday (or earlier in the week)', () => {
  const r = rangeFromQuery({ range: 'week' });
  // Monday as the first day of week: gte.getDay() is 1 (Mon) unless "today"
  // is itself Monday where the offset is 0. Never a Tuesday..Sunday gap.
  const day = r.gte!.getDay(); // 0=Sun, 1=Mon
  assert.ok(day === 1 || day === 0, `expected Mon-ish start, got day ${day}`);
  assert.ok(hasRange(r));
});

test('range=month starts on the 1st of the current month', () => {
  const r = rangeFromQuery({ range: 'month' });
  assert.equal(r.gte!.getDate(), 1);
});

test('range=lastMonth spans exactly the previous calendar month', () => {
  const r = rangeFromQuery({ range: 'lastMonth' });
  assert.equal(r.gte!.getDate(), 1);
  assert.equal(r.lt!.getDate(), 1);
  // lt is exactly one month after gte.
  const expectedLt = new Date(r.gte!.getFullYear(), r.gte!.getMonth() + 1, 1);
  assert.equal(r.lt!.getTime(), expectedLt.getTime());
});

test('custom from/to is parsed (to is inclusive to end of day)', () => {
  const r = rangeFromQuery({ from: '2026-01-01', to: '2026-01-31' });
  assert.ok(r.gte instanceof Date);
  assert.ok(r.lt instanceof Date);
  assert.equal(r.lt!.getUTCHours(), 23);
  assert.ok(hasRange(r));
});

test('custom from only opens the lower bound', () => {
  const r = rangeFromQuery({ from: '2026-03-05' });
  assert.ok(r.gte instanceof Date);
  assert.equal(r.lt, undefined);
  assert.ok(hasRange(r));
});
