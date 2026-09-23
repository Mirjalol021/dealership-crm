// Phone normalization for customer dedup (§63).
// UZ numbers: +998XXXXXXXXX. We keep only digits, prefix with +998 rules.

export function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');

  // Uzbek numbers are 9 digits after the 998 country code.
  if (digits.length === 9) return `+998${digits}`;
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('0998')) return `+998${digits.slice(4)}`;

  // Fallback: keep E.164-ish. If it already starts with +, preserve leading +.
  if (input.trim().startsWith('+')) return `+${digits}`;
  return digits;
}
