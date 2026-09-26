import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMetaSignature } from '../src/lib/webhookSignature.js';

// §56 — Meta webhook payloads must carry a valid X-Hub-Signature-256 HMAC.

function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

test('accepts a correct signature', () => {
  const secret = 'app-secret-123';
  const body = JSON.stringify({ object: 'page', entry: [] });
  assert.equal(verifyMetaSignature(body, sign(secret, body), secret), true);
});

test('rejects a tampered body', () => {
  const secret = 'app-secret-123';
  const body = JSON.stringify({ object: 'page', entry: [] });
  const sig = sign(secret, body);
  assert.equal(verifyMetaSignature(body + 'x', sig, secret), false);
});

test('rejects a wrong secret', () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, sign('right', body), 'wrong'), false);
});

test('rejects when the secret is not configured', () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, sign('s', body), undefined), false);
});

test('rejects a malformed / missing header', () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, undefined, 's'), false);
  assert.equal(verifyMetaSignature(body, 'md5=abc', 's'), false);
  assert.equal(verifyMetaSignature(body, 'sha256=', 's'), false);
});

test('rejects a missing body', () => {
  assert.equal(verifyMetaSignature(undefined, 'sha256=abc', 's'), false);
});
