import type { AuthUser } from './session.js';

// Data-scoping helpers (§5, §73).
//
// The Super Admin is ALWAYS unrestricted — it is the only role that sees the
// whole network by design. Every OTHER role is bounded by the dealerships/brands
// granted to it.
//
// SECURITY NOTE (fail-closed): a non-admin with NO access rows sees NOTHING.
// Previously "no access rows" meant "unrestricted", which was fail-OPEN: any
// staff account created without access links (or with access removed by mistake)
// silently gained full-network visibility. That contradicts §73. Scoping is now
// fail-closed: absence of grants means absence of access.

export function isUnrestricted(user: AuthUser): boolean {
  return user.role === 'SUPER_ADMIN';
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
//
// A scoped user with an EMPTY grant list is denied everything via an impossible
// `in: []` filter (fail-closed), not silently allowed.
export function scopeWhere(
  user: AuthUser,
  opts: { dealershipField?: string | null; brandField?: string | null; nestedBrand?: string } = {},
): Record<string, unknown> {
  if (isUnrestricted(user)) return {};
  const where: Record<string, unknown> = {};

  // dealershipField: default 'dealershipId'; null disables dealership scoping.
  // Always applied for scoped users (empty list -> matches nothing).
  if (opts.dealershipField !== null) {
    where[opts.dealershipField ?? 'dealershipId'] = { in: user.dealershipIds };
  }

  // brandField: default 'brandId'; null disables brand scoping.
  if (opts.brandField !== null) {
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
//
// Fail-closed for the dimensions a role actually owns:
//  - If the record carries a `dealershipId`, the user MUST hold that dealership
//    (an empty dealership grant list grants nothing).
//  - If the record carries a `brandId`, the user MUST hold that brand
//    (an empty brand grant list grants nothing).
//  - A `null`/`undefined` dimension on the record is "not scoped by it" — e.g.
//    a corporate Expense with `brandId: null`, or a brand-less AfterSales item.
//    That dimension is then ignored (the other still applies).
export function canAccessScope(
  user: AuthUser,
  record: { dealershipId?: string | null; brandId?: string | null },
): boolean {
  if (isUnrestricted(user)) return true;

  if (record.dealershipId != null) {
    if (user.dealershipIds.length === 0 || !user.dealershipIds.includes(record.dealershipId)) {
      return false;
    }
  }
  if (record.brandId != null) {
    if (user.brandIds.length === 0 || !user.brandIds.includes(record.brandId)) {
      return false;
    }
  }
  return true;
}
