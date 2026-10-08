import type { GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { downloadBlob } from '../../shared/downloadBlob';
import { exportGeometryGeoJSON, exportGeometryKml } from './geometryExports';

export function GeometryExport({
  locale,
  exportRecords,
  exportScope,
  onScope,
  disabled,
  onError
}: {
  locale: Locale;
  exportRecords: GeometryRecord[];
  exportScope: string;
  onScope: (scope: string) => void;
  disabled: boolean;
  onError: (error: unknown) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const download = (text: string, name: string, type: string) =>
    downloadBlob(new Blob([text], { type }), name);
  return (
    <footer className="geodata-export">
      <label className="geodata-field">
        {t('Xuất dữ liệu', 'Export data')}
        <select
          aria-label={t('Phạm vi xuất GIS', 'GIS export scope')}
          value={exportScope}
          onChange={(event) => onScope(event.target.value)}
        >
          <option value="all">{t('Tất cả đối tượng', 'All features')}</option>
          <option value="aoi">AOI</option>
        </select>
      </label>
      <div className="geodata-actions">
        {(['geojson', 'kml'] as const).map((format) => (
          <button
            className="button"
            key={format}
            disabled={!exportRecords.length || disabled}
            onClick={() => {
              try {
                download(
                  format === 'geojson'
                    ? exportGeometryGeoJSON(exportRecords)
                    : exportGeometryKml(exportRecords),
                  `dear-${exportScope}.${format}`,
                  format === 'geojson'
                    ? 'application/geo+json'
                    : 'application/vnd.google-earth.kml+xml'
                );
              } catch (error) {
                onError(error);
              }
            }}
          >
            <UiIcon name="download" />
            {format === 'geojson' ? 'GeoJSON' : 'KML'}
          </button>
        ))}
      </div>
    </footer>
  );
}
