import React from 'react';
import type { Locale, WorkspaceView } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';

type Props = {
  view: WorkspaceView;
  locale: Locale;
  onChangeView: (view: WorkspaceView) => void;
};

export const WorkspaceNav: React.FC<Props> = ({ view, locale, onChangeView }) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

  const navItems: Array<{ id: WorkspaceView; vi: string; en: string }> = [
    { id: 'incident', vi: 'Sự kiện', en: 'Incident' },
    { id: 'impact', vi: 'Đường sá', en: 'Roads' },
    { id: 'priority', vi: 'Địa bàn', en: 'Communities' }
  ];

  return (
    <nav className="workspace-nav" aria-label={t('Nghiệp vụ ứng phó', 'Response workspace')}>
      {navItems.map((item) => (
        <button
          key={item.id}
          data-view={item.id}
          aria-current={view === item.id ? 'page' : 'false'}
          onClick={() => onChangeView(item.id)}
        >
          {item.id === 'impact' ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="m8 3-4 18M16 3l4 18M12 3v3m0 4v4m0 4v3"/></svg> : <UiIcon name={item.id === 'incident' ? 'bell' : 'people'} size={16}/>}
          {t(item.vi, item.en)}
        </button>
      ))}
    </nav>
  );
};
