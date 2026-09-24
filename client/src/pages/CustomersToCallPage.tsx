import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { CustomerToCall } from '../lib/aftersalesTypes';
import { NewVisitModal } from './ServiceVisitsPage';
import { useAuth } from '../lib/auth';

// §44 Customer to Call filters.
const BUCKETS: { key: string; i18n: string; pill: string }[] = [
  { key: 'DUE_SOON', i18n: 'dueSoon', pill: 'pill-visit-planned' },
  { key: 'OVERDUE', i18n: 'overdue', pill: 'pill-lost' },
  { key: 'MILEAGE_DUE', i18n: 'mileageDue', pill: 'pill-new' },
  { key: 'NEVER_SERVICED', i18n: 'neverServiced', pill: 'pill-new' },
];

const PILL: Record<string, { i18n: string; cls: string }> = {
  DUE_SOON: { i18n: 'dueSoon', cls: 'pill-visit-planned' },
  OVERDUE: { i18n: 'overdue', cls: 'pill-lost' },
  MILEAGE_DUE: { i18n: 'mileageDue', cls: 'pill-new' },
  NEVER_SERVICED: { i18n: 'neverServiced', cls: 'pill-new' },
};

export function CustomersToCallPage() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CustomerToCall[]>([]);
  const [bucket, setBucket] = useState<string>('');
  const [visitCarId, setVisitCarId] = useState<string | null>(null);
  const { can } = useAuth();
  const canManage = can('aftersales.manage');

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
          <button key={b.key} className={`chip${bucket === b.key ? ' active' : ''}`} onClick={() => setBucket(b.key)}>
            {t(`as.${b.i18n}`)}
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const meta = PILL[c.bucket] ?? { i18n: 'neverServiced', cls: 'pill-new' };
              return (
                <tr key={c.soldCarId}>
                  <td>{c.customerName ?? c.phone}</td>
                  <td><a className="phone-link" href={`tel:${c.phone}`}>{c.phone}</a></td>
                  <td>{c.brand} {c.model}</td>
                  <td className="mono">{c.vin}</td>
                  <td>
                    {c.currentMileage?.toLocaleString() ?? '—'}
                    {c.nextServiceMileage != null && <span className="muted small"> / {c.nextServiceMileage.toLocaleString()}</span>}
                  </td>
                  <td>{c.nextServiceDate ? new Date(c.nextServiceDate).toLocaleDateString() : '—'}</td>
                  <td><span className={`pill ${meta.cls}`}>{t(`as.${meta.i18n}`)}</span></td>
                  <td>
                    {canManage && (
                      <button className="btn-primary sm" onClick={() => setVisitCarId(c.soldCarId)}>{t('as.newVisit')}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {visitCarId && (
        <NewVisitModal
          initialCarId={visitCarId}
          onClose={() => setVisitCarId(null)}
          onSaved={() => { setVisitCarId(null); load(); }}
        />
      )}
    </div>
  );
}
