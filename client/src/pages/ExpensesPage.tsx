import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';
import { EXPENSE_CATEGORIES, type Expense } from '../lib/financeTypes';
import type { Brand, Dealership } from '../lib/types';
import { ExportButtons } from '../components/ExportButtons';
import { formErrorText } from '../lib/formError';

export function ExpensesPage() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
          const [e, b, d] = await Promise.all([
            api.get<{ expenses: Expense[] }>('/api/expenses'),
            api.get<{ brands: Brand[] }>('/api/brands'),
            api.get<{ dealerships: Dealership[] }>('/api/dealerships'),
          ]);
          setExpenses(e.expenses);
          setBrands(b.brands);
          setDealerships(d.dealerships);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div><h1 className="page-title">{t('fin.expenses')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('fin.expenses')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t('fin.expenses')}</h1>
        <div className="page-head-actions">
          <ExportButtons type="expenses" />
          <button className="btn-primary inline" onClick={() => setShowAdd(true)}>+ {t('fin.addExpense')}</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('fin.accountingMonth')}</th>
              <th>{t('fin.paymentDate')}</th>
              <th>{t('fin.category')}</th>
              <th>{t('fin.expenseType')}</th>
              <th>{t('veh.amount')}</th>
              <th>{t('fin.paymentMethod')}</th>
              <th>{t('fin.status')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.accountingMonth}</td>
                <td>{e.paymentDate ? new Date(e.paymentDate).toLocaleDateString() : <span className="muted">—</span>}</td>
                <td>{e.category}</td>
                <td>{t(`fin.${e.expenseType.toLowerCase()}`)}</td>
                <td>{e.amount.toLocaleString()}</td>
                <td>{e.paymentMethod ? t(`veh.${e.paymentMethod.toLowerCase()}`) : '—'}</td>
                <td><span className={`pill ${e.status === 'PAID' ? 'pill-sold' : 'pill-visit-planned'}`}>{t(`fin.${e.status.toLowerCase()}`)}</span></td>
              </tr>
            ))}
            {expenses.length === 0 && (<tr><td colSpan={7}><EmptyState /></td></tr>)}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddExpenseModal
          brands={brands}
          dealerships={dealerships}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({
  brands, dealerships, onClose, onSaved,
}: { brands: Brand[]; dealerships: Dealership[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<Record<string, string>>({
    accountingMonth: new Date().toISOString().slice(0, 7),
    expenseType: 'FIXED', category: 'Rent', paymentMethod: 'LLC_ACCOUNT', status: 'PENDING',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/expenses', {
        accountingMonth: f.accountingMonth,
        paymentDate: f.paymentDate ? f.paymentDate : null,
        category: f.category,
        expenseType: f.expenseType,
        amount: Number(f.amount || 0),
        paymentMethod: f.paymentMethod || null,
        status: f.status,
        brandId: f.brandId || null,
        dealershipId: f.dealershipId || null,
        comment: f.comment || null,
      });
      onSaved();
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('fin.addExpense')}</h2>
        <label>{t('fin.accountingMonth')} <span className="req">*</span>
          <input type="month" value={f.accountingMonth} onChange={(e) => set('accountingMonth', e.target.value)} />
        </label>
        <label>{t('fin.paymentDate')}
          <input type="date" value={f.paymentDate ?? ''} onChange={(e) => set('paymentDate', e.target.value)} />
        </label>
        <label>{t('fin.category')}
          <select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>{t('fin.expenseType')}
          <select value={f.expenseType} onChange={(e) => set('expenseType', e.target.value)}>
            <option value="FIXED">{t('fin.fixed')}</option>
            <option value="VARIABLE">{t('fin.variable')}</option>
          </select>
        </label>
        <label>{t('veh.amount')} <span className="req">*</span>
          <input type="number" value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value)} />
        </label>
        <label>{t('fin.paymentMethod')}
          <select value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
            <option value="LLC_ACCOUNT">{t('veh.llc')}</option>
            <option value="CASH">{t('veh.cash')}</option>
            <option value="CARD">{t('veh.card')}</option>
          </select>
        </label>
        <label>{t('fin.status')}
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="PENDING">{t('fin.pending')}</option>
            <option value="PAID">{t('fin.paid')}</option>
          </select>
        </label>
        <label>{t('lead.dealership')}
          <select value={f.dealershipId ?? ''} onChange={(e) => set('dealershipId', e.target.value)}>
            <option value="">—</option>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealershipName}</option>)}
          </select>
        </label>
        <label>{t('lead.brand')}
          <select value={f.brandId ?? ''} onChange={(e) => set('brandId', e.target.value)}>
            <option value="">{t('common.corporate')}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>{t('lead.comment')} <span className="opt">{t('common.optional')}</span><input value={f.comment ?? ''} onChange={(e) => set('comment', e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !f.amount} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
