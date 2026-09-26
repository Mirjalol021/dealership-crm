import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formErrorText } from '../lib/formError';
import type { Brand, Dealership } from '../lib/types';
import { AuditLogPage } from './AuditLogPage';

type Tab = 'general' | 'dealerships' | 'brands' | 'audit';

export function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('general');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [b, d] = await Promise.all([
        api.get<{ brands: Brand[] }>('/api/brands'),
        api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
      ]);
      setBrands(b.brands);
      setDealerships(d.dealerships);
    } catch {
      setError(t('err.loadFailed'));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: t('settings.leadDistribution') },
    { key: 'dealerships', label: t('settings.dealerships') },
    { key: 'brands', label: t('settings.brands') },
    { key: 'audit', label: t('audit.title') },
  ];

  return (
    <div>
      <h1 className="page-title">{t('settings.title')}</h1>
      <div className="tabs">
        {TABS.map((x) => (
          <button key={x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {tab === 'general' && <GeneralTab />}
      {tab === 'dealerships' && <DealershipsTab dealerships={dealerships} brands={brands} onChanged={load} />}
      {tab === 'brands' && <BrandsTab brands={brands} onChanged={load} />}
      {tab === 'audit' && <AuditLogPage />}
    </div>
  );
}

function GeneralTab() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'MANAGER_SELF_PICK' | 'CALL_CENTER_QUALIFICATION'>('MANAGER_SELF_PICK');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ settings: { leadDistributionMode: 'MANAGER_SELF_PICK' | 'CALL_CENTER_QUALIFICATION' } }>('/api/settings')
      .then((r) => setMode(r.settings.leadDistributionMode));
  }, []);

  async function change(next: 'MANAGER_SELF_PICK' | 'CALL_CENTER_QUALIFICATION') {
    setBusy(true);
    setSaved(false);
    try {
      await api.patch('/api/settings', { leadDistributionMode: next });
      setMode(next);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2>{t('settings.leadDistribution')}</h2>
      <label className="check">
        <input type="radio" name="distmode" checked={mode === 'MANAGER_SELF_PICK'} disabled={busy} onChange={() => change('MANAGER_SELF_PICK')} />
        {t('settings.managerSelfPick')}
      </label>
      <label className="check">
        <input type="radio" name="distmode" checked={mode === 'CALL_CENTER_QUALIFICATION'} disabled={busy} onChange={() => change('CALL_CENTER_QUALIFICATION')} />
        {t('settings.callCenter')}
      </label>
      <p className="muted small">{t('settings.distributionHint')}</p>
      {saved && <div className="ok-msg">✓ {t('common.saved')}</div>}
    </div>
  );
}

function BrandsTab({ brands, onChanged }: { brands: Brand[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; code: string; active: boolean }>({ name: '', code: '', active: true });
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function startEdit(b: Brand) {
    setEditId(b.id);
    setDraft({ name: b.name, code: b.code, active: b.active });
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/api/brands/${editId}`, draft);
      setEditId(null);
      onChanged();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/api/brands', { name: newName, code: newCode });
      setNewName('');
      setNewCode('');
      onChanged();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <div className="card">
        <h2>{t('settings.brands')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('settings.name')}</th>
              <th>{t('settings.code')}</th>
              <th>{t('settings.active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                {editId === b.id ? (
                  <>
                    <td><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                    <td><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
                    <td><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /></td>
                    <td className="actions-cell">
                      <button className="btn-primary sm" disabled={busy} onClick={saveEdit}>{t('common.save')}</button>
                      <button className="btn-ghost sm" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{b.name}</td>
                    <td>{b.code}</td>
                    <td>{b.active ? '✓' : '—'}</td>
                    <td className="actions-cell"><button className="btn-ghost sm" onClick={() => startEdit(b)}>{t('common.edit')}</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h2>{t('settings.addBrand')}</h2>
        {error && <div className="error">{error}</div>}
        <label>{t('settings.name')}<input value={newName} onChange={(e) => setNewName(e.target.value)} required /></label>
        <label>{t('settings.code')}<input value={newCode} onChange={(e) => setNewCode(e.target.value)} required /></label>
        <button className="btn-primary" disabled={busy}>{t('settings.save')}</button>
      </form>
    </div>
  );
}

function DealershipsTab({
  dealerships,
  brands,
  onChanged,
}: {
  dealerships: Dealership[];
  brands: Brand[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ dealershipName: string; cityRegion: string; address: string; active: boolean; brandIds: string[] }>({
    dealershipName: '', cityRegion: '', address: '', active: true, brandIds: [],
  });
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function startEdit(d: Dealership) {
    setEditId(d.id);
    setDraft({
      dealershipName: d.dealershipName, cityRegion: d.cityRegion, address: d.address ?? '', active: d.active,
      brandIds: (d.brands ?? []).map((b) => b.id),
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/api/dealerships/${editId}`, {
        dealershipName: draft.dealershipName, cityRegion: draft.cityRegion,
        address: draft.address || null, active: draft.active, brandIds: draft.brandIds,
      });
      setEditId(null);
      onChanged();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleDraftBrand(id: string) {
    setDraft((d) => ({ ...d, brandIds: d.brandIds.includes(id) ? d.brandIds.filter((x) => x !== id) : [...d.brandIds, id] }));
  }
  function toggleBrand(id: string) {
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/api/dealerships', { dealershipName: name, cityRegion: city, address: address || null, brandIds: selectedBrands });
      setName(''); setCity(''); setAddress(''); setSelectedBrands([]);
      onChanged();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <div className="card">
        <h2>{t('settings.dealerships')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('settings.name')}</th>
              <th>{t('settings.cityRegion')}</th>
              <th>{t('settings.brandsAvailable')}</th>
              <th>{t('settings.active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dealerships.map((d) => (
              <tr key={d.id}>
                {editId === d.id ? (
                  <>
                    <td><input value={draft.dealershipName} onChange={(e) => setDraft({ ...draft, dealershipName: e.target.value })} /></td>
                    <td><input value={draft.cityRegion} onChange={(e) => setDraft({ ...draft, cityRegion: e.target.value })} /></td>
                    <td>
                      <div className="brand-checks">
                        {brands.map((b) => (
                          <label key={b.id} className="check small">
                            <input type="checkbox" checked={draft.brandIds.includes(b.id)} onChange={() => toggleDraftBrand(b.id)} />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /></td>
                    <td className="actions-cell">
                      <button className="btn-primary sm" disabled={busy} onClick={saveEdit}>{t('common.save')}</button>
                      <button className="btn-ghost sm" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{d.dealershipName}</td>
                    <td>{d.cityRegion}</td>
                    <td>{d.brands?.map((b) => b.name).join(', ') || t('common.none')}</td>
                    <td>{d.active ? '✓' : '—'}</td>
                    <td className="actions-cell"><button className="btn-ghost sm" onClick={() => startEdit(d)}>{t('common.edit')}</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h2>{t('settings.addDealership')}</h2>
        {error && <div className="error">{error}</div>}
        <label>{t('settings.name')}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>{t('settings.cityRegion')}<input value={city} onChange={(e) => setCity(e.target.value)} required /></label>
        <label>{t('settings.address')} <span className="opt">{t('common.optional')}</span><input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <fieldset>
          <legend>{t('settings.brandsAvailable')}</legend>
          {brands.map((b) => (
            <label key={b.id} className="check">
              <input type="checkbox" checked={selectedBrands.includes(b.id)} onChange={() => toggleBrand(b.id)} />
              {b.name}
            </label>
          ))}
        </fieldset>
        <button className="btn-primary" disabled={busy}>{t('settings.save')}</button>
      </form>
    </div>
  );
}
