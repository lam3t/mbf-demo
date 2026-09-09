# PA04 - Hệ thống Quản lý Đăng ký và Kiểm tra Tổ chức, Cá nhân Kinh doanh

> **Demo Full-Stack Monorepo** phục vụ Phòng An ninh Kinh tế (PA04) - Công an TP Hà Nội và Công an các xã/phường trên địa bàn Thủ đô.
> Xây dựng theo đầy đủ yêu cầu nghiệp vụ trong tài liệu SRS (FR-A, FR-B, FR-C, FR-D và các quy tắc kiểm soát nghiệp vụ RULE-01, RULE-02, RULE-03).

---

## 1. Công nghệ Sử dụng

- **Frontend (`/frontend`)**: Angular 18 (Standalone Components, Angular Material, SCSS Design System CIDS, Leaflet + OpenStreetMap online, Chart.js).
- **Backend (`/backend`)**: Node.js + TypeScript + Express (Phân tầng Controller/Middleware/Routes, SQLite file-based qua `node:sqlite`/`better-sqlite3`, JWT Auth, Multer upload file bằng chứng, ExcelJS xuất báo cáo).
- **Monorepo Root**: Quản lý song song bằng `concurrently`, khởi động cả hệ thống chỉ với 1 lệnh.

---

## 2. Hướng dẫn Cài đặt & Khởi động

### Bước 1: Cài đặt Dependencies
Chạy lệnh sau tại thư mục gốc của dự án:
```bash
# Cài đặt đồng thời cho Root, Backend và Frontend
npm run install:all
```
*(Hoặc `npm install` tại thư mục root, `cd backend && npm install`, `cd ../frontend && npm install`).*

### Bước 2: Khởi tạo CSDL & Seed Dữ liệu Mẫu
```bash
npm run seed
```
> Lệnh này sẽ khởi tạo CSDL SQLite `backend/pa04.db` và nạp sẵn:
> - **4 Tài khoản demo**: `admin`, `leader`, `officer1`, `ward1` (mật khẩu chung: `123456`).
> - **4 Danh mục vi phạm** (`L01` đến `L04`) & **4 Thẻ lĩnh vực kiến nghị** (`THUE`, `DAT_DAI`, `MOI_TRUONG`, `ANTT`).
> - **Cấu hình Quota Quý II/2026** cho 5 phường (Min: 30, Max: 100 cơ sở) & **Hạn chốt sổ Cut-off**.
> - **28 Đối tượng kinh doanh** (Doanh nghiệp, Hộ KD, Cá nhân) phân bổ đều tại 5 phường: Hoàn Kiếm, Ba Đình, Đống Đa, Hai Bà Trưng, Cầu Giấy.
> - **28 Hồ sơ kiểm tra thực địa** với tọa độ thật và các mức độ vi phạm để tạo điểm nóng (Hotspots) rõ rệt trên Bản đồ nhiệt Heatmap.

### Bước 3: Khởi động Ứng dụng
Tại thư mục gốc:
```bash
npm run dev
```

Hệ thống tự động chạy trên 2 cổng:
- 🌐 **Frontend Application**: [http://localhost:4200](http://localhost:4200)
- 🔌 **Backend REST API**: [http://localhost:3000/api](http://localhost:3000/api)
- 🩺 **Health Check Endpoint**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 3. Danh sách 4 Tài khoản Demo

| Tên đăng nhập | Mật khẩu | Vai trò (Role) | Đơn vị phụ trách | Quyền hạn chính |
| :--- | :---: | :--- | :--- | :--- |
| `ward1` | `123456` | `officer_ward` | Phường Hoàn Kiếm | Nhập đối tượng, cảnh báo trùng, lập giỏ kế hoạch, kiểm tra thực địa |
| `officer1` | `123456` | `officer_pa04` | Phòng PA04 - Hà Nội | Rà soát kế hoạch toàn thành phố, ma trận phê duyệt, giám sát thực địa |
| `leader` | `123456` | `leader_pa04` | Lãnh đạo PA04 | Phê duyệt kế hoạch, chỉ huy điều hành BI Dashboard, xem bản đồ nhiệt |
| `admin` | `123456` | `admin` | PA04 - Quản trị | Quản trị tài khoản, phân quyền, cấu hình Quota/Cut-off, Audit Logs |

*(Tại trang [http://localhost:4200/login](http://localhost:4200/login), đã tích hợp sẵn **4 nút Đăng nhập nhanh**, bấm 1 click để chuyển đổi tức thì giữa các vai trò).*

---

## 4. Kịch bản Demo 5 Phút (End-to-End Walkthrough)

Dưới đây là thứ tự các bước thao tác để trình diễn trọn vẹn vòng đời nghiệp vụ từ cấp cơ sở đến lãnh đạo thành phố:

### 🔹 BƯỚC 1: Cán bộ Phường Đăng ký Đối tượng & Cảnh báo Trùng (Phân hệ A)
1. Mở [http://localhost:4200/login](http://localhost:4200/login), bấm nút **"Cán bộ Phường (ward1)"**.
2. Vào menu **"Quản lý đối tượng"** (`/objects`):
   - Bấm nút **"Thêm mới đối tượng"**.
   - Nhập MST `0101234567` $\rightarrow$ Hệ thống lập tức hiển thị cảnh báo đỏ: *"Đối tượng đã được đưa vào kế hoạch kiểm tra của Phường Hoàn Kiếm trong năm nay (RULE-01)"*.
   - Đổi sang loại hình *"Hộ kinh doanh"*, nhập CCCD hợp lệ (12 chữ số), nhập tên cơ sở mới $\rightarrow$ Bấm Lưu thành công.

### 🔹 BƯỚC 2: Lập Giỏ Kế hoạch & Kiểm tra Quota / Cut-off (Phân hệ B)
1. Vào menu **"Lập kế hoạch & Phê duyệt"** (`/plans`):
   - Xem góc trên: **Banner Quota** cảnh báo màu vàng (Chưa đạt chỉ tiêu tối thiểu 30 cơ sở).
   - Xem đồng hồ đếm ngược **Hạn chốt sổ Cut-off Quý II/2026**.
   - Bấm nút **"Thêm đối tượng vào giỏ"** $\rightarrow$ Tích chọn các cơ sở kinh doanh đưa vào giỏ kế hoạch.
   - Bấm **"Trình duyệt Kế hoạch lên PA04"** $\rightarrow$ Kế hoạch chuyển trạng thái sang `pending` (Chờ phê duyệt).

### 🔹 BƯỚC 3: Lãnh đạo PA04 Phê duyệt Kế hoạch (Ma trận Phê duyệt)
1. Bấm avatar góc phải $\rightarrow$ Đăng xuất $\rightarrow$ Bấm nút **"Lãnh đạo PA04 (leader)"**.
2. Vào menu **"Lập kế hoạch & Phê duyệt"** (`/plans`):
   - Chuyển sang chế độ **"Ma trận Phê duyệt PA04"** (`?view=matrix`).
   - Danh sách hiển thị toàn bộ cơ sở từ các phường đang chờ duyệt.
   - Tích chọn các cơ sở $\rightarrow$ Bấm **"Duyệt các mục đã chọn"** $\rightarrow$ Trạng thái chuyển sang `approved`, đồng thời hệ thống tự động sinh các bản ghi hồ sơ kiểm tra thực địa (`status = 'not_started'`).

### 🔹 BƯỚC 4: Kiểm tra Thực địa, Áp mã Vi phạm & Khóa Hồ sơ RULE-03 (Phân hệ C)
1. Chuyển sang tài khoản **"Cán bộ Phường (ward1)"** hoặc **"Chuyên viên PA04 (officer1)"**.
2. Vào menu **"Giám sát thực địa"** (`/inspections`):
   - Mở 1 hồ sơ ở trạng thái *Chưa kiểm tra* $\rightarrow$ Bấm **"Kiểm tra thực địa"**.
   - Trong biểu mẫu Checklist: Bấm *"Không đạt"* ở tiêu chí PCCC và Niêm yết giá $\rightarrow$ Khối *"Ghi nhận Lỗi Vi phạm & Mức độ"* tự động mở ra.
   - Chọn mức độ nghiêm trọng (Mức 2 - Trung bình), tích chọn mã lỗi `L02` (Vi phạm PCCC) và `L04` (Không niêm yết giá).
   - Chọn thẻ lĩnh vực kiến nghị `PCCC`, `THUE` và nhập nội dung đề xuất xử lý.
   - Bấm *"Điền tọa độ mẫu"* hoặc *"Lấy GPS hiện tại"* $\rightarrow$ Hệ thống tự động nhận diện khớp địa bàn Phường.
   - Bấm **"Kết thúc kiểm tra & Khóa hồ sơ"** $\rightarrow$ Xác nhận trên hộp thoại cảnh báo.
   - Mở lại hồ sơ vừa hoàn thành $\rightarrow$ Banner **"HỒ SƠ ĐÃ ĐƯỢC CHỐT KẾT QUẢ VÀ KHÓA DỮ LIỆU (RULE-03)"** hiển thị, toàn bộ dữ liệu ở chế độ chỉ đọc.

### 🔹 BƯỚC 5: BI Dashboard, Bản đồ Nhiệt Heatmap & Xuất Báo cáo (Phân hệ D)
1. Đăng nhập lại với tài khoản **"Lãnh đạo PA04 (leader)"**.
2. Vào **"Dashboard"** (`/dashboard`):
   - Xem **Radial Gauge** tròn lớn hiển thị tỷ lệ % hoàn thành so với mục tiêu 9,960 cơ sở toàn thành phố.
   - Xem biểu đồ đường Line Chart tiến độ theo ngày và biểu đồ tròn Donut Chart tỷ lệ tuân thủ pháp luật.
   - Xem bảng xếp hạng top phường cần đôn đốc tiến độ.
3. Vào **"Bản đồ vi phạm"** (`/map`):
   - Bản đồ Leaflet OpenStreetMap hiển thị vùng nhiệt (Heatmap) đỏ đậm tại khu vực Hoàn Kiếm, Ba Đình, Đống Đa.
   - Bấm vào cụm Marker Cluster để phóng to, click từng điểm vi phạm để xem popup và nút *"Xem chi tiết hồ sơ"*.
   - Bật/tắt thử lớp Heatmap và lọc theo loại vi phạm `L02`.
4. Vào **"Báo cáo"** (`/reports`):
   - Xem Tab 1 *"Kiến nghị theo lĩnh vực"* và Tab 2 *"Tổng kết quý"*.
   - Bấm nút **"Xuất Báo cáo Excel (.xlsx)"** $\rightarrow$ File Excel chuẩn định dạng OpenXML được tải về máy tính.

---

## 5. Danh mục Endpoints REST API Chính

| Phân hệ | Endpoint | Method | Chức năng |
| :--- | :--- | :---: | :--- |
| **Auth** | `/api/auth/login` | `POST` | Đăng nhập JWT authentication |
| **Objects** | `/api/objects` | `GET/POST` | Danh sách & Tạo đối tượng kinh doanh |
| | `/api/objects/check/:idOrTaxCode` | `GET` | Kiểm tra tồn tại & cảnh báo khóa kế hoạch (RULE-01) |
| **Plans** | `/api/plans` | `GET/POST` | Danh sách & Tạo kế hoạch nháp |
| | `/api/plans/:id/quota-check` | `GET` | Kiểm tra định ngạch Quota (min/max) |
| | `/api/plans/:id/submit` | `POST` | Trình duyệt kế hoạch (Kiểm tra Cut-off time) |
| | `/api/plans/:id/approve` | `POST` | Phê duyệt kế hoạch $\rightarrow$ Tự động sinh Inspections |
| | `/api/plans/approve-bulk` | `POST` | Phê duyệt hàng loạt từ ma trận PA04 |
| **Inspections** | `/api/inspections` | `GET` | Danh sách hồ sơ kiểm tra (tự tính `isOverdue` > 30 ngày) |
| | `/api/inspections/:id` | `GET/PUT` | Chi tiết & Cập nhật checklist (**Chặn 403 nếu locked - RULE-03**) |
| | `/api/inspections/:id/evidence` | `POST` | Upload file ảnh/scan bằng chứng (Multer 5MB) |
| | `/api/inspections/:id/complete` | `POST` | Chốt kết quả, khóa hồ sơ (`isLocked = 1`) & cập nhật `lastCheckedYear` |
| **BI & Map** | `/api/dashboard/summary` | `GET` | Chỉ số tổng quan mục tiêu (9960), KPI, phân bổ phường |
| | `/api/dashboard/progress-by-day` | `GET` | Chuỗi tiến độ thực hiện theo thời gian |
| | `/api/dashboard/compliance-pie` | `GET` | Cơ cấu nhóm tuân thủ (Tốt / Vi phạm / Đình chỉ) |
| | `/api/dashboard/violations-geo` | `GET` | Dữ liệu tọa độ vi phạm phục vụ Heatmap & Cluster |
| **Reports** | `/api/reports/recommendations/export` | `GET` | Xuất file Excel danh sách kiến nghị (ExcelJS) |
| | `/api/reports/quarterly/export` | `GET` | Xuất file Excel tổng kết quý theo địa bàn (ExcelJS) |
| **Admin** | `/api/users` | `GET/POST/PUT` | Quản lý người dùng & Phân quyền |
| | `/api/configs/quota` | `GET/PUT` | Cấu hình định ngạch Quota từng phường |
| | `/api/configs/cutoff` | `GET/PUT` | Cấu hình thời hạn chốt sổ Cut-off |
| | `/api/audit-logs` | `GET` | Nhật ký ghi vết tự động (Audit Logs) |

---

## 6. Xử lý Lỗi & Kiểm thử

- Dự án có đầy đủ các trang báo lỗi thân thiện:
  - `404 Not Found` (`/404` và mọi đường dẫn không tồn tại).
  - `403 Forbidden` (`/forbidden` khi tài khoản không đủ quyền hạn).
- Đảm bảo kiểm tra toàn bộ luồng theo Kịch bản 5 Phút ở trên để thấy rõ tính liên kết chặt chẽ giữa các phân hệ.
