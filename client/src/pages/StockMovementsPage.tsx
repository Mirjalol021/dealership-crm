import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../lib/auth';
import { Loading, ErrorState, EmptyState } from '../components/AsyncState';

interface Movement {
  itemId: string;
  itemName: string;
  unit: string;
  opening: number;
  received: number;
  used: number;
  adjustments: number;
  closing: number;
  costOfUsed?: number;
}

export function StockMovementsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showCosts = can('costs.view');

  function load() {
    setLoading(true); setError(null);
    api.get<{ movements: Movement[] }>('/api/aftersales/stock-movements')
      .then((r) => setMovements(r.movements))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div><h1 className="page-title">{t('as.stockMovements')}</h1><Loading /></div>;
  if (error) return <div><h1 className="page-title">{t('as.stockMovements')}</h1><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div>
      <h1 className="page-title">{t('as.stockMovements')}</h1>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('as.itemName')}</th>
              <th>{t('as.opening')}</th>
              <th>+ {t('as.received')}</th>
              <th>{t('as.used')}</th>
              <th>{t('as.adjustments')}</th>
              <th>= {t('as.closing')}</th>
              {showCosts && <th>{t('as.inventoryCost')}</th>}
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.itemId}>
                <td>{m.itemName} <span className="muted small">({m.unit})</span></td>
                <td>{m.opening}</td>
                <td>{m.received > 0 ? `+${m.received}` : '0'}</td>
                <td>{m.used !== 0 ? m.used : '0'}</td>
                <td>{m.adjustments !== 0 ? (m.adjustments > 0 ? `+${m.adjustments}` : m.adjustments) : '0'}</td>
                <td><strong>{m.closing}</strong></td>
                {showCosts && <td>{m.costOfUsed?.toLocaleString() ?? '—'}</td>}
              </tr>
            ))}
            {movements.length === 0 && (<tr><td colSpan={showCosts ? 7 : 6}><EmptyState /></td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Opening + Received + Used + Adjustments = Expected Closing (physical check)
      </p>
    </div>
  );
}
