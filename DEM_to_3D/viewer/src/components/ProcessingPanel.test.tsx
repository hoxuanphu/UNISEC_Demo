import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProcessingPanel } from './ProcessingPanel';

describe('processing panel initial UI', () => {
  it('is collapsed by default, separate from the viewer, with labeled sources and advanced controls', () => {
    const html = renderToStaticMarkup(<ProcessingPanel viewerBusy={false} onImport={async () => undefined} />);
    expect(html).toContain('<details class="processing-panel">');
    expect(html).not.toContain('<details open');
    expect(html).toContain('Processing workspace');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Generate terrain');
    expect(html).toContain('Split DEM');
    expect(html).toContain('accept=".shp,.shx,.dbf,.prj,.cpg"');
    expect(html).toContain('DEM GeoTIFF');
    expect(html).toContain('Texture (optional)');
    for (const label of ['Exporter version', 'Colormap', 'Max vertices', 'Vertical exaggeration', 'Sampling step', 'Target EPSG', 'Commune filter', 'Commune buffer', 'NoData holes', 'Normalize base elevation', 'Keep geographic coordinates']) expect(html).toContain(label);
    for (const format of ['GLB', 'OBJ', 'STL', 'PLY']) expect(html).toContain(format);
    expect(html).toContain('Check connection');
  });
});
