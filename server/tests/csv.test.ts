import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCell, toCsv } from '../src/lib/csv.js';

// Hardening — spreadsheet formula injection must be neutralised.

test('formula prefixes (= @ TAB CR) are quoted with a leading apostrophe', () => {
  assert.equal(sanitizeCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(sanitizeCell('@cmd'), "'@cmd");
  assert.equal(sanitizeCell('\tpayload'), "'\tpayload");
  assert.equal(sanitizeCell('\rpayload'), "'\rpayload");
});

test('leading + / - stays intact for plain numbers (phone, negatives)', () => {
  assert.equal(sanitizeCell('+998901234567'), '+998901234567');
  assert.equal(sanitizeCell('-42'), '-42');
  assert.equal(sanitizeCell('-1,000.50'), '-1,000.50');
});

test('leading + / - before non-numbers is neutralised', () => {
  assert.equal(sanitizeCell('+HYPERLINK("http://evil")'), "'+HYPERLINK(\"http://evil\")");
  assert.equal(sanitizeCell('-1+cmd|"/c calc"'), '\'-1+cmd|"/c calc"');
});

test('plain text and numbers are untouched', () => {
  assert.equal(sanitizeCell('John Doe'), 'John Doe');
  assert.equal(sanitizeCell('12345'), '12345');
});

test('toCsv quotes cells containing comma, quote or newline', () => {
  const out = toCsv(['a', 'b'], [['x,y', 'he said "hi"']]);
  const [, line] = out.split('\n');
  assert.equal(line, '"x,y","he said ""hi"""');
});

test('toCsv emits a header row then the data rows', () => {
  const out = toCsv(['Name', 'Age'], [['A', 1], ['B', 2]]);
  assert.equal(out, 'Name,Age\nA,1\nB,2');
});

test('toCsv sanitises string cells but leaves numbers alone', () => {
  const out = toCsv(['v'], [['=1+1'], [123]]);
  assert.equal(out, "v\n'=1+1\n123");
});

test('toCsv renders null/undefined as empty', () => {
  const out = toCsv(['v'], [[null], [undefined as unknown as null]]);
  assert.equal(out, 'v\n\n');
});
