import { useTranslation } from 'react-i18next';
import type { LeadResult } from '../lib/leadTypes';

// Smart follow-up presets (§14).
// Only ask for extra detail when the selected result requires it, and offer
// one-tap presets instead of forcing the user to open a date picker.

export type PresetKind = 'no_answer' | 'busy' | 'thinking' | 'visit_expected' | 'visit_planned';

// Which preset set a result maps to (§14).
export function presetKindFor(result: LeadResult | null): PresetKind | null {
  switch (result) {
    case 'NO_ANSWER': return 'no_answer';
    case 'CLIENT_BUSY': return 'busy';
    case 'INFO_GIVEN_THINKING': return 'thinking';
    case 'INFO_GIVEN_VISIT_EXPECTED': return 'visit_expected';
    case 'VISIT_PLANNED': return 'visit_planned';
    default: return null;
  }
}

interface Preset {
  key: string;
  labelKey: string;
  // Produces the target Date (local) for this preset.
  resolve: () => Date;
}

function atDay(offsetDays: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function laterToday(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 3, 0, 0, 0);
  return d;
}

// Presets per result (§14). Order matters — shown left to right.
const PRESETS: Record<PresetKind, Preset[]> = {
  no_answer: [
    { key: 'laterToday', labelKey: 'follow.laterToday', resolve: laterToday },
    { key: 'tomorrow', labelKey: 'follow.tomorrow', resolve: () => atDay(1) },
    { key: 'in3Days', labelKey: 'follow.in3Days', resolve: () => atDay(3) },
  ],
  busy: [
    { key: 'laterToday', labelKey: 'follow.laterToday', resolve: laterToday },
    { key: 'tomorrow', labelKey: 'follow.tomorrow', resolve: () => atDay(1) },
    { key: 'in3Days', labelKey: 'follow.in3Days', resolve: () => atDay(3) },
  ],
  thinking: [
    { key: 'in2Days', labelKey: 'follow.in2Days', resolve: () => atDay(2) },
    { key: 'in3Days', labelKey: 'follow.in3Days', resolve: () => atDay(3) },
    { key: 'in1Week', labelKey: 'follow.in1Week', resolve: () => atDay(7) },
  ],
  visit_expected: [
    { key: 'thisWeek', labelKey: 'follow.thisWeek', resolve: () => atDay(3) },
    { key: 'nextWeek', labelKey: 'follow.nextWeek', resolve: () => atDay(7) },
  ],
  visit_planned: [],
};

// Format a Date to the value expected by <input type="datetime-local"> (local time).
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowUpPicker({
  kind,
  onChange,
}: {
  kind: PresetKind;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const presets = PRESETS[kind];

  if (presets.length === 0) return null;

  return (
    <div className="preset-row">
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          className="chip"
          onClick={() => onChange(toLocalInput(p.resolve()))}
        >
          {t(p.labelKey)}
        </button>
      ))}
    </div>
  );
}
