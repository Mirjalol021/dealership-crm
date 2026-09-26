import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Sale } from '../lib/vehicleTypes';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';

// Super Admin / Head of Sales "Sales" landing (§77) — a focused overview of sold cars.
export function SalesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const showCosts = can('costs.view');
  const { data, loading, error, reload } = useAsync(() => api.get<{ sales: Sale[] }>('/api/sales'), []);
  const sales = data?.sales ?? [];

  const total = sales.length;
  const discounted = sales.filter((s) => s.discountedSale).length;

  if (loading) return <div><h1 className="page-title">{t('nav.sales')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('nav.sales')}</h1><ErrorState message={error} onRetry={reload} /></div>;

  return (
    <div>
      <h1 className="page-title">{t('nav.sales')}</h1>

      <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="fin-card neutral"><div className="fin-card-label">{t('rep.sold')}</div><div className="fin-card-value">{total}</div></div>
        <div className="fin-card warn"><div className="fin-card-label">{t('veh.discountedSale')}</div><div className="fin-card-value">{discounted}</div></div>
        {showCosts && (
          <div className="fin-card good"><div className="fin-card-label">{t('fin.turnover')}</div>
            <div className="fin-card-value">{sales.reduce((s, x) => s + (x.salePrice ?? 0), 0).toLocaleString()}</div>
          </div>
        )}
      </div>

      <div className="table-scroll" style={{ marginTop: 18 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>{t('lead.customer')}</th><th>{t('lead.brand')}</th>
              <th>{t('veh.paymentType')}</th>{showCosts && <th>{t('veh.manualMargin')}</th>}<th>{t('lead.manager')}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.saleDate).toLocaleDateString()}</td>
                <td>{s.customerName ?? s.phone}</td>
                <td>{s.brand} {s.model}</td>
                <td>{t(`veh.${s.paymentType.toLowerCase()}`)}</td>
                {showCosts && <td>{s.manualMargin?.toLocaleString() ?? '—'}</td>}
                <td>{s.salesManager ?? '—'}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={showCosts ? 6 : 5}><EmptyState /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
