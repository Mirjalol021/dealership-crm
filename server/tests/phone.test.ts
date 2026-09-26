import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/lib/phone.js';

// §63 — Uzbek numbers are normalised to +998XXXXXXXXX for dedup.

test('9 raw digits get the +998 country code', () => {
  assert.equal(normalizePhone('901234567'), '+998901234567');
});

test('12 digits already carrying 998 are kept', () => {
  assert.equal(normalizePhone('998901234567'), '+998901234567');
});

test('spaces, dashes and parentheses are stripped', () => {
  assert.equal(normalizePhone('+998 90 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('(90) 123 45 67'), '+998901234567');
});

test('leading 0 local form (0998...) is folded to +998', () => {
  // 0998 + 8 digits = 12 digits, starting with "0998" -> strip the leading 0.
  assert.equal(normalizePhone('0998 90 123 456'), '+99890123456');
});

test('value already starting with + is preserved as E.164-ish', () => {
  assert.equal(normalizePhone('+1 202 555 0143'), '+12025550143');
});

test('empty / whitespace input normalises to empty', () => {
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone('   '), '');
});
