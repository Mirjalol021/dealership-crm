import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { AsSoldCar } from '../lib/aftersalesTypes';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';

export function AfterSalesSoldCarsPage() {
  const { t } = useTranslation();
  const [cars, setCars] = useState<AsSoldCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true); setError(null);
    api.get<{ cars: AsSoldCar[] }>('/api/aftersales/sold-cars')
      .then((r) => setCars(r.cars))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div><h1 className="page-title">{t('as.soldCarsDb')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('as.soldCarsDb')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <h1 className="page-title">{t('as.soldCarsDb')}</h1>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.phone')}</th>
              <th>{t('lead.brand')}</th>
              <th className="mono">{t('veh.vin')}</th>
              <th>{t('veh.purchaseDate')}</th>
              <th>{t('as.mileage')}</th>
              <th>{t('as.lastService')}</th>
              <th>{t('as.nextService')}</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id}>
                <td>{c.customerName ?? c.phone}</td>
                <td>{c.phone}</td>
                <td>{c.brand} {c.model}</td>
                <td className="mono">{c.vin}</td>
                <td>{new Date(c.purchaseDate).toLocaleDateString()}</td>
                <td>{c.currentMileage?.toLocaleString() ?? '—'}</td>
                <td>{c.lastServiceDate ? new Date(c.lastServiceDate).toLocaleDateString() : '—'}</td>
                <td>{c.nextServiceDate ? new Date(c.nextServiceDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {cars.length === 0 && (<tr><td colSpan={8}><EmptyState /></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
