import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ListLead } from '../lib/leadTypes';
import type { Brand } from '../lib/types';
import { LeadAddModal } from '../components/LeadAddModal';
import { LeadDetailModal } from '../components/LeadDetailModal';

// Quick filter chips (§17).
const QUICK = [
  { key: 'new', pipeline: 'NEW' },
  { key: 'call_today', filter: 'call_today' },
  { key: 'overdue', filter: 'overdue' },
  { key: 'thinking', result: 'INFO_GIVEN_THINKING' },
  { key: 'interested', result: 'INTERESTED' },
  { key: 'visit_expected', result: 'INFO_GIVEN_VISIT_EXPECTED' },
  { key: 'visit_planned', pipeline: 'VISIT_PLANNED' },
  { key: 'test_drive', pipeline: 'VISITED_TEST_DRIVE' },
  { key: 'sold', pipeline: 'SOLD' },
  { key: 'lost', pipeline: 'LOST' },
] as const;

const SOURCES = ['META', 'TELEGRAM', 'INSTAGRAM_ORGANIC', 'TELEGRAM_ORGANIC', 'WALK_IN', 'PHONE_CALL', 'REFERRAL', 'EXISTING_CUSTOMER', 'MANUAL', 'OTHER'];

export function MyLeadsPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [active, setActive] = useState<string>('new');
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Additional filters (§17).
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [source, setSource] = useState('');
  const [model, setModel] = useState('');
  const [from, setFrom] = useState('');

  useEffect(() => {
    api.get<{ brands: Brand[] }>('/api/brands').then((r) => setBrands(r.brands));
  }, []);

  async function load() {
    const q = new URLSearchParams();
    const f = QUICK.find((x) => x.key === active);
    if (f && 'pipeline' in f && f.pipeline) q.set('pipeline', f.pipeline);
    if (f && 'filter' in f && f.filter) q.set('filter', f.filter);
    if (f && 'result' in f && f.result) q.set('result', f.result);
    if (brandId) q.set('brandId', brandId);
    if (source) q.set('source', source);
    if (model) q.set('model', model);
    if (from) q.set('from', from);
    const r = await api.get<{ leads: ListLead[] }>(`/api/leads?${q.toString()}`);
    setLeads(r.leads);
  }

  useEffect(() => {
    load();
  }, [active, brandId, source, model, from]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('nav.myLeads')}</h1>
        <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('lead.addLead')}</button>
      </div>

      <div className="chips">
        {QUICK.map((f) => (
          <button key={f.key} className={`chip${active === f.key ? ' active' : ''}`} onClick={() => setActive(f.key)}>
            {t(`lead.${f.key}`)}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <label>{t('lead.brand')}
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('lead.model')}
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="EX5..." />
        </label>
        <label>{t('lead.source')}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {SOURCES.map((s) => <option key={s} value={s}>{t(`sourceLabel.${s}`)}</option>)}
          </select>
        </label>
        <label>{t('rep.dateRange')}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>{t('lead.customer')}</th><th>{t('lead.phone')}</th><th>{t('lead.brand')}</th>
            <th>{t('lead.pipeline')}</th><th>{t('lead.result')}</th><th>{t('lead.followUp')}</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="row-click" onClick={() => setOpenId(l.id)}>
              <td>{l.priority === 'PRIORITY' && <span className="tag-priority">★</span>} {l.customerName ?? '—'}</td>
              <td>{l.phone}</td>
              <td>{l.brand}{l.model ? ` · ${l.model}` : ''}</td>
              <td><StatusPill status={l.pipelineStatus} /></td>
              <td>{l.lastResult ? t(`resultLabel.${l.lastResult}`) : '—'}</td>
              <td>{l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>{t('lead.noLeads')}</td></tr>
          )}
        </tbody>
      </table>

      {showAdd && (
        <LeadAddModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />
      )}
      {openId && <LeadDetailModal leadId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = `pill pill-${status.toLowerCase().replace(/_/g, '-')}`;
  return <span className={cls}>{t(`pipelineStatus.${status}`)}</span>;
}
