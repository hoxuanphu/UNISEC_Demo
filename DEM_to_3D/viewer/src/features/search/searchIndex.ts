import type { AnalysisArea, Community, Hazard, Locale, ResponseSite, RoadSegment } from '../../types/dear';

export type SearchResult = { key: string; name: string; category: string; terms: string; projected: { x: number; y: number }; symbol?: 'community' | Hazard['kind'] | ResponseSite['kind'] };
export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export function searchWorkspace(query: string, data: {
  communities: Community[]; roads: RoadSegment[]; hazards: Hazard[]; responseSites: ResponseSite[]; aoi: AnalysisArea;
}, locale: Locale): SearchResult[] {
  const t = (pair: [string, string]) => pair[locale === 'vi' ? 0 : 1];
  const items: SearchResult[] = [
    ...data.communities.map(c => ({ key: `community:${c.id}`, name: c.name, category: t(['Thôn, bản', 'Community']), terms: `${c.name} ${c.commune} ${c.id}`, projected: c.projected, symbol: 'community' as const })),
    ...data.roads.map(r => ({ key: `road:${r.id}`, name: t(r.name), category: t(['Đoạn đường', 'Road section']), terms: `${r.name.join(' ')} ${r.scenarioRoadCode ?? ''} ${r.id}`, projected: r.points[Math.floor(r.points.length / 2)] })),
    ...data.hazards.map(h => ({ key: `hazard:${h.id}`, name: t(h.name), category: t(['Điểm ảnh hưởng', 'Impact site']), terms: `${h.name.join(' ')} ${h.id}`, projected: h.projected, symbol: h.kind })),
    ...data.responseSites.map(s => ({ key: `poi:${s.id}`, name: t(s.name), category: t(['Điểm ứng phó', 'Response site']), terms: `${s.name.join(' ')} ${s.id}`, projected: s.projected, symbol: s.kind })),
    { key: `aoi:${data.aoi.id}`, name: t(data.aoi.name), category: t(['Vùng đánh giá', 'Assessment area']), terms: data.aoi.name.join(' '), projected: data.aoi.points[0] }
  ];
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items.filter(item => words.every(word => normalizeSearch(item.terms).includes(word)))
    .sort((a, b) => Number(normalizeSearch(b.name).startsWith(words.join(' '))) - Number(normalizeSearch(a.name).startsWith(words.join(' '))))
    .slice(0, 8);
}
