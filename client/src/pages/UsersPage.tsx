import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Brand, Dealership, Role } from '../lib/types';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  preferredLanguage: string;
  active: boolean;
}

const ROLES: Role[] = [
  'SUPER_ADMIN', 'HEAD_OF_SALES', 'SALES_MANAGER', 'CALL_CENTER', 'SERVICE_STAFF', 'FINANCE',
];

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('SALES_MANAGER');
  const [language, setLanguage] = useState('uz');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [u, b, d] = await Promise.all([
        api.get<{ users: UserRow[] }>('/api/users'),
        api.get<{ brands: Brand[] }>('/api/brands'),
        api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
      ]);
      setUsers(u.users);
      setBrands(b.brands);
      setDealerships(d.dealerships);
    } catch {
      setError('Failed to load users');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/users', {
        name, email, password, role, preferredLanguage: language,
      });
      setName('');
      setEmail('');
      setPassword('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t('nav.users')}</h1>
      {error && <div className="error">{error}</div>}
      <div className="two-col">
        <div className="card">
          <h2>{t('nav.users')}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t('settings.name')}</th>
                <th>{t('auth.email')}</th>
                <th>Role</th>
                <th>{t('common.language')}</th>
                <th>{t('settings.active')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{t(`roles.${u.role}`)}</td>
                  <td>{u.preferredLanguage.toUpperCase()}</td>
                  <td>{u.active ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="card" onSubmit={add}>
          <h2>Add User</h2>
          <label>
            {t('settings.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('auth.password')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`roles.${r}`)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('common.language')}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="uz">O'zbek</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <p className="muted small">
            {dealerships.length} dealership(s), {brands.length} brand(s) available.
            Access assignment is edited after creation.
          </p>
          <button className="btn-primary" disabled={busy}>{t('settings.save')}</button>
        </form>
      </div>
    </div>
  );
}
