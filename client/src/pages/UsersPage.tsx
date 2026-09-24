import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Brand, Dealership, Role } from '../lib/types';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  preferredLanguage: string;
  active: boolean;
  dealershipIds: string[];
  brandIds: string[];
}

const ROLES: Role[] = [
  'SUPER_ADMIN', 'HEAD_OF_SALES', 'SALES_MANAGER', 'CALL_CENTER', 'SERVICE_STAFF', 'FINANCE',
];

const EMPTY_FORM = {
  name: '', email: '', phone: '', password: '', role: 'SALES_MANAGER' as Role,
  preferredLanguage: 'uz', active: true, dealershipIds: [] as string[], brandIds: [] as string[],
};

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [error, setError] = useState('');

  // null = form closed; '' = creating; id = editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
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
      setError(t('err.loadFailed'));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId('');
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(u: UserRow) {
    setEditingId(u.id);
    setForm({
      name: u.name, email: u.email, phone: u.phone ?? '', password: '', role: u.role,
      preferredLanguage: u.preferredLanguage, active: u.active,
      dealershipIds: [...u.dealershipIds], brandIds: [...u.brandIds],
    });
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key: 'dealershipIds' | 'brandIds', id: string) =>
    set(key, form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        // Edit: email/name/role/scopes/active; password only if provided.
        await api.patch(`/api/users/${editingId}`, {
          name: form.name, phone: form.phone || null, role: form.role,
          preferredLanguage: form.preferredLanguage, active: form.active,
          dealershipIds: form.dealershipIds, brandIds: form.brandIds,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.post('/api/users', {
          name: form.name, email: form.email, password: form.password, role: form.role,
          preferredLanguage: form.preferredLanguage,
          dealershipIds: form.dealershipIds, brandIds: form.brandIds,
        });
      }
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message === 'EMAIL_TAKEN' ? t('err.emailTaken') : t('err.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserRow) {
    await api.patch(`/api/users/${u.id}`, { active: !u.active });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('nav.users')}</h1>
        {editingId === null && (
          <button className="btn-primary inline" onClick={openCreate}>+ {t('settings.addUser')}</button>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t('settings.name')}</th>
              <th>{t('auth.email')}</th>
              <th>{t('roles.role')}</th>
              <th>{t('settings.scope')}</th>
              <th>{t('settings.active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{t(`roles.${u.role}`)}</td>
                <td className="muted small">
                  {u.dealershipIds.length}D · {u.brandIds.length}B
                </td>
                <td>{u.active ? '✓' : '—'}</td>
                <td className="actions-cell">
                  <button className="btn-ghost sm" onClick={() => openEdit(u)}>{t('common.edit')}</button>
                  <button className="btn-ghost sm" onClick={() => toggleActive(u)}>
                    {u.active ? t('settings.deactivate') : t('settings.activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <form className="card" style={{ marginTop: 16, maxWidth: 720 }} onSubmit={save}>
          <h2>{editingId ? t('settings.editUser') : t('settings.addUser')}</h2>
          <div className="two-col">
            <div>
              <label>{t('settings.name')}
                <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </label>
              <label>{t('auth.email')}
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!!editingId} />
              </label>
              <label>{t('settings.phone')}
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label>{t('auth.password')}{editingId && <span className="muted small"> ({t('settings.leaveBlank')})</span>}
                <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} minLength={editingId ? 0 : 6} required={!editingId} />
              </label>
              <label>Role
                <select value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                </select>
              </label>
              <label>{t('common.language')}
                <select value={form.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)}>
                  <option value="uz">O'zbek</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </label>
              {editingId && (
                <label className="check">
                  <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                  {t('settings.active')}
                </label>
              )}
            </div>
            <div>
              <fieldset>
                <legend>{t('settings.dealershipAccess')}</legend>
                {dealerships.map((d) => (
                  <label key={d.id} className="check">
                    <input type="checkbox" checked={form.dealershipIds.includes(d.id)} onChange={() => toggle('dealershipIds', d.id)} />
                    {d.dealershipName}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>{t('settings.brandAccess')}</legend>
                {brands.map((b) => (
                  <label key={b.id} className="check">
                    <input type="checkbox" checked={form.brandIds.includes(b.id)} onChange={() => toggle('brandIds', b.id)} />
                    {b.name}
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={busy}>{t('common.save')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
