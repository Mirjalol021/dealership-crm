import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { PoolLead } from '../lib/leadTypes';

export function LeadPoolPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const r = await api.get<{ leads: PoolLead[] }>('/api/leads/pool');
    setLeads(r.leads);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function take(id: string) {
    setMsg('');
    try {
      await api.post(`/api/leads/${id}/take`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setMsg('Someone else already took this lead');
      load();
    }
  }

  return (
    <div>
      <h1 className="page-title">{t('lead.pool')}</h1>
      {msg && <div className="error">{msg}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : leads.length === 0 ? (
        <div className="placeholder-card">{t('lead.noLeads')}</div>
      ) : (
        <div className="lead-grid">
          {leads.map((l) => (
            <div key={l.id} className={`lead-card${l.priority === 'PRIORITY' ? ' priority' : ''}`}>
              <div className="lead-card-head">
                <strong>{l.customerName ?? l.phone}</strong>
                {l.priority === 'PRIORITY' && <span className="tag-priority">{t('lead.priority')}</span>}
              </div>
              <div className="lead-card-line">{l.brand}{l.model ? ` · ${l.model}` : ''}</div>
              <div className="lead-card-line muted">{t(`sourceLabel.${l.source}`)} · {l.dealership} · {l.region}</div>
              <div className="lead-card-line muted small">
                {t('lead.received')}: {new Date(l.createdAt).toLocaleString()}
              </div>
              <button className="btn-primary" onClick={() => take(l.id)}>
                {t('lead.takeLead')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
