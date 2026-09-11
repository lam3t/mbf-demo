# BỘ PROMPT CHO ANTIGRAVITY
## Vibe-coding ứng dụng demo MBF — Angular + Node.js

**Cách dùng:** Chạy tuần tự từng prompt theo đúng thứ tự trong 1 workspace của Antigravity. Sau mỗi prompt, kiểm tra kết quả (chạy thử) trước khi sang prompt tiếp theo. Mỗi prompt đã được viết để agent có đủ ngữ cảnh mà không cần bạn giải thích lại từ đầu — bạn có thể copy-paste nguyên văn.

Đính kèm cho agent (nếu Antigravity hỗ trợ đính kèm file): file `SRS_TNT_Quan_Ly_Kiem_Tra.md` và ảnh giao diện tham khảo `1788918994314_image.png`.

---

## PROMPT 0 — Khởi tạo dự án & kiến trúc tổng thể

```
Bạn là một full-stack engineer. Hãy khởi tạo một dự án demo full-stack với cấu trúc monorepo gồm 2 thư mục:

- /frontend: Angular 18 (standalone components, không dùng NgModules), Angular Material,
  SCSS, routing lazy-load theo từng phân hệ nghiệp vụ.
- /backend: Node.js + TypeScript + Express, cấu trúc theo module (routes/controllers/services),
  dùng better-sqlite3 làm database file-based cho demo (không cần cài đặt DB server rời),
  JWT cho authentication, Multer cho upload file.

Yêu cầu:
1. Tạo package.json riêng cho từng thư mục, và 1 script ở root để chạy đồng thời cả 2
   (dùng concurrently), lệnh `npm run dev` ở root khởi động cả FE (port 4200) và BE (port 3000).
2. Cấu hình CORS ở backend cho phép frontend gọi API.
3. Cấu hình proxy.conf.json ở Angular để gọi /api tới backend port 3000 khi dev.
4. Tạo file backend/src/db/schema.sql với các bảng sau (SQLite):
   users, business_objects, quota_configs, cutoff_configs, plans, plan_items,
   inspections, violation_catalog, recommendation_tag_catalog, audit_logs.
   Dùng đúng các trường mô tả trong file SRS đính kèm mục "5. MÔ HÌNH DỮ LIỆU ĐỀ XUẤT".
5. Viết script backend/src/db/seed.ts để seed dữ liệu mẫu:
   - 4 user demo: admin/123456 (role admin), leader/123456 (role leader_mbf),
     officer1/123456 (role officer_mbf), ward1/123456 (role officer_ward, đơn vị "Phường Hoàn Kiếm").
   - Danh mục lỗi vi phạm: Lỗi 01 - Không có giấy ĐKKD, Lỗi 02 - Vi phạm PCCC,
     Lỗi 03 - Sai địa điểm kinh doanh, Lỗi 04 - Không niêm yết giá.
   - Danh mục lĩnh vực kiến nghị: Thuế, Đất đai, Môi trường, Trật tự đô thị.
   - Cấu hình quota mẫu cho 5 phường (min 30, max 100 mỗi phường, quý 2/2026).
6. Trả lời bằng cách liệt kê toàn bộ cấu trúc thư mục đã tạo và cách chạy dự án.

Không cần Docker, không cần CSDL server rời, mục tiêu là chạy được ngay bằng `npm install && npm run dev`.
```

---

## PROMPT 1 — Thiết kế Design System & Layout Shell (theo ảnh tham khảo)

```
Đây là ảnh giao diện tham khảo (đính kèm: 1788918994314_image.png) của một ứng dụng quản lý
tên "CIDS". Hãy phân tích và tái tạo layout shell dùng chung cho toàn bộ ứng dụng Angular ở
/frontend theo đúng phong cách này:

1. Sidebar bên trái (width ~230px, có thể thu gọn/mở rộng bằng nút mũi tên ở góc trên):
   - Logo + tên hệ thống trên cùng: "MBF - Hệ thống Quản lý Kiểm tra".
   - Menu chính dạng icon + label, có nhóm menu cha/con thu gọn (accordion),
     nền xanh nhạt (#EAF1FF) cho item đang active, chữ xanh đậm (#1A56DB).
   - Các mục menu: Dashboard, Quản lý đối tượng, Lập kế hoạch & Phê duyệt,
     Giám sát thực địa, Bản đồ vi phạm, Báo cáo, Quản trị hệ thống (menu con:
     Người dùng, Phân quyền, Danh mục, Cấu hình, Nhật ký hệ thống).

2. Header trên cùng bên phải: icon chuông thông báo có badge số, icon avatar tròn với tên
   người dùng đang đăng nhập (lấy từ JWT decode), nút đăng xuất khi click avatar.

3. Component dùng chung "PageHeader": nhận input title, subtitle, và danh sách action buttons
   (nút chính màu xanh đậm #1E3A8A bo góc, icon + text) — tái sử dụng cho mọi trang danh sách.

4. Component dùng chung "StatusTabs": dải tab hình pill hiển thị các trạng thái kèm số đếm
   trong ngoặc, tab active có nền xanh đậm chữ trắng, tab khác chỉ có chữ màu theo ngữ nghĩa
   trạng thái (xanh lá/xanh dương/cam/tím/đỏ) — giống với dải tab "Tất cả(16) / Mới(3) /
   Đang thực hiện(7) / Chờ phê duyệt(0) / Phê duyệt(4) / Trúng(0) / Đóng(2)" trong ảnh.

5. Component dùng chung "DataTable": bảng có checkbox chọn dòng, cột "Thao tác" dạng menu
   3 chấm (mat-menu) với các action truyền vào qua input, cột trạng thái hiển thị dạng badge
   bo tròn với màu theo mapping trạng thái, hỗ trợ sort theo cột, phân trang (mat-paginator).

6. Component "SearchFilterBar": ô tìm kiếm bên trái + nút "Bộ lọc" bên phải, giống thanh tìm
   kiếm trong ảnh tham khảo.

Bảng màu chủ đạo: xanh dương đậm (#1E3A8A, #1A56DB) cho brand/nút chính, nền trắng, viền xám nhạt
(#E5E7EB), chữ chính #1F2937. Dùng Angular Material theme tùy biến hoặc CSS variables, không dùng
màu mặc định tím của Material.

Sau khi tạo xong, dựng 1 trang Dashboard tạm (placeholder) để tôi xem layout hoạt động đúng chưa.
```

---

## PROMPT 2 — Xác thực & Quản trị người dùng (Phân hệ 0)

```
Dựa trên schema đã seed ở backend, hãy xây dựng:

BACKEND:
1. POST /api/auth/login (username, password) trả về JWT chứa {id, username, fullName, role, unit}.
2. Middleware authGuard kiểm tra JWT hợp lệ, middleware roleGuard(...roles) kiểm tra quyền theo role.
3. CRUD /api/users (GET danh sách có filter theo unit/role, POST tạo mới, PUT sửa,
   PATCH /api/users/:id/toggle-active để khóa/mở khóa).
4. CRUD /api/catalogs/violations và /api/catalogs/recommendation-tags.
5. CRUD /api/configs/quota và /api/configs/cutoff.
6. GET /api/audit-logs với filter theo user/entity/thời gian, phân trang.
7. Middleware ghi audit log tự động mỗi khi có POST/PUT/PATCH/DELETE vào các entity chính
   (business_objects, plans, inspections, users) — lưu action, entityType, entityId, userId, timestamp.

FRONTEND:
1. Trang Đăng nhập: form username/password + 4 nút "Đăng nhập nhanh" ứng với 4 tài khoản demo
   đã seed, để tiện demo không cần gõ tay.
2. AuthService lưu JWT vào localStorage, AuthGuard chặn route khi chưa đăng nhập,
   RoleGuard chặn theo role cho các route quản trị.
3. Module "Quản trị hệ thống" với các trang con dùng chung DataTable/PageHeader đã tạo ở
   Prompt 1: Danh sách người dùng (có form thêm/sửa dạng dialog), Danh mục lỗi vi phạm,
   Danh mục lĩnh vực kiến nghị, Cấu hình Quota (bảng chỉnh sửa inline theo phường/quý),
   Cấu hình Cut-off (form chọn quý + datetime picker), Nhật ký hệ thống (bảng chỉ đọc).
4. HTTP Interceptor tự động gắn Bearer token vào mọi request, và tự động logout + chuyển
   về trang đăng nhập khi nhận 401.

Đảm bảo sau prompt này tôi có thể đăng nhập bằng 4 tài khoản demo và vào được các trang quản trị
tương ứng với quyền của từng role.
```

---

## PROMPT 3 — Phân hệ A: Quản lý Danh mục Đối tượng

```
Xây dựng phân hệ Quản lý Đối tượng theo đúng mô tả FR-A trong file SRS đính kèm.

BACKEND:
1. GET /api/objects — danh sách có filter theo type (enterprise/household/individual),
   status, ward, tìm kiếm theo tên/MST/CCCD, phân trang.
2. GET /api/objects/check/:idOrTaxCode — kiểm tra tồn tại theo MST (10 số) hoặc CCCD (12 số):
   - Nếu tồn tại và objectId đã gắn với 1 plan (bảng plan_items) của MỘT phường khác
     trong năm hiện tại (kiểm tra qua bảng plans.quarter chứa năm hiện tại) → trả về
     {exists: true, lockedByWard: "<tên phường>", objectData: {...}} .
   - Nếu tồn tại nhưng chưa bị khóa kế hoạch → trả về {exists: true, lockedByWard: null,
     objectData: {...}} để frontend auto-fill.
   - Nếu không tồn tại → {exists: false}.
3. POST /api/objects — tạo mới, validate field bắt buộc theo type
   (enterprise: taxCode+name+representative+address; household: idNumber+name+taxCode;
   individual: idNumber+name+field+address). Chặn tạo mới nếu áp dụng RULE-01
   (đối tượng đã có inspection status=completed trong năm tài chính hiện tại).
4. POST /api/objects/import — nhận file Excel/CSV (dùng multer + thư viện `xlsx`),
   parse, validate từng dòng, trả về {successCount, errors: [{row, reason}]}, chỉ insert
   các dòng hợp lệ, KHÔNG insert dòng lỗi.
5. GET /api/objects/import/template — trả về file Excel mẫu để tải xuống, có 3 sheet
   tương ứng 3 loại đối tượng với đúng cột bắt buộc.

FRONTEND (module "Quản lý đối tượng"):
1. Trang danh sách: dùng PageHeader (title "Danh sách đối tượng", nút "Thêm mới" và
   "Import Excel"), StatusTabs theo status (Tất cả/Đang hoạt động/Tạm ngừng),
   SearchFilterBar, DataTable hiển thị: Loại hình, Mã định danh, Tên, Địa chỉ, Phường
   quản lý, Trạng thái, Thao tác (Xem/Sửa).
2. Dialog "Thêm mới đối tượng": chọn loại hình bằng tab (Doanh nghiệp/Hộ kinh doanh/
   Cá nhân kinh doanh), field mã định danh (MST hoặc CCCD tùy loại) có debounce 400ms
   gọi API check khi đủ 10 hoặc 12 số:
   - Nếu lockedByWard khác null: hiện banner đỏ "Đối tượng đã thuộc quản lý kế hoạch
     kiểm tra của <lockedByWard> - Không được phép thêm mới", disable nút Lưu.
   - Nếu exists nhưng không bị khóa: auto-fill và disable các field đã điền, cho phép Lưu.
   - Nếu không tồn tại: cho nhập đầy đủ thông tin mới.
3. Dialog "Import hàng loạt": bước 1 tải file mẫu, bước 2 upload file, bước 3 hiển thị
   kết quả (số dòng thành công màu xanh, bảng danh sách dòng lỗi kèm lý do màu đỏ).

Test case cần chạy được: tạo 1 đối tượng doanh nghiệp mới thành công; nhập lại đúng MST đó
từ "tài khoản phường khác" phải bị chặn với banner đỏ đúng như mô tả.
```

---

## PROMPT 4 — Phân hệ B: Lập Kế hoạch & Phê duyệt

```
Xây dựng phân hệ Lập kế hoạch & Phê duyệt theo FR-B trong SRS đính kèm.

BACKEND:
1. GET /api/plans — danh sách kế hoạch, filter theo quarter/ward/status, phân trang.
2. POST /api/plans — tạo kế hoạch nháp (draft) cho 1 phường + quý, kèm mảng objectIds
   để insert vào plan_items.
3. PUT /api/plans/:id/items — cập nhật giỏ kế hoạch (thêm/bớt object) khi còn ở trạng thái draft.
4. GET /api/plans/:id/quota-check — trả về {min, max, current, status: 'ok'|'below'|'above'}
   dựa vào quota_configs.
5. POST /api/plans/:id/submit — chuyển draft → pending. Chặn nếu thời điểm hiện tại đã qua
   cutoff_configs của quý đó (trả lỗi 400 kèm message rõ ràng).
6. POST /api/plans/:id/approve — chỉ role leader_mbf/officer_mbf, chuyển pending → approved,
   ghi approvedBy/approvedAt, đồng thời sinh bản ghi inspections (status=not_started) cho từng
   object trong plan để chuẩn bị cho Phân hệ C.
7. POST /api/plans/:id/reject — body bắt buộc {reason}, chuyển pending → rejected (hoặc về draft
   để phường sửa lại — chọn 1 trong 2 theo SRS: "quay về Bản nháp"), lưu reason.
8. GET /api/plans/pending-grid — trả toàn bộ plan_items đang pending dạng phẳng (mỗi dòng là
   1 object) để hiển thị lưới phê duyệt hàng loạt cho MBF.
9. POST /api/plans/approve-bulk — nhận mảng planItemIds, duyệt hàng loạt các item thuộc
   nhiều plan cùng lúc (nếu nghiệp vụ yêu cầu duyệt theo object thay vì theo cả plan, hãy tách
   nhỏ hơn: cho phép approve từng object riêng trong 1 plan, cập nhật trạng thái object đó).

FRONTEND (module "Lập kế hoạch & Phê duyệt", chỉ hiển thị menu phù hợp theo role):
1. Trang "Giỏ kế hoạch" (cho role officer_ward): chọn quý đang mở, danh sách đối tượng đã
   thêm vào giỏ (từ trang Danh mục đối tượng có nút "+ Thêm vào kế hoạch"), banner hiển thị
   quota hiện tại/min/max với màu cảnh báo tương ứng, nút "Trình duyệt" (disable nếu quá
   cutoff, hiển thị đồng hồ đếm ngược đến cutoff).
2. Trang "Danh sách kế hoạch": DataTable + StatusTabs (Nháp/Chờ phê duyệt/Đã duyệt/Từ chối)
   giống hệt phong cách bảng "Danh sách báo giá" trong ảnh tham khảo — cột: Tên kế hoạch
   (VD "Kế hoạch Quý II/2026 - Phường Hoàn Kiếm"), Đơn vị, Số lượng đối tượng, Ngày trình,
   Trạng thái, Thao tác.
3. Trang "Ma trận phê duyệt" (cho role leader_mbf/officer_mbf): bảng dạng lưới liệt kê
   từng object đang pending kèm checkbox chọn nhiều dòng, nút "Duyệt các mục đã chọn" và
   nút "Từ chối" (mở dialog bắt nhập lý do, validate not-empty trước khi submit).

Test case: tạo giỏ kế hoạch dưới quota tối thiểu → banner cảnh báo vàng; trình duyệt thành
công; đăng nhập leader_mbf vào ma trận phê duyệt, duyệt hàng loạt; kiểm tra bảng inspections
đã có bản ghi mới tương ứng.
```

---

## PROMPT 5 — Phân hệ C: Giám sát Kiểm tra Thực địa

```
Xây dựng phân hệ Giám sát Thực địa theo FR-C trong SRS đính kèm.

BACKEND:
1. GET /api/inspections — danh sách, filter theo status/ward/quarter, phân trang.
2. GET /api/inspections/:id — chi tiết 1 hồ sơ kiểm tra, gồm object liên quan, checklist,
   violationCodes, evidenceFiles, recommendationNote, recommendationTags, lat/lng, isLocked.
3. PUT /api/inspections/:id — cập nhật checklist/violationCodes/recommendationNote/tags/lat/lng/
   severity. TỪ CHỐI (trả 403) nếu bản ghi có isLocked = true (RULE-03).
4. POST /api/inspections/:id/evidence — upload ảnh/scan (multer, giới hạn 5MB/file,
   chỉ nhận .jpg/.png/.pdf), lưu path vào evidenceFiles.
5. POST /api/inspections/:id/complete — set status=completed, isLocked=true, completedAt=now.
   Sau bước này mọi PUT vào record đều bị chặn ở bước 3.
6. GET /api/violation-catalog và GET /api/recommendation-tag-catalog — trả danh mục dùng
   cho dropdown/multi-select ở frontend.
7. GET /api/recommendations — danh sách kiến nghị (join từ inspections có recommendationNote
   không rỗng), filter theo tag/ward, dùng cho Phân hệ D xuất báo cáo.

FRONTEND (module "Giám sát thực địa"):
1. Trang danh sách hồ sơ kiểm tra: DataTable + StatusTabs (Chưa kiểm tra/Đang kiểm tra/
   Hoàn thành/Quá hạn — "Quá hạn" tính khi still not_started quá X ngày kể từ approvedAt,
   có thể hard-code X=30 cho demo).
2. Trang chi tiết kiểm tra (khi status != completed thì editable, ngược lại toàn bộ form
   readonly + banner "Hồ sơ đã chốt - không thể chỉnh sửa"):
   - Khối "Checklist" hiển thị danh sách tiêu chí (hard-code 5-6 tiêu chí mẫu như:
     "Có giấy ĐKKD hợp lệ", "Đảm bảo PCCC", "Đúng địa điểm kinh doanh", "Niêm yết giá",
     "Vệ sinh an toàn thực phẩm (nếu áp dụng)") mỗi tiêu chí có toggle Đạt/Không đạt.
   - Khi có tiêu chí "Không đạt" → hiện multi-select "Áp mã vi phạm" lấy từ danh mục.
   - Khối "Bằng chứng số": drag-drop hoặc chọn file để upload, hiển thị thumbnail ảnh
     đã upload, validate 5MB.
   - Khối "Kiến nghị": textarea ghi nội dung + multi-select chọn thẻ lĩnh vực.
   - Khối "Vị trí": input lat/lng (tạm thời nhập tay ở prompt này, sẽ nối với bản đồ ở
     Prompt 6), hiển thị tên phường tự nhận diện bằng cách match tọa độ gần nhất với
     danh sách tọa độ trung tâm 5 phường demo (hard-code toạ độ trung tâm 5 phường Hà Nội).
   - Nút "Kết thúc kiểm tra" (confirm dialog trước khi gọi API complete).
3. Trang "Danh sách kiến nghị": DataTable filter theo lĩnh vực/phường, cột: Đối tượng,
   Phường, Lĩnh vực (badge), Nội dung, Ngày ghi nhận.

Test case: mở 1 hồ sơ not_started, tick vài tiêu chí không đạt, áp mã lỗi, upload ảnh,
ghi kiến nghị, bấm Kết thúc kiểm tra → sau đó mở lại phải thấy toàn bộ readonly.
```

---

## PROMPT 6 — Phân hệ D: BI Dashboard & Bản đồ Online (thay thế bản đồ offline)

```
Xây dựng phân hệ BI Dashboard theo FR-D trong SRS đính kèm. LƯU Ý QUAN TRỌNG: bản đồ dùng
Leaflet + tile OpenStreetMap ONLINE (https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png),
KHÔNG triển khai TileServer offline/.mbtiles.

BACKEND:
1. GET /api/dashboard/summary — trả về: tổng mục tiêu (9960), tổng đã hoàn thành
   (đếm inspections status=completed), % hoàn thành, số xã/phường đã hoàn thành/đang thực
   hiện/chưa bắt đầu (dựa trên % completed theo ward), tổng nhiệm vụ, nhiệm vụ đang thực
   hiện, nhiệm vụ quá hạn (theo rule Prompt 5).
2. GET /api/dashboard/progress-by-day — trả mảng {date, percent} 7-30 ngày gần nhất để vẽ
   line chart (có thể tính giả lập tăng dần dựa trên timestamp các inspections completed).
3. GET /api/dashboard/overdue-ranking — top N phường có % hoàn thành thấp nhất.
4. GET /api/dashboard/compliance-pie — đếm object theo 3 nhóm: Tốt (không có vi phạm nào),
   Vi phạm (có ít nhất 1 inspection có violationCodes không rỗng), Đình chỉ (status=suspended).
5. GET /api/dashboard/violations-geo — trả mảng {lat, lng, severity, ward, violationType,
   inspectionId} của toàn bộ inspections có violationCodes không rỗng và có lat/lng, hỗ trợ
   query filter theo timeRange (week/month/quarter), ward, violationType.

FRONTEND (module "Dashboard" và "Bản đồ vi phạm"):
1. Trang Dashboard tổng quan — bố cục lưới giống ảnh dashboard trong tài liệu PDF đính kèm
   (mô tả: gauge tròn lớn bên trái hiển thị % hoàn thành chung, ở giữa là bản đồ mini/thẻ
   tổng quan, bên phải là các thẻ thống kê nổi bật dạng card có icon + số + mũi tên xu hướng),
   phía dưới là line chart "Tiến độ theo thời gian" và pie chart "Tỷ lệ hoàn thành theo nhóm".
   Dùng ngx-charts hoặc chart.js (ng2-charts) cho toàn bộ biểu đồ.
2. Trang "Bản đồ vi phạm":
   - Khởi tạo bản đồ Leaflet tâm tại Hà Nội (lat 21.0285, lng 105.8542), zoom 11,
     tile layer OpenStreetMap online.
   - Dùng plugin `leaflet.heat` để vẽ lớp heatmap từ dữ liệu /api/dashboard/violations-geo
     (weight theo severity).
   - Dùng `leaflet.markercluster` để gom cụm các điểm vi phạm khi zoom nhỏ, click vào cluster
     để zoom vào, click vào marker đơn để mở popup hiển thị: tên đối tượng, loại vi phạm,
     mức độ nghiêm trọng, ngày ghi nhận, nút "Xem chi tiết hồ sơ" (điều hướng sang trang
     chi tiết inspection ở Phân hệ C).
   - Panel bộ lọc bên trái/trên bản đồ: dropdown Khoảng thời gian (Tuần này/Tháng này/Quý
     này), dropdown Loại vi phạm, dropdown Phường — khi đổi filter, gọi lại API và vẽ lại
     heatmap + marker (dùng layerGroup.clearLayers() rồi add lại).
   - Layer control (nút bật/tắt) cho phép ẩn/hiện riêng lớp Heatmap và lớp Marker.
3. Trang "Báo cáo": 2 tab "Kiến nghị theo lĩnh vực" và "Tổng kết quý" — mỗi tab có bộ lọc
   (quý/phường/lĩnh vực) và nút "Xuất Excel" gọi API backend trả về file .xlsx (dùng thư
   viện `exceljs` ở backend), frontend trigger tải file bằng blob response.

Sau bước này, chạm vào 1 vùng trên bản đồ heatmap phải thấy rõ vùng đỏ đậm nếu dữ liệu seed
đã tập trung nhiều điểm vi phạm ở 1 khu vực — hãy đảm bảo script seed ở Prompt 0 có ít nhất
20-30 bản ghi inspection với tọa độ thật quanh khu vực Hoàn Kiếm/Ba Đình/Đống Đa để heatmap
có ý nghĩa trực quan khi demo.
```

---

## PROMPT 7 — Hoàn thiện, dữ liệu demo & kịch bản trình diễn

```
Rà soát toàn bộ ứng dụng đã xây dựng qua các Prompt 0-6 và hoàn thiện:

1. Bổ sung script backend/src/db/seed.ts (nếu chưa đủ) để có dữ liệu demo phong phú:
   - 8 đối tượng loại Doanh nghiệp, 5 loại Hộ kinh doanh, 5 loại Cá nhân kinh doanh,
     phân bổ đều trên 5 phường demo (Hoàn Kiếm, Ba Đình, Đống Đa, Hai Bà Trưng, Cầu Giấy)
     với tọa độ trung tâm phường xấp xỉ đúng thực tế Hà Nội.
   - 5 kế hoạch quý ở các trạng thái khác nhau (1 draft, 1 pending, 2 approved, 1 rejected)
     để demo được đầy đủ luồng Phân hệ B.
   - 15-20 bản ghi inspection ở nhiều trạng thái (not_started, in_progress, completed),
     trong đó khoảng 8-10 bản ghi completed có violationCodes và tọa độ cụ thể, tập trung
     lệch về 1-2 khu vực để tạo hot zone rõ trên heatmap.
2. Kiểm tra toàn bộ điều hướng menu sidebar khớp với các route đã tạo, không có link chết.
3. Thêm trang 404 và trang "Không có quyền truy cập" dùng chung layout.
4. Thêm loading spinner / skeleton cho các bảng khi đang gọi API.
5. Thêm toast/snackbar thông báo (thành công màu xanh, lỗi màu đỏ) cho mọi action tạo/sửa/
   xóa/duyệt/từ chối.
6. Viết file README.md ở root hướng dẫn: cách cài đặt (`npm install` ở root + 2 thư mục con),
   cách chạy (`npm run dev`), danh sách 4 tài khoản demo kèm role, và một "kịch bản demo 5
   phút" gợi ý thứ tự click để trình diễn đầy đủ vòng đời: đăng nhập ward1 → thêm đối tượng
   mới (demo cảnh báo trùng) → thêm vào giỏ kế hoạch → trình duyệt → đăng nhập leader → duyệt
   hàng loạt → đăng nhập ward1 → vào kiểm tra thực địa, ghi nhận vi phạm, kết thúc kiểm tra →
   đăng nhập leader → xem Dashboard cập nhật real-time + xem bản đồ heatmap xuất hiện điểm mới
   → xuất báo cáo Excel.

Chạy thử toàn bộ luồng theo kịch bản demo trên và báo lại nếu có lỗi phát sinh ở bước nào.
```

---

## GHI CHÚ KHI DÙNG BỘ PROMPT NÀY

- Luôn đính kèm lại file `SRS_TNT_Quan_Ly_Kiem_Tra.md` ở các prompt quan trọng (0, 3, 4, 5, 6) nếu Antigravity không tự nhớ ngữ cảnh giữa các phiên.
- Nếu agent đề xuất dùng NestJS thay Express, hoặc PrimeNG thay Angular Material — đều chấp nhận được, không ảnh hưởng đến yêu cầu nghiệp vụ, chỉ cần giữ đúng danh sách API/màn hình.
- Nếu muốn rút gọn thời gian dựng demo hơn nữa, có thể gộp Prompt 3+4 hoặc 5+6 làm một, nhưng nên giữ thứ tự: Nền tảng & Auth → Đối tượng → Kế hoạch/Duyệt → Thực địa → Dashboard/Bản đồ → Hoàn thiện.
- Sau mỗi prompt, nên yêu cầu thêm: "Chạy thử ứng dụng và chụp/mô tả lại giao diện đã tạo để tôi xác nhận trước khi sang bước tiếp theo" nếu Antigravity hỗ trợ preview.
