import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

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

const STATUS_LABEL: Record<string, Record<string, string>> = {
  uz: { PLANNED: "Rejalashtirilgan", ARRIVED: "Keldi", NO_SHOW: "Kelmadi" },
  ru: { PLANNED: "Запланирован", ARRIVED: "Пришёл", NO_SHOW: "Не пришёл" },
  en: { PLANNED: "Planned", ARRIVED: "Arrived", NO_SHOW: "No Show" },
};

export function AppointmentsPage() {
  const { t, i18n } = useTranslation();
  const [appts, setAppts] = useState<Appt[]>([]);

  async function load() {
    const r = await api.get<{ appointments: Appt[] }>('/api/appointments');
    setAppts(r.appointments);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await api.patch(`/api/appointments/${id}`, { status });
    load();
  }

  const labels = STATUS_LABEL[i18n.language] ?? STATUS_LABEL.en;

  return (
    <div>
      <h1 className="page-title">{t('nav.appointments')}</h1>
      <table className="table">
        <thead>
          <tr>
            <th>{t('lead.customer')}</th>
            <th>{t('lead.phone')}</th>
            <th>{t('lead.brand')}</th>
            <th>{t('lead.dealership')}</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {appts.map((a) => (
            <tr key={a.id}>
              <td>{a.customerName ?? '—'}</td>
              <td>{a.phone}</td>
              <td>{a.brand}</td>
              <td>{a.dealership}</td>
              <td>{new Date(a.date).toLocaleDateString()} {a.time ?? ''}</td>
              <td>
                <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)}>
                  <option value="PLANNED">{labels.PLANNED}</option>
                  <option value="ARRIVED">{labels.ARRIVED}</option>
                  <option value="NO_SHOW">{labels.NO_SHOW}</option>
                </select>
              </td>
            </tr>
          ))}
          {appts.length === 0 && (
            <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>—</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
