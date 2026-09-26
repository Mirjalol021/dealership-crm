import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formErrorText } from '../lib/formError';

interface PreviewRow {
  row: number;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
}

type ImportType = 'leads' | 'inventory' | 'customers' | 'sold_cars' | 'aftersales_stock';

const COLUMN_HINTS: Record<ImportType, string> = {
  leads: 'name, phone, brand, dealership',
  inventory: 'brand, model, trim, color, vin, dealership',
  customers: 'name, phone',
  sold_cars: 'name, phone, brand, model, vin, saledate, saleprice, margin, paymenttype, dealership',
  aftersales_stock: 'itemname, category, unit, quantity, sellingprice, purchasecost, partnumber, dealership',
};

// Simple CSV parser: first line = headers, supports comma or semicolon.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(delim);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
}

export function ImportPage() {
  const { t } = useTranslation();
  const [type, setType] = useState<ImportType>('leads');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [counts, setCounts] = useState<{ total: number; valid: number; invalid: number; duplicate: number } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      setRows(parsed);
      setPreview([]);
      setCounts(null);
      setMessage('');
    };
    reader.readAsText(file);
  }

  function exportProblems() {
    const problems = preview.filter((p) => p.status !== 'valid');
    const csv = ['row,status,reason', ...problems.map((p) => `${p.row},${p.status},"${(p.reason ?? '').replace(/"/g, '""')}"`)].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-problems-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function send(confirm: boolean) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const r = await api.post<{ preview: PreviewRow[]; counts: typeof counts }>(`/api/import/${type}`, { rows, confirm });
      setPreview(r.preview);
      setCounts(r.counts);
      if (confirm) setMessage(`✓ ${t('rep.confirmImport')}: ${r.counts?.valid}`);
    } catch (err) {
      setError(formErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t('rep.import')}</h1>

      <div className="card" style={{ maxWidth: 720 }}>
        <label>{t('rep.import')}
          <select value={type} onChange={(e) => { setType(e.target.value as ImportType); setRows([]); setPreview([]); setCounts(null); setMessage(''); }}>
            <option value="leads">{t('rep.importLeads')}</option>
            <option value="customers">{t('rep.importCustomers')}</option>
            <option value="inventory">{t('rep.importInventory')}</option>
            <option value="sold_cars">{t('rep.importSoldCars')}</option>
            <option value="aftersales_stock">{t('rep.importAfterSalesStock')}</option>
          </select>
        </label>
        <label>{t('rep.upload')} (CSV)
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>
        <p className="muted small">{t('rep.columns')}: {COLUMN_HINTS[type]}</p>

        {rows.length > 0 && (
          <button className="btn-ghost" onClick={() => send(false)} disabled={busy}>{t('rep.previewTitle')}</button>
        )}
      </div>

      {counts && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{t('rep.previewTitle')}</h2>
          <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="fin-card neutral"><div className="fin-card-label">{t('rep.row')}</div><div className="fin-card-value">{counts.total}</div></div>
            <div className="fin-card good"><div className="fin-card-label">{t('rep.valid')}</div><div className="fin-card-value">{counts.valid}</div></div>
            <div className="fin-card bad"><div className="fin-card-label">{t('rep.invalid')}</div><div className="fin-card-value">{counts.invalid}</div></div>
            <div className="fin-card warn"><div className="fin-card-label">{t('rep.duplicate')}</div><div className="fin-card-value">{counts.duplicate}</div></div>
          </div>

          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>{t('rep.row')}</th><th>{t('rep.status')}</th><th>{t('rep.reason')}</th></tr></thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.row} className={p.status === 'valid' ? '' : 'row-warn'}>
                  <td>{p.row}</td>
                  <td>{t(`rep.${p.status}`)}</td>
                  <td className="muted">{p.reason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {counts.valid > 0 && (
              <button className="btn-primary inline" onClick={() => send(true)} disabled={busy}>
                {t('rep.confirmImport')} ({counts.valid})
              </button>
            )}
            {(counts.invalid > 0 || counts.duplicate > 0) && (
              <button className="btn-ghost" onClick={() => exportProblems()}>{t('rep.exportProblems')}</button>
            )}
          </div>
        </div>
      )}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      {message && <div className="ok-msg" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
