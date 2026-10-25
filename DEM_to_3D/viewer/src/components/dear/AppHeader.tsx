import { UiIcon } from './UiIcon';
import React, { useEffect, useRef, useState } from 'react';
import type {
  FontChoice,
  IncidentModel,
  Locale,
  RoadSegment
} from '../../types/dear';
import type { IncidentPacket } from '../../data/incidentPacket';
import { NotificationPopover, type RescueAlert } from './NotificationPopover';
import { FontSelector } from './FontSelector';
import { IncidentContext } from './IncidentContext';
import { HeaderAccount } from './HeaderAccount';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';

type Props = {
  rescueAlerts?:RescueAlert[];onRescueOpen?:(id:string)=>void;
  /** While GIS is open its draft owns the session; header actions would replace it unguarded. */
  locked?: boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
  identityName: string;
  onSignOut: () => void;
  onOpenReports: () => void;
  reportsPending: boolean;
  locale: Locale;
  incident: IncidentModel;
  areaName: [vi: string, en: string];
  snapshotDisplay?: 'full' | 'date';
  report: IncidentPacket['report'];
  reportRoad?: RoadSegment;
  dataAvailable: boolean;
  theme: 'light' | 'dark';
  fontChoice: FontChoice;
  updated: boolean;
  reportApplied: boolean;
  alertRead: boolean;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onChangeFontChoice: (font: FontChoice) => void;
  onOpenAlerts: () => void;
  onOpenIncident: () => void;
  onOpenData: () => void;
  onOpenHelp: () => void;
  onOpenUpload: () => void;
  onOpenTimeline: () => void;
  onOpenNotifications: () => void;
  onReset: () => void;
};

export const AppHeader: React.FC<Props> = ({
  rescueAlerts=[],onRescueOpen,
  identityName,
  onSignOut,
  onOpenReports,
  reportsPending,
  locale,
  incident,
  areaName,
  snapshotDisplay,
  report,
  reportRoad,
  dataAvailable,
  theme,
  fontChoice,
  updated,
  reportApplied,
  alertRead,
  onToggleTheme,
  onToggleLocale,
  onChangeFontChoice,
  onOpenAlerts,
  onOpenIncident,
  onOpenData,
  onOpenHelp,
  onOpenUpload,
  onOpenTimeline,
  onOpenNotifications,
  onReset,
  collapsed = false, onCollapse,
  locked = false
}) => {
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => { if (headerRef.current) headerRef.current.inert = locked; }, [locked]);
  const [prefOpen, setPrefOpen] = useState(false);
  const notificationReadKey='dear.notification-read.v1:'+incident.triggeredAt;
  const readNotifications=()=>{try{const raw=localStorage.getItem(notificationReadKey)??'[]';if(raw.length>200000)return[];const data:unknown=JSON.parse(raw);return Array.isArray(data)?data.filter((id):id is string=>typeof id==='string'&&id.length<200).slice(-1000):[];}catch{return[];}};
  const [seenRescues,setSeenRescues]=useState<string[]>(readNotifications);
  useEffect(()=>{setSeenRescues(readNotifications());const sync=(event:StorageEvent)=>{if(event.key===notificationReadKey)setSeenRescues(readNotifications());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[notificationReadKey]);
  const rescueUnread=rescueAlerts.filter(alert=>!seenRescues.includes(alert.id)).length;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  useDismissiblePopover(notificationsRef, notificationsOpen, () =>
    setNotificationsOpen(false)
  );
  const prefRef = useRef<HTMLDivElement>(null);
  useDismissiblePopover(prefRef, prefOpen, () => setPrefOpen(false));

  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  const snapshot = updated ? incident.asOfUpdated : incident.asOf;

  return (
    <header className="app-header" ref={headerRef} hidden={collapsed}>
      <div className="brand">
        <span className="brand-symbol" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M3 25 13 7l6 10 4-6 6 14H3Z"
              fill="currentColor"
              fillOpacity=".12"
            />
            <path
              d="m3 25 10-18 6 10 4-6 6 14M8 25l5-9 6 9M3 29h26"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="brand-word">DEAR</span>
      </div>

      <IncidentContext
        locale={locale}
        incident={incident}
        areaName={areaName}
        snapshot={snapshot}
        snapshotDisplay={snapshotDisplay}
        available={dataAvailable}
        onOpenTimeline={onOpenTimeline}
        onOpenData={onOpenData}
      />
      <div className="header-actions">
        <div className="notification-anchor" ref={notificationsRef}>
          <button
            className="icon-button notification-button"
            disabled={!dataAvailable}
            onClick={() => {
              setPrefOpen(false);
              setNotificationsOpen((open) => !open);
              const seen=[...new Set([...seenRescues,...rescueAlerts.slice(0,4).map(alert=>alert.id)])].slice(-1000);setSeenRescues(seen);try{localStorage.setItem(notificationReadKey,JSON.stringify(seen));}catch{/* The current window still tracks read notifications. */}
            }}
            aria-expanded={notificationsOpen}
            aria-controls="incident-notifications"
            aria-haspopup="dialog"
            title={t('Thông báo sự kiện', 'Incident notifications')}
            aria-label={t('Thông báo sự kiện', 'Incident notifications')}
          >
            <UiIcon name="bell" />
            {rescueUnread>0?<span className="notification-count" aria-label={t(`${rescueUnread} thông báo mới`,`${rescueUnread} new notifications`)}>{rescueUnread}</span>:!alertRead&&<span className="unread-indicator"/>}
          </button>
          {notificationsOpen && (
            <NotificationPopover rescueAlerts={rescueAlerts} onOpenReports={()=>{setNotificationsOpen(false);onOpenReports();}} onRescueOpen={id=>{setNotificationsOpen(false);onRescueOpen?.(id);}}
              locale={locale}
              incident={incident}
              report={report}
              road={reportRoad}
              updated={reportApplied}
              onClose={() => setNotificationsOpen(false)}
              onOpenAll={() => {
                setNotificationsOpen(false);
                onOpenNotifications();
              }}
              onOpenIncident={() => {
                setNotificationsOpen(false);
                onOpenIncident();
              }}
              onOpenDetails={() => {
                notificationsRef.current
                  ?.querySelector<HTMLButtonElement>('button')
                  ?.focus();
                setNotificationsOpen(false);
                onOpenAlerts();
              }}
            />
          )}
        </div>

        <button
          className="button header-report-button"
          onClick={onOpenReports}
          title={t('Ghi nhận gửi đến', 'Incoming reports')}
          aria-label={t('Ghi nhận gửi đến', 'Incoming reports')}
        >
          <UiIcon name="image" />
          <span>{t('Ghi nhận', 'Reports')}</span>
          {reportsPending && <span className="unread-indicator" />}
        </button>
        <HeaderAccount locale={locale} identityName={identityName} onSwitchRole={onSignOut}/>
        <div ref={prefRef} className="settings-anchor">
          <button
            className="icon-button"
            onClick={() => {
              setNotificationsOpen(false);
              setPrefOpen(!prefOpen);
            }}
            aria-label={t('Cài đặt', 'Settings')}
            aria-expanded={prefOpen}
            aria-haspopup="dialog"
            aria-controls="display-settings"
            title={t('Cài đặt', 'Settings')}
          >
            <UiIcon name="settings" />
          </button>

          {prefOpen && (
            <div
              className="settings-menu"
              id="display-settings"
              role="dialog"
              aria-labelledby="display-settings-title"
              data-popover
            >
              <div className="settings-heading">
                <h2 id="display-settings-title">
                  {t('Cài đặt', 'Settings')}
                </h2>
                <button
                  className="icon-button"
                  aria-label={t('Đóng cài đặt', 'Close settings')}
                  onClick={() => {
                    setPrefOpen(false);
                    prefRef.current
                      ?.querySelector<HTMLButtonElement>('button')
                      ?.focus();
                  }}
                >
                  <UiIcon name="close" />
                </button>
              </div>
              <div className="settings-group">
                <strong className="settings-label">
                  {t('Giao diện', 'Appearance')}
                </strong>
                <div
                  className="settings-options"
                  role="group"
                  aria-label={t('Giao diện', 'Appearance')}
                >
                  <button
                    className="settings-option"
                    aria-pressed={theme === 'light'}
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                    }}
                  >
                    {t('Sáng', 'Light')}
                  </button>
                  <button
                    className="settings-option"
                    aria-pressed={theme === 'dark'}
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                    }}
                  >
                    {t('Tối', 'Dark')}
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <strong className="settings-label">
                  {t('Ngôn ngữ', 'Language')}
                </strong>
                <div
                  className="settings-options"
                  role="group"
                  aria-label={t('Ngôn ngữ', 'Language')}
                >
                  <button
                    className="settings-option"
                    aria-pressed={locale === 'vi'}
                    onClick={() => {
                      if (locale !== 'vi') onToggleLocale();
                    }}
                  >
                    Tiếng Việt
                  </button>
                  <button
                    className="settings-option"
                    aria-pressed={locale === 'en'}
                    onClick={() => {
                      if (locale !== 'en') onToggleLocale();
                    }}
                  >
                    English
                  </button>
                </div>
              </div>
              <div className="settings-group settings-typeface">
                <FontSelector
                  locale={locale}
                  value={fontChoice}
                  onChange={onChangeFontChoice}
                />
              </div>
              <div className="settings-group settings-utilities">
                <button className="settings-link" onClick={() => {prefRef.current?.querySelector<HTMLButtonElement>('button')?.focus();setPrefOpen(false);onOpenHelp();}}><UiIcon name="help" size={16}/>{t('Hướng dẫn sử dụng', 'User guide')}</button>
                {onCollapse && <button className="settings-link" onClick={() => {setPrefOpen(false);setNotificationsOpen(false);onCollapse();}}><UiIcon name="collapse" size={16}/>{t('Thu gọn tiêu đề', 'Hide header')}</button>}
                <button className="settings-link" onClick={() => {setPrefOpen(false);onOpenUpload();}}>
                  <UiIcon name="upload" size={16}/>{t('Mô hình địa hình', 'Terrain model')}
                </button>
                <button className="settings-link" onClick={() => {setPrefOpen(false);onReset();}}><UiIcon name="undo" size={16}/>{t('Đặt lại phiên làm việc', 'Reset workspace')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
