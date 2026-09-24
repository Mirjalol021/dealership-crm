import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { DashboardCards, MonthlyTrendPoint } from '../lib/financeTypes';
import type { Brand, Dealership } from '../lib/types';

type RangeMode = 'month' | 'custom';

export function FinanceDashboardPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<'profit' | 'cash'>('profit');
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [brandId, setBrandId] = useState('');
  const [dealershipId, setDealershipId] = useState('');
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendPoint[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => { setBrands(b.brands); setDealerships(d.dealerships); });
  }, []);

  // Shared query params for the dashboard + trend endpoints (§53, §54).
  function baseParams(): URLSearchParams {
    const q = new URLSearchParams({ view });
    if (rangeMode === 'month') q.set('month', month);
    else {
      if (from) q.set('from', from);
      if (to) q.set('to', to);
    }
    if (brandId) q.set('brandId', brandId);
    if (dealershipId) q.set('dealershipId', dealershipId);
    return q;
  }

  useEffect(() => {
    api.get<{ cards: DashboardCards }>(`/api/finance/dashboard?${baseParams()}`).then((r) => setCards(r.cards));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, rangeMode, month, from, to, brandId, dealershipId]);

  // Monthly trend is always "last N months" (not affected by the custom range toggle).
  useEffect(() => {
    const q = new URLSearchParams({ view, months: '6' });
    if (brandId) q.set('brandId', brandId);
    if (dealershipId) q.set('dealershipId', dealershipId);
    api.get<{ points: MonthlyTrendPoint[] }>(`/api/finance/monthly-trend?${q}`).then((r) => setTrend(r.points));
  }, [view, brandId, dealershipId]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('fin.dashboard')}</h1>
        <div className="view-toggle">
          <button className={view === 'profit' ? 'active' : ''} onClick={() => setView('profit')}>
            {t('fin.profitView')}
          </button>
          <button className={view === 'cash' ? 'active' : ''} onClick={() => setView('cash')}>
            {t('fin.cashFlow')}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="view-toggle">
          <button className={rangeMode === 'month' ? 'active' : ''} onClick={() => setRangeMode('month')}>
            {t('fin.byMonth')}
          </button>
          <button className={rangeMode === 'custom' ? 'active' : ''} onClick={() => setRangeMode('custom')}>
            {t('fin.customRange')}
          </button>
        </div>
        {rangeMode === 'month' ? (
          <label>{t('fin.month')}
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        ) : (
          <>
            <label>{t('fin.from')}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>{t('fin.to')}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label>{t('lead.dealership')}
          <select value={dealershipId} onChange={(e) => setDealershipId(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
        <label>{t('lead.brand')}
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">{t('lead.all')}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>

      {cards && (
        <>
          <div className="fin-grid">
            <Card label={t('fin.turnover')} value={cards.totalTurnover} tone="neutral" />
            <Card label={t('fin.vehicleMargin')} value={cards.vehicleMargin} tone="neutral" />
            <Card label={t('fin.serviceRevenue')} value={cards.serviceRevenue} tone="neutral" />
            <Card label={t('fin.vinBonuses')} value={cards.vinBonuses} tone="good" sub={`${t('fin.expectedBonus')}: ${fmt(cards.vinBonusesExpected)}`} />
            <Card label={t('fin.kpiBonuses')} value={cards.kpiBonuses} tone="good" sub={`${t('fin.expectedBonus')}: ${fmt(cards.kpiBonusesExpected)}`} />
            <Card label={t('fin.customerBonuses')} value={cards.customerBonuses} tone="bad" />
            <Card label={t('fin.totalExpenses')} value={cards.totalExpenses} tone="bad" />
          </div>

          {/* VAT breakdown (§40): Margin Before VAT / VAT Provision / Margin After VAT */}
          <div className="fin-grid" style={{ marginTop: 8 }}>
            <Card label={t('fin.marginBeforeVat')} value={cards.marginBeforeVat} tone="neutral" />
            <Card label={t('fin.vat')} value={cards.vatProvision} tone="warn" />
            <Card label={t('fin.marginAfterVat')} value={cards.marginAfterVat} tone="neutral" />
          </div>

          <div className={`net-result ${cards.netResult >= 0 ? 'pos' : 'neg'}`}>
            <div className="net-label">{t('fin.netResult')}</div>
            <div className="net-value">{fmt(cards.netResult)}</div>
          </div>

          <div className="charts-row">
            <TrendChart points={trend} />
            <ExpenseComposition fixed={cards.fixedExpenses} variable={cards.variableExpenses} />
          </div>
        </>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Card({ label, value, tone, sub }: { label: string; value: number; tone: 'neutral' | 'good' | 'bad' | 'warn'; sub?: string }) {
  return (
    <div className={`fin-card ${tone}`}>
      <div className="fin-card-label">{label}</div>
      <div className="fin-card-value">{fmt(value)}</div>
      {sub && <div className="fin-card-sub">{sub}</div>}
    </div>
  );
}

// Graph 1 (§54): Revenue vs Expenses by Month — tiny hand-rolled SVG, no chart lib.
function TrendChart({ points }: { points: MonthlyTrendPoint[] }) {
  const { t } = useTranslation();
  if (!points.length) return null;

  const W = 560, H = 200, PAD = 28;
  const max = Math.max(1, ...points.flatMap((p) => [p.turnover, p.expenses]));
  const n = points.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const line = (get: (p: MonthlyTrendPoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(get(p))}`).join(' ');

  return (
    <div className="card" style={{ flex: 2 }}>
      <h2>{t('fin.revenueVsExpenses')}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        {/* baseline */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e5ea" />
        {/* revenue line */}
        <path d={line((p) => p.turnover)} fill="none" stroke="#2f855a" strokeWidth="2.5" />
        {/* expenses line */}
        <path d={line((p) => p.expenses)} fill="none" stroke="#c53030" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={x(i)} cy={y(p.turnover)} r="3" fill="#2f855a" />
            <circle cx={x(i)} cy={y(p.expenses)} r="3" fill="#c53030" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#718096">
              {p.month.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <div className="bar-legend">
        <span><i className="dot" style={{ background: '#2f855a' }} /> {t('fin.revenue')}</span>
        <span><i className="dot" style={{ background: '#c53030' }} /> {t('fin.totalExpenses')}</span>
      </div>
    </div>
  );
}

// Expense composition bar (§54) — no Sankey, no BI.
function ExpenseComposition({ fixed, variable }: { fixed: number; variable: number }) {
  const { t } = useTranslation();
  const total = fixed + variable || 1;
  const fixedPct = Math.round((fixed / total) * 100);
  const varPct = 100 - fixedPct;
  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>{t('fin.expenseComposition')}</h2>
      <div className="bar">
        <div className="bar-seg fixed" style={{ width: `${fixedPct}%` }} />
        <div className="bar-seg variable" style={{ width: `${varPct}%` }} />
      </div>
      <div className="bar-legend">
        <span><i className="dot fixed" /> {t('fin.fixed')}: {fixed.toLocaleString()} ({fixedPct}%)</span>
        <span><i className="dot variable" /> {t('fin.variable')}: {variable.toLocaleString()} ({varPct}%)</span>
      </div>
    </div>
  );
}
