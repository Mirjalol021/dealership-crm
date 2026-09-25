// Shared export helper (§65). Opens the export endpoint with the same filters
// the on-screen list uses, so "export = current filtered result".
export function exportList(
  type: 'leads' | 'sales' | 'inventory' | 'expenses' | 'stock' | 'aftersales',
  format: 'csv' | 'xlsx',
  params?: Record<string, string | undefined>,
): void {
  const q = new URLSearchParams({ format });
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) q.set(k, v);
  }
  window.open(`/api/export/${type}?${q}`, '_blank');
}
