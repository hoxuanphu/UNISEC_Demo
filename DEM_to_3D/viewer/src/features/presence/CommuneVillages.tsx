import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { CommuneVillage, VillageAccess } from './communeSites';
import './commune-villages.css';

const accessText: Record<VillageAccess, [string, string]> = {
  open: ['Đường thông', 'Road open'], difficult: ['Khó đi', 'Difficult'], cut: ['Bị cô lập', 'Cut off'], unknown: ['Chưa rõ', 'Unknown'],
};
const accessTone = { open: 'neutral', difficult: 'warning', cut: 'critical', unknown: 'neutral' } as const;

/** The commune's villages under its community: how each is reached, and who is at the huts around it. */
export function CommuneVillages({ villages, entryName, locale, onSelectVillage, onSelectHuts }: {
  villages: CommuneVillage[]; entryName?: [vi: string, en: string]; locale: Locale;
  onSelectVillage: (village: CommuneVillage) => void; onSelectHuts: (id: string) => void;
}): JSX.Element | null {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const l = (pair: [string, string]) => pair[locale === 'vi' ? 0 : 1];
  if (!villages.length) return null;
  return <section className="workflow-section commune-villages">
    <h2 className="incident-section-title"><span>{t('Thôn bản Chế Tạo', 'Chế Tạo villages')}</span>
      {entryName && <small>{t(`Tiếp cận từ ${l(entryName)}`, `Access from ${l(entryName)}`)}</small>}</h2>
    <div className="incident-landslide-list">
      {villages.map(village => {
        const cutOff = village.huts.filter(item => item.isolated), people = cutOff.reduce((sum, item) => sum + item.cluster.people, 0);
        return <div className="commune-village" key={village.place.id}>
          <button className="incident-landslide-row commune-village-row" onClick={() => onSelectVillage(village)}>
            <span className="commune-village-icon" aria-hidden="true"><UiIcon name="home" size={18}/></span>
            <span className="incident-landslide-copy"><strong>{l(village.name)}</strong>
              <small>{cutOff.length ? t(`${people} người bị cô lập quanh bản`, `${people} people cut off nearby`) : t('Chưa ghi nhận cô lập', 'No isolation reported')}</small></span>
            <small className="incident-status" data-tone={accessTone[village.access]}>{l(accessText[village.access])}</small>
          </button>
          {village.huts.length > 0 && <div className="commune-huts">{village.huts.map(item => <button className="incident-landslide-row commune-hut-row" key={item.cluster.id} data-isolated={item.isolated || undefined} onClick={() => onSelectHuts(item.cluster.id)}>
            <span className="commune-hut-icon" aria-hidden="true"><UiIcon name="people" size={14}/></span>
            <span className="incident-landslide-copy"><strong>{l(item.cluster.name)}</strong>
              <small>{t(`${item.cluster.people} người, ${item.cluster.households} hộ`, `${item.cluster.people} people, ${item.cluster.households} households`)}{item.isolated ? t(', bị cô lập', ', cut off') : t(', còn đường ra', ', way out open')}</small></span>
            <UiIcon name="next" size={16}/>
          </button>)}</div>}
        </div>;
      })}
    </div>
  </section>;
}
