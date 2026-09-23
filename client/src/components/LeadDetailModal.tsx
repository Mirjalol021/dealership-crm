import { useTranslation } from 'react-i18next';
import { LeadDetailPanel } from './LeadDetailPanel';

export function LeadDetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t('lead.customer')}</h2>
        <LeadDetailPanel leadId={leadId} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
