import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { LeadDetail } from '../lib/leadTypes';

export function LeadDetailPanel({ leadId }: { leadId: string }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [text, setText] = useState('');

  async function load() {
    const r = await api.get<{ lead: LeadDetail }>(`/api/leads/${leadId}`);
    setDetail(r.lead);
  }

  useEffect(() => {
    load();
  }, [leadId]);

  async function addComment() {
    if (!text.trim()) return;
    await api.post(`/api/leads/${leadId}/comments`, { text });
    setText('');
    load();
  }

  if (!detail) return null;

  return (
    <div className="detail-panel">
      {detail.formAnswers.length > 0 && (
        <section>
          <h3>Form answers</h3>
          <ul className="kv">
            {detail.formAnswers.map((a) => (
              <li key={a.id}><span className="muted">{a.questionLabelSnapshot}:</span> {a.answer}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>{t('lead.comments')}</h3>
        <div className="comment-add">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('lead.addComment')} />
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

      <section>
        <h3>{t('lead.attempts')}</h3>
        <ul className="kv">
          {detail.attempts.map((a) => (
            <li key={a.id}>
              <span className="muted">{t('lead.attempt')} {a.attemptNo}:</span> {t(`resultLabel.${a.result}`)}
              <span className="muted small"> · {new Date(a.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
          {detail.attempts.length === 0 && <li className="muted">—</li>}
        </ul>
      </section>

      <section>
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

      <section>
        <h3>{t('lead.activity')}</h3>
        <ul className="kv">
          {detail.activities.slice(0, 12).map((a) => (
            <li key={a.id}>
              <span className="activity-dot" /> {a.event}
              <span className="muted small"> · {new Date(a.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
