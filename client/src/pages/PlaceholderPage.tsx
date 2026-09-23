import { useTranslation } from 'react-i18next';

// Temporary page for nav routes whose features arrive in later phases.
export function PlaceholderPage({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="page-title">{t(`nav.${labelKey}`)}</h1>
      <div className="placeholder-card">
        <p className="muted">Coming in a later phase.</p>
      </div>
    </div>
  );
}
