import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// Reserve a vehicle / create Zalog (§28).
export function ReserveModal({ vehicleId, onClose, onSaved }: { vehicleId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deposit, setDeposit] = useState('');
  const [method, setMethod] = useState('CASH');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.post('/api/reservations', {
        vehicleId,
        customerName: name || undefined,
        phone,
        depositAmount: Number(deposit || 0),
        depositPaymentMethod: method,
        comment: comment || null,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('veh.newReservation')}</h2>
        <label>{t('lead.name')}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t('lead.phone')} <span className="req">*</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required />
        </label>
        <label>{t('veh.deposit')} <span className="req">*</span>
          <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        <label>{t('veh.depositMethod')}
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">{t('veh.cash')}</option>
            <option value="CARD">{t('veh.card')}</option>
            <option value="LLC_ACCOUNT">{t('veh.llc')}</option>
          </select>
        </label>
        <label>{t('lead.comment')}<input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !phone || !deposit} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
