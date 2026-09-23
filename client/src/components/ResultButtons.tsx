import { useTranslation } from 'react-i18next';
import type { LeadResult } from '../lib/leadTypes';

// Primary + secondary quick buttons (§13).
const PRIMARY: LeadResult[] = [
  'NO_ANSWER', 'CLIENT_BUSY', 'INTERESTED', 'INFO_GIVEN_THINKING', 'VISIT_PLANNED', 'NOT_INTERESTED',
];
const SECONDARY: LeadResult[] = [
  'WRONG_NUMBER', 'LEFT_INFO_BY_MISTAKE', 'ANOTHER_REGION', 'TEST_DRIVE_COMPLETED', 'SOLD',
];

export function ResultButtons({
  onPick,
  active,
}: {
  onPick: (r: LeadResult) => void;
  active?: LeadResult | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="result-buttons">
      <div className="result-primary">
        {PRIMARY.map((r) => (
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
        {SECONDARY.map((r) => (
          <button key={r} className="result-btn small" onClick={() => onPick(r)}>
            {t(`resultLabel.${r}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
