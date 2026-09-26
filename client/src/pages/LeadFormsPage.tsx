import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formErrorText } from '../lib/formError';
import type { Brand, Dealership } from '../lib/types';

interface LeadForm {
  id: string;
  source: string;
  formId: string;
  formName: string;
  fieldMapping: { fullNameKey?: string; phoneKey?: string; modelKey?: string } | null;
}

const SOURCES = ['META', 'TELEGRAM'];

export function LeadFormsPage() {
  const { t } = useTranslation();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);

  async function load() {
    const [i, b, d] = await Promise.all([
      api.get<{ forms: LeadForm[] }>('/api/integrations'),
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]);
    setForms(i.forms);
    setBrands(b.brands);
    setDealerships(d.dealerships);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('rep.leadForms')}</h1>
      <div className="two-col">
        <div className="card">
          <h2>{t('rep.allFormsTitle')}</h2>
          <table className="table">
            <thead><tr><th>{t('rep.formName')}</th><th>{t('rep.formId')}</th><th>{t('lead.source')}</th><th>{t('rep.fieldMapping')}</th><th></th></tr></thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>{f.formName}</td>
                  <td className="mono">{f.formId}</td>
                  <td>{t(`sourceLabel.${f.source}`)}</td>
                  <td className="muted small">
                    {f.fieldMapping
                      ? Object.entries(f.fieldMapping).map(([k, v]) => `${v}→${k}`).join(', ')
                      : '—'}
                  </td>
                  <td>
                    <button className="link-del" onClick={async () => { await api.del(`/api/lead-forms/${f.id}`); load(); }}>✕</button>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>—</td></tr>}
            </tbody>
          </table>
        </div>
        <AddForm brands={brands} dealerships={dealerships} onSaved={load} />
      </div>
    </div>
  );
}

function AddForm({ brands, dealerships, onSaved }: { brands: Brand[]; dealerships: Dealership[]; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<Record<string, string>>({
    source: 'META', fullNameKey: 'full_name', phoneKey: 'phone_number', modelKey: 'which_model',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/lead-forms', {
        source: f.source,
        formId: f.formId,
        formName: f.formName,
        brandId: f.brandId || null,
        dealershipId: f.dealershipId || null,
        fieldMapping: {
          fullNameKey: f.fullNameKey || undefined,
          phoneKey: f.phoneKey || undefined,
          modelKey: f.modelKey || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>{t('rep.addForm')}</h2>
      {error && <div className="error">{error}</div>}
      <label>{t('lead.source')}
        <select value={f.source} onChange={(e) => set('source', e.target.value)}>
          {SOURCES.map((s) => <option key={s} value={s}>{t(`sourceLabel.${s}`)}</option>)}
        </select>
      </label>
      <label>{t('rep.formId')} <span className="req">*</span><input value={f.formId ?? ''} onChange={(e) => set('formId', e.target.value)} /></label>
      <label>{t('rep.formName')} <span className="req">*</span><input value={f.formName ?? ''} onChange={(e) => set('formName', e.target.value)} /></label>
      <label>{t('lead.brand')} <span className="opt">{t('common.optional')}</span>
        <select value={f.brandId ?? ''} onChange={(e) => set('brandId', e.target.value)}>
          <option value="">—</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label>{t('lead.dealership')} <span className="opt">{t('common.optional')}</span>
        <select value={f.dealershipId ?? ''} onChange={(e) => set('dealershipId', e.target.value)}>
          <option value="">—</option>
          {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>{t('rep.fieldMapping')} <span className="opt">{t('common.optional')}</span></legend>
        <label>{t('lead.name')}<input value={f.fullNameKey ?? ''} onChange={(e) => set('fullNameKey', e.target.value)} /></label>
        <label>{t('lead.phone')}<input value={f.phoneKey ?? ''} onChange={(e) => set('phoneKey', e.target.value)} /></label>
        <label>{t('lead.model')}<input value={f.modelKey ?? ''} onChange={(e) => set('modelKey', e.target.value)} /></label>
      </fieldset>
      <button className="btn-primary" disabled={busy || !f.formId || !f.formName}>{t('lead.save')}</button>
    </form>
  );
}
