import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { KmlPanel } from './KmlPanel';

it('provides a multiple KML/KMZ input and explains terrain requirements', () => {
  const html = renderToStaticMarkup(<KmlPanel layers={[]} onLayers={() => undefined} available={false} status={null} />);
  expect(html).toContain('accept=".kml,.kmz"');
  expect(html).toContain('multiple');
  expect(html).toContain('Cần terrain có .terrain.json');
});

it('shows escaped names, counts and controls without technical parser warnings', () => {
  const html = renderToStaticMarkup(<KmlPanel layers={[{ name: '<script>test</script>', features: [{ name: '', kind: 'point', coordinates: [[[100, 20]]] }], warnings: ['Unsupported overlay'] }]} onLayers={() => undefined} available status='Đã phủ' />);
  expect(html).toContain('1 đối tượng');
  expect(html).not.toContain('Unsupported overlay');
  expect(html).toContain('Hiện KML / KMZ');
  expect(html).toContain('Xóa lớp KML / KMZ');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('Đã phủ');
});
