import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../lib/auth';
import { Icon } from '../components/Icons';

interface DashboardData {
  cards: {
    newLeadsToday: number; workingLeads: number; visitPlanned: number;
    soldThisMonth: number; poolCount: number; overdueLeads: number;
    visitsToday: number; serviceDue: number;
  };
  pipelineTable: Record<string, string | number>[];
  resultTable: Record<string, string | number>[];
  salesByBrand: { brand: string; sold: number }[];
  inventorySummary: { AVAILABLE: number; RESERVED: number; SOLD: number };
  financeSummary: { turnover: number; margin: number; totalExpenses: number } | null;
}

const PIPELINE_COLS = ['NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST'];

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/api/dashboard').then(setData);
  }, []);

  if (!user) return null;
  if (!data) return <div className="loading">{t('common.loading')}</div>;

  const c = data.cards;
  const isManager = user.role === 'SALES_MANAGER';

  return (
    <div>
      {/* Hero banner with the MG S5 EV */}
      <section className="hero-banner">
        <div className="hero-inner">
          <span className="hero-eyebrow">
            {Icon.Spark({ size: 14 })} MG · S5 EV
          </span>
          <h1 className="hero-title">
            {t('auth.welcome')}, {user.name}
          </h1>
          <p className="hero-sub">{t('brand.heroSubtitle')}</p>
          <div className="hero-badges">
            <span className="hero-badge">{Icon.Leads({ size: 14 })} {c.newLeadsToday} {t('dash.newToday')}</span>
            <span className="hero-badge">{Icon.Today({ size: 14 })} {c.visitsToday} {t('dash.visitsToday')}</span>
            <span className="hero-badge">{Icon.Car({ size: 14 })} {data.inventorySummary.AVAILABLE} {t('veh.available')}</span>
          </div>
        </div>
      </section>

      {/* Top cards (§69, §70, §71) */}
      <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Card label={t('dash.newToday')} value={c.newLeadsToday} tone="neutral" icon="Leads" />
        <Card label={t('dash.working')} value={c.workingLeads} tone="neutral" icon="Spark" />
        <Card label={t('dash.visitPlanned')} value={c.visitPlanned} tone="neutral" icon="Calendar" />
        <Card label={t('dash.soldMonth')} value={c.soldThisMonth} tone="good" icon="TrendUp" hero />
        <Card label={t('dash.pool')} value={c.poolCount} tone="neutral" icon="Pool" />
        <Card label={t('dash.overdue')} value={c.overdueLeads} tone="bad" icon="TrendDown" />
        <Card label={t('dash.visitsToday')} value={c.visitsToday} tone="neutral" icon="Today" />
        <Card label={t('dash.serviceDue')} value={c.serviceDue} tone="warn" icon="Wrench" />
      </div>

      {/* Inventory summary (§69) */}
      <div className="two-col" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>{Icon.Car({ size: 17 })} {t('veh.summary')}</h2>
          <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', margin: 0 }}>
            <Card label={t('veh.available')} value={data.inventorySummary.AVAILABLE} tone="good" icon="Car" />
            <Card label={t('veh.reserved')} value={data.inventorySummary.RESERVED} tone="warn" icon="Bookmark" />
            <Card label={t('veh.sold')} value={data.inventorySummary.SOLD} tone="neutral" icon="TrendUp" />
          </div>
        </div>
        <div className="card">
          <h2>{Icon.Chart({ size: 17 })} {t('rep.byBrand')}</h2>
          <table className="table">
            <tbody>
              {data.salesByBrand.map((b) => <tr key={b.brand}><td>{b.brand}</td><td>{b.sold}</td></tr>)}
              {data.salesByBrand.length === 0 && <tr><td className="muted">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finance summary (only if authorized, §69) */}
      {data.financeSummary && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2>{Icon.Coin({ size: 17 })} {t('nav.finance')}</h2>
          <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', margin: 0 }}>
            <Card label={t('fin.turnover')} value={data.financeSummary.turnover} tone="neutral" icon="Chart" />
            <Card label={t('fin.vehicleMargin')} value={data.financeSummary.margin} tone="good" icon="TrendUp" />
            <Card label={t('fin.totalExpenses')} value={data.financeSummary.totalExpenses} tone="bad" icon="Receipt" />
          </div>
        </div>
      )}

      {/* Pipeline by manager (§69, §70) — hidden for Sales Manager */}
      {!isManager && data.pipelineTable.length > 0 && (
        <>
          <h2 className="section-title">{t('sec.pipelineByManager')}</h2>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>{t('lead.manager')}</th>{PIPELINE_COLS.map((s) => <th key={s}>{t(`pipelineStatus.${s}`)}</th>)}</tr></thead>
              <tbody>
                {data.pipelineTable.map((row) => (
                  <tr key={String(row.managerId)}>
                    <td>{String(row.managerName)}</td>
                    {PIPELINE_COLS.map((s) => <td key={s}>{Number(row[s] ?? 0) || <span className="muted">0</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  label, value, tone, icon, hero,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'good' | 'bad' | 'warn';
  icon?: keyof typeof Icon;
  hero?: boolean;
}) {
  return (
    <div className={`fin-card ${tone}${hero ? ' value-hero' : ''}`}>
      {icon && <span className="fin-card-icon">{Icon[icon]({ size: 20 })}</span>}
      <div className="fin-card-label">{label}</div>
      <div className="fin-card-value">{value.toLocaleString()}</div>
    </div>
  );
}
