import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { LeadDetail, LeadResult } from '../lib/leadTypes';
import { ResultButtons } from './ResultButtons';
import { useAuth } from '../lib/auth';

// Full lead detail modal with contact-result entry (§12, §14, §19-§22).
// Used from My Leads, Kanban and management drill-downs, so managers can work a
// lead without being forced back to the Today page.
export function LeadDetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [detail, setDetail] = useState<LeadDetail | null>(null);

  // Contact-result form state (§12-§14).
  const [result, setResult] = useState<LeadResult | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function load() {
    const r = await api.get<{ lead: LeadDetail }>(`/api/leads/${leadId}`);
    setDetail(r.lead);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Which extra fields a result needs (§14). No Answer and Busy both require a follow-up.
  const needsFollowUp = ['NO_ANSWER', 'CLIENT_BUSY', 'INFO_GIVEN_THINKING', 'INFO_GIVEN_VISIT_EXPECTED'].includes(result ?? '');
  const followUpRequired = result === 'CLIENT_BUSY' || result === 'NO_ANSWER';
  const needsAppointment = result === 'VISIT_PLANNED';

  const canWork = can('leads.take') || can('leads.view.own') || can('leads.view.all');

  async function saveResult() {
    if (!result) return;
    if (followUpRequired && !followUp) {
      setError(t('lead.followUpRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/leads/${leadId}/result`, {
        result,
        nextFollowUpAt: needsFollowUp && followUp ? new Date(followUp).toISOString() : undefined,
        appointmentDate: needsAppointment && appointmentDate ? new Date(appointmentDate).toISOString() : undefined,
        comment: comment || undefined,
      });
      setSaved(true);
      setResult(null);
      setFollowUp('');
      setAppointmentDate('');
      setComment('');
      await load();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    await api.post(`/api/leads/${leadId}/comments`, { text: comment });
    setComment('');
    await load();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        {!detail ? (
          <div className="loading">{t('common.loading')}</div>
        ) : (
          <>
            <div className="processor-head">
              <div>
                <h2>{detail.customer.name ?? detail.customer.primaryPhone}</h2>
                <a className="phone-link" href={`tel:${detail.customer.primaryPhone}`}>{detail.customer.primaryPhone}</a>
              </div>
              <div className="muted small">
                {detail.brand.name}{detail.modelInterest ? ` · ${detail.modelInterest}` : ''} · {detail.dealership.dealershipName}
              </div>
            </div>

            {/* Form answers (§60, §62) */}
            {detail.formAnswers.length > 0 && (
              <section className="detail-section">
                <h3>{t('lead.formAnswers')}</h3>
                <ul className="kv">
                  {detail.formAnswers.map((a) => (
                    <li key={a.id}><span className="muted">{a.questionLabelSnapshot}:</span> {a.answer}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Result entry (§12-§14) */}
            {canWork && (
              <section className="detail-section">
                <h3>{t('lead.result')}</h3>
                <ResultButtons onPick={setResult} active={result} />

                {needsFollowUp && (
                  <label className="followup-label">
                    {t('lead.followUp')} {followUpRequired && <span className="req">*</span>}
                    <input
                      type="datetime-local"
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
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
                  <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('lead.addComment')} />
                </label>

                {error && <div className="error">{error}</div>}
                {saved && <div className="ok-msg">✓ {t('common.saved')}</div>}

                <button className="btn-primary" disabled={!result || busy} onClick={saveResult}>
                  {t('lead.save')}
                </button>
              </section>
            )}

            {/* Comments (§19) */}
            <section className="detail-section">
              <h3>{t('lead.comments')}</h3>
              <div className="comment-add">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('lead.addComment')} />
                <button className="btn-ghost" onClick={addComment}>+</button>
              </div>
              <ul className="comment-list">
                {detail.comments.map((c) => (
                  <li key={c.id}>
                    <div>{c.text}</div>
                    <div className="muted small">{c.author} · {new Date(c.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Attempts (§20) */}
            <section className="detail-section">
              <h3>{t('lead.attempts')}</h3>
              <ul className="kv">
                {detail.attempts.map((a) => (
                  <li key={a.id}>
                    <span className="muted">{t('lead.attempt')} {a.attemptNo}:</span> {t(`resultLabel.${a.result}`)}
                    <span className="muted small"> · {new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
                {detail.attempts.length === 0 && <li className="muted">—</li>}
              </ul>
            </section>

            {/* Assignment history (§22) */}
            <section className="detail-section">
              <h3>{t('lead.assignmentHistory')}</h3>
              <ul className="kv">
                {detail.assignments.map((a) => (
                  <li key={a.id}>
                    <span className="muted">{t(`assignType.${a.assignmentType}`)}:</span>{' '}
                    {a.fromName ? `${a.fromName} → ` : ''}{a.toName ?? '—'}
                    {a.byName ? <span className="muted small"> (by {a.byName})</span> : null}
                    <span className="muted small"> · {new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
                {detail.assignments.length === 0 && <li className="muted">—</li>}
              </ul>
            </section>

            {/* Activity timeline (§21) */}
            <section className="detail-section">
              <h3>{t('lead.activity')}</h3>
              <ul className="kv">
                {detail.activities.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <span className="activity-dot" /> {t(`activityEvent.${a.event}`) !== `activityEvent.${a.event}` ? t(`activityEvent.${a.event}`) : a.event}
                    <span className="muted small"> · {new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
