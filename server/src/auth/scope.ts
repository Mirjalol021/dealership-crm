import type { AuthUser } from './session.js';

// Data-scoping helpers (§5, §73).
//
// The Super Admin is ALWAYS unrestricted. For other roles, a user is
// "unrestricted" when they have NO dealership/brand access rows at all.
// Otherwise they may only touch records belonging to the dealerships/brands
// they were granted. This is enforced on the BACKEND — hiding UI is not enough.

export function isUnrestricted(user: AuthUser): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return user.dealershipIds.length === 0 && user.brandIds.length === 0;
}

// Builds a Prisma `where` fragment that restricts rows to the user's scope.
// `dealershipField` / `brandField` are the column names on the model being queried.
export function scopeWhere(
  user: AuthUser,
  opts: { dealershipField?: string; brandField?: string } = {},
): Record<string, unknown> {
  if (isUnrestricted(user)) return {};
  const where: Record<string, unknown> = {};

  const dealershipField = opts.dealershipField ?? 'dealershipId';
  const brandField = opts.brandField ?? 'brandId';

  if (user.dealershipIds.length > 0) where[dealershipField] = { in: user.dealershipIds };
  if (user.brandIds.length > 0) where[brandField] = { in: user.brandIds };
  return where;
}

// Returns true if the user may access a record with the given scoping ids.
export function canAccessScope(
  user: AuthUser,
  record: { dealershipId?: string | null; brandId?: string | null },
): boolean {
  if (isUnrestricted(user)) return true;
  const dealershipOk =
    user.dealershipIds.length === 0 ||
    (record.dealershipId != null && user.dealershipIds.includes(record.dealershipId));
  const brandOk =
    user.brandIds.length === 0 ||
    (record.brandId != null && user.brandIds.includes(record.brandId));
  return dealershipOk && brandOk;
}
