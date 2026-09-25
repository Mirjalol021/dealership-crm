import { useTranslation } from 'react-i18next';
import { exportList } from '../lib/exportUtils';

// Reusable CSV / Excel export controls (§65). Pass the current filter params
// so the download mirrors exactly what the user sees on screen.
export function ExportButtons({
  type,
  params,
}: {
  type: 'leads' | 'sales' | 'inventory' | 'expenses' | 'stock' | 'aftersales';
  params?: Record<string, string | undefined>;
}) {
  const { t } = useTranslation();
  return (
    <div className="export-inline">
      <button className="btn-ghost sm" onClick={() => exportList(type, 'csv', params)}>
        ⬇ {t('common.exportCsv')}
      </button>
      <button className="btn-ghost sm" onClick={() => exportList(type, 'xlsx', params)}>
        ⬇ {t('common.exportXlsx')}
      </button>
    </div>
  );
}
