import type { Prisma, LeadSource } from '@prisma/client';
import { normalizePhone } from './phone.js';
import { findOrCreateCustomer } from './leadService.js';

// A single incoming answer from an external form.
export interface IncomingAnswer {
  externalFieldKey: string;
  questionLabel: string;  // label snapshot (§60)
  answer: string;
}

// Normalized payload from any external source (Meta, Telegram, CSV, manual).
export interface IncomingLead {
  source: LeadSource;
  externalId?: string | null;   // Meta Lead ID / Telegram ref (§56, §57)
  name?: string | null;
  phone: string;                 // raw
  brandId: string;
  dealershipId: string;
  modelInterest?: string | null;
  campaign?: string | null;
  formId?: string | null;
  answers: IncomingAnswer[];     // dynamic answers (§60)
}

// Field mapping result (§61): which incoming keys feed fixed CRM fields.
export interface FieldMapping {
  fullNameKey?: string;
  phoneKey?: string;
  modelKey?: string;
}

export interface IngestResult {
  leadId: string;
  customerExisted: boolean;
  matchedExternalId: boolean;
  phoneHitCustomer: boolean;
}

// Ingests an external lead into the shared lead system (§57):
// normalize phone → dedup customer → create lead → store external ref + answers.
export async function ingestLead(
  tx: Prisma.TransactionClient,
  payload: IncomingLead,
): Promise<IngestResult> {
  // 1) External-ID dedup (§56): if we've seen this Meta/Telegram lead, return it.
  if (payload.externalId) {
    const ref = await tx.externalLeadReference.findUnique({
      where: { source_externalId: { source: payload.source, externalId: payload.externalId } },
    });
    if (ref) {
      return { leadId: ref.leadId, customerExisted: true, matchedExternalId: true, phoneHitCustomer: true };
    }
  }

  // 2) Phone normalization + customer dedup (§56, §63).
  const normalized = normalizePhone(payload.phone);
  const { customerId, existed } = await findOrCreateCustomer(tx, normalized, payload.name ?? null);

  // 3) Create the lead in the SAME pipeline as everything else (§8, §57).
  const lead = await tx.lead.create({
    data: {
      customerId,
      dealershipId: payload.dealershipId,
      brandId: payload.brandId,
      modelInterest: payload.modelInterest ?? null,
      source: payload.source,
      campaign: payload.campaign ?? null,
      formId: payload.formId ?? null,
      externalLeadId: payload.externalId ?? null,
      pipelineStatus: 'NEW',
    },
  });

  await tx.leadActivity.create({ data: { leadId: lead.id, event: 'LEAD_CREATED' } });
  await tx.leadActivity.create({ data: { leadId: lead.id, event: 'LEAD_ENTERED_POOL' } });

  // 4) Store dynamic answers — ALL of them, mapped or not (§60, §61, #14).
  if (payload.answers.length > 0) {
    await tx.leadFormAnswer.createMany({
      data: payload.answers.map((a, idx) => ({
        leadId: lead.id,
        externalFieldKey: a.externalFieldKey,
        questionLabelSnapshot: a.questionLabel,
        answer: a.answer,
        displayOrder: idx,
      })),
    });
  }

  // 5) Record external reference for dedup.
  if (payload.externalId) {
    await tx.externalLeadReference.create({
      data: { source: payload.source, externalId: payload.externalId, leadId: lead.id },
    });
  }

  return { leadId: lead.id, customerExisted: existed, matchedExternalId: false, phoneHitCustomer: existed };
}

// Applies a form's field mapping to extract fixed CRM fields from dynamic answers (§61).
// Unmapped answers are always kept — nothing is lost.
export function applyMapping(
  answers: IncomingAnswer[],
  mapping: FieldMapping | null,
): { name: string | null; phone: string | null; model: string | null } {
  const byKey = new Map(answers.map((a) => [a.externalFieldKey, a.answer]));
  const pick = (k?: string) => (k ? byKey.get(k) ?? null : null);
  return {
    name: pick(mapping?.fullNameKey),
    phone: pick(mapping?.phoneKey),
    model: pick(mapping?.modelKey),
  };
}
