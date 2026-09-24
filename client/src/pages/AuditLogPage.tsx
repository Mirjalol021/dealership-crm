import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  summary: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

const ENTITIES = ['SoldCar', 'Expense', 'KpiBonus', 'VinDistributorBonus', 'VehicleCustomerBonus', 'VehicleReservation', 'InventoryVehicle', 'AfterSalesStockReceipt', 'AfterSalesStockAdjustment', 'AfterSalesInventoryUsage', 'User', 'Brand', 'Dealership'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'];

export function AuditLogPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ take: '200' });
    if (entity) q.set('entity', entity);
    if (action) q.set('action', action);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api.get<{ logs: AuditEntry[]; total: number }>(`/api/audit-logs?${q}`).then((r) => {
      setLogs(r.logs);
      setTotal(r.total);
    });
  }, [entity, action, from, to]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('audit.title')}</h1>
        <span className="muted">{t('audit.records')}: {total}</span>
      </div>

      <div className="filter-bar">
        <label>{t('audit.entity')}
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>{t('audit.action')}
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {ACTIONS.map((x) => <option key={x} value={x}>{t(`audit.act.${x}`)}</option>)}
          </select>
        </label>
        <label>{t('fin.from')}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>{t('fin.to')}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('audit.time')}</th>
              <th>{t('audit.actor')}</th>
              <th>{t('audit.entity')}</th>
              <th>{t('audit.action')}</th>
              <th>{t('audit.summary')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <Fragment key={l.id}>
                <tr className="row-click" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="small">{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.actorName ?? '—'}</td>
                  <td className="mono small">{l.entity}</td>
                  <td><span className={`pill ${l.action === 'DELETE' ? 'pill-lost' : l.action === 'CREATE' ? 'pill-sold' : 'pill-visit-planned'}`}>{t(`audit.act.${l.action}`)}</span></td>
                  <td>{l.summary ?? '—'}</td>
                </tr>
                {expanded === l.id && Boolean(l.oldValue || l.newValue) && (
                  <tr>
                    <td colSpan={5}>
                      <div className="audit-detail">
                        {l.oldValue != null && (
                          <div><strong>{t('audit.oldValue')}:</strong><pre>{JSON.stringify(l.oldValue, null, 2) as string}</pre></div>
                        )}
                        {l.newValue != null && (
                          <div><strong>{t('audit.newValue')}:</strong><pre>{JSON.stringify(l.newValue, null, 2) as string}</pre></div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
