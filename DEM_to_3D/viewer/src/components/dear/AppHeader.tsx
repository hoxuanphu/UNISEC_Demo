import { UiIcon } from './UiIcon';
import React, { useEffect, useRef, useState } from 'react';
import type { FontChoice, IncidentModel, Locale, RoadSegment } from '../../types/dear';
import type { IncidentPacket } from '../../data/incidentPacket';
import { NotificationPopover } from './NotificationPopover';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';

type Props = {
  locale: Locale;
  incident: IncidentModel;
  areaName: [vi: string, en: string];
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
  onOpenUpload: () => void;
  onOpenTimeline: () => void; onOpenNotifications: () => void; onReset: () => void;
  activeModelName?: string;
};

export const AppHeader: React.FC<Props> = ({
  locale,
  incident,
  areaName,
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
  onOpenUpload,
  onOpenTimeline, onOpenNotifications, onReset,
  activeModelName
}) => {
  const [prefOpen, setPrefOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  useDismissiblePopover(notificationsRef, notificationsOpen, () => setNotificationsOpen(false));
  const prefRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!prefOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!prefRef.current?.contains(event.target as Node)) setPrefOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPrefOpen(false); prefRef.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside, true); document.removeEventListener('keydown', closeEscape); };
  }, [prefOpen]);

  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  const snapshot = updated ? incident.asOfUpdated : incident.asOf;

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M3 25 13 7l6 10 4-6 6 14H3Z" fill="currentColor" fillOpacity=".12"/><path d="m3 25 10-18 6 10 4-6 6 14M8 25l5-9 6 9M3 29h26" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></span>
        <span className="brand-word">DEAR</span>
      </div>

      <div className="incident-badge-group">
        <strong>{t('Bản đồ ứng phó', 'Response map')}</strong>
        <div className="incident-meta">
          <span>{t(...areaName)}</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-data">
          <button className="update-label header-revision" disabled={!dataAvailable} onClick={onOpenTimeline} title={t('Xem bản đồ theo thời điểm dữ liệu', 'View map revisions')}>
            {t('Tổng hợp lúc', 'Data as of')}{' '}
            {dataAvailable && <strong><time dateTime={snapshot}>
              {new Date(snapshot).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time></strong>}
          </button>
        </div>

        <div className="notification-anchor" ref={notificationsRef}>
        <button
          className="icon-button notification-button"
          disabled={!dataAvailable}
          onClick={() => { setPrefOpen(false); setNotificationsOpen(open => !open); }}
          aria-expanded={notificationsOpen}
          aria-controls="incident-notifications"
          aria-haspopup="dialog"
          title={t('Thông báo sự kiện', 'Incident notifications')}
          aria-label={t('Thông báo sự kiện', 'Incident notifications')}
        >
          <UiIcon name="bell"/>
          {!alertRead && <span className="unread-indicator" />}
        </button>
        {notificationsOpen && <NotificationPopover locale={locale} incident={incident} report={report} road={reportRoad} updated={reportApplied} onClose={() => setNotificationsOpen(false)} onOpenAll={() => { setNotificationsOpen(false); onOpenNotifications(); }} onOpenIncident={() => { setNotificationsOpen(false); onOpenIncident(); }} onOpenDetails={() => { notificationsRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); setNotificationsOpen(false); onOpenAlerts(); }} />}
        </div>

        <button
          className="button header-data-button"
          disabled={!dataAvailable}
          onClick={onOpenData}
          title={t('Thông tin dữ liệu', 'Data information')}
        >
          <UiIcon name="info"/>
          <span>{t('Dữ liệu', 'Data')}</span>
        </button>

        <span className="header-divider" aria-hidden="true" />

        <div ref={prefRef} className="settings-anchor">
          <button
            className="icon-button"
            onClick={() => { setNotificationsOpen(false); setPrefOpen(!prefOpen); }}
            aria-label={t('Cài đặt hiển thị', 'Display settings')}
            aria-expanded={prefOpen}
            title={t('Cài đặt hiển thị', 'Display settings')}
          >
            <UiIcon name="settings"/>
          </button>

          {prefOpen && (
            <div className="settings-menu" aria-label={t('Tùy chọn hiển thị', 'Display options')}>
              <div className="settings-heading">
                <h2>{t('Cài đặt hiển thị', 'Display settings')}</h2>
                <button className="icon-button" aria-label={t('Đóng cài đặt', 'Close settings')} onClick={() => { setPrefOpen(false); prefRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }}><UiIcon name="close" /></button>
              </div>
              <div className="settings-group">
                <strong className="settings-label">
                  {t('Giao diện', 'Appearance')}
                </strong>
                <div className="settings-options">
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
                <div className="settings-options">
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
              <div className="settings-group">
                <strong className="settings-label">{t('Kiểu chữ', 'Typography')}</strong>
                <div className="font-options" role="group" aria-label={t('Kiểu chữ', 'Typography')}>
                  <button className="font-option" aria-pressed={fontChoice === 'classic'} onClick={() => onChangeFontChoice('classic')}>
                    <span className="font-sample font-sample-classic" aria-hidden="true">Aa</span>
                    <span className="font-option-copy"><strong>Inter</strong></span>
                    {fontChoice === 'classic' && <UiIcon name="check" />}
                  </button>
                  <button className="font-option" aria-pressed={fontChoice === 'plex'} onClick={() => onChangeFontChoice('plex')}>
                    <span className="font-sample font-sample-plex" aria-hidden="true">Aa</span>
                    <span className="font-option-copy"><strong>IBM Plex Sans</strong></span>
                    {fontChoice === 'plex' && <UiIcon name="check" />}
                  </button>
                  <button className="font-option" aria-pressed={fontChoice === 'modern'} onClick={() => onChangeFontChoice('modern')}>
                    <span className="font-sample font-sample-modern" aria-hidden="true">Aa</span>
                    <span className="font-option-copy"><strong>Space Grotesk</strong><small>Be Vietnam Pro</small></span>
                    {fontChoice === 'modern' && <UiIcon name="check" />}
                  </button>
                </div>
              </div>
              <div className="model-settings">
                <button className="settings-link" onClick={() => { setPrefOpen(false); onOpenUpload(); }}>{t('Mô hình địa hình', 'Terrain model')}</button>
                <button className="settings-link" onClick={() => { setPrefOpen(false); onReset(); }}>{t('Đặt lại phiên làm việc', 'Reset workspace')}</button>
                {activeModelName && <small>{activeModelName}</small>}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
