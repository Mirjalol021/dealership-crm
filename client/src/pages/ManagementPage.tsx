import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ListLead } from '../lib/leadTypes';
import type { Brand, Dealership } from '../lib/types';
import { LeadDetailModal } from '../components/LeadDetailModal';

type Row = Record<string, string | number>;

interface Filters {
  range: '' | 'today' | 'week' | '7d' | 'month' | 'custom';
  dealershipId: string;
  brandId: string;
  managerId: string;
  source: string;
  from: string;
  to: string;
}

export function ManagementPage() {
  const { t } = useTranslation();
  const [pipeline, setPipeline] = useState<{ table: Row[]; statuses: string[] }>({ table: [], statuses: [] });
  const [result, setResult] = useState<{ table: Row[]; results: string[] }>({ table: [], results: [] });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [filters, setFilters] = useState<Filters>({ range: 'month', dealershipId: '', brandId: '', managerId: '', source: '', from: '', to: '' });
  const [drill, setDrill] = useState<{ leads: ListLead[]; title: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function qs() {
    const q = new URLSearchParams();
    if (filters.range) q.set('range', filters.range);
    if (filters.dealershipId) q.set('dealershipId', filters.dealershipId);
    if (filters.brandId) q.set('brandId', filters.brandId);
    if (filters.managerId) q.set('managerId', filters.managerId);
    if (filters.source) q.set('source', filters.source);
    if (filters.range === 'custom') {
      if (filters.from) q.set('from', filters.from);
      if (filters.to) q.set('to', filters.to);
    }
    return q.toString();
  }

  async function loadTables() {
    const q = qs();
    const [p, r] = await Promise.all([
      api.get<{ table: Row[]; statuses: string[] }>(`/api/leads/analytics/pipeline?${q}`),
      api.get<{ table: Row[]; results: string[] }>(`/api/leads/analytics/result?${q}`),
    ]);
    setPipeline(p);
    setResult(r);
  }

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => { setBrands(b.brands); setDealerships(d.dealerships); });
  }, []);

  useEffect(() => {
    loadTables();
  }, [filters]);

  // Drill-down: open the exact leads behind a number (§25).
  async function openCell(managerId: string, dimension: 'pipeline' | 'result', value: string, managerName: string) {
    const q = new URLSearchParams(qs());
    q.set('managerId', managerId);
    if (dimension === 'pipeline') q.set('pipeline', value);
    else q.set('result', value);
    const r = await api.get<{ leads: ListLead[] }>(`/api/leads?${q.toString()}`);
    const label = dimension === 'pipeline' ? t(`pipelineStatus.${value}`) : t(`resultLabel.${value}`);
    setDrill({ leads: r.leads, title: `${managerName} · ${label}` });
  }

  return (
    <div>
      <h1 className="page-title">{t('nav.management')}</h1>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        brands={brands}
        dealerships={dealerships}
        managers={pipeline.table}
      />

      <h2 className="section-title">{t('sec.pipelineStatus')}</h2>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.manager')}</th>
              {pipeline.statuses.map((s) => <th key={s}>{t(`pipelineStatus.${s}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {pipeline.table.map((row) => (
              <tr key={String(row.managerId)}>
                <td>{String(row.managerName)}</td>
                {pipeline.statuses.map((s) => (
                  <td key={s}>
                    {Number(row[s]) > 0 ? (
                      <button className="cell-btn" onClick={() => openCell(String(row.managerId), 'pipeline', s, String(row.managerName))}>
                        {String(row[s])}
                      </button>
                    ) : <span className="muted">0</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">{t('sec.leadResult')}</h2>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('lead.manager')}</th>
              {result.results.map((r) => <th key={r}>{t(`resultLabel.${r}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.table.map((row) => (
              <tr key={String(row.managerId)}>
                <td>{String(row.managerName)}</td>
                {result.results.map((r) => (
                  <td key={r}>
                    {Number(row[r]) > 0 ? (
                      <button className="cell-btn" onClick={() => openCell(String(row.managerId), 'result', r, String(row.managerName))}>
                        {String(row[r])}
                      </button>
                    ) : <span className="muted">0</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drill && (
        <div className="modal-backdrop" onClick={() => setDrill(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{drill.title} ({drill.leads.length})</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('lead.customer')}</th>
                  <th>{t('lead.phone')}</th>
                  <th>{t('lead.brand')}</th>
                  <th>{t('lead.pipeline')}</th>
                  <th>{t('lead.result')}</th>
                </tr>
              </thead>
              <tbody>
                {drill.leads.map((l) => (
                  <tr key={l.id} className="row-click" onClick={() => { setOpenId(l.id); }}>
                    <td>{l.customerName ?? '—'}</td>
                    <td>{l.phone}</td>
                    <td>{l.brand}{l.model ? ` · ${l.model}` : ''}</td>
                    <td>{t(`pipelineStatus.${l.pipelineStatus}`)}</td>
                    <td>{l.lastResult ? t(`resultLabel.${l.lastResult}`) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDrill(null)}>{t('lead.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {openId && <LeadDetailModal leadId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  brands,
  dealerships,
  managers,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  brands: Brand[];
  dealerships: Dealership[];
  managers: Row[];
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="filter-bar">
      <label>
        {t('lead.range')}
        <select value={filters.range} onChange={(e) => set({ range: e.target.value as Filters['range'] })}>
          <option value="">{t('lead.all')}</option>
          <option value="today">{t('lead.today')}</option>
          <option value="week">{t('rep.thisWeek')}</option>
          <option value="7d">{t('lead.week7')}</option>
          <option value="month">{t('lead.thisMonth')}</option>
          <option value="custom">{t('rep.custom')}</option>
        </select>
      </label>
      {filters.range === 'custom' && (
        <>
          <label>{t('rep.from')}<input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label>{t('rep.to')}<input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></label>
        </>
      )}
      <label>
        {t('settings.dealerships')}
        <select value={filters.dealershipId} onChange={(e) => set({ dealershipId: e.target.value })}>
          <option value="">{t('lead.all')}</option>
          {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
        </select>
      </label>
      <label>
        {t('lead.brand')}
        <select value={filters.brandId} onChange={(e) => set({ brandId: e.target.value })}>
          <option value="">{t('lead.all')}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label>
        {t('lead.manager')}
        <select value={filters.managerId} onChange={(e) => set({ managerId: e.target.value })}>
          <option value="">{t('lead.all')}</option>
          {managers.map((m) => <option key={String(m.managerId)} value={String(m.managerId)}>{String(m.managerName)}</option>)}
        </select>
      </label>
    </div>
  );
}
