import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="page-title">{t('auth.welcome')}, {user.name}</h1>
      <p className="muted">{t(`roles.${user.role}`)}</p>
      <div className="placeholder-card">
        <p>{t('nav.dashboard')}</p>
        <p className="muted">
          Phase 1 provides the shell. Dashboard widgets arrive with their data
          features (leads, sales, finance) in later phases.
        </p>
      </div>
    </div>
  );
}
