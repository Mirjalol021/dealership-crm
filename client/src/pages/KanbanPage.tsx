import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ListLead, PipelineStatus } from '../lib/leadTypes';
import { LeadDetailModal } from '../components/LeadDetailModal';
import { StatusPill } from './MyLeadsPage';
import { useAuth } from '../lib/auth';

const COLUMNS: PipelineStatus[] = [
  'NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST',
];

// Move a lead between adjacent columns (§18). Backend stores pipeline changes.
const NEXT_RESULT: Partial<Record<PipelineStatus, string>> = {
  NEW: 'INTERESTED',
  WORKING: 'VISIT_PLANNED',
  VISIT_PLANNED: 'TEST_DRIVE_COMPLETED',
  VISITED_TEST_DRIVE: 'SOLD',
  SOLD: 'SOLD',
  LOST: 'LOST',
};

export function KanbanPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<PipelineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const canWork = can('leads.take') || can('leads.view.own') || can('leads.view.all');

  async function load() {
    setLoading(true);
    const r = await api.get<{ leads: ListLead[] }>('/api/leads');
    setLeads(r.leads);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Drag & drop (§18): drop a card on a column to change its pipeline status.
  async function moveTo(leadId: string, target: PipelineStatus) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipelineStatus === target) return;
    setBusy(true);
    try {
      await api.post(`/api/leads/${leadId}/result`, {
        result: NEXT_RESULT[target] ?? 'INTERESTED',
        pipelineStatus: target,
      });
      // Optimistic update.
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipelineStatus: target } : l)));
    } catch {
      load();
    } finally {
      setBusy(false);
    }
  }

  function onDrop(col: PipelineStatus) {
    if (dragId) moveTo(dragId, col);
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div>
      <h1 className="page-title">{t('nav.leads')} — Kanban</h1>
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <div className="kanban">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.pipelineStatus === col);
            return (
              <div
                key={col}
                className={`kanban-col${overCol === col ? ' drop-target' : ''}`}
                onDragOver={(e) => { if (canWork) { e.preventDefault(); setOverCol(col); } }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => onDrop(col)}
              >
                <div className="kanban-head">
                  <StatusPill status={col} />
                  <span className="muted small">{items.length}</span>
                </div>
                {items.map((l) => (
                  <div
                    key={l.id}
                    className={`kanban-card${dragId === l.id ? ' dragging' : ''}`}
                    draggable={canWork}
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => setOpenId(l.id)}
                  >
                    {l.priority === 'PRIORITY' && <span className="tag-priority">★ {t('lead.priority')}</span>}
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
      )}
      {busy && <div className="loading">{t('common.loading')}</div>}
      {openId && <LeadDetailModal leadId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
