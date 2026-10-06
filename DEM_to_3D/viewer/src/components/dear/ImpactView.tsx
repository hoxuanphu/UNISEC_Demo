import { UiIcon } from './UiIcon';
import React from 'react';
import type { Hazard, ImpactTab, Locale, RoadFilter, RoadSegment } from '../../types/dear';
import { StatusText } from '../../shared/ui/StatusText';
import { normalizeSearch } from '../../features/search/searchIndex';

type Props = {
  roads: RoadSegment[];
  hazards: Hazard[];
  locale: Locale;
  roadFilter: RoadFilter;
  query: string;
  onChangeQuery: (query: string) => void;
  tab: ImpactTab;
  onChangeTab: (tab: ImpactTab) => void;
  onChangeRoadFilter: (filter: RoadFilter) => void;
  onSelectObject: (obj: string) => void;
  onNext: () => void;
};

export const ImpactView: React.FC<Props> = ({
  roads,
  hazards,
  locale,
  roadFilter,
  query,
  onChangeQuery,
  tab,
  onChangeTab,
  onChangeRoadFilter,
  onSelectObject,
  onNext
}) => {

  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

  const blockedCount = roads.filter((r) => r.status === 'blocked').length;
  const uncertainCount = roads.filter((r) => r.status === 'uncertain').length;

  const filteredRoads = roads
    .filter((r) => {
      if (roadFilter === 'blocked') return r.status === 'blocked';
      if (roadFilter === 'uncertain') return r.status === 'uncertain';
      return true;
    })
    .filter((r) => {
      const text = `${r.name[0]} ${r.name[1]} ${r.scenarioRoadCode || ''} ${r.id} ${r.hz || ''}`.toLowerCase();
      return normalizeSearch(text).includes(normalizeSearch(query));
    })
    .sort((a, b) => {
      const rank = { blocked: 0, uncertain: 1, open: 2 };
      return rank[a.status] - rank[b.status];
    });

  const filteredHazards = hazards.filter((h) => {
    const text = `${h.name[0]} ${h.name[1]} ${h.id} ${h.src[0]} ${h.src[1]}`.toLowerCase();
    return normalizeSearch(text).includes(normalizeSearch(query));
  });

  return (
    <>
      <div className="sidebar-top">
        <h1>{t('Tình trạng đường', 'Road conditions')}</h1>

        <div className="impact-metrics">
          <button
            data-road-filter="blocked"
            aria-pressed={tab === 'roads' && roadFilter === 'blocked'}
            onClick={() => { onChangeQuery(''); onChangeTab('roads'); onChangeRoadFilter(tab === 'roads' && roadFilter === 'blocked' ? 'all' : 'blocked'); }}
          >
            <strong>{blockedCount}</strong>
            <span>{t('Bị chặn', 'Blocked')}</span>
          </button>

          <button
            data-road-filter="uncertain"
            aria-pressed={tab === 'roads' && roadFilter === 'uncertain'}
            onClick={() => { onChangeQuery(''); onChangeTab('roads'); onChangeRoadFilter(tab === 'roads' && roadFilter === 'uncertain' ? 'all' : 'uncertain'); }}
          >
            <strong>{uncertainCount}</strong>
            <span>{t('Cần xác minh', 'Uncertain')}</span>
          </button>

          <button
            data-road-filter="all"
            aria-pressed={tab === 'roads' && roadFilter === 'all'}
            onClick={() => { onChangeQuery(''); onChangeTab('roads'); onChangeRoadFilter('all'); }}
          >
            <strong>{roads.length}</strong>
            <span>{t('Đoạn đường', 'Segments')}</span>
          </button>
        </div>

        <div className="search-box">
          <UiIcon name="search" size={18}/>
          <input
            type="search"
            aria-label={t('Tìm đường hoặc điểm ảnh hưởng', 'Find roads or affected sites')}
            placeholder={t('Tìm đường hoặc địa điểm', 'Find road or place')}
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
          />
        </div>

        <div className="decision-tabs" role="group">
          <button
            aria-pressed={tab === 'roads'}
            onClick={() => onChangeTab('roads')}
          >
            {t('Đoạn đường', 'Roads')} ({filteredRoads.length})
          </button>
          <button
            aria-pressed={tab === 'hazards'}
            onClick={() => onChangeTab('hazards')}
          >
            {t('Điểm ảnh hưởng', 'Affected sites')} ({filteredHazards.length})
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        {tab === 'roads' ? (
          <div>
            {filteredRoads.length === 0 ? (
              <p className="small" style={{ padding: '16px 0', color: 'var(--ws-muted)' }}>
                {t('Không có đoạn đường phù hợp bộ lọc.', 'No road segments match the filter.')}
              </p>
            ) : (
              filteredRoads.map((road) => (
                <button
                  key={road.id}
                  className="object-row impact-row"
                  onClick={() => onSelectObject(`road:${road.id}`)}
                >
                  <span>
                    <strong>{t(road.name[0], road.name[1])}</strong>
                    <small>
                      {road.len} km
                    </small>
                  </span>
                  <StatusText tone={road.status === 'blocked' ? 'critical' : road.status === 'uncertain' ? 'warning' : 'neutral'} icon={road.status === 'blocked' ? 'blocked' : road.status === 'uncertain' ? 'uncertain' : undefined}>
                    {road.status === 'blocked'
                      ? t('Bị chặn', 'Blocked')
                      : road.status === 'uncertain'
                      ? t('Cần xác minh', 'Uncertain')
                      : t('Chưa ghi nhận chặn', 'No blockage reported')}
                  </StatusText>
                </button>
              ))
            )}
          </div>
        ) : (
          <div>
            {filteredHazards.length === 0 ? (
              <p className="small" style={{ padding: '16px 0', color: 'var(--ws-muted)' }}>
                {t('Không tìm thấy điểm ảnh hưởng.', 'No matching impact sites.')}
              </p>
            ) : (
              filteredHazards.map((hz) => (
                <button
                  key={hz.id}
                  className="object-row impact-row"
                  onClick={() => onSelectObject(`hazard:${hz.id}`)}
                >
                  <span>
                    <strong>{t(hz.name[0], hz.name[1])}</strong>
                    <small>{t(hz.src[0], hz.src[1])}</small>
                  </span>
                  <StatusText>
                    {hz.area != null ? `${hz.area} ha` : hz.kind === 'bridge' ? t('Cầu', 'Bridge') : hz.kind === 'crossing' ? t('Điểm vượt khe', 'Gully crossing') : hz.observation === 'reported' ? t('Có báo cáo', 'Reported') : t('Chưa xác minh', 'Unverified')}
                  </StatusText>
                </button>
              ))
            )}
          </div>
        )}

        <button
          className="button primary"
          style={{ width: '100%', marginTop: '20px' }}
          onClick={onNext}
        >
          {t('Xem địa bàn ưu tiên', 'Review community priorities')}
        </button>
      </div>
    </>
  );
};
