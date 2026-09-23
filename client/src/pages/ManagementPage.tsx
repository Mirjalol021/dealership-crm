import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// Pipeline Status table by Manager (§25). Numbers are clickable later; shown here.
export function ManagementPage() {
  const { t } = useTranslation();
  const [table, setTable] = useState<Record<string, string | number>[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    api.get<{ table: Record<string, string | number>[]; statuses: string[] }>('/api/leads/analytics/pipeline')
      .then((r) => { setTable(r.table); setStatuses(r.statuses); });
  }, []);

  return (
    <div>
      <h1 className="page-title">Pipeline by Manager</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Manager</th>
            {statuses.map((s) => <th key={s}>{t(`pipelineStatus.${s}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr key={String(row.managerId)}>
              <td>{String(row.managerName)}</td>
              {statuses.map((s) => (
                <td key={s} className={Number(row[s]) > 0 ? 'cell-link' : 'muted'}>{String(row[s])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
