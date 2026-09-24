import { useTranslation } from 'react-i18next';
import type { LeadResult } from '../lib/leadTypes';
import { useAuth } from '../lib/auth';

// Primary + secondary quick buttons (§13).
const PRIMARY: LeadResult[] = [
  'NO_ANSWER', 'CLIENT_BUSY', 'INTERESTED', 'INFO_GIVEN_THINKING', 'VISIT_PLANNED', 'NOT_INTERESTED',
];
const SECONDARY: LeadResult[] = [
  'WRONG_NUMBER', 'LEFT_INFO_BY_MISTAKE', 'ANOTHER_REGION', 'TEST_DRIVE_COMPLETED', 'SOLD',
];

// Call Center qualification buttons (§5.4) — focused set for first-call triage.
const CALL_CENTER_PRIMARY: LeadResult[] = [
  'NO_ANSWER', 'CLIENT_BUSY', 'INTERESTED', 'NOT_INTERESTED',
];
const CALL_CENTER_SECONDARY: LeadResult[] = [
  'WRONG_NUMBER', 'LEFT_INFO_BY_MISTAKE', 'ANOTHER_REGION', 'INFO_GIVEN_THINKING',
];

export function ResultButtons({
  onPick,
  active,
}: {
  onPick: (r: LeadResult) => void;
  active?: LeadResult | null;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Call Center uses its own qualification button set (§5.4, C2).
  const isCallCenter = user?.role === 'CALL_CENTER';
  const primary = isCallCenter ? CALL_CENTER_PRIMARY : PRIMARY;
  const secondary = isCallCenter ? CALL_CENTER_SECONDARY : SECONDARY;

  return (
    <div className="result-buttons">
      <div className="result-primary">
        {primary.map((r) => (
          <button
            key={r}
            className={`result-btn${active === r ? ' active' : ''}`}
            onClick={() => onPick(r)}
          >
            {t(`resultLabel.${r}`)}
          </button>
        ))}
      </div>
      <div className="result-secondary">
        {secondary.map((r) => (
          <button key={r} className={`result-btn small${active === r ? ' active' : ''}`} onClick={() => onPick(r)}>
            {t(`resultLabel.${r}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
