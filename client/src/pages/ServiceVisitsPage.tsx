import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ServiceVisit, AsSoldCar, AsItem } from '../lib/aftersalesTypes';
import { useAuth } from '../lib/auth';
import { formErrorText } from '../lib/formError';

export function ServiceVisitsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [visits, setVisits] = useState<ServiceVisit[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const showCosts = can('costs.view');

  async function load() {
    const r = await api.get<{ visits: ServiceVisit[] }>('/api/service-visits');
    setVisits(r.visits);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('as.serviceVisits')}</h1>
        <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('as.newVisit')}</button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('appt.date')}</th>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.brand')}</th>
              <th className="mono">{t('veh.vin')}</th>
              <th>{t('as.workPerformed')}</th>
              <th>{t('as.serviceRevenue')}</th>
              {showCosts && <th>{t('as.inventoryCost')}</th>}
              {showCosts && <th>{t('as.contribution')}</th>}
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id}>
                <td>{new Date(v.serviceDate).toLocaleDateString()}</td>
                <td>{v.customerName ?? '—'}</td>
                <td>{v.brand} {v.model}</td>
                <td className="mono">{v.vin}</td>
                <td>{v.workPerformed}</td>
                <td>{v.serviceRevenue.toLocaleString()}</td>
                {showCosts && <td>{v.inventoryCost?.toLocaleString() ?? '—'}</td>}
                {showCosts && <td className="cell-link">{v.serviceContribution?.toLocaleString() ?? '—'}</td>}
              </tr>
            ))}
            {visits.length === 0 && (
              <tr><td colSpan={showCosts ? 8 : 6} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <NewVisitModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

export function NewVisitModal({ onClose, onSaved, initialCarId }: { onClose: () => void; onSaved: () => void; initialCarId?: string }) {
  const { t } = useTranslation();
  const [cars, setCars] = useState<AsSoldCar[]>([]);
  const [items, setItems] = useState<AsItem[]>([]);
  const [soldCarId, setSoldCarId] = useState('');
  const [mileage, setMileage] = useState('');
  const [work, setWork] = useState('');
  const [revenue, setRevenue] = useState('');
  const [method, setMethod] = useState('CASH');
  const [nextMileage, setNextMileage] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [lines, setLines] = useState<{ itemId: string; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ cars: AsSoldCar[] }>('/api/aftersales/sold-cars'),
      api.get<{ items: AsItem[] }>('/api/aftersales/items?active=true'),
    ]).then(([c, i]) => {
      setCars(c.cars);
      setItems(i.items);
      setSoldCarId(initialCarId ?? c.cars[0]?.id ?? '');
    });
  }, []);

  function addLine(itemId: string) {
    if (!itemId) return;
    setLines((prev) => (prev.some((l) => l.itemId === itemId) ? prev : [...prev, { itemId, quantity: 1 }]));
  }
  function setQty(itemId: string, q: number) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: q } : l)));
  }
  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/service-visits', {
        soldCarId,
        mileage: mileage ? Number(mileage) : null,
        workPerformed: work,
        serviceRevenue: Number(revenue || 0),
        paymentMethod: method,
        nextServiceMileage: nextMileage ? Number(nextMileage) : null,
        nextServiceDate: nextDate || null,
        items: lines,
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
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t('as.newVisit')}</h2>
        <label>{t('lead.customer')}<span className="req">*</span>
          <select value={soldCarId} onChange={(e) => setSoldCarId(e.target.value)}>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.customerName ?? c.phone} — {c.brand} {c.model} ({c.vin})</option>)}
          </select>
        </label>
        <label>{t('as.mileage')} <span className="opt">{t('common.optional')}</span><input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} /></label>
        <label>{t('as.workPerformed')} <span className="req">*</span><input value={work} onChange={(e) => setWork(e.target.value)} /></label>
        <label>{t('as.serviceRevenue')} <span className="req">*</span><input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></label>
        <label>{t('fin.paymentMethod')}
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">{t('veh.cash')}</option>
            <option value="CARD">{t('veh.card')}</option>
            <option value="LLC_ACCOUNT">{t('veh.llc')}</option>
          </select>
        </label>

        <fieldset>
          <legend>{t('as.itemsUsed')} <span className="opt">{t('common.optional')}</span></legend>
          <select onChange={(e) => { addLine(e.target.value); e.target.value = ''; }}>
            <option value="">+ {t('as.addItem')}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.itemName} ({i.quantityOnHand} {i.unit})</option>)}
          </select>
          {lines.map((l) => {
            const item = items.find((i) => i.id === l.itemId);
            return (
              <div key={l.itemId} className="line-row">
                <span>{item?.itemName}</span>
                <input type="number" min={1} value={l.quantity} onChange={(e) => setQty(l.itemId, Number(e.target.value))} />
                <button className="link-del" onClick={() => removeLine(l.itemId)}>✕</button>
              </div>
            );
          })}
        </fieldset>

        <label>{t('as.nextService')} — {t('as.mileage')}<input type="number" value={nextMileage} onChange={(e) => setNextMileage(e.target.value)} /></label>
        <label>{t('as.nextService')} — {t('appt.date')}<input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></label>

        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !work || !revenue} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
