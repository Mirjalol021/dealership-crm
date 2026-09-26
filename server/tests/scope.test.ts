import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeWhere, isUnrestricted, canAccessScope } from '../src/auth/scope.js';
import type { AuthUser } from '../src/auth/session.js';

// §5, §73 — backend data scoping. Guards against the regression where a model
// without a `brandId` column (ServiceVisit, AfterSalesInventoryItem) was queried
// with a brand filter, causing Prisma "Unknown argument brandId".

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'u1',
    email: 'u@x.local',
    name: 'U',
    role: 'SALES_MANAGER',
    preferredLanguage: 'uz',
    dealershipIds: [],
    brandIds: [],
    ...overrides,
  } as AuthUser;
}

test('Super Admin is always unrestricted', () => {
  const admin = user({ role: 'SUPER_ADMIN', dealershipIds: ['d1'], brandIds: ['b1'] });
  assert.equal(isUnrestricted(admin), true);
  assert.deepEqual(scopeWhere(admin), {});
});

test('user with no access rows is unrestricted', () => {
  const u = user({ dealershipIds: [], brandIds: [] });
  assert.equal(isUnrestricted(u), true);
  assert.deepEqual(scopeWhere(u), {});
});

test('default scope applies both dealershipId and brandId filters', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: ['b1', 'b2'] });
  assert.deepEqual(scopeWhere(u), {
    dealershipId: { in: ['d1'] },
    brandId: { in: ['b1', 'b2'] },
  });
});

test('brandField: null skips the brand filter (models without brandId)', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: ['b1'] });
  const where = scopeWhere(u, { brandField: null });
  assert.deepEqual(where, { dealershipId: { in: ['d1'] } });
  assert.ok(!('brandId' in where), 'brandId must NOT appear for brand-less models');
});

test('nestedBrand restricts the brand through a relation (ServiceVisit -> soldCar)', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: ['b1'] });
  const where = scopeWhere(u, { nestedBrand: 'soldCar' });
  assert.deepEqual(where, {
    dealershipId: { in: ['d1'] },
    soldCar: { brandId: { in: ['b1'] } },
  });
  assert.ok(!('brandId' in where), 'top-level brandId must not appear');
});

test('dealershipField: null skips the dealership filter', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: ['b1'] });
  const where = scopeWhere(u, { dealershipField: null });
  assert.deepEqual(where, { brandId: { in: ['b1'] } });
});

test('canAccessScope: unrestricted user passes everything', () => {
  const admin = user({ role: 'SUPER_ADMIN' });
  assert.equal(canAccessScope(admin, { dealershipId: 'x', brandId: 'y' }), true);
});

test('canAccessScope: bounded user must match dealership and brand', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: ['b1'] });
  assert.equal(canAccessScope(u, { dealershipId: 'd1', brandId: 'b1' }), true);
  assert.equal(canAccessScope(u, { dealershipId: 'd2', brandId: 'b1' }), false);
  assert.equal(canAccessScope(u, { dealershipId: 'd1', brandId: 'b2' }), false);
});

test('canAccessScope: a user scoped only by dealership ignores brand', () => {
  const u = user({ dealershipIds: ['d1'], brandIds: [] });
  assert.equal(canAccessScope(u, { dealershipId: 'd1', brandId: 'anything' }), true);
  assert.equal(canAccessScope(u, { dealershipId: 'd2', brandId: 'anything' }), false);
});
