import type { Locale } from '../../types/dear';
import { defaultDrawingOrder, moveDrawingLayer, type DrawingLayer } from './mapLayerOrder';
import { useMapLayerOrder } from './useMapLayerOrder';
const names: Record<DrawingLayer, [string, string]> = {
  roads: ['Mạng đường', 'Road network'], reference: ['Dữ liệu tham chiếu', 'Reference data'],
  landslides: ['Vùng sạt lở', 'Landslide extents'], boundary: ['Ranh giới vùng đánh giá', 'Assessment boundary'],
};
export function LayerOrderControl({locale}: {locale: Locale}) {
  const {order, setOrder} = useMapLayerOrder();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <details className="layer-section layer-order"><summary>{t('Thứ tự chồng lớp', 'Drawing order')}</summary>
    <p>{t('Lớp trên cùng được vẽ sau cùng.', 'Top layers draw above those below.')}</p>
    <ol>{order.map((id, index) => {
      const name = names[id][locale === 'vi' ? 0 : 1];
      return <li key={id} data-drawing-layer={id}><span>{name}</span><div>
        {([-1, 1] as const).map(direction => <button type="button" key={direction}
          className="icon-button" disabled={direction < 0 ? index === 0 : index === order.length - 1}
          aria-label={t(`${direction < 0 ? 'Đưa lên' : 'Đưa xuống'}: ${name}`, `Move ${direction < 0 ? 'up' : 'down'}: ${name}`)}
          onClick={() => setOrder(moveDrawingLayer(order, id, direction))}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={direction < 0 ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'}/></svg>
        </button>)}
      </div></li>;
    })}</ol>
    <p>{t('Ảnh ở dưới; tình trạng đường, tuyến và nhãn luôn ở trên.', 'Imagery stays below; road warnings, routes and labels stay above.')}</p>
    <button type="button" className="text-button" onClick={() => setOrder(defaultDrawingOrder)}>{t('Đặt lại thứ tự', 'Reset order')}</button>
  </details>;
}
