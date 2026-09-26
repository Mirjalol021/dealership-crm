import { ApiError } from '../api/client';
import i18n from '../i18n';

// Field key -> human label (i18n key under which the field name lives).
// A best-effort map so validation errors name the offending field in plain language.
const FIELD_LABELS: Record<string, string> = {
  phone: 'lead.phone',
  name: 'lead.name',
  brandId: 'lead.brand',
  dealershipId: 'lead.dealership',
  model: 'lead.model',
  modelInterest: 'lead.model',
  vin: 'veh.vin',
  trim: 'veh.trim',
  color: 'veh.color',
  sellingPrice: 'veh.sellingPrice',
  salePrice: 'veh.salePrice',
  manualMargin: 'veh.manualMargin',
  discountAmount: 'veh.discountAmount',
  depositAmount: 'veh.deposit',
  amount: 'veh.amount',
  accountingMonth: 'fin.accountingMonth',
  category: 'fin.category',
  expenseType: 'fin.expenseType',
  itemName: 'as.itemName',
  quantity: 'as.qty',
  quantityChange: 'as.quantityChange',
  reason: 'as.reason',
  unit: 'as.unit',
  purchaseCost: 'as.purchaseCost',
  workPerformed: 'as.workPerformed',
  serviceRevenue: 'as.serviceRevenue',
  month: 'fin.month',
  email: 'auth.email',
  password: 'auth.password',
  role: 'roles.role',
  text: 'lead.comment',
  result: 'lead.result',
  toUserId: 'lead.assignTo',
  nextFollowUpAt: 'lead.followUp',
  vehicleId: 'veh.inventory',
  soldCarId: 'lead.customer',
};

function labelFor(field: string): string {
  const key = FIELD_LABELS[field];
  if (key) {
    const translated = i18n.t(key);
    if (translated && translated !== key) return translated;
  }
  // Fallback: make the raw key slightly more readable (camelCase -> spaces).
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds a user-facing error message from any thrown value.
 * - Validation errors (INVALID_INPUT) name the offending field(s).
 * - Known error codes get a friendly translation.
 * - Everything else falls back to the generic message.
 */
export function formErrorText(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return i18n.t('err.generic');
  }

  // Name the fields that failed validation, including the specific reason if short.
  if (err.code === 'INVALID_INPUT' && err.details?.fieldErrors) {
    const parts = Object.entries(err.details.fieldErrors)
      .filter(([, msgs]) => msgs && msgs.length > 0)
      .map(([field, msgs]) => `${labelFor(field)}: ${msgs[0]}`);
    if (parts.length > 0) {
      return `${i18n.t('err.invalidInput')} — ${parts.join('; ')}`;
    }
  }

  // Map known codes to friendly text.
  const known: Record<string, string> = {
    VIN_TAKEN: 'err.vinTaken',
    EMAIL_TAKEN: 'err.emailTaken',
    ALREADY_TAKEN: 'err.alreadyTaken',
    FORBIDDEN: 'err.forbidden',
    NOT_FOUND: 'err.notFound',
    CONFLICT: 'err.conflict',
    TOO_MANY_ATTEMPTS: 'err.tooManyAttempts',
  };
  const key = known[err.code];
  if (key) {
    const t = i18n.t(key);
    if (t && t !== key) return t;
  }

  if (err.details?.formErrors?.length) {
    return `${i18n.t('err.invalidInput')} — ${err.details.formErrors[0]}`;
  }
  if (err.serverMessage) return err.serverMessage;

  return `${i18n.t('err.generic')} (${err.code})`;
}
