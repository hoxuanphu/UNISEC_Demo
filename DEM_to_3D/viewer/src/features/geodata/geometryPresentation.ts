import type { GeometryRole } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';

export const roleColors = {reference:'#b7791f',aoi:'#258b70',footprint:'#378ecc'};
export const roleLabel = (role: GeometryRole, locale: Locale) => ({
  reference:['Tham chiếu','Reference'], aoi:['Vùng quan tâm (AOI)','Area of interest (AOI)'], footprint:['Phạm vi ảnh','Image footprint']
}[role][locale === 'vi' ? 0 : 1]);
export const formatArea = (value:number,locale:Locale) => `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB',{maximumFractionDigits:2}).format(value/1e6)} km²`;
