import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Icon } from './Icons';

interface NotificationItem {
  id: string;
  kind: 'overdue' | 'appointment' | 'service' | 'pool' | 'visit';
  severity: 'info' | 'warn' | 'danger' | 'success';
  titleKey: string;
  count: number;
  path: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
}

const SEVERITY_CLASS: Record<NotificationItem['severity'], string> = {
  info: 'nt-info',
  warn: 'nt-warn',
  danger: 'nt-danger',
  success: 'nt-success',
};

const KIND_ICON: Record<NotificationItem['kind'], keyof typeof Icon> = {
  overdue: 'TrendDown',
  appointment: 'Calendar',
  service: 'Wrench',
  pool: 'Pool',
  visit: 'Today',
};

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const total = data?.total ?? 0;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<NotificationsResponse>('/api/notifications');
      setData(res);
    } catch {
      // Notification fetch is best-effort; ignore failures silently.
    } finally {
      setLoading(false);
    }
  }

  // Poll every 60s so the badge stays reasonably fresh.
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function goTo(item: NotificationItem) {
    setOpen(false);
    navigate(item.path);
  }

  return (
    <div className="notif-menu" ref={ref}>
      <button
        className="icon-btn"
        aria-label={t('notif.title')}
        title={t('notif.title')}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.Bell size={19} />
        {total > 0 && <span className="icon-badge-count">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">
            <span className="notif-head-title">{t('notif.title')}</span>
            {total > 0 && <span className="notif-head-count">{total}</span>}
          </div>

          <div className="notif-list">
            {loading && !data && <div className="notif-loading">{t('common.loading')}</div>}
            {data && data.items.length === 0 && (
              <div className="notif-empty">
                {Icon.Bell({ size: 26 })}
                <span>{t('notif.empty')}</span>
              </div>
            )}
            {data?.items.map((item) => (
              <button key={item.id} className="notif-item" onClick={() => goTo(item)}>
                <span className={`notif-item-icon ${SEVERITY_CLASS[item.severity]}`}>
                  {Icon[KIND_ICON[item.kind]]({ size: 17 })}
                </span>
                <span className="notif-item-text">
                  <span className="notif-item-title">{t(item.titleKey)}</span>
                </span>
                <span className={`notif-item-count ${SEVERITY_CLASS[item.severity]}`}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
