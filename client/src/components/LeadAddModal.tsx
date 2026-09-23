import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Brand, Dealership } from '../lib/types';
import type { LeadSource } from '../lib/leadTypes';

const SOURCES: LeadSource[] = [
  'WALK_IN', 'PHONE_CALL', 'REFERRAL', 'EXISTING_CUSTOMER', 'INSTAGRAM_ORGANIC', 'TELEGRAM_ORGANIC', 'MANUAL', 'OTHER',
];

// Minimal form (§9): Phone required, Brand required, Source required.
export function LeadAddModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [model, setModel] = useState('');
  const [dealershipId, setDealershipId] = useState('');
  const [source, setSource] = useState<LeadSource>('WALK_IN');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => {
      setBrands(b.brands);
      setDealerships(d.dealerships);
      if (b.brands[0]) setBrandId(b.brands[0].id);
      if (d.dealerships[0]) setDealershipId(d.dealerships[0].id);
    });
  }, []);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/leads', { phone, name, brandId, modelInterest: model, dealershipId, source, note });
      onCreated();
    } catch {
      setError('Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('lead.addLead')}</h2>
        <label>{t('lead.phone')} <span className="req">*</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required />
        </label>
        <label>{t('lead.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>{t('lead.brand')} <span className="req">*</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('lead.model')}
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label>{t('lead.dealership')}
          <select value={dealershipId} onChange={(e) => setDealershipId(e.target.value)}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
        <label>{t('lead.source')} <span className="req">*</span>
          <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)}>
            {SOURCES.map((s) => <option key={s} value={s}>{t(`sourceLabel.${s}`)}</option>)}
          </select>
        </label>
        <label>{t('lead.note')}
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !phone || !brandId} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
