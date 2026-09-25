import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../lib/auth';
import type { Brand, Dealership } from '../lib/types';

type Tab = 'sales' | 'marketing' | 'inventory' | 'finance' | 'aftersales';

const TABS: { key: Tab; labelKey: string; cap: string }[] = [
  { key: 'sales', labelKey: 'salesReport', cap: 'reports.sales' },
  { key: 'marketing', labelKey: 'marketingReport', cap: 'reports.marketing' },
  { key: 'inventory', labelKey: 'inventoryReport', cap: 'reports.sales' },
  { key: 'finance', labelKey: 'financeReport', cap: 'reports.finance' },
  { key: 'aftersales', labelKey: 'aftersalesReport', cap: 'reports.aftersales' },
];

// Export type per report tab (§65). Finance exports its expenses list.
const EXPORT_TYPE: Record<Tab, string> = {
  sales: 'leads',
  marketing: 'leads',
  inventory: 'inventory',
  finance: 'expenses',
  aftersales: 'aftersales',
};

export function ReportsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const visibleTabs = TABS.filter((x) => can(x.cap));
  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.key ?? 'sales');
  const [range, setRange] = useState('month');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [brandId, setBrandId] = useState('');
  const [dealershipId, setDealershipId] = useState('');
  const [group, setGroup] = useState<'source' | 'campaign' | 'form'>('source');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => { setBrands(b.brands); setDealerships(d.dealerships); });
  }, []);

  // Shared filter bar (§68). The exact same params feed the report AND the export.
  function buildFilterQuery(): URLSearchParams {
    const q = new URLSearchParams({ range });
    if (range === 'custom') {
      if (from) q.set('from', from);
      if (to) q.set('to', to);
    } else {
      q.set('month', month);
    }
    if (brandId) q.set('brandId', brandId);
    if (dealershipId) q.set('dealershipId', dealershipId);
    return q;
  }

  useEffect(() => {
    const q = buildFilterQuery();
    if (tab === 'marketing') q.set('group', group);
    const endpoint =
      tab === 'sales' ? '/api/reports/sales'
      : tab === 'marketing' ? '/api/reports/marketing'
      : tab === 'inventory' ? '/api/reports/inventory'
      : tab === 'finance' ? '/api/reports/finance'
      : '/api/reports/aftersales';
    api.get<Record<string, unknown>>(`${endpoint}?${q}`).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range, month, from, to, brandId, dealershipId, group]);

  // Export the CURRENT filtered result (§65) — same params as the on-screen report.
  function download(type: string, format: 'csv' | 'xlsx') {
    const q = buildFilterQuery();
    q.set('format', format);
    if (type === 'expenses' && range !== 'custom') q.set('month', month);
    window.open(`/api/export/${type}?${q}`, '_blank');
  }

  return (
    <div>
      <h1 className="page-title">{t('nav.reports')}</h1>

      <div className="tabs">
        {visibleTabs.map((x) => (
          <button key={x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>
            {t(`rep.${x.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <label>{t('rep.dateRange')}
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">{t('rep.today')}</option>
            <option value="week">{t('rep.thisWeek')}</option>
            <option value="7d">{t('rep.week7')}</option>
            <option value="month">{t('rep.thisMonth')}</option>
            <option value="lastMonth">{t('rep.lastMonth')}</option>
            <option value="custom">{t('rep.custom')}</option>
          </select>
        </label>
        {range === 'custom' ? (
          <>
            <label>{t('rep.from')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>{t('rep.to')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </>
        ) : (
          <label>{t('fin.month')}<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        )}
        {tab === 'marketing' && (
          <label>{t('rep.groupBy')}
            <select value={group} onChange={(e) => setGroup(e.target.value as 'source' | 'campaign' | 'form')}>
              <option value="source">{t('lead.source')}</option>
              <option value="campaign">{t('lead.campaign')}</option>
              <option value="form">{t('rep.form')}</option>
            </select>
          </label>
        )}
        <label>{t('lead.brand')}
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('lead.dealership')}
          <select value={dealershipId} onChange={(e) => setDealershipId(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
      </div>

      <div className="report-body">
        {tab === 'sales' && <SalesReport data={data} />}
        {tab === 'marketing' && <MarketingReport data={data} />}
        {tab === 'inventory' && <InventoryReport data={data} />}
        {tab === 'finance' && <FinanceReport data={data} />}
        {tab === 'aftersales' && <AfterSalesReport data={data} />}
      </div>

      <div className="export-bar">
        <span className="muted">{t('rep.export')}:</span>
        <button className="btn-ghost" onClick={() => download(EXPORT_TYPE[tab], 'csv')}>{t('rep.exportCsv')}</button>
        <button className="btn-ghost" onClick={() => download(EXPORT_TYPE[tab], 'xlsx')}>{t('rep.exportXlsx')}</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="fin-card neutral"><div className="fin-card-label">{label}</div><div className="fin-card-value">{typeof value === 'number' ? value.toLocaleString() : value}</div></div>;
}

function SalesReport({ data }: { data: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const s = data.summary as Record<string, number>;
  const byManager = data.salesByManager as { manager: string; sold: number }[];
  const byBrand = data.salesByBrand as { brand: string; sold: number }[];
  const pipeline = data.pipelineByManager as { table: Record<string, string | number>[]; statuses: string[] } | undefined;
  const results = data.resultByManager as { table: Record<string, string | number>[]; results: string[] } | undefined;
  return (
    <>
      <div className="fin-grid">
        <Stat label={t('rep.leads')} value={s.leads} />
        <Stat label={t('rep.contacted')} value={s.contacted} />
        <Stat label={t('rep.visits')} value={s.visits} />
        <Stat label={t('rep.sold')} value={s.sold} />
        <Stat label={t('rep.conversion')} value={`${Math.round((s.conversion ?? 0) * 100)}%`} />
      </div>
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card"><h2>{t('rep.byManager')}</h2>
          <table className="table"><tbody>{byManager.map((m) => <tr key={m.manager}><td>{m.manager}</td><td>{m.sold}</td></tr>)}</tbody></table>
        </div>
        <div className="card"><h2>{t('rep.byBrand')}</h2>
          <table className="table"><tbody>{byBrand.map((b) => <tr key={b.brand}><td>{b.brand}</td><td>{b.sold}</td></tr>)}</tbody></table>
        </div>
      </div>

      {pipeline && pipeline.table.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{t('rep.pipelineByManager')}</h2>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>{t('lead.manager')}</th>{pipeline.statuses.map((s2) => <th key={s2}>{t(`pipelineStatus.${s2}`)}</th>)}</tr></thead>
              <tbody>
                {pipeline.table.map((row) => (
                  <tr key={String(row.managerId)}>
                    <td>{String(row.managerName)}</td>
                    {pipeline.statuses.map((s2) => <td key={s2}>{Number(row[s2]) || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && results.table.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{t('rep.resultByManager')}</h2>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>{t('lead.manager')}</th>{results.results.map((r) => <th key={r}>{t(`resultLabel.${r}`)}</th>)}</tr></thead>
              <tbody>
                {results.table.map((row) => (
                  <tr key={String(row.managerId)}>
                    <td>{String(row.managerName)}</td>
                    {results.results.map((r) => <td key={r}>{Number(row[r]) || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function MarketingReport({ data }: { data: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const bySource = data.bySource as { source: string; leads: number; visits: number; sold: number }[];
  return (
    <div className="card">
      <h2>{t('rep.bySource')}</h2>
      <table className="table">
        <thead><tr><th>{t('lead.source')}</th><th>{t('rep.leads')}</th><th>{t('rep.visits')}</th><th>{t('rep.sold')}</th></tr></thead>
        <tbody>{bySource.map((s) => <tr key={s.source}><td>{t(`sourceLabel.${s.source}`)}</td><td>{s.leads}</td><td>{s.visits}</td><td>{s.sold}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function InventoryReport({ data }: { data: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const s = data.summary as Record<string, number>;
  return (
    <div className="fin-grid">
      <Stat label={t('veh.available')} value={s.AVAILABLE} />
      <Stat label={t('veh.reserved')} value={s.RESERVED} />
      <Stat label={t('veh.sold')} value={s.SOLD} />
    </div>
  );
}

function FinanceReport({ data }: { data: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const d = data as Record<string, number>;
  return (
    <div className="fin-grid">
      <Stat label={t('fin.turnover')} value={d.turnover} />
      <Stat label={t('fin.vehicleMargin')} value={d.margin} />
      <Stat label={t('fin.vinBonuses')} value={d.vinBonuses} />
      <Stat label={t('fin.kpiBonuses')} value={d.kpiBonuses} />
      <Stat label={t('fin.customerBonuses')} value={d.customerBonuses} />
      <Stat label={t('fin.fixed')} value={d.fixedExpenses} />
      <Stat label={t('fin.variable')} value={d.variableExpenses} />
      <Stat label={t('fin.totalExpenses')} value={d.totalExpenses} />
      <Stat label={t('fin.serviceRevenue')} value={d.serviceRevenue} />
      {d.serviceContribution != null && <Stat label={t('as.contribution')} value={d.serviceContribution} />}
    </div>
  );
}

function AfterSalesReport({ data }: { data: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!data) return <div className="loading">{t('common.loading')}</div>;
  const d = data as Record<string, number>;
  return (
    <div className="fin-grid">
      <Stat label={t('rep.customersDue')} value={d.customersDue ?? 0} />
      <Stat label={t('rep.customersOverdue')} value={d.customersOverdue ?? 0} />
      <Stat label={t('as.serviceVisits')} value={d.serviceVisits} />
      <Stat label={t('fin.serviceRevenue')} value={d.serviceRevenue} />
      {d.partsCost != null && <Stat label={t('as.inventoryCost')} value={d.partsCost} />}
      {d.serviceContribution != null && <Stat label={t('as.contribution')} value={d.serviceContribution} />}
      <Stat label={t('as.used')} value={d.inventoryUsage ?? 0} />
    </div>
  );
}
