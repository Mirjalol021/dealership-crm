// CSV / spreadsheet helpers shared by exports.
// Kept in its own module so the formula-injection guard is unit-testable.

// Prevent spreadsheet formula injection (§ hardening).
// A leading = @ (or tab/CR) always makes Excel/Sheets treat the cell as a formula.
// A leading + or - is only dangerous when followed by more than a plain number
// (otherwise "+998..." phone numbers would be needlessly prefixed). We prefix the
// value with a single quote so the cell renders as literal text and is not executed.
export function sanitizeCell(s: string): string {
  if (/^[=@\t\r]/.test(s)) return `'${s}`;
  if (/^[+\-]/.test(s)) {
    // Safe if the rest is just a number (e.g. "+998901234567", "-1234").
    const rest = s.slice(1);
    if (rest !== '' && /^[0-9.,\s()\-]+$/.test(rest)) return s;
    return `'${s}`;
  }
  return s;
}

// Convert rows to CSV (§65). String cells are sanitized against formula injection;
// numbers pass through untouched; values containing , " or newlines are quoted.
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? sanitizeCell(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
