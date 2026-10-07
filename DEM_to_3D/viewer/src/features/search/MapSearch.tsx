import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';
import type { ReactNode } from 'react';
import type { SearchResult } from './searchIndex';
import { UiIcon } from '../../components/dear/UiIcon';
import { MapSymbol } from '../../shared/ui/MapSymbol';

const resultIcon = (result: SearchResult): JSX.Element => {
  if (result.symbol) return <MapSymbol name={result.symbol} size={16}/>;
  const kind = result.key.slice(0, result.key.indexOf(':'));
  if (kind === 'road') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M4 20c4-6 12-6 16-16"/></svg>;
  return <UiIcon name="fit" size={16}/>;
};

/** Bold the query words in the name. Matching ignores Vietnamese marks, so compare one character at a time. */
function highlight(name: string, query: string): ReactNode {
  const chars = [...name];
  const folded = chars.map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().slice(0, 1) || c).join('');
  const marked = new Array<boolean>(chars.length).fill(false);
  for (const word of query.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().split(/\s+/).filter(Boolean)) {
    const start = folded.indexOf(word);
    if (start >= 0) marked.fill(true, start, start + word.length);
  }
  const parts: ReactNode[] = [];
  let from = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || marked[i] !== marked[from]) {
      const text = chars.slice(from, i).join('');
      parts.push(marked[from] ? <mark key={from}>{text}</mark> : text);
      from = i;
    }
  }
  return parts;
}

export function MapSearch({ locale, results, query, onQuery, onSelect, disabled }: {
  locale: Locale; results: SearchResult[]; query: string; onQuery: (query: string) => void;
  onSelect: (result: SearchResult) => void; disabled: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const expanded = open && Boolean(query.trim());
  const choose = (result: SearchResult) => { onSelect(result); setOpen(false); };
  return <div ref={root} className="map-search">
    <div className="map-search-field">
      <UiIcon name="search"/>
      <input role="combobox" aria-label={t('Tìm trên bản đồ', 'Search map')} aria-expanded={expanded}
        aria-controls={expanded ? 'map-search-results' : undefined} aria-autocomplete="list" aria-activedescendant={expanded && results[active] ? `map-result-${active}` : undefined}
        placeholder={t('Tìm địa bàn, đường, điểm…', 'Search places, roads, sites…')} value={query} disabled={disabled}
        onFocus={() => setOpen(true)} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
        onChange={event => { onQuery(event.target.value); setOpen(true); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && query.trim()) {
            event.preventDefault(); setOpen(true);
            setActive(index => !results.length ? 0 : !expanded
              ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
          }
          if (event.key === 'Enter' && expanded && results[active]) { event.preventDefault(); choose(results[active]); }
        }}/>
      {query && <button className="icon-button" aria-label={t('Xóa tìm kiếm', 'Clear search')} onClick={() => { onQuery(''); setActive(0); root.current?.querySelector('input')?.focus(); }}><UiIcon name="close" size={16}/></button>}
    </div>
    {expanded && <div id="map-search-results" className="map-search-results" role="listbox" aria-label={t('Kết quả tìm kiếm', 'Search results')}>
      {!results.length && <p>{t('Không tìm thấy kết quả', 'No results found')}</p>}
      {results.map((result, index) => <button key={result.key} id={`map-result-${index}`} role="option" aria-selected={index === active}
        onPointerMove={() => setActive(index)} onClick={() => choose(result)}><span className="map-search-icon">{resultIcon(result)}</span><span><strong>{highlight(result.name, query)}</strong><small>{result.category}</small></span></button>)}
    </div>}
  </div>;
}
