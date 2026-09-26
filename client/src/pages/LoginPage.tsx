import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../api/client';
import { homeForRole } from '../lib/navigation';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Icon } from '../components/Icons';

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
      const me = await fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json());
      navigate(homeForRole(me.user.role), { replace: true });
    } catch (err: unknown) {
      // Show the real reason instead of always saying "invalid credentials" (§G1).
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(t('auth.tooManyAttempts'));
        } else if (err.status === 401) {
          setError(t('auth.invalid'));
        } else if (err.status >= 500) {
          setError(t('auth.serverError'));
        } else {
          setError(t('auth.loginFailed'));
        }
      } else {
        // Network / offline / proxy error.
        setError(t('auth.networkError'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page login-split">
      {/* Left: brand / hero panel with the car */}
      <aside className="login-hero">
        <div className="login-hero-inner">
          <div className="login-hero-brand">
            <span className="brand-mark">MG</span>
            <span className="brand-name">{t('app.name')}</span>
          </div>
          <h2 className="login-hero-title">{t('brand.heroTitle')}</h2>
          <p className="login-hero-sub">{t('brand.heroSubtitle')}</p>
          <div className="login-hero-badges">
            <span className="hero-badge">{Icon.Leads({ size: 14 })} Leads</span>
            <span className="hero-badge">{Icon.Car({ size: 14 })} Inventory</span>
            <span className="hero-badge">{Icon.Coin({ size: 14 })} Finance</span>
            <span className="hero-badge">{Icon.Wrench({ size: 14 })} Service</span>
          </div>
        </div>
      </aside>

      {/* Right: login form */}
      <div className="login-form-side">
        <div className="login-card">
          <div className="login-head">
            <span className="brand-mark">MG</span>
            <h1>{t('app.name')}</h1>
            <p className="muted small" style={{ margin: '6px 0 0' }}>{t('brand.tagline')}</p>
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
    </div>
  );
}
