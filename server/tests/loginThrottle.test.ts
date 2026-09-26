import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordFailedLogin, isLoginBlocked, clearLoginAttempts } from '../src/auth/loginThrottle.js';
import { config } from '../src/config.js';

// Login brute-force protection (hardening).
// The limiter is keyed by ip|email; a distinct key keeps each test isolated.

let n = 0;
function freshKey() {
  return { ip: `10.0.0.${++n}`, email: `user${n}@test.local` };
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

test('a successful login clears the counter', () => {
  const { ip, email } = freshKey();
  for (let i = 0; i < config.loginMaxAttempts - 1; i++) recordFailedLogin(ip, email);
  clearLoginAttempts(ip, email);
  assert.equal(isLoginBlocked(ip, email).allowed, true);
});

test('different emails from the same ip are tracked independently', () => {
  const ip = '10.9.9.9';
  const a = 'a@test.local';
  const b = 'b@test.local';
  for (let i = 0; i < config.loginMaxAttempts; i++) recordFailedLogin(ip, a);
  assert.equal(isLoginBlocked(ip, a).allowed, false);
  assert.equal(isLoginBlocked(ip, b).allowed, true);
});
