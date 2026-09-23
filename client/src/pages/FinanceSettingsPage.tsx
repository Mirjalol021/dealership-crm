import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { FinanceSettings } from '../lib/financeTypes';

export function FinanceSettingsPage() {
  const { t } = useTranslation();
  const [s, setS] = useState<FinanceSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ settings: FinanceSettings }>('/api/finance/settings').then((r) => setS(r.settings));
  }, []);

  if (!s) return <div className="loading">{t('common.loading')}</div>;

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api.patch('/api/finance/settings', s);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t('fin.taxSettings')}</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <label>{t('fin.taxName')}
          <input value={s.taxName} onChange={(e) => setS({ ...s, taxName: e.target.value })} />
        </label>
        <label>{t('fin.taxRate')}
          <input type="number" value={s.taxRate} onChange={(e) => setS({ ...s, taxRate: Number(e.target.value) })} />
        </label>
        <label>{t('fin.taxBase')}
          <input value={s.taxBase} onChange={(e) => setS({ ...s, taxBase: e.target.value })} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.marginIsVatInclusive}
            onChange={(e) => setS({ ...s, marginIsVatInclusive: e.target.checked })}
          />
          {t('fin.vatInclusive')}
        </label>
        <button className="btn-primary" disabled={busy} onClick={save}>{t('lead.save')}</button>
        {saved && <div className="ok-msg">✓ {t('lead.save')}</div>}
      </div>
    </div>
  );
}
