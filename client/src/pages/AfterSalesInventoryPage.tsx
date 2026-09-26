import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';
import { AS_CATEGORIES, UNITS, type AsItem } from '../lib/aftersalesTypes';
import type { Dealership } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ExportButtons } from '../components/ExportButtons';
import { formErrorText } from '../lib/formError';

export function AfterSalesInventoryPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [items, setItems] = useState<AsItem[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);

  const showCosts = can('costs.view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
          const [i, d] = await Promise.all([
            api.get<{ items: AsItem[] }>('/api/aftersales/items'),
            api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
          ]);
          setItems(i.items);
          setDealerships(d.dealerships);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div><h1 className="page-title">{t('as.inventory')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('as.inventory')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('as.inventory')}</h1>
        <div className="page-head-actions">
          <ExportButtons type="stock" />
          <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('as.addItem')}</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('as.itemName')}</th>
              <th>{t('as.category')}</th>
              <th>{t('as.qty')}</th>
              <th>{t('as.unit')}</th>
              <th>{t('as.sellingPrice')}</th>
              {showCosts && <th>{t('as.purchaseCost')}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const low = i.minimumStock != null && i.quantityOnHand <= i.minimumStock;
              return (
                <tr key={i.id} className={low ? 'row-warn' : ''}>
                  <td>{i.itemName}</td>
                  <td>{t(`as.${camel(i.category)}`)}</td>
                  <td className={low ? 'low-stock' : ''}>{i.quantityOnHand} {low && '⚠'}</td>
                  <td>{t(`as.${i.unit.toLowerCase()}`)}</td>
                  <td>{i.sellingPrice.toLocaleString()}</td>
                  {showCosts && <td>{i.purchaseCost?.toLocaleString() ?? '—'}</td>}
                  <td className="actions-cell">
                    <button className="btn-ghost sm" onClick={() => setReceiveId(i.id)}>{t('as.receive')}</button>
                    <button className="btn-ghost sm" onClick={() => setAdjustId(i.id)}>{t('as.adjust')}</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (<tr><td colSpan={7}><EmptyState /></td></tr>)}
          </tbody>
        </table>
      </div>

      {showAdd && <AddItemModal dealerships={dealerships} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {receiveId && <ReceiveModal itemId={receiveId} onClose={() => setReceiveId(null)} onSaved={() => { setReceiveId(null); load(); }} />}
      {adjustId && <AdjustModal itemId={adjustId} onClose={() => setAdjustId(null)} onSaved={() => { setAdjustId(null); load(); }} />}
    </div>
  );
}

function camel(s: string): string {
  // ENGINE_OIL -> engineOil
  const parts = s.toLowerCase().split('_');
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

function AddItemModal({ dealerships, onClose, onSaved }: { dealerships: Dealership[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<Record<string, string>>({
    category: 'ENGINE_OIL', unit: 'PIECE', dealershipId: dealerships[0]?.id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/aftersales/items', {
        dealershipId: f.dealershipId,
        category: f.category,
        itemName: f.itemName,
        unit: f.unit,
        sellingPrice: Number(f.sellingPrice || 0),
        purchaseCost: Number(f.purchaseCost || 0),
        minimumStock: f.minimumStock ? Number(f.minimumStock) : null,
        partNumber: f.partNumber || null,
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
        <h2>{t('as.addItem')}</h2>
        <label>{t('as.itemName')} <span className="req">*</span><input value={f.itemName ?? ''} onChange={(e) => set('itemName', e.target.value)} /></label>
        <label>{t('as.category')}
          <select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {AS_CATEGORIES.map((c) => <option key={c} value={c}>{t(`as.${camel(c)}`)}</option>)}
          </select>
        </label>
        <label>{t('as.unit')}
          <select value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{t(`as.${u.toLowerCase()}`)}</option>)}
          </select>
        </label>
        <label>{t('as.sellingPrice')} <span className="req">*</span><input type="number" value={f.sellingPrice ?? ''} onChange={(e) => set('sellingPrice', e.target.value)} /></label>
        <label>{t('as.purchaseCost')} <span className="req">*</span><input type="number" value={f.purchaseCost ?? ''} onChange={(e) => set('purchaseCost', e.target.value)} /></label>
        <label>{t('as.minStock')} <span className="opt">{t('common.optional')}</span><input type="number" value={f.minimumStock ?? ''} onChange={(e) => set('minimumStock', e.target.value)} /></label>
        <label>{t('lead.dealership')}
          <select value={f.dealershipId} onChange={(e) => set('dealershipId', e.target.value)}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !f.itemName || !f.sellingPrice || !f.purchaseCost} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}

function ReceiveModal({ itemId, onClose, onSaved }: { itemId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/aftersales/items/${itemId}/receive`, {
        quantityReceived: Number(qty || 0),
        unitCost: Number(cost || 0),
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
        <h2>{t('as.receive')}</h2>
        <label>{t('as.qty')} <span className="req">*</span><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label>{t('as.purchaseCost')} <span className="opt">{t('common.optional')}</span><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !qty} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ itemId, onClose, onSaved }: { itemId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('DAMAGED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/aftersales/items/${itemId}/adjust`, {
        quantityChange: Number(change || 0),
        reason,
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
        <h2>{t('as.adjust')}</h2>
        <label>{t('as.quantityChange')} <span className="req">*</span>
          <input type="number" value={change} onChange={(e) => setChange(e.target.value)} placeholder="-3 yoki +5" />
        </label>
        <label>{t('as.reason')}
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="DAMAGED">{t('as.damaged')}</option>
            <option value="PHYSICAL_INVENTORY_CORRECTION">{t('as.physicalCorrection')}</option>
            <option value="RETURNED">{t('as.returned')}</option>
            <option value="OTHER">{t('as.other')}</option>
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !change} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
