import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formErrorText } from '../lib/formError';
import type { Vehicle, VehicleStatus } from '../lib/vehicleTypes';
import type { Brand, Dealership } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ReserveModal } from '../components/ReserveModal';
import { SellModal } from '../components/SellModal';
import { ExportButtons } from '../components/ExportButtons';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';

export function InventoryPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState({ AVAILABLE: 0, RESERVED: 0, SOLD: 0 });
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [reserveId, setReserveId] = useState<string | null>(null);
  const [sellVehicle, setSellVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = can('inventory.manage');
  const canSell = can('sales.manage');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const [v, s] = await Promise.all([
        api.get<{ vehicles: Vehicle[] }>(`/api/inventory${q}`),
        api.get<{ summary: typeof summary }>('/api/inventory/summary'),
      ]);
      setVehicles(v.vehicles);
      setSummary(s.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('veh.inventory')}</h1>
        <div className="page-head-actions">
          <ExportButtons type="inventory" params={{ status: statusFilter || undefined }} />
          {canManage && (
            <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('veh.addVehicle')}</button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? <Loading /> : (
      <>
      <div className="stat-row three">
        <button className={`stat clickable${statusFilter === 'AVAILABLE' ? ' sel' : ''}`} onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? '' : 'AVAILABLE')}>
          <div className="stat-value">{summary.AVAILABLE}</div>
          <div className="stat-label">{t('veh.available')}</div>
        </button>
        <button className={`stat clickable${statusFilter === 'RESERVED' ? ' sel' : ''}`} onClick={() => setStatusFilter(statusFilter === 'RESERVED' ? '' : 'RESERVED')}>
          <div className="stat-value">{summary.RESERVED}</div>
          <div className="stat-label">{t('veh.reserved')}</div>
        </button>
        <button className={`stat clickable${statusFilter === 'SOLD' ? ' sel' : ''}`} onClick={() => setStatusFilter(statusFilter === 'SOLD' ? '' : 'SOLD')}>
          <div className="stat-value">{summary.SOLD}</div>
          <div className="stat-label">{t('veh.sold')}</div>
        </button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.brand')}</th>
              <th>{t('lead.model')}</th>
              <th>{t('veh.trim')}</th>
              <th>{t('veh.color')}</th>
              <th>{t('veh.vin')}</th>
              <th>{t('veh.sellingPrice')}</th>
              <th>{t('veh.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.brand}</td>
                <td>{v.model}</td>
                <td>{v.trim ?? '—'}</td>
                <td>{v.color ?? '—'}</td>
                <td className="mono">{v.vin}</td>
                <td>{v.sellingPrice != null ? v.sellingPrice.toLocaleString() : '—'}</td>
                <td>
                  <VehiclePill status={v.status} />
                  {v.status === 'RESERVED' && v.reservedAt && (
                    <div className="muted small">{new Date(v.reservedAt).toLocaleDateString()}</div>
                  )}
                  {v.status === 'SOLD' && v.soldAt && (
                    <div className="muted small">{new Date(v.soldAt).toLocaleDateString()}</div>
                  )}
                </td>
                <td className="actions-cell">
                  {v.status === 'AVAILABLE' && canSell && (
                    <>
                      <button className="btn-ghost sm" onClick={() => setReserveId(v.id)}>{t('veh.reserve')}</button>
                      <button className="btn-primary sm" onClick={() => setSellVehicle(v)}>{t('veh.sell')}</button>
                    </>
                  )}
                  {v.status === 'RESERVED' && canSell && (
                    <button className="btn-primary sm" onClick={() => setSellVehicle(v)}>{t('veh.sell')}</button>
                  )}
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && !loading && (
              <tr><td colSpan={8}><EmptyState /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {reserveId && <ReserveModal vehicleId={reserveId} onClose={() => setReserveId(null)} onSaved={() => { setReserveId(null); load(); }} />}
      {sellVehicle && <SellModal vehicle={sellVehicle} onClose={() => setSellVehicle(null)} onSaved={() => { setSellVehicle(null); load(); }} />}
    </div>
  );
}

export function VehiclePill({ status }: { status: VehicleStatus }) {
  const { t } = useTranslation();
  const cls = status === 'AVAILABLE' ? 'pill pill-sold' : status === 'RESERVED' ? 'pill pill-visit-planned' : 'pill pill-lost';
  return <span className={cls}>{t(`veh.${status.toLowerCase()}`)}</span>;
}

function AddVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => {
      setBrands(b.brands);
      setDealerships(d.dealerships);
      setForm((f) => ({ ...f, brandId: b.brands[0]?.id ?? '', dealershipId: d.dealerships[0]?.id ?? '' }));
    });
  }, []);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/inventory', {
        dealershipId: form.dealershipId,
        brandId: form.brandId,
        model: form.model,
        trim: form.trim || null,
        color: form.color || null,
        vin: form.vin,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : null,
        notes: form.notes || null,
      });
      onSaved();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('veh.addVehicle')}</h2>
        <label>{t('lead.brand')} <span className="req">*</span>
          <select value={form.brandId ?? ''} onChange={(e) => set('brandId', e.target.value)}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('lead.model')} <span className="req">*</span>
          <input value={form.model ?? ''} onChange={(e) => set('model', e.target.value)} required />
        </label>
        <label>{t('veh.trim')} <span className="opt">{t('common.optional')}</span><input value={form.trim ?? ''} onChange={(e) => set('trim', e.target.value)} /></label>
        <label>{t('veh.color')} <span className="opt">{t('common.optional')}</span><input value={form.color ?? ''} onChange={(e) => set('color', e.target.value)} /></label>
        <label>{t('veh.vin')} <span className="req">*</span>
          <input value={form.vin ?? ''} onChange={(e) => set('vin', e.target.value)}
            required minLength={5} placeholder={t('veh.vinHint')} />
        </label>
        <label>{t('lead.dealership')}
          <select value={form.dealershipId ?? ''} onChange={(e) => set('dealershipId', e.target.value)}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
        <label>{t('veh.sellingPrice')} <span className="opt">{t('common.optional')}</span>
          <input type="number" value={form.sellingPrice ?? ''} onChange={(e) => set('sellingPrice', e.target.value)} />
        </label>
        <label>{t('veh.notes')} <span className="opt">{t('common.optional')}</span><input value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !form.model || (form.vin ?? '').length < 5} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
