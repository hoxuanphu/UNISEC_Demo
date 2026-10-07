import type { Locale } from '../types/dear';
import { UiIcon } from '../shared/ui/UiIcon';

/** No incident, source or timestamp is displayed before the dataset is validated. */
export function WorkspaceStartup({ locale, failed, onRetry }: { locale: Locale; failed: boolean; onRetry: () => void }) {
  return <div className="workspace" data-mobile="info">
    <header className="app-header"><div className="brand"><span className="brand-symbol"><UiIcon name="layers"/></span>DEAR</div></header>
    <main className="work-area">
      <div className="workspace-nav" aria-hidden="true"/>
      <aside className="sidebar"><div className="sidebar-top" role={failed ? 'alert' : 'status'}>
        <h1>{failed ? locale === 'vi' ? 'Chưa tải được dữ liệu' : 'Dataset unavailable' : locale === 'vi' ? 'Đang tải dữ liệu' : 'Loading dataset'}</h1>
        {failed && <button className="button soft" onClick={onRetry}>{locale === 'vi' ? 'Thử lại' : 'Retry'}</button>}
      </div></aside>
      <section className="map-area" aria-label={locale === 'vi' ? 'Bản đồ' : 'Map'}/>
    </main>
  </div>;
}
