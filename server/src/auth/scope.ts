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
//
// `dealershipField` / `brandField` are the column names on the model being queried.
//
// Some models do NOT carry a `brandId` column at all (e.g. ServiceVisit,
// AfterSalesInventoryItem). For those, pass `brandField: null` to skip brand
// scoping entirely — the record is then bounded by dealership only. This avoids
// Prisma "Unknown argument brandId" errors.
//
// For models where the brand lives on a related record, pass `nestedBrand`
// (the relation name) so the restriction is applied through the relation:
//   scopeWhere(user, { nestedBrand: 'soldCar' })
//   -> { dealershipId: {...}, soldCar: { brandId: { in: [...] } } }
export function scopeWhere(
  user: AuthUser,
  opts: { dealershipField?: string | null; brandField?: string | null; nestedBrand?: string } = {},
): Record<string, unknown> {
  if (isUnrestricted(user)) return {};
  const where: Record<string, unknown> = {};

  // dealershipField: default 'dealershipId'; null disables dealership scoping.
  if (opts.dealershipField !== null && user.dealershipIds.length > 0) {
    where[opts.dealershipField ?? 'dealershipId'] = { in: user.dealershipIds };
  }

  // brandField: default 'brandId'; null disables brand scoping.
  if (opts.brandField !== null && user.brandIds.length > 0) {
    const brandField = opts.brandField ?? 'brandId';
    if (opts.nestedBrand) {
      // Restrict by the related record's brand (relation filter).
      where[opts.nestedBrand] = { [brandField]: { in: user.brandIds } };
    } else {
      where[brandField] = { in: user.brandIds };
    }
  }
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
