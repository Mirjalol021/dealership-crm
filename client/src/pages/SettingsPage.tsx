import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Brand, Dealership } from '../lib/types';

export function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'general' | 'dealerships' | 'brands'>('general');
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
      setError('Failed to load settings');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('settings.title')}</h1>
      <div className="tabs">
        <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          {t('settings.leadDistribution')}
        </button>
        <button className={tab === 'dealerships' ? 'active' : ''} onClick={() => setTab('dealerships')}>
          {t('settings.dealerships')}
        </button>
        <button className={tab === 'brands' ? 'active' : ''} onClick={() => setTab('brands')}>
          {t('settings.brands')}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {tab === 'general' ? (
        <GeneralTab />
      ) : tab === 'dealerships' ? (
        <DealershipsTab dealerships={dealerships} brands={brands} onChanged={load} />
      ) : (
        <BrandsTab brands={brands} onChanged={load} />
      )}
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
        <input
          type="radio"
          name="distmode"
          checked={mode === 'MANAGER_SELF_PICK'}
          disabled={busy}
          onChange={() => change('MANAGER_SELF_PICK')}
        />
        {t('settings.managerSelfPick')}
      </label>
      <label className="check">
        <input
          type="radio"
          name="distmode"
          checked={mode === 'CALL_CENTER_QUALIFICATION'}
          disabled={busy}
          onChange={() => change('CALL_CENTER_QUALIFICATION')}
        />
        {t('settings.callCenter')}
      </label>
      <p className="muted small">{t('settings.distributionHint')}</p>
      {saved && <div className="ok-msg">✓ {t('settings.save')}</div>}
    </div>
  );
}

function BrandsTab({ brands, onChanged }: { brands: Brand[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/brands', { name, code });
      setName('');
      setCode('');
      onChanged();
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
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.code}</td>
                <td>{b.active ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h2>{t('settings.addBrand')}</h2>
        <label>
          {t('settings.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t('settings.code')}
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button className="btn-primary" disabled={busy}>
          {t('settings.save')}
        </button>
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
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleBrand(id: string) {
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/dealerships', {
        dealershipName: name,
        cityRegion: city,
        address: address || null,
        brandIds: selectedBrands,
      });
      setName('');
      setCity('');
      setAddress('');
      setSelectedBrands([]);
      onChanged();
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
            </tr>
          </thead>
          <tbody>
            {dealerships.map((d) => (
              <tr key={d.id}>
                <td>{d.dealershipName}</td>
                <td>{d.cityRegion}</td>
                <td>{d.brands?.map((b) => b.name).join(', ') || t('common.none')}</td>
                <td>{d.active ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h2>{t('settings.addDealership')}</h2>
        <label>
          {t('settings.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t('settings.cityRegion')}
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label>
          {t('settings.address')}
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <fieldset>
          <legend>{t('settings.brandsAvailable')}</legend>
          {brands.map((b) => (
            <label key={b.id} className="check">
              <input
                type="checkbox"
                checked={selectedBrands.includes(b.id)}
                onChange={() => toggleBrand(b.id)}
              />
              {b.name}
            </label>
          ))}
        </fieldset>
        <button className="btn-primary" disabled={busy}>
          {t('settings.save')}
        </button>
      </form>
    </div>
  );
}
