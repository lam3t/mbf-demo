# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Hệ thống Quản lý Đăng ký và Kiểm tra Tổ chức, Cá nhân Kinh doanh (PA04)
### Bản demo — Frontend Angular / Backend Node.js

**Phiên bản:** 1.0 (Demo Scope)
**Ngày:** 09/09/2026
**Nguồn tham chiếu:** Tài liệu Tổng quan Dự án PA04, WBS chức năng (wbs.xlsx), Giao diện tham khảo CIDS (danh sách/dashboard)

---

## 1. GIỚI THIỆU

### 1.1 Mục đích
Tài liệu này đặc tả yêu cầu phần mềm cho bản **demo** của Hệ thống Quản lý Đăng ký và Kiểm tra Tổ chức, Cá nhân Kinh doanh, phục vụ Công an Thành phố Hà Nội (PA04) và Công an 126 xã/phường. Tài liệu dùng làm đầu vào để dựng ứng dụng bằng công cụ lập trình AI (Antigravity) với ngăn xếp công nghệ **Angular (frontend)** và **Node.js (backend)**.

### 1.2 Phạm vi demo
- Xây dựng đầy đủ luồng nghiệp vụ chính: Đăng ký đối tượng → Lập kế hoạch → Phê duyệt → Kiểm tra thực địa → Dashboard/Báo cáo.
- **Không** triển khai bản đồ offline/TileServer nội bộ (.mbtiles). Thay vào đó dùng **bản đồ online** (OpenStreetMap qua thư viện Leaflet) để mô phỏng đầy đủ tính năng chấm tọa độ, popup vi phạm, heatmap, lọc theo khu vực — tương đương mục 6 trong WBS nhưng dùng tile online.
- Dữ liệu demo dùng **mock/seed data** (JSON hoặc SQLite), không cần tích hợp CSDL doanh nghiệp quốc gia thật, không cần xác thực CCCD/MST thật (giả lập bằng dữ liệu mẫu + rule kiểm tra trùng lặp nội bộ).
- Không yêu cầu triển khai hạ tầng production, bảo mật cấp độ nhà nước, ký số, hay tích hợp LGSP/VNeID — các mục này chỉ nêu như ghi chú "out of scope" để người dùng demo hiểu giới hạn.

### 1.3 Đối tượng sử dụng tài liệu
Dùng cho: kỹ sư prompt / AI coding agent (Antigravity), lập trình viên rà soát lại, và người trình demo cho khách hàng PA04.

### 1.4 Định nghĩa, từ viết tắt
| Từ viết tắt | Ý nghĩa |
|---|---|
| MST | Mã số thuế |
| CCCD | Căn cước công dân |
| ĐKKD | Đăng ký kinh doanh |
| PA04 | Phòng An ninh kinh tế – Công an TP Hà Nội (đơn vị chủ quản, cấp duyệt) |
| Xã/Phường | Đơn vị Công an cấp cơ sở (cấp nhập liệu, thực thi) |
| Single Check | Nguyên tắc mỗi đối tượng chỉ bị kiểm tra tối đa 1 lần/năm |
| Hot zone | Vùng có mật độ vi phạm cao trên bản đồ nhiệt |

---

## 2. TỔNG QUAN HỆ THỐNG

### 2.1 Bối cảnh nghiệp vụ
Công an TP Hà Nội cần quản lý ~9.960 đối tượng kinh doanh (Quý II/2026, tăng dần các quý sau) trên 126 xã/phường, tránh chồng chéo kiểm tra, đảm bảo minh bạch, và giám sát tiến độ real-time cho lãnh đạo PA04.

### 2.2 Vai trò người dùng (Role-based access)
| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| **Admin hệ thống** | Quản trị chung | Quản lý người dùng, phân quyền, danh mục, cấu hình quota/cut-off, xem audit log |
| **Lãnh đạo PA04** | Cấp phê duyệt cao nhất | Xem toàn bộ Dashboard, phê duyệt/từ chối kế hoạch, xuất báo cáo |
| **Cán bộ PA04** | Nghiệp vụ cấp thành phố | Rà soát trùng lặp toàn thành phố, thao tác ma trận phê duyệt |
| **Cán bộ Xã/Phường** | Nghiệp vụ cấp cơ sở | Nhập đối tượng, lập giỏ kế hoạch, trình duyệt, kiểm tra thực địa, ghi nhận kết quả/kiến nghị |

### 2.3 Kiến trúc tổng thể (đề xuất cho demo)

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  ANGULAR 18+ (Standalone)    │  REST  │   NODE.JS (Express/NestJS)    │
│  - Angular Material UI       │ <----> │   - Auth (JWT)                │
│  - Leaflet (bản đồ online)   │  API   │   - REST API modules A/B/C/D  │
│  - ngx-charts / Chart.js     │  JSON  │   - Business rule engine      │
│  - RxJS state (Signal/Store) │        │   - SQLite/lowdb (demo DB)    │
└─────────────────────────────┘        └──────────────────────────────┘
                                                  │
                                        ┌─────────▼─────────┐
                                        │  Seed data JSON /  │
                                        │  SQLite file       │
                                        └────────────────────┘
```

- **Frontend:** Angular 18 (standalone components), Angular Material (layout/table/dialog/badge), Leaflet + `leaflet.heat` cho bản đồ nhiệt online, ngx-charts hoặc Chart.js cho gauge/pie/bar.
- **Backend:** Node.js + Express (hoặc NestJS nếu muốn cấu trúc module rõ ràng), TypeScript, JWT auth đơn giản, SQLite (better-sqlite3) hoặc lowdb cho tốc độ dựng demo nhanh, Multer cho upload ảnh bằng chứng.
- **Không cần** message queue, microservices, Redis, Docker Swarm/K8s cho bản demo — chỉ 1 BE + 1 FE chạy local hoặc 1 VM demo.

### 2.4 Phong cách giao diện tham khảo
Theo ảnh giao diện CIDS đính kèm, áp dụng các mẫu UI sau xuyên suốt ứng dụng:
- **Sidebar trái** thu gọn được (collapse), logo trên cùng, menu icon + label, menu con thụt lề khi hover/active có nền xanh nhạt.
- **Thanh tab ngang trên cùng** (VD: Dashboard / Danh sách / Báo cáo) với gạch chân xanh cho tab active.
- **Header phải:** cờ ngôn ngữ, chuông thông báo (badge số), avatar tròn.
- **Khối tiêu đề trang:** tiêu đề lớn + dòng phụ đề số lượng bản ghi, các nút hành động chính (nút xanh đậm) nằm bên phải.
- **Thanh tìm kiếm + nút Bộ lọc** ngay dưới tiêu đề.
- **Thanh tab trạng thái dạng pill** (Tất cả / Mới / Đang thực hiện / Chờ duyệt / Phê duyệt / Trúng / Đóng) kèm số đếm, tab active có nền xanh đậm chữ trắng, còn lại là chữ màu theo trạng thái.
- **Bảng dữ liệu:** checkbox chọn dòng, cột "Thao tác" dạng menu 3 chấm, badge trạng thái bo tròn màu theo ngữ nghĩa (xanh lá = mới/tốt, xanh dương = đang xử lý, cam = chờ, tím = đã duyệt, đỏ = đóng/vi phạm).

Áp dụng tương tự cho các màn hình: Danh sách đối tượng, Danh sách kế hoạch quý, Ma trận phê duyệt, Danh sách hồ sơ kiểm tra thực địa, Danh sách kiến nghị.

---

## 3. YÊU CẦU CHỨC NĂNG CHI TIẾT

> Đánh số FR-x.y theo phân hệ, bám sát WBS gốc, lược bỏ mục 6 (bản đồ offline) và thay bằng bản đồ online tại FR-4.

### PHÂN HỆ 0 — QUẢN TRỊ HỆ THỐNG

| ID | Chức năng | Mô tả | Ghi chú demo |
|---|---|---|---|
| FR-0.1 | Đăng nhập | Đăng nhập bằng tài khoản/mật khẩu, trả JWT | Seed 4 tài khoản demo tương ứng 4 vai trò |
| FR-0.2 | Đổi mật khẩu | Người dùng tự đổi mật khẩu, validate độ mạnh | Rule đơn giản: ≥8 ký tự, có số |
| FR-0.3 | Danh sách người dùng | Bảng danh sách, lọc theo đơn vị (Xã/Phường/Phòng) | Theo mẫu bảng ở ảnh tham khảo |
| FR-0.4 | Thêm/Sửa người dùng | Form thêm/sửa cán bộ (họ tên, chức vụ, đơn vị, vai trò) | — |
| FR-0.5 | Khóa/Mở khóa tài khoản | Toggle trạng thái active | Badge trạng thái màu |
| FR-0.6 | Nhóm quyền (Roles) | Danh sách 3 nhóm: Lãnh đạo PA04, Cán bộ PA04, Cán bộ Phường | Có thể hard-code 3 role cho demo, không cần builder quyền động phức tạp |
| FR-0.7 | Gán quyền | Gán 1 user vào 1 role | Dropdown đơn giản |
| FR-0.8 | Danh mục lỗi vi phạm | CRUD danh mục (Lỗi 01 - Không có ĐKKD, Lỗi 02 - Vi phạm PCCC, …) | Dùng lại ở Phân hệ C |
| FR-0.9 | Danh mục lĩnh vực kiến nghị | CRUD tag: Thuế, Đất đai, Môi trường, ANTT | Dùng lại ở Phân hệ C |
| FR-0.10 | Cấu hình Quota | Thiết lập min/max cơ sở theo từng Xã/Phường theo quý | Bảng cấu hình đơn giản |
| FR-0.11 | Cấu hình Cut-off Time | Thiết lập ngày giờ khóa cổng đăng ký theo quý | Date-time picker; job kiểm tra so hiện tại |
| FR-0.12 | Audit Log | Ghi log mọi hành động tạo/sửa/xóa/duyệt | Bảng log đơn giản: user, action, entity, thời gian |

### PHÂN HỆ A — QUẢN LÝ ĐỐI TƯỢNG (Danh mục nền)

| ID | Chức năng | Mô tả | Ghi chú demo |
|---|---|---|---|
| FR-A.1 | Nhập đối tượng đơn lẻ | Form nhập theo 3 loại: Doanh nghiệp (MST-khóa chính), Hộ kinh doanh (CCCD chủ hộ-khóa chính), Cá nhân kinh doanh (CCCD-khóa chính) | 3 tab/loại hình trong 1 form động |
| FR-A.2 | On-typing validation | Khi gõ đủ 10 số MST hoặc 12 số CCCD, gọi API kiểm tra tồn tại | Debounce 400ms, gọi `GET /api/objects/check/:id` |
| FR-A.3 | Auto-fill | Nếu đối tượng tồn tại, tự điền Tên/Địa chỉ/Người đại diện, khóa các field đã điền | — |
| FR-A.4 | Cảnh báo trùng kế hoạch | Nếu MST/CCCD đã thuộc kế hoạch phường khác trong năm hiện tại → cảnh báo đỏ, disable nút Lưu | Thông báo dạng banner đỏ đúng câu nghiệp vụ: "Đối tượng đã thuộc quản lý kế hoạch kiểm tra của Phường A - Không được phép thêm mới" |
| FR-A.5 | Import hàng loạt | Tải file mẫu Excel/CSV, upload, xem trước, xác nhận import | Dùng thư viện `xlsx`/`papaparse`; validate field bắt buộc theo loại đối tượng |
| FR-A.6 | Báo lỗi sau import | Danh sách dòng lỗi (trùng lặp/sai định dạng) để sửa & re-import | Trả về mảng lỗi kèm số dòng |
| FR-A.7 | Danh sách đối tượng | Bảng danh sách có filter loại hình, trạng thái, đơn vị quản lý, tìm kiếm | Theo mẫu UI tham khảo (tabs trạng thái + bảng) |
| FR-A.8 | Rule 01 | Khóa đăng ký với DN đã có lịch sử kiểm tra "Hoàn thành" trong năm tài chính hiện tại | Kiểm tra ở backend trước khi cho thêm vào giỏ kế hoạch |

### PHÂN HỆ B — LẬP KẾ HOẠCH & PHÊ DUYỆT

| ID | Chức năng | Mô tả | Ghi chú demo |
|---|---|---|---|
| FR-B.1 | Giỏ kế hoạch (Planning Cart) | Chọn nhiều đối tượng từ danh mục A để thêm vào kế hoạch quý (giống giỏ hàng) | UI dạng "add to cart" + badge số lượng |
| FR-B.2 | Kiểm tra Quota | Cảnh báo nếu số lượng đăng ký < min hoặc > max cấu hình ở FR-0.10 | Banner cảnh báo vàng/đỏ theo ngưỡng |
| FR-B.3 | Trình duyệt | Gửi giỏ kế hoạch lên PA04, chuyển trạng thái "Chờ phê duyệt" | — |
| FR-B.4 | Khóa cổng đăng ký (Cut-off) | Sau thời điểm cấu hình, disable nút trình duyệt, hiển thị đếm ngược | Cron/kiểm tra thời gian phía backend + frontend hiển thị |
| FR-B.5 | Ma trận phê duyệt (Grid) | PA04 xem danh sách dạng lưới, tick chọn nhiều dòng để duyệt hàng loạt | Table + checkbox + nút "Duyệt các mục đã chọn" |
| FR-B.6 | Phê duyệt (Approve) | Chuyển trạng thái "Đã duyệt", ghi audit log | — |
| FR-B.7 | Từ chối (Reject) | Bắt buộc nhập lý do (textarea), trả hồ sơ về "Bản nháp" cho phường sửa | Modal nhập lý do, validate not-empty |
| FR-B.8 | Danh sách kế hoạch theo Quý | Bảng danh sách kế hoạch, filter theo quý/đơn vị/trạng thái, tabs trạng thái pill giống ảnh tham khảo | Trạng thái: Nháp / Chờ phê duyệt / Đã duyệt / Từ chối |

### PHÂN HỆ C — GIÁM SÁT THỰC ĐỊA

| ID | Chức năng | Mô tả | Ghi chú demo |
|---|---|---|---|
| FR-C.1 | Biểu mẫu động (Checklist) | Danh sách tiêu chí pháp luật dạng Đạt/Không đạt (checkbox), không cho nhập tự do | Checklist cấu hình sẵn theo loại kiểm tra |
| FR-C.2 | Áp mã vi phạm | Dropdown chọn lỗi từ danh mục FR-0.8 khi có tiêu chí "Không đạt" | Hiện field khi có ít nhất 1 lỗi |
| FR-C.3 | Đính kèm bằng chứng | Upload ảnh/scan biên bản, giới hạn 5MB/file, hiển thị thumbnail | Lưu file local `/uploads` cho demo |
| FR-C.4 | Ghi nhận kiến nghị | Textarea nhập vướng mắc doanh nghiệp | — |
| FR-C.5 | Gắn thẻ lĩnh vực | Multi-select tag: Thuế, Đất đai, Môi trường, ANTT | Dùng danh mục FR-0.9 |
| FR-C.6 | Kết thúc kiểm tra | Nút "Chốt hồ sơ", chuyển trạng thái "Hoàn thành" | — |
| FR-C.7 | Rule 03 — Khóa dữ liệu | Sau khi chốt, toàn bộ field của hồ sơ chuyển read-only, backend chặn PUT/PATCH | Kiểm tra trạng thái ở middleware backend |
| FR-C.8 | Danh sách hồ sơ kiểm tra | Bảng danh sách + tabs trạng thái (Chưa kiểm tra/Đang kiểm tra/Hoàn thành/Quá hạn) | Theo mẫu UI tham khảo |
| FR-C.9 | Danh sách kiến nghị | Bảng riêng liệt kê kiến nghị theo lĩnh vực, dùng cho Phân hệ D xuất báo cáo | — |

### PHÂN HỆ D — BI DASHBOARD & BÁO CÁO

| ID | Chức năng | Mô tả | Ghi chú demo |
|---|---|---|---|
| FR-D.1 | Gauge tiến độ tổng | Biểu đồ đồng hồ % hoàn thành trên mục tiêu 9.960 đối tượng | ngx-charts Gauge hoặc Chart.js doughnut tùy biến |
| FR-D.2 | Bảng xếp hạng quá hạn | Top 5 Xã/Phường chậm tiến độ, hàng bôi đỏ | Table sort theo % hoàn thành tăng dần |
| FR-D.3 | Pie chart chấp hành | Tỷ lệ Tốt (xanh) / Vi phạm (cam) / Đình chỉ (đỏ) | — |
| FR-D.4 | Bản đồ nhiệt vi phạm (ONLINE) | Overlay heatmap trên bản đồ Hà Nội dùng Leaflet + OpenStreetMap tile online, chấm tọa độ tự động khi có biên bản vi phạm mới | Thay thế mục 6 WBS (bỏ TileServer offline); dùng `leaflet.heat` |
| FR-D.5 | Lọc Hot zone động | Lọc theo thời gian (tuần/tháng/quý), loại vi phạm, quận/huyện; vẽ lại heatmap | Filter panel bên cạnh bản đồ |
| FR-D.6 | Tùy chỉnh tham số nhiệt | Slider chỉnh Radius, Blur, Max intensity của heatmap | Optional — nếu còn thời gian, có thể để mặc định cho demo |
| FR-D.7 | Click khu vực xem chi tiết | Click vào cụm/khu vực trên bản đồ → popup danh sách cơ sở vi phạm tại đó | Dùng `leaflet.markercluster` cho gom cụm đơn giản thay thuật toán clustering phức tạp |
| FR-D.8 | Xuất báo cáo kiến nghị | Xuất Excel/PDF tổng hợp kiến nghị theo lĩnh vực | Dùng `exceljs`/`pdfkit` ở backend |
| FR-D.9 | Xuất báo cáo tổng kết quý | Xuất Excel/PDF kết quả kiểm tra theo quý | — |
| FR-D.10 | Biểu đồ tiến độ theo thời gian | Line chart % hoàn thành theo ngày (giống ảnh dashboard mẫu trong tài liệu) | — |
| FR-D.11 | Bộ đếm thống kê nổi bật | Các thẻ số liệu: Xã/phường hoàn thành, đang thực hiện, nhiệm vụ quá hạn, tổng nhiệm vụ | Thẻ dạng card icon + số + % so với hôm qua (dữ liệu giả lập tĩnh) |

### QUY TẮC HỆ THỐNG (Áp dụng xuyên suốt)

| ID | Quy tắc |
|---|---|
| RULE-01 | Khóa đăng ký đối tượng đã có kiểm tra "Hoàn thành" trong năm tài chính hiện tại |
| RULE-02 | Cảnh báo tự động cho PA04 nếu số đăng ký của 1 đơn vị vượt/thấp hơn Quota |
| RULE-03 | Dữ liệu sau "Kết thúc kiểm tra" không được sửa đổi |
| RULE-SC | Single Check — 1 đối tượng chỉ được đưa vào kế hoạch kiểm tra 1 lần/năm trên toàn thành phố |

---

## 4. MÀN HÌNH (SCREENS) ĐỀ XUẤT CHO DEMO

1. **Đăng nhập** — form đơn giản, chọn nhanh 1 trong 4 tài khoản demo.
2. **Shell/Layout chính** — sidebar + top tabs + header (theo ảnh tham khảo), dùng chung cho toàn app.
3. **Dashboard tổng quan (Phân hệ D)** — gauge, thẻ số liệu, line chart, pie chart, bảng top đơn vị chậm tiến độ.
4. **Bản đồ giám sát vi phạm** — bản đồ Leaflet online + heatmap + filter + popup chi tiết.
5. **Danh mục đối tượng** — danh sách + tabs trạng thái + nút "Thêm mới" (đơn lẻ) + "Import Excel".
6. **Form thêm/sửa đối tượng** — modal/trang riêng, có on-typing validation + auto-fill + cảnh báo trùng.
7. **Kế hoạch Quý (Giỏ kế hoạch)** — danh sách đối tượng đã chọn, chỉ báo quota, nút "Trình duyệt".
8. **Danh sách Kế hoạch (theo Quý)** — bảng + tabs trạng thái, giống mẫu ảnh CIDS.
9. **Ma trận phê duyệt** — bảng dạng lưới, checkbox hàng loạt, nút Duyệt/Từ chối.
10. **Danh sách hồ sơ kiểm tra thực địa** — bảng + tabs trạng thái.
11. **Chi tiết kiểm tra thực địa** — checklist động, mã vi phạm, upload ảnh, ghi kiến nghị, nút "Kết thúc kiểm tra".
12. **Danh sách kiến nghị** — bảng lọc theo lĩnh vực/đơn vị.
13. **Báo cáo** — trang chọn loại báo cáo + bộ lọc + nút Xuất Excel/PDF.
14. **Quản trị hệ thống** — tab con: Người dùng, Phân quyền, Danh mục, Cấu hình Quota/Cut-off, Audit Log.

---

## 5. MÔ HÌNH DỮ LIỆU ĐỀ XUẤT (Demo — đơn giản hóa)

```
User(id, username, passwordHash, fullName, role[admin|leader_pa04|officer_pa04|officer_ward],
     unit, isActive, createdAt)

BusinessObject(id, type[enterprise|household|individual], taxCode, idNumber,
     name, representative, address, ward, status[active|suspended],
     lastCheckedYear, planId(nullable), createdBy, createdAt)

QuotaConfig(id, ward, quarter, minCount, maxCount)

CutoffConfig(id, quarter, cutoffDateTime)

Plan(id, quarter, ward, status[draft|pending|approved|rejected],
     rejectReason, submittedBy, submittedAt, approvedBy, approvedAt)

PlanItem(id, planId, objectId)

Inspection(id, objectId, planId, checklist(json), violationCodes(json array),
     evidenceFiles(json array of paths), recommendationNote, recommendationTags(json array),
     status[not_started|in_progress|completed], lat, lng, ward,
     severity(1-5), completedAt, isLocked(bool))

ViolationCatalog(id, code, name)   // Lỗi 01, Lỗi 02...
RecommendationTagCatalog(id, code, name) // Thuế, Đất đai, Môi trường, ANTT

AuditLog(id, userId, action, entityType, entityId, detail(json), createdAt)
```

---

## 6. YÊU CẦU PHI CHỨC NĂNG (Demo scope)

| Loại | Yêu cầu |
|---|---|
| Hiệu năng | Danh sách hỗ trợ phân trang, tải < 1s với dữ liệu mẫu ~1.000–2.000 bản ghi |
| Bảo mật | JWT auth, phân quyền theo role ở middleware; không cần mã hóa cấp nhà nước cho demo |
| Khả năng mở rộng | Cấu trúc module hóa rõ ràng (mỗi phân hệ A/B/C/D là 1 module Angular + 1 route Express riêng) để dễ thay bằng CSDL thật sau này |
| Responsive | Tối thiểu hỗ trợ desktop (1366px+); không bắt buộc tối ưu mobile cho demo |
| Ngôn ngữ | Toàn bộ UI tiếng Việt |
| Dữ liệu mẫu | Cần script seed ~50-100 đối tượng, 5-10 kế hoạch, 20-30 hồ sơ kiểm tra có tọa độ thật trong nội thành Hà Nội để heatmap có ý nghĩa trực quan |

## 7. NGOÀI PHẠM VI DEMO (Out of scope)

- Bản đồ nền offline (.mbtiles/TileServer nội bộ), dữ liệu GeoJSON ranh giới hành chính chính thức.
- Tích hợp CSDL quốc gia về dân cư/doanh nghiệp (VNeID, Thuế, Cổng ĐKKD quốc gia).
- Ký số, chữ ký điện tử, xác thực sinh trắc học.
- Hạ tầng production (HA, backup, giám sát vận hành), containerization.
- Kiểm thử bảo mật/penetration test cấp nhà nước.
