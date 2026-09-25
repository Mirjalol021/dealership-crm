import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Sale } from '../lib/vehicleTypes';
import { useAuth } from '../lib/auth';
import { SaleDetailModal } from '../components/SaleDetailModal';
import { ExportButtons } from '../components/ExportButtons';

export function SoldCarsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const showCosts = can('costs.view');

  async function load() {
    const q = discountedOnly ? '?discounted=true' : '';
    const r = await api.get<{ sales: Sale[] }>(`/api/sales${q}`);
    setSales(r.sales);
  }

  useEffect(() => {
    load();
  }, [discountedOnly]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('veh.soldCars')}</h1>
        <div className="page-head-actions">
          <ExportButtons type="sales" />
          <label className="check inline">
            <input type="checkbox" checked={discountedOnly} onChange={(e) => setDiscountedOnly(e.target.checked)} />
            {t('veh.discountedSale')}
          </label>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.brand')}</th>
              <th>{t('veh.vin')}</th>
              <th>{t('veh.paymentType')}</th>
              {showCosts && <th>{t('veh.salePrice')}</th>}
              {showCosts && <th>{t('veh.manualMargin')}</th>}
              <th>{t('lead.manager')}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="row-click" onClick={() => setOpenId(s.id)}>
                <td>{s.customerName ?? s.phone}</td>
                <td>{s.brand} · {s.model}</td>
                <td className="mono">{s.vin}</td>
                <td>{t(`veh.${s.paymentType.toLowerCase()}`)}{s.discountedSale ? ' • ' + t('veh.discountedSale') : ''}</td>
                {showCosts && <td>{s.salePrice != null ? s.salePrice.toLocaleString() : '—'}</td>}
                {showCosts && <td>{s.manualMargin != null ? s.manualMargin.toLocaleString() : '—'}</td>}
                <td>{s.salesManager ?? '—'}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={showCosts ? 7 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <SaleDetailModal saleId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
