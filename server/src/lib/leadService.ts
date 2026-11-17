import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { ActivityEvent, AssignmentType } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

// Append an activity row (§21).
export async function logActivity(
  tx: Tx,
  leadId: string,
  event: ActivityEvent,
  userId?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
): Promise<void> {
  await tx.leadActivity.create({
    data: { leadId, event, userId: userId ?? null, oldValue: oldValue ?? null, newValue: newValue ?? null },
  });
}

// Append an assignment-history row (§22).
export async function logAssignment(
  tx: Tx,
  leadId: string,
  assignmentType: AssignmentType,
  opts: { fromUserId?: string | null; toUserId?: string | null; assignedById?: string | null } = {},
): Promise<void> {
  await tx.leadAssignment.create({
    data: {
      leadId,
      assignmentType,
      fromUserId: opts.fromUserId ?? null,
      toUserId: opts.toUserId ?? null,
      assignedById: opts.assignedById ?? null,
    },
  });
}

// Find an existing customer by any known phone, else create one (§63).
//
// `LeadPhone.phone` is UNIQUE, so two concurrent ingests for the same new phone
// can both miss the initial `findFirst` and race to `create`. The loser gets a
// P2002 unique violation — we catch it and re-read the row the winner created,
// making the operation race-safe (was: whole transaction failed -> 500).
export async function findOrCreateCustomer(
  tx: Tx,
  normalized: string,
  name?: string | null,
): Promise<{ customerId: string; existed: boolean }> {
  const phoneHit = await tx.leadPhone.findFirst({ where: { phone: normalized } });
  if (phoneHit) return { customerId: phoneHit.customerId, existed: true };

  try {
    const customer = await tx.customer.create({
      data: {
        name: name ?? null,
        primaryPhone: normalized,
        phones: { create: [{ phone: normalized }] },
      },
    });
    return { customerId: customer.id, existed: false };
  } catch (err) {
    // Unique violation: another request created the same phone first. Re-read it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await tx.leadPhone.findFirst({ where: { phone: normalized } });
      if (winner) return { customerId: winner.customerId, existed: true };
    }
    throw err;
  }
}

// Next attempt number for a lead (auto-numbered, §20).
export async function nextAttemptNo(tx: Tx, leadId: string): Promise<number> {
  const last = await tx.leadContactAttempt.findFirst({
    where: { leadId },
    orderBy: { attemptNo: 'desc' },
  });
  return (last?.attemptNo ?? 0) + 1;
}
