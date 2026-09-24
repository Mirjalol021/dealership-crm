import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navForRole } from '../lib/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = user ? navForRole(user.role) : [];

  useEffect(() => {
    const item = items.find((i) => i.path === location.pathname);
    const label = item ? t(`nav.${item.labelKey}`) : t('app.name');
    document.title = `${label} · ${t('app.name')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <button
        className="menu-toggle"
        aria-label="Menu"
        onClick={() => setMenuOpen((o) => !o)}
      >
        ☰
      </button>

      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}

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
              onClick={() => setMenuOpen(false)}
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
