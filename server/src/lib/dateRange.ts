// Shared date-range parsing for reports, analytics and exports (§65, §68).
// Supported presets: today | 7d | month | lastMonth | custom (via from/to).
export interface DateRange {
  gte?: Date;
  lt?: Date;
}

export function rangeFromQuery(q: Record<string, string | undefined>): DateRange {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (q.range === 'today') return { gte: startOfToday };
  if (q.range === '7d') return { gte: new Date(startOfToday.getTime() - 6 * 86400000) };
  if (q.range === 'week') {
    // "This Week" — Monday as the first day.
    const day = (startOfToday.getDay() + 6) % 7; // 0 = Monday
    return { gte: new Date(startOfToday.getTime() - day * 86400000) };
  }
  if (q.range === 'lastMonth') {
    return {
      gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      lt: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  if (q.range === 'month') return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };

  // Explicit custom range (works with or without range=custom).
  const r: DateRange = {};
  if (q.from) r.gte = new Date(q.from);
  if (q.to) r.lt = new Date(`${q.to}T23:59:59.999Z`);
  return r;
}

// True when the query actually constrains a date window.
export function hasRange(r: DateRange): boolean {
  return Boolean(r.gte || r.lt);
}
