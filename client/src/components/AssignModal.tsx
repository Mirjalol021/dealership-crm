import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formErrorText } from '../lib/formError';

interface Assignable {
  id: string;
  name: string;
  role: string;
}

// Assign / prioritize a lead (§7, §23).
export function AssignModal({
  leadId,
  currentPriority,
  onClose,
  onDone,
}: {
  leadId: string;
  currentPriority?: 'NORMAL' | 'PRIORITY';
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<Assignable[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'PRIORITY'>(currentPriority ?? 'NORMAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ users: Assignable[] }>('/api/settings/assignable-users').then((r) => {
      setUsers(r.users);
      if (r.users[0]) setToUserId(r.users[0].id);
    });
  }, []);

  async function save() {
    if (!toUserId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/leads/${leadId}/assign`, { toUserId, priority });
      onDone();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('lead.assign')}</h2>
        <label>
          {t('lead.assignTo')}
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({t(`roles.${u.role}`)})
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={priority === 'PRIORITY'}
            onChange={(e) => setPriority(e.target.checked ? 'PRIORITY' : 'NORMAL')}
          />
          {t('lead.markPriority')}
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !toUserId} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
