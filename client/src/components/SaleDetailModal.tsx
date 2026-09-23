import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { CustomerBonus, Sale, VinBonus } from '../lib/vehicleTypes';
import { useAuth } from '../lib/auth';

interface SaleDetail extends Sale {
  customerBonuses: CustomerBonus[];
  vinBonuses: VinBonus[];
}

export function SaleDetailModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const showCosts = can('costs.view');
  const [sale, setSale] = useState<SaleDetail | null>(null);

  async function load() {
    const r = await api.get<{ sale: SaleDetail }>(`/api/sales/${saleId}`);
    setSale(r.sale);
  }

  useEffect(() => {
    load();
  }, [saleId]);

  if (!sale) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{sale.brand} {sale.model}</h2>
        <div className="muted small mono">{sale.vin}</div>

        <div className="kv-grid">
          <div><span className="muted">{t('lead.customer')}</span><div>{sale.customerName ?? sale.phone}</div></div>
          <div><span className="muted">{t('veh.paymentType')}</span><div>{t(`veh.${sale.paymentType.toLowerCase()}`)}</div></div>
          {showCosts && <div><span className="muted">{t('veh.salePrice')}</span><div>{sale.salePrice?.toLocaleString()}</div></div>}
          {showCosts && <div><span className="muted">{t('veh.manualMargin')}</span><div>{sale.manualMargin?.toLocaleString()}</div></div>}
          {sale.discountedSale && (
            <div><span className="muted">{t('veh.discountAmount')}</span><div>{sale.discountAmount?.toLocaleString()}</div></div>
          )}
        </div>

        {showCosts && <BonusSection saleId={saleId} bonuses={sale.customerBonuses} reload={load} />}
        {showCosts && <VinBonusSection saleId={saleId} bonuses={sale.vinBonuses} reload={load} />}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function BonusSection({ saleId, bonuses, reload }: { saleId: string; bonuses: CustomerBonus[]; reload: () => void }) {
  const { t } = useTranslation();
  const [type, setType] = useState('TONIROVKA');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState('CASH');

  async function add() {
    await api.post(`/api/sales/${saleId}/bonuses`, { bonusType: type, amount: Number(amount || 0), paidFrom });
    setAmount('');
    reload();
  }

  async function del(id: string) {
    await api.del(`/api/sales/${saleId}/bonuses/${id}`);
    reload();
  }

  return (
    <div className="detail-panel">
      <h3>{t('veh.customerBonuses')}</h3>
      <ul className="kv">
        {bonuses.map((b) => (
          <li key={b.id}>
            {t(`veh.${b.bonusType.toLowerCase()}`)} — {b.amount.toLocaleString()} · {t(`veh.${b.paidFrom.toLowerCase()}`)}
            <button className="link-del" onClick={() => del(b.id)}>✕</button>
          </li>
        ))}
      </ul>
      <div className="inline-form">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {['TONIROVKA', 'POLIK', 'REGISTRATION', 'FUEL', 'GIFT', 'OTHER'].map((x) => (
            <option key={x} value={x}>{t(`veh.${x.toLowerCase()}`)}</option>
          ))}
        </select>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('veh.amount')} />
        <select value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)}>
          <option value="CASH">{t('veh.cash')}</option>
          <option value="CARD">{t('veh.card')}</option>
          <option value="LLC_ACCOUNT">{t('veh.llc')}</option>
        </select>
        <button className="btn-ghost" onClick={add} disabled={!amount}>+</button>
      </div>
    </div>
  );
}

function VinBonusSection({ saleId, bonuses, reload }: { saleId: string; bonuses: VinBonus[]; reload: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  async function add() {
    await api.post(`/api/sales/${saleId}/vin-bonuses`, { amount: Number(amount || 0), accountingMonth: month, status: 'EXPECTED' });
    setAmount('');
    reload();
  }

  async function setStatus(id: string, status: string) {
    await api.patch(`/api/sales/${saleId}/vin-bonuses/${id}`, { status });
    reload();
  }

  return (
    <div className="detail-panel">
      <h3>{t('veh.vinBonus')}</h3>
      <ul className="kv">
        {bonuses.map((b) => (
          <li key={b.id}>
            <span className={`status-dot ${b.status.toLowerCase()}`} />
            {b.amount.toLocaleString()} · {b.accountingMonth} · {t(`veh.${b.status.toLowerCase()}`)}
            <span className="inline-actions">
              {b.status !== 'CONFIRMED' && b.status !== 'PAID' && (
                <button className="link-btn" onClick={() => setStatus(b.id, 'CONFIRMED')}>{t('veh.confirm')}</button>
              )}
              {b.status !== 'PAID' && (
                <button className="link-btn" onClick={() => setStatus(b.id, 'PAID')}>{t('veh.markPaid')}</button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="inline-form">
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('veh.amount')} />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button className="btn-ghost" onClick={add} disabled={!amount}>+</button>
      </div>
    </div>
  );
}
