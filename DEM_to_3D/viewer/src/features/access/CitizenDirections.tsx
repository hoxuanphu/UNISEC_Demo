import type { ReactNode } from "react";
import type { Community, Locale, ResponseSite } from "../../types/dear";
import type { useRoadJourney } from "../routes/useRoadJourney";
import { roadProjected } from "../routes/selectedRoadJourney";
import type { useDeviceLocation } from "../../shared/hooks/useDeviceLocation";
import { UiIcon } from "../../shared/ui/UiIcon";
import { roadConditionLabel, roadConditionMessage } from '../routes/localRoadLabels';
import { roadCondition } from '../routes/roadConditions';

/** Two places, each picked from one list (the start also offers the phone's location) or from the map. */
export function CitizenDirections({
  journey,
  communities,
  sites,
  locale,
  gps,
  gpsError,
  onPick,
  onMap,
  local = false,
}: {
  journey: ReturnType<typeof useRoadJourney>;
  communities: Community[];
  sites: ResponseSite[];
  locale: Locale;
  gps: ReturnType<typeof useDeviceLocation>;
  gpsError: ReactNode;
  onPick: (side: "start" | "end") => void;
  onMap: () => void;
  local?: boolean;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const places = [
    ...communities.map((c) => ({ key: "community:" + c.id, name: c.name, projected: c.projected })),
    ...sites.map((s) => ({ key: "site:" + s.id, name: t(...s.name), projected: s.projected })),
  ];
  const choose = async (side: "start" | "end", key: string) => {
    gps.cancel();
    journey.setOpen(true);
    if (!key) {
      journey.clear(side);
      return;
    }
    if (key === "device") {
      const p = await gps.request();
      if (p) journey.setPoint("start", roadProjected(p.latitude, p.longitude), "device", t("Vị trí của bạn", "Your location"));
      return;
    }
    const place = places.find((p) => p.key === key);
    if (place) journey.setPoint(side, place.projected, key, place.name);
  };
  const staging = (key: string) => sites.some(site => "site:" + site.id === key && site.kind === "staging");
  const km = (value: number) =>
    new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: 1 }).format(value);
  const stop = (side: "start" | "end") => {
    const other = journey[side === "start" ? "end" : "start"]?.source;
    return (
      <div className="citizen-stop">
        <label className="geodata-field" htmlFor={`citizen-stop-${side}`}>{side === "start" ? t("Đi từ", "From") : t("Đến", "To")}</label>
        <div className="citizen-stop-row">
          <select id={`citizen-stop-${side}`} value={journey[side]?.source ?? ""} disabled={gps.busy && side === "start"} onChange={(e) => void choose(side, e.target.value)}>
            <option value="">{side === "start" ? t("Chọn nơi xuất phát", "Choose starting point") : t("Chọn nơi đến", "Choose destination")}</option>
            {side === "start" && <option value="device">{gps.busy ? t("Đang lấy vị trí", "Locating") : t("Vị trí của bạn", "Your location")}</option>}
            {journey[side]?.source === "map" && <option value="map">{t("Điểm chọn trên bản đồ", "Point on map")}</option>}
            {sites.some(site => site.kind === "staging") && <optgroup label={t("Điểm tập kết", "Assembly points")}>
              {places.filter((p) => staging(p.key)).map((p) => <option key={p.key} value={p.key} disabled={p.key === other}>{p.name}</option>)}
            </optgroup>}
            {communities.length > 0 && <optgroup label={t("Thôn, bản", "Villages")}>
              {places.filter((p) => p.key.startsWith("community:")).map((p) => <option key={p.key} value={p.key} disabled={p.key === other}>{p.name}</option>)}
            </optgroup>}
            {sites.some(site => site.kind !== "staging") && <optgroup label={local ? t('Địa điểm khác', 'Other places') : t("Điểm tập kết", "Staging points")}>
              {places.filter((p) => p.key.startsWith("site:") && !staging(p.key)).map((p) => <option key={p.key} value={p.key} disabled={p.key === other}>{p.name}</option>)}
            </optgroup>}
          </select>
          <button type="button" className="icon-button" aria-label={t("Chọn trên bản đồ", "Choose on map")} title={t("Chọn trên bản đồ", "Choose on map")}
            onClick={() => { journey.setOpen(true); onPick(side); }}>
            <UiIcon name="map" size={20} />
          </button>
        </div>
        {side === "start" && gpsError}
      </div>
    );
  };
  return (
    <section className="citizen-card citizen-directions" aria-label={t("Tìm đường", "Find a route")}>
      {stop("start")}
      {stop("end")}
      {journey.start && journey.end && (
        <div className="citizen-direction-result" role="status" data-status={journey.route?.status}>
          {journey.route ? (
            <>
              <p className="citizen-direction-verdict">
                {journey.route.status === 'blocked' ? t('Chưa có đường nên đi', 'No passable route found') : journey.advised ? t('Đường nên đi', 'Suggested route') : t('Đường bạn chọn', 'Your chosen route')}
              </p>
              <p className="citizen-direction-length"><strong>{km(journey.route.lengthKm)}</strong> km {t("theo đường", "by road")}</p>
              <p className="citizen-direction-note">{roadConditionMessage(journey.route, locale, local)}</p>
              {journey.route.segs.some(road => roadCondition(road) !== 'open') && <details className="citizen-road-checks"><summary>{t('Đoạn cần chú ý', 'Sections to check')}</summary><ul>{journey.route.segs.filter(road => roadCondition(road) !== 'open').map(road => <li key={road.id}><span>{t(...road.name)}</span><small>{roadConditionLabel(roadCondition(road), locale, local)}</small></li>)}</ul></details>}
              {(journey.start.anchor?.distance ?? 0) + (journey.end.anchor?.distance ?? 0) > 1 && (
                <p className="citizen-direction-note">
                  {t("Đoạn nối nét chấm chưa có thông tin đường đi.", "Dotted connections have no mapped access path.")}
                </p>
              )}
              <button type="button" className="button" onClick={() => { journey.fit(); onMap(); }}>
                <UiIcon name="map" size={16} />
                {t("Xem trên bản đồ", "View on map")}
              </button>
            </>
          ) : (
            <p className="citizen-direction-note">
              {journey.kind === "same-location"
                ? t("Điểm đi và điểm đến trùng nhau.", "Start and destination are the same.")
                : journey.kind === "same-connection"
                  ? t("Hai điểm nối vào cùng một vị trí trên đường. Chưa có đường đi giữa hai điểm.", "Both points connect to the same road location. A route between them is unavailable.")
                  : journey.kind === "endpoint-unavailable"
                    ? journey.start?.problem === 'blocked' || journey.end?.problem === 'blocked'
                      ? t('Đường gần điểm đã chọn đang bị chặn.', 'Roads near the chosen point are blocked.')
                      : t("Chưa có đường đến điểm đã chọn.", "No road is mapped to the chosen point.")
                    : journey.kind === "blocked-network"
                      ? t("Tuyến nối hai nơi có đoạn bị chặn.", "The route between these places includes a blocked section.")
                      : t("Chưa tìm được đường nối hai nơi.", "No connecting route was found.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
