import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navForRole } from '../lib/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { Icon } from './Icons';

// Initials avatar from a full name (e.g. "Ali Karimov" -> "AK").
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const items = user ? navForRole(user.role) : [];

  useEffect(() => {
    const item = items.find((i) => i.path === location.pathname);
    const label = item ? t(`nav.${item.labelKey}`) : t('app.name');
    document.title = `${label} · ${t('app.name')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]);

  // Close the profile dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const activeItem = items.find((i) => i.path === location.pathname);

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
          <span className="brand-mark">MG</span>
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
              <span className="nav-icon">
                {item.icon ? Icon[item.icon]({ size: 18 }) : Icon.Dashboard({ size: 18 })}
              </span>
              <span className="nav-label">{t(`nav.${item.labelKey}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-promo">
            <img src="/img/car.jpg" alt="" className="sidebar-promo-img" />
            <div className="sidebar-promo-text">
              <strong>MG S5 EV</strong>
              <span>{t('brand.tagline')}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="topbar-crumb-icon">
              {activeItem?.icon ? Icon[activeItem.icon]({ size: 18 }) : Icon.Dashboard({ size: 18 })}
            </span>
            <span className="topbar-crumb-text">
              {activeItem ? t(`nav.${activeItem.labelKey}`) : t('app.name')}
            </span>
          </div>

          <div className="topbar-actions">
            <NotificationBell />
            <ThemeToggle />

            <div className="lang-switch-wrap">
              <LanguageSwitcher />
            </div>

            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-chip"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
              >
                <span className="avatar">{initials(user.name)}</span>
                <span className="user-chip-text">
                  <span className="user-chip-name">{user.name}</span>
                  <span className="user-chip-role">{t(`roles.${user.role}`)}</span>
                </span>
                <Icon.Chevron size={16} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-head">
                    <span className="avatar avatar-lg">{initials(user.name)}</span>
                    <div>
                      <div className="user-dropdown-name">{user.name}</div>
                      <div className="user-dropdown-role">{t(`roles.${user.role}`)}</div>
                    </div>
                  </div>
                  <button className="user-dropdown-item" onClick={handleLogout}>
                    <Icon.Logout size={17} />
                    {t('auth.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
