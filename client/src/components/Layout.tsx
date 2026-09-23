import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navForRole } from '../lib/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const items = navForRole(user.role);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CRM</span>
          <span className="brand-name">{t('app.name')}</span>
        </div>
        <nav className="nav">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              end={item.path === '/'}
            >
              {t(`nav.${item.labelKey}`)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="user-info">
            <strong>{user.name}</strong>
            <span className="role-badge">{t(`roles.${user.role}`)}</span>
          </div>
          <div className="topbar-actions">
            <LanguageSwitcher />
            <button className="btn-ghost" onClick={handleLogout}>
              {t('auth.logout')}
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
