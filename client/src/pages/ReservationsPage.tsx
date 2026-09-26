import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';
import type { Reservation } from '../lib/vehicleTypes';
import { useAuth } from '../lib/auth';

export function ReservationsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const canManage = can('sales.manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
          const r = await api.get<{ reservations: Reservation[] }>('/api/reservations');
          setReservations(r.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id: string) {
    await api.post(`/api/reservations/${id}/cancel`);
    load();
  }

  if (loading) return <div><h1 className="page-title">{t('veh.reservations')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('veh.reservations')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <h1 className="page-title">{t('veh.reservations')}</h1>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.phone')}</th>
              <th>{t('lead.model')}</th>
              <th>{t('veh.vin')}</th>
              <th>{t('veh.deposit')}</th>
              <th>{t('veh.depositMethod')}</th>
              <th>{t('lead.manager')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id}>
                <td>{r.customerName ?? '—'}</td>
                <td>{r.phone}</td>
                <td>{r.model}</td>
                <td className="mono">{r.vin}</td>
                <td>{r.depositAmount.toLocaleString()}</td>
                <td>{r.depositPaymentMethod ? t(`veh.${r.depositPaymentMethod.toLowerCase()}`) : '—'}</td>
                <td>{r.salesManager ?? '—'}</td>
                <td>
                  {canManage && (
                    <button className="btn-ghost sm" onClick={() => cancel(r.id)}>{t('veh.cancelReservation')}</button>
                  )}
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (<tr><td colSpan={8}><EmptyState /></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
