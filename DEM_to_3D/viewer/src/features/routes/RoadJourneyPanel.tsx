import { isSelectPickerEvent } from "../../shared/ui/selectKeyboard";
import { useEffect, useState } from "react";
import { journeyMessages } from "./locales";
import type {
  Locale,
  Community,
  ResponseSite,
  RoadSegment,
} from "../../types/dear";
import type { useRoadJourney } from "./useRoadJourney";
import { roadGeographic, roadProjected, type JourneyPreference } from "./selectedRoadJourney";
import type { JourneyPlace } from "./journeyPlaces";
import { UiIcon } from "../../shared/ui/UiIcon";
import { roadConditionLabel, roadConditionMessage } from './localRoadLabels';
import { routeCondition } from './roadConditions';
import "./road-journey.css";

const sides = ["start", "end"] as const;

export function RoadJourneyPanel({
  locale,
  journey,
  communities,
  sites,
  roads,
  places = [],
  onProfile,
}: {
  locale: Locale;
  journey: ReturnType<typeof useRoadJourney>;
  communities: Community[];
  sites: ResponseSite[];
  roads: RoadSegment[];
  /** Extra endpoints such as imported GIS points and areas. */
  places?: JourneyPlace[];
  onProfile?: () => void;
}): JSX.Element {
  const m = journeyMessages[locale];
  const [collapsed, setCollapsed] = useState(false);
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const number = (value: number, digits = 2) =>
    new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-GB", {
      maximumFractionDigits: digits,
    }).format(value);
  const length = (metres: number) =>
    metres < 1000 ? `${Math.round(metres)} m` : `${number(metres / 1000)} km`;
  const { picking } = journey;
  useEffect(() => {
    if (!picking) return;
    const cancel = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !isSelectPickerEvent(event)
      )
        journey.setPicking(null);
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [picking]);

  const choose = (side: "start" | "end", key: string) => {
    if (!key) {
      journey.clear(side);
      return;
    }
    if (key === "pick") {
      journey.setPicking(side);
      return;
    }
    const [kind, ...rest] = key.split(":"),
      id = rest.join(":");
    if (kind === "site") {
      const site = sites.find((s) => s.id === id);
      if (site) journey.setPoint(side, site.projected, key, t(...site.name));
    } else if (kind === "community") {
      const community = communities.find((c) => c.id === id);
      if (community)
        journey.setPoint(side, community.projected, key, community.name);
    } else {
      const place = places.find((p) => p.key === key);
      if (place)
        journey.setPoint(
          side,
          roadProjected(place.latitude, place.longitude),
          key,
          place.label,
          place.roadIds,
        );
    }
  };
  const groups = [...new Set(places.map((p) => p.group))];
  const localGroups = groups.filter(group => places.some(place => place.group === group && place.key.startsWith('local:')));
  const placeGroup = (group: string) => <optgroup key={group} label={localGroups.includes(group) ? group : `${m.gisData}: ${group}`}>
    {places.filter(place => place.group === group).map(place => <option key={place.key} value={place.key}>
      {place.label}{place.representative ? ` (${m.representativePoint})` : ''}
    </option>)}
  </optgroup>;
  /** Keep picking instructions and connection errors beside their endpoint. */
  const meta = (side: "start" | "end") => {
    if (picking === side)
      return side === "start" ? m.clickMapStart : m.clickMapEnd;
    const endpoint = journey[side];
    if (!endpoint) return "";
    if (endpoint.problem)
      return endpoint.problem === "blocked"
        ? m.blockedConnection
        : m.tooFarFromRoads;
    // Distances to the road are in the result figures; the stop only reports problems.
    return "";
  };
  const route = journey.route,
    access =
      (journey.start?.anchor?.distance ?? 0) +
      (journey.end?.anchor?.distance ?? 0);
  const status = route?.status ?? "open";
  const local = [journey.start,journey.end].every(point => point?.source.startsWith('local:'));
  const shortest = journey.preference === 'distance';
  const rescue = journey.preference === 'rescue-foot';

  return (
    <section
      className="road-journey-panel"
      aria-label={m.journeyBetweenTwoPoints}
      data-collapsed={collapsed || undefined}
    >
      <header>
        <h2>{t('Chỉ đường', 'Directions')}</h2>
        <button
          className="icon-button"
          title={m.fitJourney}
          aria-label={m.fitJourney}
          disabled={!journey.start && !journey.end}
          onClick={() => {
            if (matchMedia("(max-width: 760px)").matches) setCollapsed(true);
            journey.fit();
          }}
        >
          <UiIcon name="fit" />
        </button>
        <button
          className="icon-button"
          title={collapsed ? m.expandJourney : m.collapseJourney}
          aria-label={collapsed ? m.expandJourney : m.collapseJourney}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <UiIcon name={collapsed ? "expand" : "collapse"} />
        </button>
        <button
          className="icon-button"
          aria-label={m.closeJourney}
          onClick={journey.close}
        >
          <UiIcon name="close" />
        </button>
      </header>
      <div className="road-journey-content" hidden={collapsed}>
        <label className="journey-purpose">
          <span>{t('Cách đi', 'Travel plan')}</span>
          <select aria-label={t('Cách đi', 'Travel plan')} value={journey.preference} onChange={event => journey.setPreference(event.target.value as JourneyPreference)}>
            <option value="distance">{t('Đường ngắn nhất', 'Shortest route')}</option>
            <option value="conditions">{t('Ưu tiên điều kiện đường', 'Prefer better road conditions')}</option>
            <option value="rescue-foot">{t('Cứu hộ đi bộ', 'Rescue on foot')}</option>
          </select>
        </label>
        <div className="journey-stops">
          {sides.map((side) => {
            const endpoint = journey[side],
              pointLabel = side === "start" ? m.presetStart : m.presetEnd,
              active = picking === side;
            const road =
              endpoint?.anchor &&
              roads.find((r) => r.id === endpoint.anchor!.roadId);
            return (
              <div
                key={side}
                className="journey-stop"
                data-active={active || undefined}
              >
                <span className={"journey-stop-symbol is-" + side} aria-hidden="true">
                  {side === 'start' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg> : <UiIcon name="location" size={22}/>}
                </span>
                <div className="journey-stop-field">
                  <label htmlFor={`journey-${side}`}>{side === "start" ? m.presetStart : m.presetEnd}</label>
                  <select
                    id={`journey-${side}`}
                    aria-label={side === "start" ? m.presetStart : m.presetEnd}
                    value={endpoint?.source ?? ""}
                    onChange={(event) => choose(side, event.target.value)}
                  >
                    <option value="">
                      {side === "start" ? m.chooseStart : m.chooseEnd}
                    </option>
                    {endpoint?.source === "map" && (
                      <option value="map">{endpoint.label ?? (() => { const p = roadGeographic(endpoint.origin); return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`; })()}</option>
                    )}
                    <option value="pick">{m.chooseOnMapEllipsis}</option>
                    {localGroups.map(placeGroup)}
                    <optgroup label={m.responseSites}>
                      {sites.map((s) => (
                        <option key={s.id} value={"site:" + s.id}>
                          {t(...s.name)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={m.areas}>
                      {communities.map((c) => (
                        <option key={c.id} value={"community:" + c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    {groups.filter(group => !localGroups.includes(group)).map(placeGroup)}
                  </select>
                  {meta(side) && (
                    <small
                      className="journey-stop-meta"
                      role={endpoint?.problem && !active ? "alert" : undefined}
                      data-error={(!!endpoint?.problem && !active) || undefined}
                      title={
                        road ? road.name[locale === "vi" ? 0 : 1] : undefined
                      }
                      data-far={
                        endpoint?.anchor && endpoint.anchor.distance > 250
                          ? true
                          : undefined
                      }
                    >
                      {meta(side)}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-button journey-pick"
                  aria-pressed={active}
                  aria-label={`${m.chooseOnMap}: ${pointLabel}`}
                  title={`${m.chooseOnMap}: ${pointLabel}`}
                  onClick={() => journey.setPicking(active ? null : side)}
                >
                  <UiIcon name="location" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="icon-button journey-swap"
            aria-label={m.swap}
            title={m.swap}
            disabled={!journey.start && !journey.end}
            onClick={journey.swap}
          >
            <UiIcon name="swap" size={18}/>
          </button>
        </div>

        {!rescue && <label className="journey-option">
          <input
            type="checkbox"
            checked={journey.avoidBlocked}
            onChange={(event) => journey.setAvoidBlocked(event.target.checked)}
          />
          {m.avoidBlockedSections}
        </label>}

        {route ? (
          <section className="journey-result" aria-live="polite">
            <div className="journey-result-heading">
              <strong>{status === 'blocked' ? t('Tuyến có đoạn bị chặn', 'Route has a blocked section') : journey.advised ? rescue ? t('Phương án tiếp cận', 'Approach plan') : shortest ? t('Đường ngắn nhất', 'Shortest route') : t('Đường nên đi', 'Suggested route') : t('Đường bạn chọn', 'Your chosen route')}</strong>
              <strong className="journey-route-distance">{length(route.lengthKm * 1000)}</strong>
            </div>
            <p className={`journey-condition is-${status}`}>{roadConditionMessage(route,locale,local)}</p>
            {rescue && <p className="journey-note">{t('Có thể dùng đường mòn. Cần xác nhận lối đi với người địa phương.', 'May use local trails. Confirm access with local people.')}</p>}
            {!rescue && <p className="journey-note">{shortest ? t('Tính theo chiều dài đường đã có trong dữ liệu.', 'Based on the length of mapped roads.') : t('Ưu tiên đường ít ảnh hưởng nếu dài hơn không quá 25%.', 'Prefers less affected roads within a 25% distance detour.')}</p>}
            {access > 1 && <div className="journey-access">
              <p>{t('Đoạn nối nét đứt, chưa xác nhận lối đi:', 'Dotted connections, access not verified:')}</p>
              <dl className="journey-figures">{sides.map((side) => {
                const distance = journey[side]?.anchor?.distance ?? 0;
                return distance > 1 ? (
                  <div key={side}>
                    <dt>{side === "start" ? m.startToRoad : m.roadToEnd}</dt>
                    <dd>{length(distance)}</dd>
                  </div>
                ) : null;
              })}</dl>
            </div>}
            {!!journey.alternatives.length && <details className="journey-alternatives">
              <summary>{t('Đường khác', 'Other routes')}</summary>
              {journey.alternatives.map(alternative => <button type="button" className="journey-alternative" key={alternative.id}
                onClick={()=>{journey.choose(alternative.id);journey.fit();}}>
                <span>{roadConditionLabel(routeCondition(alternative),locale,local)}</span><strong>{length(alternative.lengthKm * 1000)}</strong>
              </button>)}
            </details>}
            {onProfile && (
              <button className="button journey-profile" onClick={onProfile}>
                <UiIcon name="route" />
                {m.journeyElevationProfile}
              </button>
            )}
          </section>
        ) : (
          journey.kind !== "incomplete" &&
          journey.kind !== "endpoint-unavailable" && (
            <p
              role="status"
              data-reason={journey.kind}
              className={
                "journey-message " +
                (journey.kind === "blocked-network" ? "is-error" : "is-info")
              }
            >
              {journey.kind === "same-location"
                ? m.samePoint
                : journey.kind === "same-connection"
                  ? m.sameConnection
                  : journey.kind === "blocked-network"
                    ? m.blockedNetwork
                    : m.disconnected}
            </p>
          )
        )}
      </div>
    </section>
  );
}
