import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { LeadResult, ListLead, TodayCounts } from '../lib/leadTypes';
import { ResultButtons } from '../components/ResultButtons';
import { LeadDetailPanel } from '../components/LeadDetailPanel';

export function TodayPage() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<TodayCounts | null>(null);
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [current, setCurrent] = useState<ListLead | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await api.get<{ counts: TodayCounts; leads: ListLead[] }>('/api/leads/today');
    setCounts(r.counts);
    setLeads(r.leads);
    setCurrent(r.leads[0] ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function saveAndNext() {
    const rest = leads.filter((l) => l.id !== current?.id);
    setLeads(rest);
    setCurrent(rest[0] ?? null);
  }

  return (
    <div>
      <h1 className="page-title">{t('lead.today')}</h1>

      {counts && (
        <div className="stat-row">
          <Stat label={t('pipelineStatus.NEW')} value={counts.newLeads} />
          <Stat label={t('lead.callToday')} value={counts.callbacksToday} tone="brand" />
          <Stat label={t('lead.overdue')} value={counts.overdue} tone="danger" />
          <Stat label={t('lead.visitExpected')} value={counts.visitExpected} />
          <Stat label={t('lead.visitPlanned')} value={counts.visitsPlannedToday} />
        </div>
      )}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : !current ? (
        <div className="placeholder-card">🎉 {t('lead.noLeads')}</div>
      ) : (
        <div className="processor">
          <div className="processor-list">
            {leads.map((l) => (
              <button
                key={l.id}
                className={`processor-item${current.id === l.id ? ' active' : ''}`}
                onClick={() => setCurrent(l)}
              >
                <div className="pi-name">{l.customerName ?? l.phone}</div>
                <div className="pi-sub muted small">{l.brand}{l.model ? ` · ${l.model}` : ''}</div>
                <div className="pi-sub muted small">
                  {l.lastResult ? t(`resultLabel.${l.lastResult}`) : t('pipelineStatus.NEW')}
                  {l.attempts > 0 ? ` — ${t('lead.attempt')} ${l.attempts}` : ''}
                </div>
              </button>
            ))}
          </div>

          <LeadProcessor
            key={current.id}
            lead={current}
            onSaved={saveAndNext}
            onRefreshList={load}
          />
        </div>
      )}
    </div>
  );
}

function LeadProcessor({
  lead,
  onSaved,
  onRefreshList,
}: {
  lead: ListLead;
  onSaved: () => void;
  onRefreshList: () => void;
}) {
  const { t } = useTranslation();
  const [result, setResult] = useState<LeadResult | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Which extra fields a result needs (§14). No Answer and Busy both require a follow-up.
  const needsFollowUp = ['NO_ANSWER', 'CLIENT_BUSY', 'INFO_GIVEN_THINKING', 'INFO_GIVEN_VISIT_EXPECTED'].includes(result ?? '');
  const followUpRequired = result === 'CLIENT_BUSY' || result === 'NO_ANSWER';
  const needsAppointment = result === 'VISIT_PLANNED';

  async function save() {
    if (!result) return;
    if (followUpRequired && !followUp) { setError(t('lead.followUpRequired')); return; }
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/leads/${lead.id}/result`, {
        result,
        nextFollowUpAt: needsFollowUp && followUp ? new Date(followUp).toISOString() : undefined,
        appointmentDate: needsAppointment && appointmentDate ? new Date(appointmentDate).toISOString() : undefined,
        comment: comment || undefined,
      });
      onSaved();
      onRefreshList();
    } catch {
      setError('Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="processor-main card">
      <div className="processor-head">
        <div>
          <h2>{lead.customerName ?? lead.phone}</h2>
          <a className="phone-link" href={`tel:${lead.phone}`}>{lead.phone}</a>
        </div>
        <div className="muted small">{lead.brand}{lead.model ? ` · ${lead.model}` : ''} · {lead.dealership}</div>
      </div>

      <ResultButtons onPick={setResult} active={result} />

      {needsFollowUp && (
        <label className="followup-label">
          {t('lead.followUp')} {followUpRequired && <span className="req">*</span>}
          <input
            type="datetime-local"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            required={followUpRequired}
          />
        </label>
      )}

      {needsAppointment && (
        <label className="followup-label">
          {t('lead.visitPlanned')} <span className="req">*</span>
          <input
            type="datetime-local"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
          />
        </label>
      )}

      <label className="followup-label">
        {t('lead.comment')}
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>

      {error && <div className="error">{error}</div>}

      <button className="btn-primary big" disabled={!result || busy} onClick={save}>
        {t('lead.saveNext')}
      </button>

      <LeadDetailPanel leadId={lead.id} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'brand' | 'danger' }) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
