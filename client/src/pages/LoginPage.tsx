import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { homeForRole } from '../lib/navigation';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      // Read the freshly stored user via a second mount; navigate by role.
      const me = await fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json());
      navigate(homeForRole(me.user.role), { replace: true });
    } catch {
      setError(t('auth.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-head">
          <span className="brand-mark">CRM</span>
          <h1>{t('app.name')}</h1>
        </div>
        <form onSubmit={submit}>
          <label>
            {t('auth.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.login')}
          </button>
        </form>
        <div className="login-foot">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
