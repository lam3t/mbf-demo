# BỘ PROMPT NÂNG CẤP (PHASE 2) CHO ANTIGRAVITY
## Khắc phục theo comment khách hàng — Hệ thống PA04

**Áp dụng sau khi đã hoàn thành Prompt 0-7 (bản demo v1).**
Đính kèm lại cho agent: `SRS_PA04_Quan_Ly_Kiem_Tra.md` + toàn bộ mã nguồn hiện có, để agent hiểu đây là **thay đổi/nâng cấp trên codebase đang chạy**, không phải viết lại từ đầu.

---

## 0. BẢNG ĐỐI CHIẾU COMMENT → HẠNG MỤC THAY ĐỔI (Change Log)

| # | Comment khách hàng | Mã CR | Loại thay đổi |
|---|---|---|---|
| 1 | Kế hoạch: 1 năm 1 lần kiểm tra duy nhất doanh nghiệp | CR-01 | Rule nghiệp vụ (backend) |
| 2 | Luồng phê duyệt cần ký giấy scan đính kèm; Trưởng phòng/GĐ có token ký số, nhân viên chưa có | CR-02 | Luồng phê duyệt + upload + ký số |
| 3 | Dashboard tổng quan theo lĩnh vực (PCCC...) - tỷ lệ hoàn thành | CR-03 | Dashboard |
| 4 | Top 5 nhanh nhất - Top 5 chậm nhất (chung + theo từng lĩnh vực) | CR-04 | Dashboard |
| 5 | Chỉ huy click vào 1 phường → xem dashboard riêng của phường đó | CR-05 | Dashboard drill-down |
| 6 | Nhật ký lưu vết thao tác (audit log) đầy đủ hơn | CR-06 | Audit log nâng cao |
| 7 | DB tổ chức lưu trữ theo phường/xã để tìm kiếm nhanh | CR-07 | Backend/DB tối ưu |
| 8 | Deadline cho công việc + theo dõi cảnh báo | CR-08 | Deadline & Alert |
| 9 | Dashboard Phường: danh sách cảnh báo đạt/không đạt, nhắc gửi văn bản cho DN + cảnh báo Phường | CR-09 | Dashboard Phường + workflow cảnh báo |
| 10 | Phường thêm kiểm tra 1 DN ngoài kế hoạch, gửi lên; cấp trên duyệt 1 hoặc cả 2 loại | CR-10 | Kiểm tra phát sinh (ad-hoc) |
| 11 | Kiểm tra trùng với kế hoạch quý cũ trong năm → chặn tạo | CR-11 | Rule trùng lặp (gắn với CR-01) |
| 12 | UI đang nhiều thông tin, cần gọn hơn | CR-12 | UI/UX declutter |

---

## PROMPT 8 — CR-01 + CR-11: Rule "1 năm 1 lần kiểm tra duy nhất" & chặn trùng xuyên quý

```
Đây là bản nâng cấp trên codebase hiện có (không viết lại từ đầu). Hiện tại rule Single Check
chỉ đang kiểm tra trùng trong PHẠM VI 1 KẾ HOẠCH/QUÝ. Khách hàng yêu cầu mở rộng thành:
"1 doanh nghiệp/hộ/cá nhân kinh doanh chỉ được kiểm tra DUY NHẤT 1 LẦN TRONG CẢ NĂM,
bất kể thuộc kế hoạch quý nào, do phường nào lập."

BACKEND — sửa lại logic tại endpoint check trùng (GET /api/objects/check/:id) và tại
POST /api/plans/:id/items (thêm object vào giỏ kế hoạch):
1. Khi thêm 1 object vào plan_items, phải truy vấn TOÀN BỘ plan_items của object đó thuộc
   các plan có status IN ('pending','approved') và plan.year = năm hiện tại (không chỉ quý
   hiện tại) — nếu tìm thấy ở bất kỳ quý nào khác (Q1/Q2/Q3/Q4) → trả lỗi 409 kèm message:
   "Doanh nghiệp/đối tượng này đã được lên kế hoạch kiểm tra trong Quý <X>/<năm> bởi
   <tên phường> - Không được phép thêm mới theo nguyên tắc 1 năm/1 lần." Chặn hoàn toàn
   (không cho lưu), không chỉ cảnh báo.
2. Nếu object đã có inspection với status = 'completed' trong năm hiện tại (bất kể do phường
   nào thực hiện) → cũng chặn với message tương tự nhưng nêu rõ "đã hoàn thành kiểm tra vào
   ngày <completedAt>".
3. Sửa bảng `plans` để có cột `year` tường minh (không chỉ suy ra từ chuỗi quarter) để việc
   query theo năm nhanh và rõ ràng — viết migration cập nhật dữ liệu cũ.
4. Viết lại unit test/script test thủ công: tạo object A ở kế hoạch Q1 phường X (approved),
   sau đó thử thêm object A vào kế hoạch Q3 phường Y → phải bị chặn với đúng message trên.

FRONTEND:
1. Cập nhật lại toàn bộ nơi hiển thị cảnh báo trùng (dialog thêm đối tượng ở Prompt 3, dialog
   thêm vào giỏ kế hoạch ở Prompt 4) để hiển thị đúng message mới (nêu rõ quý/năm/phường đã
   kiểm tra hoặc đã lên kế hoạch), banner màu đỏ, nút "Thêm/Lưu" bị disable hoàn toàn, không
   có tùy chọn ghi đè.
2. Ở trang chi tiết đối tượng, thêm 1 khối "Lịch sử kiểm tra trong năm" hiển thị timeline các
   lần đã được lên kế hoạch/kiểm tra trong năm hiện tại (kể cả bị từ chối) để cán bộ tra cứu
   trước khi thêm vào kế hoạch mới.
```

---

## PROMPT 9 — CR-02: Đính kèm bản ký scan & ký số cho luồng phê duyệt

```
Bổ sung vào luồng Phân hệ B (Lập kế hoạch & Phê duyệt) yêu cầu: khi phường trình duyệt kế
hoạch lên PA04, PHẢI đính kèm văn bản đã ký (scan/ảnh chụp có chữ ký + dấu). Lãnh đạo PA04
(Trưởng phòng/Giám đốc) có token ký số nên có thể ký số điện tử ngay trên hệ thống; cán bộ
PA04 thường và cán bộ phường CHƯA có token ký số nên chỉ thao tác bằng file scan.

BACKEND:
1. Thêm cột vào bảng `plans`: `signedDocumentUrl` (văn bản scan phường đính kèm khi trình
   duyệt), `signedDocumentUploadedAt`.
2. Thêm bảng mới `digital_signatures`: id, planId, signedByUserId, signedByRole,
   signatureType ['scan'|'digital_token'], signatureImageUrl (đối với scan) hoặc
   certificateInfo (json, giả lập cho token — VD serialNumber, issuer, signedAt), createdAt.
3. Sửa POST /api/plans/:id/submit: bắt buộc kèm theo `signedDocumentUrl` (upload file trước
   qua multer, chỉ nhận .pdf/.jpg/.png, tối đa 10MB) — nếu thiếu, trả lỗi 400
   "Vui lòng đính kèm văn bản đã ký trước khi trình duyệt".
4. Thêm endpoint POST /api/plans/:id/sign-digital — chỉ cho phép role leader_pa04 (Trưởng
   phòng/Giám đốc, người có token ký số). Vì đây là bản demo, GIẢ LẬP bước ký số: sinh 1 bản
   ghi digital_signatures với signatureType='digital_token', certificateInfo giả lập
   {serialNumber: random, issuer: "Ban Cơ yếu Chính phủ (demo)", signedAt: now}, và tự động
   set plans.status='approved' nếu chưa approved. Ghi rõ trong code comment rằng ở môi trường
   production cần tích hợp SDK ký số thật (VD: VNPT-CA, Viettel-CA, USB Token qua plugin
   trình duyệt/Java applet hoặc middleware ký số) — phần này KHÔNG cần code thật, chỉ cần
   để lại TODO rõ ràng.
5. Endpoint POST /api/plans/:id/approve (đã có ở Prompt 4) — nếu người duyệt KHÔNG có
   quyền ký số (role officer_pa04), chỉ cho phép "Duyệt thường" (giữ nguyên hành vi cũ,
   không tạo bản ghi digital_signatures) — hệ thống cần phân biệt 2 loại phê duyệt:
   "Phê duyệt thường" (mọi role PA04 dùng được) và "Phê duyệt kèm ký số" (chỉ leader_pa04).

FRONTEND:
1. Ở trang "Giỏ kế hoạch" (phường), trước nút "Trình duyệt": thêm ô upload bắt buộc
   "Đính kèm văn bản đã ký (scan/ảnh)", preview file đã chọn, validate định dạng/dung lượng.
   Nút "Trình duyệt" disable nếu chưa có file.
2. Ở trang "Ma trận phê duyệt" (PA04): thêm cột/khu vực xem văn bản scan đính kèm (mở trong
   modal/preview), và:
   - Nếu người đăng nhập là leader_pa04: hiển thị 2 nút riêng biệt "Duyệt thường" và
     "Duyệt & Ký số" (nút ký số có icon con dấu/chữ ký, click sẽ mở dialog xác nhận giả lập
     "Xác thực token ký số..." rồi hoàn tất).
   - Nếu người đăng nhập là officer_pa04 (chưa có token): chỉ hiển thị nút "Duyệt thường",
     kèm tooltip/ghi chú nhỏ "Chỉ Trưởng phòng/Giám đốc mới có quyền ký số".
3. Ở trang chi tiết kế hoạch đã duyệt: hiển thị badge "Đã ký số" (kèm thông tin serialNumber,
   người ký, thời gian) nếu có bản ghi digital_signatures loại digital_token, hoặc badge
   "Duyệt thường (chưa ký số)" nếu chỉ approve thông thường.

Test case: phường trình duyệt thiếu file → bị chặn; đăng nhập leader → thấy nút Duyệt & Ký số
hoạt động và badge "Đã ký số" xuất hiện; đăng nhập officer_pa04 → chỉ thấy nút Duyệt thường.
```

---

## PROMPT 10 — CR-08: Deadline cho công việc & cảnh báo quá hạn

```
Bổ sung cơ chế deadline và cảnh báo cho toàn bộ vòng đời công việc (không chỉ hồ sơ kiểm tra
mà cả trình duyệt và phê duyệt).

BACKEND:
1. Thêm cột `dueDate` vào các bảng: `plans` (hạn trình duyệt — mặc định = cutoff_configs của
   quý đó), `inspections` (hạn hoàn thành kiểm tra — mặc định = approvedAt + N ngày, N lấy
   từ 1 cấu hình mới `configs.inspectionDeadlineDays`, mặc định 30 ngày, cho phép Admin sửa
   ở màn Cấu hình).
2. Thêm endpoint GET /api/configs/inspection-deadline-days và PUT để Admin chỉnh N ngày.
3. Viết 1 service `deadlineChecker` chạy định kỳ (dùng `node-cron`, ví dụ mỗi giờ) quét:
   - inspections có status != 'completed' và dueDate < now → set field `isOverdue = true`.
   - plans có status = 'draft' và dueDate (cutoff) < now → set field `isOverdue = true`
     (không cho trình duyệt nữa, đã có ở Prompt 4, giờ thêm cờ để hiển thị rõ trên UI).
4. Thêm bảng `alerts`: id, type ['overdue_inspection'|'overdue_plan'|'quota_below'|
   'quota_above'], relatedEntityType, relatedEntityId, ward, message, severity
   ['info'|'warning'|'critical'], isRead, createdAt. deadlineChecker tự động insert alert
   mới khi phát hiện quá hạn (tránh insert trùng nếu alert cùng loại đã tồn tại và
   isRead=false).
5. GET /api/alerts — danh sách cảnh báo, filter theo ward/type/severity/isRead, phân trang.
6. PATCH /api/alerts/:id/read — đánh dấu đã đọc.

FRONTEND:
1. Thêm cột "Hạn hoàn thành" và badge "Quá hạn" (đỏ, có icon đồng hồ) vào DataTable ở trang
   Danh sách hồ sơ kiểm tra (Phân hệ C) và Danh sách kế hoạch (Phân hệ B).
2. Thêm icon chuông cảnh báo ở Header (khác với chuông thông báo chung nếu đã có) hiển thị
   badge số lượng alerts chưa đọc, click mở dropdown/panel danh sách alert gần nhất, có nút
   "Xem tất cả" dẫn tới trang "Cảnh báo hệ thống" mới (bảng đầy đủ + filter + đánh dấu đã đọc).
3. Ở trang chi tiết hồ sơ kiểm tra: nếu isOverdue = true, hiển thị banner cảnh báo đỏ ở đầu
   trang "Hồ sơ đã quá hạn hoàn thành X ngày".

Test: chỉnh cấu hình inspectionDeadlineDays = 1 ngày, đợi cron chạy (hoặc gọi thủ công job
qua endpoint debug), xác nhận alert mới xuất hiện và badge quá hạn hiển thị đúng.
```

---

## PROMPT 11 — CR-03 + CR-04: Dashboard theo lĩnh vực + Top 5 nhanh/chậm

```
Hiện tại checklist trong hồ sơ kiểm tra (Prompt 5) là danh sách phẳng, cần phân loại từng
tiêu chí theo LĨNH VỰC (VD: PCCC, An toàn thực phẩm, Môi trường, Trật tự đô thị, Thuế) để
tổng hợp tỷ lệ hoàn thành/đạt theo từng lĩnh vực trên Dashboard.

BACKEND:
1. Sửa bảng danh mục: đổi `violation_catalog` hoặc thêm bảng mới `inspection_domains`
   (id, code, name — VD: PCCC, ATTP, MOI_TRUONG, TTDT, THUE) và thêm cột `domainId` vào
   bảng lưu từng tiêu chí checklist (nếu checklist đang là JSON tự do trong `inspections`,
   hãy tách thành bảng riêng `inspection_checklist_items`: id, inspectionId, domainId,
   criteriaName, result ['pass'|'fail'], violationCodeId (nullable)). Viết migration
   chuyển dữ liệu JSON cũ sang bảng mới.
2. Seed danh mục 5 lĩnh vực mẫu ở trên, và seed lại checklist mẫu (Prompt 0/5) gắn domainId
   tương ứng cho từng tiêu chí (VD "Đảm bảo PCCC" → domain PCCC).
3. GET /api/dashboard/by-domain — trả về mảng {domainId, domainName, totalChecked,
   totalPass, totalFail, completionRate} tính từ inspection_checklist_items của các
   inspections completed trong khoảng thời gian filter (quý/năm hiện tại).
4. GET /api/dashboard/ranking?scope=overall|domain&domainId=<id>&order=fastest|slowest&limit=5
   — trả Top N phường theo % hoàn thành kế hoạch (overall) hoặc theo % đạt của 1 lĩnh vực
   cụ thể (domain), sắp xếp tăng dần (slowest) hoặc giảm dần (fastest).

FRONTEND:
1. Thêm khối "Tỷ lệ hoàn thành theo lĩnh vực" trên trang Dashboard tổng quan: mỗi lĩnh vực
   1 progress bar hoặc mini gauge (PCCC 92%, ATTP 85%, Môi trường 78%...), click vào 1 lĩnh
   vực để lọc sâu hơn (xem chi tiết danh sách hồ sơ có tiêu chí thuộc lĩnh vực đó bị Không đạt).
2. Thêm 2 bảng song song "Top 5 đơn vị nhanh nhất" (xanh) và "Top 5 đơn vị chậm nhất" (đỏ)
   — có dropdown chọn phạm vi: Tổng thể hoặc theo từng lĩnh vực (PCCC/ATTP/...), khi đổi
   dropdown gọi lại API ranking tương ứng.
3. Cập nhật form checklist ở trang chi tiết kiểm tra (Prompt 5) để nhóm các tiêu chí theo
   lĩnh vực (dùng mat-expansion-panel hoặc tab con), thay vì liệt kê phẳng.
```

---

## PROMPT 12 — CR-05: Drill-down Dashboard theo từng Phường

```
Bổ sung khả năng "khoan sâu" (drill-down): từ Dashboard tổng (cấp Thành phố), Chỉ huy click
vào 1 phường (trên bảng xếp hạng, trên bản đồ, hoặc trên 1 danh sách phường riêng) sẽ chuyển
sang Dashboard con chỉ hiển thị dữ liệu của phường đó.

BACKEND:
1. Thêm query param `?ward=<tênPhường>` cho toàn bộ endpoint dashboard đã có ở Prompt 6 và
   Prompt 11 (/api/dashboard/summary, /progress-by-day, /compliance-pie, /by-domain,
   /violations-geo) — khi có param này, lọc toàn bộ số liệu chỉ trong phạm vi phường đó.
2. GET /api/wards — danh sách 5 phường demo (id, tên, tọa độ trung tâm) để frontend build
   dropdown chọn phường hoặc danh sách click.

FRONTEND:
1. Route mới `/dashboard/ward/:wardId` — tái sử dụng toàn bộ component Dashboard đã xây ở
   Prompt 6 + Prompt 11 nhưng truyền thêm wardId để gọi API kèm filter ward, tiêu đề trang
   đổi thành "Dashboard - Phường <tên>", thêm nút "◄ Quay lại Dashboard Thành phố".
2. Ở Dashboard tổng: bảng Top 5 nhanh/chậm (Prompt 11) và danh sách "Xã/phường đang thực
   hiện" — mỗi dòng tên phường là 1 link điều hướng tới `/dashboard/ward/:wardId`.
3. Ở trang Bản đồ vi phạm (Prompt 6): click vào tên phường trong popup hoặc trong panel lọc
   theo phường cũng có nút "Xem Dashboard phường này" dẫn tới route trên.
4. Đảm bảo phân quyền: cán bộ phường (officer_ward) khi đăng nhập được tự động điều hướng/
   giới hạn chỉ xem Dashboard của chính phường mình (không thấy dữ liệu phường khác);
   leader_pa04/officer_pa04 xem được Dashboard mọi phường.
```

---

## PROMPT 13 — CR-09: Dashboard Phường — Danh sách cảnh báo & nhắc gửi văn bản

```
Bổ sung riêng cho Dashboard cấp Phường (route /dashboard/ward/:wardId ở Prompt 12, hoặc màn
hình mặc định khi cán bộ phường đăng nhập) một khối "Cảnh báo & Nhắc việc" dành riêng cho
cán bộ phường sử dụng hàng ngày.

BACKEND:
1. GET /api/wards/:wardId/inspection-alerts — trả về danh sách các inspections completed
   gần đây của phường đó kèm: tên đối tượng, danh sách hạng mục Đạt/Không đạt (rút gọn từ
   inspection_checklist_items), cờ `needsNoticeLetter` = true nếu có ít nhất 1 hạng mục
   'fail' VÀ chưa có bản ghi thông báo gửi doanh nghiệp.
2. Thêm bảng `business_notices`: id, inspectionId, objectId, sentByUserId, method
   ['van_ban_giay'|'khac'], sentAt, note, fileUrl (scan văn bản thông báo đã gửi, optional).
3. POST /api/wards/:wardId/inspection-alerts/:inspectionId/mark-notice-sent — cán bộ phường
   xác nhận đã gửi văn bản thông báo cho doanh nghiệp (kèm upload file scan nếu có), tạo
   bản ghi business_notices, sau đó needsNoticeLetter tự chuyển false.
4. Alert type mới trong bảng `alerts` (Prompt 10): 'notice_letter_pending' — tự sinh khi có
   inspection completed có fail item quá 3 ngày mà chưa mark-notice-sent, để nhắc chủ động.

FRONTEND:
1. Trên Dashboard Phường, thêm tab/khối "Cảnh báo cần xử lý": danh sách card mỗi card 1
   doanh nghiệp có vi phạm, hiển thị rõ: hạng mục Đạt (✓ xanh) / Không đạt (✗ đỏ), badge
   "Cần gửi thông báo" (cam) nếu needsNoticeLetter=true.
2. Mỗi card có nút "Đánh dấu đã gửi thông báo" mở dialog nhập ngày gửi, hình thức (văn bản
   giấy/khác), upload file scan (optional), ghi chú → gọi API mark-notice-sent.
3. Card nào đã xử lý (needsNoticeLetter=false) chuyển sang trạng thái mờ/đã hoàn tất, có
   thể ẩn khỏi danh sách mặc định (dùng toggle "Hiện cả mục đã xử lý").
4. Đồng bộ vào khối chuông cảnh báo chung (Prompt 10) — alert 'notice_letter_pending' cũng
   hiển thị ở đó với link trực tiếp tới card tương ứng trên Dashboard Phường.

Test: hoàn thành 1 hồ sơ kiểm tra có hạng mục fail → card cảnh báo xuất hiện ngay trên
Dashboard Phường; đánh dấu đã gửi thông báo → card chuyển trạng thái đã xử lý.
```

---

## PROMPT 14 — CR-10: Kiểm tra phát sinh ngoài kế hoạch (Ad-hoc)

```
Bổ sung luồng: ngoài kế hoạch quý đã duyệt, cán bộ Phường có thể đề xuất kiểm tra PHÁT SINH
1 doanh nghiệp/đối tượng CHƯA có trong kế hoạch chính thức, gửi lên PA04 xét duyệt riêng.
Khi PA04 xem xét, họ thấy đồng thời danh sách kế hoạch chính thức VÀ danh sách đề xuất phát
sinh, có thể duyệt 1 trong 2 loại, hoặc cả 2 độc lập với nhau.

BACKEND:
1. Thêm bảng `adhoc_inspection_requests`: id, objectId, wardRequestedBy, reason (bắt buộc —
   lý do đề xuất kiểm tra đột xuất), status ['pending'|'approved'|'rejected'], rejectReason,
   requestedBy, requestedAt, approvedBy, approvedAt, relatedQuarter (quý hiện tại, để vẫn
   tính vào rule Single Check năm).
2. POST /api/adhoc-requests — cán bộ phường tạo đề xuất, PHẢI chạy qua đúng rule kiểm tra
   trùng của CR-01/CR-11 (không cho đề xuất đối tượng đã có kế hoạch/đã kiểm tra trong năm ở
   phường khác) trước khi cho tạo — trả lỗi 409 với message tương tự Prompt 8 nếu vi phạm.
3. GET /api/adhoc-requests — danh sách, filter theo ward/status.
4. POST /api/adhoc-requests/:id/approve và /reject (giống cấu trúc plans ở Prompt 4/9,
   reject bắt buộc nhập lý do). Khi approve, tự sinh 1 bản ghi `inspections` mới (giống hành
   vi approve plan) để đưa vào Phân hệ C xử lý bình thường, đồng thời set thêm cờ
   `isAdhoc = true` ở bảng inspections để phân biệt với kiểm tra theo kế hoạch chính thức.
5. Đảm bảo hàm tính Quota (Prompt 4/FR-B.2) có tách riêng: đối tượng ad-hoc KHÔNG tính vào
   quota kế hoạch quý chính thức, tránh làm sai lệch số liệu min/max.

FRONTEND:
1. Trang mới "Đề xuất kiểm tra phát sinh" (menu con dưới "Lập kế hoạch & Phê duyệt"):
   - Với cán bộ phường: nút "+ Đề xuất kiểm tra mới", form chọn đối tượng (tái dùng cơ chế
     check trùng như dialog thêm đối tượng ở Prompt 3/8) + textarea "Lý do đề xuất" (bắt
     buộc), danh sách các đề xuất đã gửi kèm trạng thái (StatusTabs: Chờ duyệt/Đã duyệt/
     Từ chối).
   - Với PA04: bảng riêng "Danh sách đề xuất phát sinh chờ duyệt" tách biệt (không gộp
     chung bảng với Ma trận phê duyệt kế hoạch chính thức ở Prompt 4, để tránh nhầm lẫn,
     nhưng đặt 2 bảng trên cùng 1 trang dạng 2 tab: "Kế hoạch chính thức" | "Đề xuất phát
     sinh"), có thể duyệt/từ chối độc lập với kế hoạch chính thức.
2. Ở bảng danh sách hồ sơ kiểm tra (Phân hệ C), thêm badge nhỏ "Phát sinh" (màu tím) trên
   các dòng có isAdhoc=true để phân biệt trực quan với kiểm tra theo kế hoạch.

Test: cán bộ phường A đề xuất kiểm tra đối tượng đã có trong kế hoạch phường B → bị chặn
đúng message; đề xuất đối tượng hợp lệ → PA04 thấy ở tab riêng, duyệt xong sinh inspection
mới với isAdhoc=true.
```

---

## PROMPT 15 — CR-06 + CR-07: Nâng cấp Audit Log & Tối ưu DB theo Phường

```
Nâng cấp phần Nhật ký hệ thống và cấu trúc lưu trữ để phù hợp yêu cầu tra cứu nhanh theo
phường/xã và truy vết chi tiết hơn.

BACKEND:
1. Mở rộng bảng `audit_logs` (đã có từ Prompt 2): thêm cột `ward` (denormalize sẵn ward liên
   quan tới entity bị tác động, để lọc nhanh không cần join), `beforeData` (json — snapshot
   dữ liệu trước khi sửa) và `afterData` (json — snapshot sau khi sửa), `ipAddress`.
2. Cập nhật middleware ghi audit log (Prompt 2) để tự động lấy snapshot trước/sau với các
   thao tác PUT/PATCH (so sánh field nào thay đổi), và điền `ward` từ entity liên quan
   (business_objects.ward, plans qua object, inspections qua object...).
3. Thêm INDEX trên các cột hay filter theo phường để tăng tốc truy vấn: tạo index
   `idx_objects_ward` trên business_objects(ward), `idx_plans_ward_quarter` trên
   plans(ward, quarter), `idx_inspections_ward_status` trên inspections
   (ward tính gián tiếp qua object — nếu cần, denormalize thêm cột `ward` ngay trong bảng
   inspections để tránh join khi filter, và index luôn cột đó).
4. GET /api/audit-logs — bổ sung filter `ward`, và thêm endpoint GET /api/audit-logs/:id/diff
   trả về so sánh trực quan beforeData vs afterData (danh sách field nào đổi, giá trị cũ/mới).

FRONTEND:
1. Trang Nhật ký hệ thống (Prompt 2): thêm cột "Đơn vị/Phường", thêm filter theo phường,
   thêm nút "Xem chi tiết thay đổi" mở dialog hiển thị bảng 2 cột (Trước/Sau) theo field,
   field nào thay đổi thì bôi vàng.
2. Ở mọi trang danh sách có filter theo phường (Đối tượng, Kế hoạch, Kiểm tra) đảm bảo
   filter phường luôn dùng chung 1 component "WardSelect" (lấy từ GET /api/wards ở Prompt 12)
   để đồng nhất và tận dụng index mới, tránh gõ tay tên phường.

Không cần thay đổi sang kiến trúc sharding/multi-tenant thật cho bản demo — mục tiêu chỉ là
đảm bảo mọi truy vấn danh sách chính đều lọc/sắp xếp hiệu quả theo phường bằng index, và
audit log tra cứu theo phường được nhanh, rõ ràng.
```

---

## PROMPT 16 — CR-12: Tối ưu lại UI/UX — giảm rối mắt, ưu tiên thông tin quan trọng

```
Khách hàng phản hồi giao diện hiện đang hiển thị QUÁ NHIỀU thông tin cùng lúc, gây rối mắt.
Hãy rà soát và tinh gọn lại theo nguyên tắc "progressive disclosure" (chỉ hiện thông tin cốt
lõi trước, chi tiết xem thêm khi cần):

1. DASHBOARD TỔNG (Prompt 6 + 11 + 12): sắp xếp lại theo thứ tự ưu tiên thị giác —
   - Hàng 1 (trên cùng): 4 thẻ số liệu quan trọng nhất (Tổng đối tượng, % hoàn thành,
     Quá hạn, Cảnh báo chưa xử lý) — bỏ bớt các thẻ phụ ít dùng, gộp vào 1 nút "Xem thêm
     chỉ số khác" mở rộng khi cần.
   - Hàng 2: Gauge tổng + Top 5 nhanh/chậm (chỉ hiện Top 5 chậm mặc định, có toggle chuyển
     sang Top 5 nhanh, KHÔNG hiện cả 2 bảng cùng lúc để đỡ chật).
   - Hàng 3: Line chart tiến độ + Pie chart chấp hành (2 cột song song, không xếp dọc).
   - Khối "Tỷ lệ theo lĩnh vực" (Prompt 11) và Bản đồ: đưa vào 1 TAB riêng "Chi tiết lĩnh
     vực & Bản đồ" thay vì nhồi hết vào 1 trang dài — dùng mat-tab-group cho toàn trang
     Dashboard: Tab "Tổng quan" (hàng 1-3 ở trên) | Tab "Theo lĩnh vực" | Tab "Bản đồ vi phạm".
2. DATATABLE dùng chung (Prompt 1): giảm số cột hiển thị mặc định trên các bảng danh sách
   (Đối tượng, Kế hoạch, Kiểm tra) xuống còn các cột thiết yếu (5-6 cột), các thông tin phụ
   (địa chỉ đầy đủ, người đại diện, ghi chú...) chuyển vào việc click mở rộng dòng (row
   expansion) hoặc xem chi tiết, không hiển thị hết trên bảng.
3. FORM chi tiết kiểm tra (Prompt 5, 11, 13): dùng mat-expansion-panel/accordion để mỗi
   nhóm lĩnh vực checklist thu gọn mặc định (trừ nhóm đang có tiêu chí Không đạt thì tự mở),
   thay vì hiện tất cả cùng lúc.
4. Card cảnh báo (Prompt 13) và danh sách alerts (Prompt 10): mặc định chỉ hiện 5 mục gần
   nhất/quan trọng nhất trên Dashboard, có link "Xem tất cả" dẫn sang trang riêng đầy đủ.
5. Áp dụng khoảng trắng (spacing) nhất quán hơn: tăng padding giữa các khối, giảm border/
   đường viền không cần thiết, dùng shadow nhẹ để phân tách khối thay vì viền cứng khắp nơi
   — giữ đúng bảng màu đã định nghĩa ở Prompt 1.
6. Thêm chế độ "Thu gọn Sidebar" mặc định trên các màn hình Dashboard/Bản đồ (nơi cần nhiều
   không gian ngang) để tối đa không gian hiển thị biểu đồ/bản đồ.

Sau khi tinh gọn, chụp lại so sánh trước/sau (mô tả lại nếu không preview được ảnh) để xác
nhận thông tin quan trọng vẫn đầy đủ nhưng bố cục thoáng, dễ quét mắt hơn.
```

---

## GHI CHÚ TRIỂN KHAI PHASE 2

- Thứ tự khuyến nghị: **Prompt 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16**, vì CR-01/CR-11
  (Prompt 8) là rule nền tảng mà CR-02 (Prompt 9) và CR-10 (Prompt 14) đều phụ thuộc vào;
  CR-03/04 (Prompt 11) là nền cho CR-05 (Prompt 12) và CR-09 (Prompt 13).
- CR-12 (Prompt 16 — UI declutter) nên làm **sau cùng**, sau khi mọi tính năng mới đã có đủ
  dữ liệu/màn hình để biết chỗ nào thực sự cần tinh gọn.
- Về CR-02 (ký số): vì đây là bản demo, phần ký số bằng token USB/HSM thật (VNPT-CA,
  Viettel-CA, FastCA...) cần SDK riêng và môi trường triển khai thật — bản demo chỉ giả lập
  UI/luồng nghiệp vụ. Cần nêu rõ với khách hàng đây là điểm cần làm việc riêng với đơn vị
  cung cấp chứng thư số khi lên production.
- Sau mỗi prompt, chạy lại các test case liệt kê cuối mỗi prompt trước khi sang bước kế tiếp,
  và nên hồi quy (regression) nhanh các luồng chính đã có ở Phase 1 (Prompt 0-7) để đảm bảo
  không phá vỡ tính năng cũ.
