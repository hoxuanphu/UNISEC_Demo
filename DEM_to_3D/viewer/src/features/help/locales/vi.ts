import type { GuideContent } from './index';

export const vi: GuideContent = {
  title: 'Hướng dẫn sử dụng',
  topicsLabel: 'Chủ đề',
  close: 'Đóng hướng dẫn',
  fullImage: 'Xem ảnh hướng dẫn đầy đủ',
  previous: 'Chủ đề trước',
  next: 'Chủ đề tiếp',
  stepOf: 'Chủ đề {n}/{total}',
  topics: [
    {
      id: 'response',
      audience: 'manager',
      title: 'Đọc tình huống',
      image: 'guide/response.jpg',
      steps: [
        {
          icon: 'history',
          title: 'Vùng và thời điểm dữ liệu',
          text: 'Bấm tên vùng ở đầu màn hình để xem sự kiện, nguồn dữ liệu và lịch sử cập nhật. “Dữ liệu đến” cho biết thời điểm cập nhật của thông tin trên bản đồ.'
        },
        {
          icon: 'people',
          title: 'Chọn địa bàn',
          text: 'Trong tab Sự kiện, chọn một địa bàn ưu tiên để mở phương án tiếp cận.'
        },
        {
          icon: 'route',
          title: 'So sánh tuyến',
          text: 'Chọn từng tuyến để xem chiều dài, thời gian di chuyển và đường đi. Chi tiết mở bên phải khi đủ chỗ; trên màn hình hẹp, chi tiết thay bảng danh sách.'
        },
        {
          icon: 'blocked',
          title: 'Kiểm tra đoạn có vấn đề',
          text: 'Mở một đoạn trong Các đoạn trên tuyến để xem báo cáo hiện trường và mặt cắt địa hình.'
        },
        {
          icon: 'bell',
          title: 'Cập nhật báo cáo mới',
          text: 'Mở chuông thông báo, đọc báo cáo rồi chọn Cập nhật bản đồ để đưa vào đánh giá.'
        }
      ]
    },
    {
      id: 'reports',
      audience: 'manager',
      title: 'Ảnh và kiểm tra ghi nhận',
      image: 'guide/reports.jpg',
      steps: [
        {
          icon: 'image',
          title: 'Xem ghi nhận gửi đến',
          text: 'Bấm Ghi nhận ở đầu màn hình. Chọn một ghi nhận trong danh sách để xem ảnh và vị trí; bấm ảnh để xem lớn.'
        },
        {
          icon: 'location',
          title: 'Đối chiếu nguồn',
          text: 'Kiểm tra vị trí ghi nhận và giờ chụp. Dữ liệu có sẵn trong ảnh được điền tự động; thông số ảnh nằm trong phần mở rộng để đối chiếu khi cần.'
        },
        {
          icon: 'check',
          title: 'Lưu kết quả kiểm tra',
          text: 'Trong Kiểm tra ghi nhận, chọn kết quả rồi bấm Lưu. Kết quả kiểm tra được lưu vào ghi nhận. Muốn đổi tình trạng đường, mở hồ sơ đoạn đường và cập nhật riêng.'
        },
        {
          icon: 'area',
          title: 'Thêm ảnh và khoanh vùng',
          text: 'Trong GIS, chọn điểm rồi Thêm ghi nhận thực địa để thêm ảnh của bạn. Vẽ vùng nghi ảnh hưởng để gắn ranh giới với điểm; ghi rõ khi đây còn là vùng cần xác minh.'
        }
      ]
    },
    {
      id: 'map',
      audience: 'manager',
      title: 'Bản đồ và tìm đường',
      image: 'guide/map.jpg',
      steps: [
        {
          icon: 'route',
          title: 'Tìm đường giữa hai điểm',
          text: 'Chọn A và B từ danh sách, hoặc bấm biểu tượng vị trí rồi bấm lên bản đồ. Tránh đoạn bị chặn áp dụng cả khi chọn điểm nối vào đường. Nét đứt chỉ là đoạn nối thẳng chưa xác nhận lối đi; độ dài kết quả chỉ tính phần theo đường. Bấm Xem A, B và tuyến để đưa cả tuyến đường vào khung nhìn; trên điện thoại, mở lại chi tiết bằng nút mở rộng.'
        },
        {
          icon: 'layers',
          title: 'Lớp bản đồ',
          text: 'Đổi nền ảnh vệ tinh hoặc địa hình, bật tắt từng nhóm dữ liệu.'
        },
        {
          icon: 'ruler',
          title: 'Đo',
          text: 'Đo khoảng cách và diện tích trên bản đồ 2D.'
        },
        {
          icon: 'location',
          title: 'Vị trí',
          text: 'Bấm một điểm trên bản đồ để xem tọa độ và cao độ.'
        },
        {
          icon: 'fit',
          title: '2D và 3D',
          text: 'Chuyển chế độ ở góc phải thanh công cụ. Trong 3D, giữ Ctrl và kéo để nghiêng, xoay.'
        }
      ]
    },
    {
      id: 'gis',
      audience: 'manager',
      title: 'Dữ liệu GIS và ảnh',
      image: 'guide/gis.jpg',
      steps: [
        {
          icon: 'polygon',
          title: 'Mở GIS',
          text: 'Bấm GIS trên thanh công cụ bản đồ.'
        },
        {
          icon: 'edit',
          title: 'Sửa đối tượng ứng phó',
          text: 'Chọn sự cố, bãi đáp, địa bàn hoặc đoạn đường trên bản đồ ứng phó rồi bấm Sửa trong GIS. Trong GIS, chọn đối tượng từ danh sách thu gọn; các điểm chưa xác minh hoặc bãi đáp chưa khảo sát có thể lọc riêng. Đổi tên, nhãn, loại sự cố hoặc vị trí; ghi lý do và xác nhận trước khi lưu.'
        },
        {
          icon: 'plus',
          title: 'Thêm sự cố và bãi đáp',
          text: 'Trong Đối tượng ứng phó, bấm Thêm sự cố hoặc Thêm bãi đáp. Chọn vị trí trên bản đồ, hoặc dán vĩ độ, kinh độ WGS84; ghi tên và nguồn. Bãi đáp mới chưa khảo sát. Thêm sự cố không tự đổi tình trạng đường: kiểm tra và cập nhật đoạn đường riêng.'
        },
        {
          icon: 'plus',
          title: 'Nhập dữ liệu tham chiếu',
          text: 'Thêm điểm bằng cách chọn trên bản đồ hoặc nhập tọa độ. Cũng có thể nhập KML, GeoJSON, WKT. Dữ liệu nhập và đối tượng ứng phó nằm trong hai nhóm riêng; điểm tham chiếu không tự trở thành sự cố đã xác minh.'
        },
        {
          icon: 'image',
          title: 'Nhóm điểm gần nhau',
          text: 'Ở mục Hiển thị điểm, chọn Gom điểm gần nhau rồi bấm nhóm điểm để xem danh sách và ảnh. Chọn Hiện từng điểm để xem từng tọa độ gốc.'
        },
        {
          icon: 'area',
          title: 'Khoanh vùng sạt lở',
          text: 'Trong mục Vùng sạt lở, chọn Khoanh vùng nguy cơ hoặc Khoanh vết sạt lở. Vẽ ranh giới, ghi nguồn và căn cứ, rồi chọn đường liên quan. Chọn hai đầu trên bản đồ nếu chỉ một phần đường bị ảnh hưởng. Tình trạng đường được đánh giá riêng; bấm Áp dụng thay đổi để dùng chung bản nháp.'
        },
        {
          icon: 'area',
          title: 'Ghi nhận và vùng ảnh hưởng',
          text: 'Chọn một điểm để thêm ghi nhận, ảnh và vẽ vùng nghi ảnh hưởng gắn với điểm.'
        }
      ]
    },
    {
      id: 'save',
      audience: 'manager',
      title: 'Lưu và xuất',
      image: 'guide/save.jpg',
      steps: [
        {
          icon: 'download',
          title: 'Xuất đánh giá',
          text: 'Trong hồ sơ địa bàn, chọn Xuất đánh giá để xem trước và tải tệp đánh giá.'
        },
        {
          icon: 'download',
          title: 'Xuất dữ liệu GIS',
          text: 'Trong GIS, chọn phạm vi ở Xuất dữ liệu rồi bấm GeoJSON hoặc KML.'
        },
        {
          icon: 'settings',
          title: 'Cài đặt',
          text: 'Đổi giao diện sáng/tối, phông chữ, ngôn ngữ hoặc đặt lại phiên làm việc.'
        },
        {
          icon: 'info',
          title: 'Sao lưu',
          text: 'Dữ liệu lưu trong trình duyệt này. Xuất bản sao trước khi xóa dữ liệu trình duyệt.'
        }
      ]
    },
    {
      id: 'residentRoads',
      audience: 'resident',
      title: 'Xem thông tin đường',
      image: 'guide/resident-roads.jpg',
      steps: [
        {
          icon: 'people',
          title: 'Chọn khu vực',
          text: 'Chọn Thông tin đường ở thanh dưới. Trong xã hiển thị mạng đường và địa điểm Chế Tạo; Đường về thôn, bản hiển thị các tuyến đã công bố.'
        },
        {
          icon: 'blocked',
          title: 'Xem đường nên đi',
          text: 'Đi theo đường xanh dương. Trong xã, đoạn màu cam khó đi nhưng vẫn qua được. Đường đỏ bị chặn. Chạm vùng sạt lở để xem thông tin. Nút Hiển thị có chú giải đầy đủ.'
        },
        {
          icon: 'route',
          title: 'Tìm đường giữa hai nơi khác',
          text: 'Chọn nơi đi và nơi đến, hoặc dùng Vị trí của tôi. Bấm Xem trên bản đồ. Chụm hai ngón để phóng bản đồ.'
        }
      ]
    },
    {
      id: 'residentReport',
      audience: 'resident',
      title: 'Gửi ảnh và ghi nhận',
      image: 'guide/resident-report.jpg',
      steps: [
        {
          icon: 'image',
          title: 'Thêm ảnh',
          text: 'Kéo thả hoặc bấm để chọn tối đa 3 ảnh. Vị trí và giờ chụp trong ảnh được điền tự động.'
        },
        {
          icon: 'location',
          title: 'Kiểm tra vị trí',
          text: 'Nếu vị trí chưa đúng, dùng Vị trí của tôi, chọn trên bản đồ hoặc nhập tọa độ.'
        },
        {
          icon: 'check',
          title: 'Gửi',
          text: 'Bấm Gửi ghi nhận. Ghi nhận chuyển sang tab Đã gửi.'
        }
      ]
    },
    {
      id: 'residentMine',
      audience: 'resident',
      title: 'Theo dõi ghi nhận',
      image: 'guide/resident-mine.jpg',
      steps: [
        {
          icon: 'image',
          title: 'Xem trạng thái',
          text: 'Mỗi ghi nhận có nhãn Chờ kiểm tra, Đã kiểm tra hoặc Cần bổ sung.'
        },
        {
          icon: 'edit',
          title: 'Bổ sung thông tin',
          text: 'Bấm vào ghi nhận rồi chọn Sửa ghi nhận khi cần thêm ảnh hoặc mô tả.'
        }
      ]
    }
  ]
};
