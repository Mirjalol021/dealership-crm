import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { CustomerToCall } from '../lib/aftersalesTypes';

const BUCKETS = ['DUE_SOON', 'OVERDUE', 'NEVER_SERVICED'] as const;

export function CustomersToCallPage() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CustomerToCall[]>([]);
  const [bucket, setBucket] = useState<string>('');

  async function load() {
    const q = bucket ? `?bucket=${bucket}` : '';
    const r = await api.get<{ customers: CustomerToCall[] }>(`/api/aftersales/customers-to-call${q}`);
    setCustomers(r.customers);
  }

  useEffect(() => {
    load();
  }, [bucket]);

  return (
    <div>
      <h1 className="page-title">{t('as.customersToCall')}</h1>

      <div className="chips">
        <button className={`chip${bucket === '' ? ' active' : ''}`} onClick={() => setBucket('')}>{t('lead.all')}</button>
        {BUCKETS.map((b) => (
          <button key={b} className={`chip${bucket === b ? ' active' : ''}`} onClick={() => setBucket(b)}>
            {t(`as.${b === 'DUE_SOON' ? 'dueSoon' : b === 'OVERDUE' ? 'overdue' : 'neverServiced'}`)}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.phone')}</th>
              <th>{t('lead.brand')}</th>
              <th className="mono">{t('veh.vin')}</th>
              <th>{t('as.mileage')}</th>
              <th>{t('as.nextService')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.soldCarId}>
                <td>{c.customerName ?? c.phone}</td>
                <td><a className="phone-link" href={`tel:${c.phone}`}>{c.phone}</a></td>
                <td>{c.brand} {c.model}</td>
                <td className="mono">{c.vin}</td>
                <td>{c.currentMileage?.toLocaleString() ?? '—'}</td>
                <td>{c.nextServiceDate ? new Date(c.nextServiceDate).toLocaleDateString() : '—'}</td>
                <td><span className={`pill ${c.bucket === 'OVERDUE' ? 'pill-lost' : c.bucket === 'DUE_SOON' ? 'pill-visit-planned' : 'pill-new'}`}>{t(`as.${c.bucket === 'DUE_SOON' ? 'dueSoon' : c.bucket === 'OVERDUE' ? 'overdue' : 'neverServiced'}`)}</span></td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
