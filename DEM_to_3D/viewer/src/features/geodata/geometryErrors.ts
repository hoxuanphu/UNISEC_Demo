import { GeometryError } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';

const messages: Record<string,[string,string]> = {
  empty:['Không có điểm, đường hoặc polygon để nhập.','No point, line or polygon to import.'],
  coordinates:['Tọa độ không hợp lệ. Dùng giá trị số cho kinh độ, vĩ độ.','Invalid coordinates. Longitude and latitude must be numbers.'],
  'coordinate-range':['Tọa độ nằm ngoài WGS84. Kiểm tra hệ tọa độ và thứ tự kinh độ, vĩ độ.','Coordinates are outside WGS84. Check CRS and longitude/latitude order.'],
  'map-range':['Bản đồ này hỗ trợ vĩ độ từ −85,05° đến 85,05°.','This map supports latitudes from −85.05° to 85.05°.'],
  dateline:['Vùng vượt kinh tuyến 180° chưa được hỗ trợ. Tách vùng trước khi nhập.','Areas crossing the antimeridian are not supported. Split the geometry first.'],
  'ring-points':['Polygon cần ít nhất ba đỉnh khác nhau và điểm khép vòng.','A polygon needs three distinct vertices and a closing coordinate.'],
  'ring-open':['Polygon chưa khép kín. Lặp tọa độ đầu ở cuối vòng.','Polygon ring is not closed. Repeat its first coordinate at the end.'],
  'self-intersection':['Polygon tự cắt hoặc có cạnh chồng lên nhau. Kiểm tra lại các đỉnh.','Polygon intersects itself or has overlapping edges. Check its vertices.'],
  holes:['Lỗ polygon phải nằm trong biên ngoài, không chạm biên hoặc chồng nhau.','Polygon holes must lie inside the outer ring without touching or overlapping.'],
  'zero-area':['Polygon không có diện tích sử dụng được.','Polygon has no usable area.'],
  'multi-overlap':['Các phần của MultiPolygon chồng diện tích lên nhau.','MultiPolygon members have overlapping interiors.'],
  'line-points':['Đường cần ít nhất hai điểm khác nhau.','A line needs two distinct points.'],
  'geometry-type':['Hỗ trợ Point, LineString, Polygon và MultiPolygon.','Supported geometry: Point, LineString, Polygon and MultiPolygon.'],
  wkt:['WKT không hợp lệ. Dùng POINT, LINESTRING, POLYGON hoặc MULTIPOLYGON, theo thứ tự kinh độ vĩ độ.','Invalid WKT. Use POINT, LINESTRING, POLYGON or MULTIPOLYGON with longitude latitude order.'],
  geojson:['GeoJSON không hợp lệ. Kiểm tra cú pháp JSON và geometry.','Invalid GeoJSON. Check JSON syntax and geometry.'],
  crs:['Chỉ nhập WGS84. Chuyển dữ liệu sang EPSG:4326 trong QGIS trước khi nhập.','Import WGS84 data. Reproject to EPSG:4326 in QGIS first.'],
  'kml-xml':['KML không phải XML hợp lệ. Không hỗ trợ DTD hoặc entity.','KML is not valid XML. DTD and entities are not supported.'],
  'kml-network':['KML có NetworkLink. Xuất đối tượng thành KML cục bộ trước khi nhập.','KML contains NetworkLink. Export its features to a local KML file first.'],
  'kml-overlay':['KML chứa lớp ảnh. Công cụ này nhập hình học vector.','KML contains image overlays. This tool imports vector geometry.'],
  'file-limit':['Mỗi tệp tối đa 2 MB.','Each file must be at most 2 MB.'],
  'feature-limit':['Tối đa 100 đối tượng trong workspace.','The workspace supports at most 100 features.'],
  'vertex-limit':['Tối đa 1.500 đỉnh/đối tượng và 15.000 đỉnh/workspace. Giản lược hình học trong QGIS trước khi nhập.','Limits: 1,500 vertices/feature and 15,000/workspace. Simplify in QGIS before importing.'],
  file:['Không đọc được tệp. Chọn KML, GeoJSON hoặc WKT dạng văn bản.','Could not read the file. Choose a text KML, GeoJSON or WKT file.'],
  storage:['Không lưu được tại trình duyệt. Có thể xuất GeoJSON cho phiên hiện tại.','Browser storage is unavailable. Export GeoJSON to keep the current session.'],
  analysis:['Không tính được phần giao. Kiểm tra lại hình học đầu vào.','Could not calculate the intersection. Check the input geometry.']
};

export function geometryErrorText(error: unknown, locale: Locale): string {
  const key=error instanceof GeometryError ? error.code : 'file';
  const text=(messages[key] ?? messages.file)[locale === 'vi' ? 0 : 1];
  return error instanceof GeometryError && error.detail ? `${error.detail.slice(0,160)}: ${text}` : text;
}
