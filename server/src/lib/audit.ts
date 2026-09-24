import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';

type Tx = Prisma.TransactionClient | PrismaClient;

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export interface AuditInput {
  actorId?: string | null;
  entity: string;         // "SoldCar", "Expense", "VinDistributorBonus", ...
  entityId: string;
  action: AuditAction;
  summary?: string | null;
  oldValue?: unknown;     // serialized to JSON
  newValue?: unknown;
}

// Strip undefined so JSON columns stay clean, and convert Decimals/Dates to strings.
function clean(value: unknown): unknown {
  if (value === undefined || value === null) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
}

// Appends one audit row (§75). Safe to call inside a transaction; failures here
// must never break the business operation, so callers may wrap in try/catch.
export async function logAudit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary ?? null,
      oldValue: (clean(input.oldValue) ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (clean(input.newValue) ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

// Best-effort variant for call sites that are NOT inside a transaction and must
// not fail the request if auditing throws.
export async function logAuditSafe(input: AuditInput): Promise<void> {
  try {
    await logAudit(prisma, input);
  } catch {
    // swallow — auditing must never break the request
  }
}
