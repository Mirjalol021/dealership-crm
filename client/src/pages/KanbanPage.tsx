import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ListLead, PipelineStatus } from '../lib/leadTypes';
import { LeadDetailModal } from '../components/LeadDetailModal';
import { StatusPill } from './MyLeadsPage';

const COLUMNS: PipelineStatus[] = [
  'NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST',
];

export function KanbanPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ leads: ListLead[] }>('/api/leads');
    setLeads(r.leads);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('nav.leads')} — Kanban</h1>
      <div className="kanban">
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.pipelineStatus === col);
          return (
            <div key={col} className="kanban-col">
              <div className="kanban-head">
                <StatusPill status={col} />
                <span className="muted small">{items.length}</span>
              </div>
              {items.map((l) => (
                <div key={l.id} className="kanban-card" onClick={() => setOpenId(l.id)}>
                  <div className="kc-name">{l.customerName ?? l.phone}</div>
                  <div className="muted small">{l.phone}</div>
                  <div className="muted small">{l.brand}{l.model ? ` · ${l.model}` : ''}</div>
                  {l.lastResult && (
                    <div className="kc-result">
                      {t(`resultLabel.${l.lastResult}`)}
                      {l.attempts > 0 ? ` — ${t('lead.attempt')} ${l.attempts}` : ''}
                    </div>
                  )}
                  {l.nextFollowUpAt && (
                    <div className="kc-next">
                      {t('lead.callToday')} {new Date(l.nextFollowUpAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {openId && <LeadDetailModal leadId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
