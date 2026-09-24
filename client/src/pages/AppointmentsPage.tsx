import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { LeadDetailModal } from '../components/LeadDetailModal';

interface Appt {
  id: string;
  date: string;
  time: string | null;
  status: 'PLANNED' | 'ARRIVED' | 'NO_SHOW';
  note: string | null;
  customerName: string | null;
  phone: string;
  brand: string;
  dealership: string;
  manager: string | null;
  leadId: string;
}

export function AppointmentsPage() {
  const { t } = useTranslation();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    const r = await api.get<{ appointments: Appt[] }>(`/api/appointments${q}`);
    setAppts(r.appointments);
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function setStatus(id: string, status: string) {
    await api.patch(`/api/appointments/${id}`, { status });
    load();
  }

  return (
    <div>
      <h1 className="page-title">{t('nav.appointments')}</h1>

      <div className="chips">
        <button className={`chip${statusFilter === '' ? ' active' : ''}`} onClick={() => setStatusFilter('')}>{t('lead.all')}</button>
        <button className={`chip${statusFilter === 'PLANNED' ? ' active' : ''}`} onClick={() => setStatusFilter('PLANNED')}>{t('appt.PLANNED')}</button>
        <button className={`chip${statusFilter === 'ARRIVED' ? ' active' : ''}`} onClick={() => setStatusFilter('ARRIVED')}>{t('appt.ARRIVED')}</button>
        <button className={`chip${statusFilter === 'NO_SHOW' ? ' active' : ''}`} onClick={() => setStatusFilter('NO_SHOW')}>{t('appt.NO_SHOW')}</button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.customer')}</th>
              <th>{t('lead.phone')}</th>
              <th>{t('lead.brand')}</th>
              <th>{t('lead.dealership')}</th>
              <th>{t('appt.date')}</th>
              <th>{t('lead.manager')}</th>
              <th>{t('appt.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appts.map((a) => (
              <tr key={a.id}>
                <td className="row-click" onClick={() => setOpenLead(a.leadId)}>{a.customerName ?? '—'}</td>
                <td><a className="phone-link" href={`tel:${a.phone}`}>{a.phone}</a></td>
                <td>{a.brand}</td>
                <td>{a.dealership}</td>
                <td>{new Date(a.date).toLocaleDateString()} {a.time ?? ''}</td>
                <td>{a.manager ?? '—'}</td>
                <td>
                  <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)}>
                    <option value="PLANNED">{t('appt.PLANNED')}</option>
                    <option value="ARRIVED">{t('appt.ARRIVED')}</option>
                    <option value="NO_SHOW">{t('appt.NO_SHOW')}</option>
                  </select>
                </td>
                <td><button className="btn-ghost sm" onClick={() => setOpenLead(a.leadId)}>{t('lead.open')}</button></td>
              </tr>
            ))}
            {appts.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openLead && <LeadDetailModal leadId={openLead} onClose={() => { setOpenLead(null); load(); }} />}
    </div>
  );
}
