import { useTranslation } from 'react-i18next';

// Shared loading / error / empty UI so every page behaves consistently.

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="async-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <span className="muted">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="async-state error-state" role="alert">
      <div className="error-state-msg">
        <strong>{t('common.loadFailed')}</strong>
        {message ? <span className="muted"> — {message}</span> : null}
      </div>
      {onRetry && (
        <button className="btn-ghost sm" onClick={onRetry}>{t('common.retry')}</button>
      )}
    </div>
  );
}

export function EmptyState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="async-state empty-state">
      <span className="muted">{label ?? t('common.noData')}</span>
    </div>
  );
}
