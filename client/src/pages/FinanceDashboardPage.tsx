import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { DashboardCards } from '../lib/financeTypes';
import type { Brand, Dealership } from '../lib/types';

export function FinanceDashboardPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<'profit' | 'cash'>('profit');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [brandId, setBrandId] = useState('');
  const [dealershipId, setDealershipId] = useState('');
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<{ brands: Brand[] }>('/api/brands'),
      api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
    ]).then(([b, d]) => { setBrands(b.brands); setDealerships(d.dealerships); });
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ view, month });
    if (brandId) q.set('brandId', brandId);
    if (dealershipId) q.set('dealershipId', dealershipId);
    api.get<{ cards: DashboardCards }>(`/api/finance/dashboard?${q}`).then((r) => setCards(r.cards));
  }, [view, month, brandId, dealershipId]);

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
        <label>{t('fin.month')}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
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
            <Card label={t('fin.vat')} value={cards.vatProvision} tone="warn" />
            <Card label={t('fin.totalExpenses')} value={cards.totalExpenses} tone="bad" />
          </div>

          <div className={`net-result ${cards.netResult >= 0 ? 'pos' : 'neg'}`}>
            <div className="net-label">{t('fin.netResult')}</div>
            <div className="net-value">{fmt(cards.netResult)}</div>
          </div>

          <div className="charts-row">
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

// Simple expense composition bar (§54) — no Sankey, no BI.
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
