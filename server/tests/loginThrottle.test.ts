import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordFailedLogin, isLoginBlocked, clearLoginAttempts } from '../src/auth/loginThrottle.js';
import { config } from '../src/config.js';

// Login brute-force protection (hardening).
// Two limits: per ip|email and per ip (anti credential-stuffing).
// A distinct key keeps each test isolated.

let n = 0;
function freshKey() {
  return { ip: `10.0.0.${++n}`, email: `user${n}@test.local` };
}
function freshIp() {
  return `10.9.${++n}.${n}`;
}

test('a fresh ip|email pair is not blocked', () => {
  const { ip, email } = freshKey();
  assert.equal(isLoginBlocked(ip, email).allowed, true);
});

test('blocks after the configured number of failures', () => {
  const { ip, email } = freshKey();
  // Fail (maxAttempts - 1) times -> still allowed.
  for (let i = 0; i < config.loginMaxAttempts - 1; i++) {
    const r = recordFailedLogin(ip, email);
    assert.equal(r.allowed, true, `attempt ${i + 1} should still be allowed`);
  }
  // The maxAttempts-th failure trips the block.
  const tripped = recordFailedLogin(ip, email);
  assert.equal(tripped.allowed, false);
  assert.ok(tripped.retryAfterSeconds > 0);
  // Subsequent checks report blocked.
  assert.equal(isLoginBlocked(ip, email).allowed, false);
});

test('a successful login clears the per-account counter', () => {
  const { ip, email } = freshKey();
  for (let i = 0; i < config.loginMaxAttempts - 1; i++) recordFailedLogin(ip, email);
  clearLoginAttempts(ip, email);
  assert.equal(isLoginBlocked(ip, email).allowed, true);
});

test('different emails from the same ip are tracked independently (per account)', () => {
  const ip = `10.20.0.${++n}`;
  const a = `a${n}@test.local`;
  const b = `b${n}@test.local`;
  // Stay below the per-IP limit by not exceeding it across both accounts.
  const perIp = config.loginMaxAttemptsPerIp;
  const accountFails = Math.min(config.loginMaxAttempts, perIp - 2);
  for (let i = 0; i < accountFails; i++) recordFailedLogin(ip, a);
  assert.equal(isLoginBlocked(ip, a).allowed, false);
  assert.equal(isLoginBlocked(ip, b).allowed, true);
});

test('per-IP limit blocks credential-stuffing across many accounts', () => {
  const ip = `10.30.0.${++n}`;
  // Try many DIFFERENT emails, one failure each — never trips the per-account
  // limit, but the per-IP counter must eventually block.
  let blocked = false;
  for (let i = 0; i < config.loginMaxAttemptsPerIp; i++) {
    const r = recordFailedLogin(ip, `victim${i}${n}@test.local`);
    if (!r.allowed) { blocked = true; break; }
  }
  assert.equal(blocked, true, 'per-IP limit should block a spraying attempt');
  // A brand-new email from the same IP is still blocked (the IP is blocked).
  assert.equal(isLoginBlocked(ip, `someone-else${n}@test.local`).allowed, false);
});

test('per-IP block does not affect a different IP', () => {
  const spammer = `10.40.0.${++n}`;
  const innocent = `10.41.0.${++n}`;
  for (let i = 0; i < config.loginMaxAttemptsPerIp; i++) {
    recordFailedLogin(spammer, `x${i}${n}@test.local`);
  }
  assert.equal(isLoginBlocked(spammer, `any${n}@test.local`).allowed, false);
  assert.equal(isLoginBlocked(innocent, `any${n}@test.local`).allowed, true);
});
