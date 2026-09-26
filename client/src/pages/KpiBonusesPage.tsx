import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';
import type { KpiBonus } from '../lib/financeTypes';
import type { Brand } from '../lib/types';
import { formErrorText } from '../lib/formError';

export function KpiBonusesPage() {
  const { t } = useTranslation();
  const [bonuses, setBonuses] = useState<KpiBonus[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
          const [b, br] = await Promise.all([
            api.get<{ bonuses: KpiBonus[] }>('/api/kpi-bonuses'),
            api.get<{ brands: Brand[] }>('/api/brands'),
          ]);
          setBonuses(b.bonuses);
          setBrands(br.brands);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await api.patch(`/api/kpi-bonuses/${id}`, { status });
    load();
  }

  if (loading) return <div><h1 className="page-title">{t('fin.kpiBonusTitle')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('fin.kpiBonusTitle')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('fin.kpiBonusTitle')}</h1>
        <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('fin.addKpi')}</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>{t('fin.month')}</th>
            <th>{t('lead.brand')}</th>
            <th>{t('veh.amount')}</th>
            <th>{t('fin.status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b) => (
            <tr key={b.id}>
              <td>{b.month}</td>
              <td>{b.brand}</td>
              <td>{b.amount.toLocaleString()}</td>
              <td>
                <span className={`status-dot ${b.status.toLowerCase()}`} />
                {t(`veh.${b.status.toLowerCase()}`)}
              </td>
              <td className="actions-cell">
                {b.status !== 'CONFIRMED' && b.status !== 'PAID' && (
                  <button className="btn-ghost sm" onClick={() => setStatus(b.id, 'CONFIRMED')}>{t('veh.confirm')}</button>
                )}
                {b.status !== 'PAID' && (
                  <button className="btn-primary sm" onClick={() => setStatus(b.id, 'PAID')}>{t('veh.markPaid')}</button>
                )}
              </td>
            </tr>
          ))}
          {bonuses.length === 0 && (<tr><td colSpan={5}><EmptyState /></td></tr>)}
        </tbody>
      </table>

      {showAdd && (
        <AddKpiModal brands={brands} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

function AddKpiModal({ brands, onClose, onSaved }: { brands: Brand[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/kpi-bonuses', { month, brandId, amount: Number(amount || 0), status: 'EXPECTED' });
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
        <h2>{t('fin.addKpi')}</h2>
        <label>{t('fin.month')}<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <label>{t('lead.brand')}
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('veh.amount')}<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !amount} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
