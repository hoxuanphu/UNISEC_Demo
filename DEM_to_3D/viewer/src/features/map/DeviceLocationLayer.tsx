import { useEffect, useRef } from "react";
import * as L from "leaflet";
import { mapPane } from "./mapLayerOrder";
import type { DeviceLocation } from "../../shared/hooks/useDeviceLocation";
export function DeviceLocationLayer({
  mapRef,
  location,
  request,
  locale,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  location: DeviceLocation | null;
  request: number;
  locale: "vi" | "en";
}): null {
  const last = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    const point = L.latLng(location.latitude, location.longitude),
      group = L.layerGroup().addTo(map);
    L.circle(point, {
      pane: mapPane("selection"),
      radius: location.accuracy,
      color: "#1a73e8",
      weight: 1,
      fillColor: "#1a73e8",
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(group);
    const marker = L.circleMarker(point, {
      pane: mapPane("selection"),
      // The same "You" dot as the tracked position: larger, white-ringed, labelled.
      radius: 8,
      color: "#fff",
      weight: 3,
      fillColor: "#1a73e8",
      fillOpacity: 1,
      interactive: false,
    }).addTo(group);
    marker.bindTooltip(locale === "vi" ? "Bạn" : "You", { permanent: true, direction: "top", offset: [0, -10], className: "self-location-tag" });
    const tip = document.createElement("span");
    tip.textContent =
      (locale === "vi" ? "Vị trí của bạn" : "Your location") +
      (locale === "vi" ? ", sai số ±" : ", accuracy ±") +
      Math.round(location.accuracy) +
      " m";
    marker.getElement()?.setAttribute("aria-label", tip.textContent ?? "");
    if (request && request !== last.current) {
      last.current = request;
      map.setView(point, Math.min(16, Math.max(14, map.getZoom())), {
        animate: false,
      });
    }
    return () => {
      group.remove();
    };
  }, [mapRef, location, request, locale]);
  return null;
}
