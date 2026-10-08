import type { Locale, ScenarioRoute } from '../../types/dear';
import { StatusText } from '../../shared/ui/StatusText';

export function RouteOption({ route, selected, locale, onSelect }: {
  route: ScenarioRoute; selected: boolean; locale: Locale; onSelect: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const blocked = route.status === 'blocked';
  return <button className="route-card" aria-pressed={selected} onClick={onSelect}>
    <span className="route-option-heading">
      <span className="route-option-selector" aria-hidden="true"/>
      <strong>{t(route.name[0], route.name[1])}</strong>
    </span>
    <span className="route-option-meta">
      <span>{route.lengthKm} km</span>
    </span>
    <span className="route-bottom">
      <StatusText tone={blocked ? 'critical' : 'warning'} icon={blocked ? 'blocked' : 'uncertain'}>
        {blocked ? t('Bị chặn', 'Blocked') : t('Cần xác minh', 'Verify access')}
      </StatusText>
    </span>
  </button>;
}
