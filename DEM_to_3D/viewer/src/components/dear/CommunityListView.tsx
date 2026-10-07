import { UiIcon } from './UiIcon';
import React from 'react';
import type { Community, CommunityFilter, Locale } from '../../types/dear';
import { StatusText } from '../../shared/ui/StatusText';
import { normalizeSearch } from '../../features/search/searchIndex';
import { communityAccessText } from '../../features/routes/accessAssessment';
import type { ScenarioRoutePair } from '../../types/dear';

type Props = {
  communities: Community[];
  locale: Locale;
  filter: CommunityFilter;
  query: string;
  onChangeQuery: (query: string) => void;
  onChangeFilter: (f: CommunityFilter) => void;
  onSelectCommunity: (id: string) => void;
  selectedId: string | null;
  routes: Map<string, ScenarioRoutePair>;
};

export const CommunityListView: React.FC<Props> = ({
  communities,
  locale,
  filter,
  query,
  onChangeQuery,
  onChangeFilter,
  onSelectCommunity,
  selectedId,
  routes
}) => {

  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

  const filtered = [...communities]
    .sort((a, b) => a.prio - b.prio)
    .filter((c) => {
      if (filter === 'priority') return c.prio === 1;
      if (filter === 'monitor') return c.prio !== 1;
      return true;
    })
    .filter((c) => {
      const text = `${c.name} ${c.commune} ${c.desc[0]} ${c.desc[1]}`.toLowerCase();
      return normalizeSearch(text).includes(normalizeSearch(query));
    });

  return (
    <>
      <div className="sidebar-top">
        <h1>{t('Địa bàn cần chú ý', 'Communities to review')}</h1>

        <div className="search-box">
          <UiIcon name="search" size={18}/>
          <input
            type="search"
            aria-label={t('Tìm địa bàn', 'Find community')}
            placeholder={t('Tìm thôn, bản…', 'Find village…')}
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
          />
        </div>

        <div className="filters">
          <button
            className="filter"
            aria-pressed={filter === 'all'}
            onClick={() => onChangeFilter('all')}
          >
            {t('Tất cả', 'All')}
          </button>
          <button
            className="filter"
            aria-pressed={filter === 'priority'}
            onClick={() => onChangeFilter('priority')}
          >
            {t('Ưu tiên cao', 'High priority')}
          </button>
          <button
            className="filter"
            aria-pressed={filter === 'monitor'}
            onClick={() => onChangeFilter('monitor')}
          >
            {t('Theo dõi', 'Monitor')}
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="list-label">
          <span>
            {filtered.length} {t('địa bàn', 'communities')}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="small" style={{ padding: '20px 0', color: 'var(--ws-muted)' }}>
            {t('Không tìm thấy địa bàn.', 'No matching communities found.')}
          </p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              className={`community ${selectedId === c.id ? 'active' : ''}`}
              onClick={() => onSelectCommunity(c.id)}
            >
              <span className="community-heading">
                <strong>{c.name}</strong>
                <StatusText tone={c.prio === 1 ? 'priority' : 'neutral'} icon={c.prio === 1 ? 'priority' : undefined}>
                  {c.prio === 1 ? t('Ưu tiên cao', 'High priority') : t('Theo dõi', 'Monitor')}
                </StatusText>
              </span>
              <p>{t(...communityAccessText(routes.get(c.id)))}</p>
            </button>
          ))
        )}
      </div>
    </>
  );
};
