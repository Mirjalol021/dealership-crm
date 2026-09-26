import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { PoolLead } from '../lib/leadTypes';
import { AssignModal } from '../components/AssignModal';
import { useAuth } from '../lib/auth';

export function LeadPoolPage({ titleKey = 'lead.pool' }: { titleKey?: string } = {}) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [assignId, setAssignId] = useState<string | null>(null);

  const canAssign = can('leads.assign');

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
      setMsg(t('err.alreadyTaken'));
      load();
    }
  }

  return (
    <div>
      <h1 className="page-title">{t(titleKey)}</h1>
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
              <div className="lead-card-actions">
                <button className="btn-primary" onClick={() => take(l.id)}>
                  {t('lead.takeLead')}
                </button>
                {canAssign && (
                  <button className="btn-ghost" onClick={() => setAssignId(l.id)}>
                    {t('lead.assign')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assignId && (
        <AssignModal
          leadId={assignId}
          onClose={() => setAssignId(null)}
          onDone={() => { setAssignId(null); load(); }}
        />
      )}
    </div>
  );
}
