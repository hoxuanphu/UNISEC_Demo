import pointOnFeature from "@turf/point-on-feature";
import type { GeometryRecord } from "../../geo/vector/types";

export type JourneyPlace = {
  key: string;
  label: string;
  /** Source file or layer the place came from, used to group long lists. */
  group: string;
  latitude: number;
  longitude: number;
  representative?: boolean;
  /** Roads belonging to this place's source network, not a confirmed access link. */
  roadIds?: readonly string[];
};

/** Points retain their coordinates. Non-point presets use a point on the feature,
 * labelled as representative; reaching it does not establish access to the whole area. */
export function gisJourneyPlaces(records: GeometryRecord[]): JourneyPlace[] {
  return records
    .filter((record) => record.visible)
    .flatMap((record) => {
      const geometry = record.feature.geometry;
      const [longitude, latitude] = pointOnFeature(record.feature).geometry
        .coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [
        {
          key: "gis:" + record.id,
          label: record.name || record.id,
          group: record.source.name,
          latitude,
          longitude,
          representative: geometry.type !== "Point",
        },
      ];
    })
    .sort(
      (a, b) =>
        a.group.localeCompare(b.group) ||
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
}
