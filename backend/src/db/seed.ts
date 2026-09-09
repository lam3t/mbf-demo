import bcrypt from 'bcryptjs';
import { db, initDatabase } from './connection';

export function runSeed() {
  console.log('🌱 Starting Database Seeding...');
  initDatabase();

  // Hash demo password
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);

  // 1. Seed Users (4 demo accounts required)
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, passwordHash, fullName, role, unit, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const users = [
    { id: 1, username: 'admin', fullName: 'Quản trị viên Hệ thống', role: 'admin', unit: 'PA04 - Quản trị' },
    { id: 2, username: 'leader', fullName: 'Đ/c Nguyễn Văn An - Lãnh đạo PA04', role: 'leader_pa04', unit: 'Phòng PA04' },
    { id: 3, username: 'officer1', fullName: 'Đ/c Trần Thị Bình - Cán bộ PA04', role: 'officer_pa04', unit: 'Phòng PA04' },
    { id: 4, username: 'ward1', fullName: 'Đ/c Lê Văn Cường - Cán bộ Phường Hoàn Kiếm', role: 'officer_ward', unit: 'Phường Hoàn Kiếm' }
  ];

  for (const u of users) {
    insertUser.run(u.id, u.username, passwordHash, u.fullName, u.role, u.unit, 1);
  }
  console.log(`✅ Seeded ${users.length} demo users (password: 123456)`);

  // 2. Seed Violation Catalog
  const insertViolation = db.prepare(`
    INSERT OR REPLACE INTO violation_catalog (id, code, name)
    VALUES (?, ?, ?)
  `);

  const violations = [
    { id: 1, code: 'L01', name: 'Lỗi 01 - Không có giấy ĐKKD' },
    { id: 2, code: 'L02', name: 'Lỗi 02 - Vi phạm PCCC' },
    { id: 3, code: 'L03', name: 'Lỗi 03 - Sai địa điểm kinh doanh' },
    { id: 4, code: 'L04', name: 'Lỗi 04 - Không niêm yết giá' }
  ];

  for (const v of violations) {
    insertViolation.run(v.id, v.code, v.name);
  }
  console.log(`✅ Seeded ${violations.length} violation catalog items`);

  // 3. Seed Recommendation Tag Catalog
  const insertTag = db.prepare(`
    INSERT OR REPLACE INTO recommendation_tag_catalog (id, code, name)
    VALUES (?, ?, ?)
  `);

  const tags = [
    { id: 1, code: 'THUE', name: 'Thuế' },
    { id: 2, code: 'DAT_DAI', name: 'Đất đai' },
    { id: 3, code: 'MOI_TRUONG', name: 'Môi trường' },
    { id: 4, code: 'ANTT', name: 'An ninh trật tự' }
  ];

  for (const t of tags) {
    insertTag.run(t.id, t.code, t.name);
  }
  console.log(`✅ Seeded ${tags.length} recommendation tag catalog items`);

  // 4. Seed Quota Configs (5 wards, Q2/2026, min 30, max 100)
  const insertQuota = db.prepare(`
    INSERT OR REPLACE INTO quota_configs (id, ward, quarter, minCount, maxCount)
    VALUES (?, ?, ?, ?, ?)
  `);

  const wards = [
    'Phường Hoàn Kiếm',
    'Phường Ba Đình',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy'
  ];

  wards.forEach((ward, index) => {
    insertQuota.run(index + 1, ward, 'Q2/2026', 30, 100);
  });
  console.log(`✅ Seeded quota configs for ${wards.length} wards (Q2/2026: 30 - 100)`);

  // 5. Seed Cutoff Config
  const insertCutoff = db.prepare(`
    INSERT OR REPLACE INTO cutoff_configs (id, quarter, cutoffDateTime)
    VALUES (?, ?, ?)
  `);
  insertCutoff.run(1, 'Q2/2026', '2026-06-30 23:59:59');
  console.log('✅ Seeded cutoff config for Q2/2026');

  // 6. Seed Plans FIRST (so business_objects can reference planId or vice-versa)
  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans (id, quarter, ward, status, rejectReason, submittedBy, submittedAt, approvedBy, approvedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))
  `);

  const samplePlans = [
    { id: 1, quarter: 'Q2/2026', ward: 'Phường Hoàn Kiếm', status: 'approved', rejectReason: null, submittedBy: 4, submittedAt: '2026-04-05 08:30:00', approvedBy: 2, approvedAt: '2026-04-06 09:15:00' },
    { id: 2, quarter: 'Q2/2026', ward: 'Phường Ba Đình', status: 'approved', rejectReason: null, submittedBy: 3, submittedAt: '2026-04-07 10:00:00', approvedBy: 2, approvedAt: '2026-04-08 14:00:00' },
    { id: 3, quarter: 'Q2/2026', ward: 'Phường Đống Đa', status: 'pending', rejectReason: null, submittedBy: 3, submittedAt: '2026-04-10 11:20:00', approvedBy: null, approvedAt: null },
    { id: 4, quarter: 'Q2/2026', ward: 'Phường Hai Bà Trưng', status: 'draft', rejectReason: null, submittedBy: 3, submittedAt: null, approvedBy: null, approvedAt: null },
    { id: 5, quarter: 'Q2/2026', ward: 'Phường Cầu Giấy', status: 'rejected', rejectReason: 'Số lượng đối tượng chưa đạt ngưỡng tối thiểu 30 cơ sở theo Quota.', submittedBy: 3, submittedAt: '2026-04-09 15:45:00', approvedBy: 2, approvedAt: '2026-04-10 08:30:00' }
  ];

  for (const p of samplePlans) {
    insertPlan.run(p.id, p.quarter, p.ward, p.status, p.rejectReason, p.submittedBy, p.submittedAt, p.approvedBy, p.approvedAt);
  }
  console.log(`✅ Seeded ${samplePlans.length} sample plans`);

  // 7. Seed Sample Business Objects
  const insertObject = db.prepare(`
    INSERT OR REPLACE INTO business_objects (id, type, taxCode, idNumber, name, representative, address, ward, status, lastCheckedYear, planId, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const sampleObjects = [
    // Hoàn Kiếm
    { id: 1, type: 'enterprise', taxCode: '0101234567', idNumber: null, name: 'Công ty TNHH Thương mại Dịch vụ Tràng Tiền', representative: 'Nguyễn Văn Hùng', address: 'Số 15 Tràng Tiền', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 2, type: 'enterprise', taxCode: '0102345678', idNumber: null, name: 'Công ty CP Khách sạn & Du lịch Phố Cổ', representative: 'Trần Thị Mai', address: 'Số 38 Hàng Bạc', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 3, type: 'household', taxCode: '0103456789', idNumber: '001090012345', name: 'Hộ kinh doanh Cà phê Đinh Liệt', representative: 'Lê Văn Tuấn', address: 'Số 12 Đinh Liệt', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 4, type: 'household', taxCode: '0104567890', idNumber: '001090023456', name: 'Hộ kinh doanh Tạp hóa Hàng Gai', representative: 'Phạm Thị Lan', address: 'Số 55 Hàng Gai', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 5, type: 'individual', taxCode: null, idNumber: '001090034567', name: 'Nguyễn Văn Minh (Dịch vụ Phố đi bộ)', representative: 'Nguyễn Văn Minh', address: 'Số 2 Lê Thái Tổ', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 6, type: 'enterprise', taxCode: '0105112233', idNumber: null, name: 'Công ty TNHH Ẩm thực Hồ Gươm', representative: 'Vũ Hải Đăng', address: 'Số 9 Đinh Tiên Hoàng', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 7, type: 'household', taxCode: '0105223344', idNumber: '001090033445', name: 'Hộ KD Quán Bar Tạ Hiện', representative: 'Bùi Thế Vinh', address: 'Số 22 Tạ Hiện', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 8, type: 'enterprise', taxCode: '0105334455', idNumber: null, name: 'Công ty CP Thời trang Hàng Bông', representative: 'Đỗ Thùy Linh', address: 'Số 112 Hàng Bông', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    
    // Ba Đình
    { id: 9, type: 'enterprise', taxCode: '0105678901', idNumber: null, name: 'Công ty CP Đầu tư Ẩm thực Kim Mã', representative: 'Hoàng Văn Nam', address: 'Số 280 Kim Mã', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 10, type: 'enterprise', taxCode: '0106789012', idNumber: null, name: 'Công ty TNHH Dịch vụ Bảo vệ Ba Đình', representative: 'Vũ Quốc Toàn', address: 'Số 95 Đội Cấn', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 11, type: 'household', taxCode: '0107890123', idNumber: '001090045678', name: 'Hộ kinh doanh Karaoke Trúc Bạch', representative: 'Đỗ Văn Hưng', address: 'Số 18 Trúc Bạch', ward: 'Phường Ba Đình', status: 'suspended', lastCheckedYear: 2025, planId: 2, createdBy: 3 },
    { id: 12, type: 'individual', taxCode: null, idNumber: '001090056789', name: 'Trần Văn Đức (Kinh doanh Đồ uống mang đi)', representative: 'Trần Văn Đức', address: 'Số 42 Giảng Võ', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 13, type: 'enterprise', taxCode: '0106112233', idNumber: null, name: 'Công ty CP Khách sạn Giảng Võ Plaza', representative: 'Lý Quốc Sư', address: 'Số 152 Giảng Võ', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 14, type: 'household', taxCode: '0106223344', idNumber: '001090066778', name: 'Hộ KD Phòng trà Liễu Giai', representative: 'Phan Thị Yến', address: 'Số 68 Liễu Giai', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 15, type: 'enterprise', taxCode: '0106334455', idNumber: null, name: 'Công ty TNHH Spa & Massage Quán Thánh', representative: 'Lê Thu Hương', address: 'Số 89 Quán Thánh', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },

    // Đống Đa
    { id: 16, type: 'enterprise', taxCode: '0108901234', idNumber: null, name: 'Công ty CP Thiết bị Điện tử Thái Hà', representative: 'Bùi Anh Tuấn', address: 'Số 120 Thái Hà', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 17, type: 'household', taxCode: '0109012345', idNumber: '001090067890', name: 'Hộ kinh doanh Quán ăn Chùa Bộc', representative: 'Ngô Thị Thúy', address: 'Số 88 Chùa Bộc', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 18, type: 'enterprise', taxCode: '0109123456', idNumber: null, name: 'Công ty TNHH Tư vấn & Giáo dục Tây Sơn', representative: 'Dương Đình Nghệ', address: 'Số 229 Tây Sơn', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 19, type: 'household', taxCode: '0107112233', idNumber: '001090077889', name: 'Hộ KD Cửa hàng Máy tính Láng Hạ', representative: 'Nguyễn Tấn Đạt', address: 'Số 45 Láng Hạ', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 20, type: 'enterprise', taxCode: '0107223344', idNumber: null, name: 'Công ty TNHH Dịch vụ Game Xã Đàn', representative: 'Lương Thế Vinh', address: 'Số 360 Xã Đàn', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 21, type: 'household', taxCode: '0107334455', idNumber: '001090088990', name: 'Hộ KD Quán bia Tôn Đức Thắng', representative: 'Hoàng Trung Hải', address: 'Số 178 Tôn Đức Thắng', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },

    // Hai Bà Trưng
    { id: 22, type: 'enterprise', taxCode: '0109234567', idNumber: null, name: 'Công ty CP May mặc & Thời trang Phố Huế', representative: 'Phan Minh Hoàng', address: 'Số 310 Phố Huế', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },
    { id: 23, type: 'household', taxCode: '0109345678', idNumber: '001090078901', name: 'Hộ kinh doanh Cửa hàng Tiện lợi Bạch Mai', representative: 'Vũ Thị Hoa', address: 'Số 145 Bạch Mai', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },
    { id: 24, type: 'enterprise', taxCode: '0108112233', idNumber: null, name: 'Công ty TNHH Thương mại Bà Triệu', representative: 'Lê Ngọc Hân', address: 'Số 54 Bà Triệu', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },
    { id: 25, type: 'household', taxCode: '0108223344', idNumber: '001090099001', name: 'Hộ KD Đại Cồ Việt BBQ', representative: 'Trần Đại Nghĩa', address: 'Số 29 Đại Cồ Việt', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },

    // Cầu Giấy
    { id: 26, type: 'enterprise', taxCode: '0109456789', idNumber: null, name: 'Công ty Cổ phần Công nghệ Thông tin Duy Tân', representative: 'Trịnh Quốc Dũng', address: 'Số 78 Duy Tân', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: 5, createdBy: 3 },
    { id: 27, type: 'household', taxCode: '0109567890', idNumber: '001090089012', name: 'Hộ kinh doanh Trò chơi Điện tử Xuân Thủy', representative: 'Đặng Thái Hà', address: 'Số 204 Xuân Thủy', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: 5, createdBy: 3 },
    { id: 28, type: 'enterprise', taxCode: '0109667788', idNumber: null, name: 'Công ty TNHH Dịch vụ Vận tải Trần Thái Tông', representative: 'Cao Bá Quát', address: 'Số 62 Trần Thái Tông', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: 5, createdBy: 3 }
  ];

  for (const obj of sampleObjects) {
    insertObject.run(
      obj.id,
      obj.type,
      obj.taxCode,
      obj.idNumber,
      obj.name,
      obj.representative,
      obj.address,
      obj.ward,
      obj.status,
      obj.lastCheckedYear,
      obj.planId,
      obj.createdBy
    );
  }
  console.log(`✅ Seeded ${sampleObjects.length} business objects`);

  // 8. Seed Plan Items
  const insertPlanItem = db.prepare(`
    INSERT OR REPLACE INTO plan_items (id, planId, objectId, createdAt)
    VALUES (?, ?, ?, datetime('now'))
  `);

  sampleObjects.forEach((obj, idx) => {
    if (obj.planId) {
      insertPlanItem.run(idx + 1, obj.planId, obj.id);
    }
  });
  console.log(`✅ Seeded plan items for objects`);

  // 9. Seed Inspections (28 records with high-density hotspot coordinates in Hoàn Kiếm, Ba Đình, Đống Đa)
  const insertInspection = db.prepare(`
    INSERT OR REPLACE INTO inspections (
      id, objectId, planId, checklist, violationCodes, evidenceFiles, recommendationNote, recommendationTags,
      status, lat, lng, ward, severity, completedAt, isLocked, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))
  `);

  const sampleInspections = [
    // Hoàn Kiếm Hotspot Cluster (High density of violations around Old Quarter)
    {
      id: 1, objectId: 1, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_1.jpg']),
      recommendationNote: 'Yêu cầu khắc phục lối thoát hiểm tầng 2 và trang bị bổ sung 03 bình bọt PCCC trong 15 ngày.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'completed', lat: 21.0255, lng: 105.8572, ward: 'Phường Hoàn Kiếm', severity: 4, completedAt: '2026-04-12 10:30:00', isLocked: 1
    },
    {
      id: 2, objectId: 2, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Đề nghị niêm yết công khai bảng giá dịch vụ phòng nghỉ bằng cả tiếng Việt và tiếng Anh.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0342, lng: 105.8515, ward: 'Phường Hoàn Kiếm', severity: 2, completedAt: '2026-04-13 14:15:00', isLocked: 1
    },
    {
      id: 3, objectId: 3, planId: 1,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_2.jpg']),
      recommendationNote: 'Cơ sở hoạt động không có giấy chứng nhận ĐKKD và không có thẩm duyệt PCCC. Đề xuất tạm đình chỉ hoạt động.',
      recommendationTags: JSON.stringify(['ANTT', 'THUE']),
      status: 'completed', lat: 21.0318, lng: 105.8528, ward: 'Phường Hoàn Kiếm', severity: 5, completedAt: '2026-04-14 09:00:00', isLocked: 1
    },
    {
      id: 4, objectId: 4, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở chấp hành tốt các quy định pháp luật.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0325, lng: 105.8492, ward: 'Phường Hoàn Kiếm', severity: 1, completedAt: '2026-04-15 16:00:00', isLocked: 1
    },
    {
      id: 5, objectId: 5, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Lấn chiếm vỉa hè dành cho người đi bộ để đặt biển hiệu quảng cáo trái phép.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'ANTT']),
      status: 'completed', lat: 21.0289, lng: 105.8535, ward: 'Phường Hoàn Kiếm', severity: 3, completedAt: '2026-04-15 17:30:00', isLocked: 1
    },
    {
      id: 6, objectId: 6, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: false, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Vi phạm an toàn PCCC bếp nấu và không niêm yết giá phụ thu ngày lễ.',
      recommendationTags: JSON.stringify(['PCCC', 'THUE']),
      status: 'completed', lat: 21.0305, lng: 105.8540, ward: 'Phường Hoàn Kiếm', severity: 4, completedAt: '2026-04-16 09:30:00', isLocked: 1
    },
    {
      id: 7, objectId: 7, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Kinh doanh quá giờ quy định, gây tiếng ồn và để bàn ghế lấn chiếm lòng đường Tạ Hiện.',
      recommendationTags: JSON.stringify(['ANTT', 'MOI_TRUONG']),
      status: 'completed', lat: 21.0348, lng: 105.8522, ward: 'Phường Hoàn Kiếm', severity: 5, completedAt: '2026-04-16 15:45:00', isLocked: 1
    },
    {
      id: 8, objectId: 8, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Nhắc nhở niêm yết giá tem nhãn đầy đủ trên sản phẩm may mặc.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0298, lng: 105.8475, ward: 'Phường Hoàn Kiếm', severity: 2, completedAt: '2026-04-17 11:00:00', isLocked: 1
    },

    // Ba Đình Hotspot Cluster
    {
      id: 9, objectId: 9, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_3.jpg']),
      recommendationNote: 'Cơ sở mở rộng diện tích kinh doanh lấn chiếm đất đai công cộng và chưa nghiệm thu PCCC.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'ANTT']),
      status: 'completed', lat: 21.0310, lng: 105.8235, ward: 'Phường Ba Đình', severity: 4, completedAt: '2026-04-16 11:20:00', isLocked: 1
    },
    {
      id: 10, objectId: 10, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở chấp hành nghiêm túc quy định đăng ký dịch vụ bảo vệ.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0380, lng: 105.8290, ward: 'Phường Ba Đình', severity: 1, completedAt: '2026-04-16 14:00:00', isLocked: 1
    },
    {
      id: 11, objectId: 11, planId: 2,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Đình chỉ hoạt động kinh doanh Karaoke do không đủ điều kiện PCCC theo Nghị định 136.',
      recommendationTags: JSON.stringify(['PCCC', 'ANTT']),
      status: 'completed', lat: 21.0450, lng: 105.8380, ward: 'Phường Ba Đình', severity: 5, completedAt: '2026-04-17 10:15:00', isLocked: 1
    },
    {
      id: 12, objectId: 12, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Bán hàng rong lấn chiếm vỉa hè phố Giảng Võ.',
      recommendationTags: JSON.stringify(['DAT_DAI']),
      status: 'completed', lat: 21.0265, lng: 105.8240, ward: 'Phường Ba Đình', severity: 2, completedAt: '2026-04-17 14:30:00', isLocked: 1
    },
    {
      id: 13, objectId: 13, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Hệ thống báo cháy tự động tầng hầm bị lỗi kết nối, yêu cầu bảo trì ngay.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'completed', lat: 21.0280, lng: 105.8210, ward: 'Phường Ba Đình', severity: 3, completedAt: '2026-04-18 09:00:00', isLocked: 1
    },
    {
      id: 14, objectId: 14, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: '', recommendationTags: JSON.stringify([]),
      status: 'in_progress', lat: 21.0345, lng: 105.8155, ward: 'Phường Ba Đình', severity: 1, completedAt: null, isLocked: 0
    },
    {
      id: 15, objectId: 15, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Chưa niêm yết bảng giá dịch vụ trị liệu tại sảnh lễ tân.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'in_progress', lat: 21.0420, lng: 105.8395, ward: 'Phường Ba Đình', severity: 2, completedAt: null, isLocked: 0
    },

    // Đống Đa Hotspot Cluster
    {
      id: 16, objectId: 16, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở đáp ứng đầy đủ tiêu chuẩn kinh doanh.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0125, lng: 105.8210, ward: 'Phường Đống Đa', severity: 1, completedAt: '2026-04-18 15:00:00', isLocked: 1
    },
    {
      id: 17, objectId: 17, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: false, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Bếp ăn không có bình chữa cháy, không niêm yết giá thực đơn chi tiết.',
      recommendationTags: JSON.stringify(['PCCC', 'THUE']),
      status: 'completed', lat: 21.0080, lng: 105.8285, ward: 'Phường Đống Đa', severity: 3, completedAt: '2026-04-19 10:00:00', isLocked: 1
    },
    {
      id: 18, objectId: 18, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Trung tâm đào tạo chặn cửa thoát hiểm cầu thang bộ bằng bàn ghế cũ.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'completed', lat: 21.0110, lng: 105.8240, ward: 'Phường Đống Đa', severity: 4, completedAt: '2026-04-19 14:20:00', isLocked: 1
    },
    {
      id: 19, objectId: 19, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Để xe của khách tràn ra vỉa hè phố Láng Hạ.',
      recommendationTags: JSON.stringify(['ANTT']),
      status: 'in_progress', lat: 21.0165, lng: 105.8150, ward: 'Phường Đống Đa', severity: 2, completedAt: null, isLocked: 0
    },
    {
      id: 20, objectId: 20, planId: 3,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Quán game không giấy phép hoạt động điểm truy nhập internet công cộng, không có tiêu lệnh PCCC.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'in_progress', lat: 21.0145, lng: 105.8340, ward: 'Phường Đống Đa', severity: 4, completedAt: null, isLocked: 0
    },
    {
      id: 21, objectId: 21, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Kê bàn ghế kinh doanh ngoài hành lang bảo vệ đê điều và lòng đường.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'MOI_TRUONG']),
      status: 'not_started', lat: 21.0230, lng: 105.8315, ward: 'Phường Đống Đa', severity: 3, completedAt: null, isLocked: 0
    },

    // Hai Bà Trưng Cluster
    {
      id: 22, objectId: 22, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: '', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0090, lng: 105.8510, ward: 'Phường Hai Bà Trưng', severity: 1, completedAt: '2026-04-20 09:30:00', isLocked: 1
    },
    {
      id: 23, objectId: 23, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Niêm yết giá không rõ ràng trên các mặt hàng tiêu dùng thiết yếu.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0015, lng: 105.8490, ward: 'Phường Hai Bà Trưng', severity: 2, completedAt: '2026-04-20 11:00:00', isLocked: 1
    },
    {
      id: 24, objectId: 24, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Tủ điện chính không có nắp bảo vệ chống cháy nổ.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'not_started', lat: 21.0180, lng: 105.8495, ward: 'Phường Hai Bà Trưng', severity: 3, completedAt: null, isLocked: 0
    },
    {
      id: 25, objectId: 25, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Khói nướng xả trực tiếp ra đường phố gây ô nhiễm môi trường, chưa trang bị bình chữa cháy.',
      recommendationTags: JSON.stringify(['MOI_TRUONG', 'PCCC']),
      status: 'not_started', lat: 21.0075, lng: 105.8450, ward: 'Phường Hai Bà Trưng', severity: 4, completedAt: null, isLocked: 0
    },

    // Cầu Giấy Cluster
    {
      id: 26, objectId: 26, planId: 5,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Doanh nghiệp công nghệ tuân thủ tốt các quy định pháp luật.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0310, lng: 105.7830, ward: 'Phường Cầu Giấy', severity: 1, completedAt: '2026-04-20 14:00:00', isLocked: 1
    },
    {
      id: 27, objectId: 27, planId: 5,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Điểm kinh doanh game online không khoảng cách quy định với trường học, thiếu bình cứu hỏa.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'completed', lat: 21.0360, lng: 105.7895, ward: 'Phường Cầu Giấy', severity: 5, completedAt: '2026-04-20 16:30:00', isLocked: 1
    },
    {
      id: 28, objectId: 28, planId: 5,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Sử dụng bãi đất trống chưa được quy hoạch làm bãi đỗ xe tải chở hàng.',
      recommendationTags: JSON.stringify(['DAT_DAI']),
      status: 'not_started', lat: 21.0300, lng: 105.7880, ward: 'Phường Cầu Giấy', severity: 3, completedAt: null, isLocked: 0
    }
  ];

  for (const ins of sampleInspections) {
    insertInspection.run(
      ins.id,
      ins.objectId,
      ins.planId,
      ins.checklist,
      ins.violationCodes,
      ins.evidenceFiles,
      ins.recommendationNote,
      ins.recommendationTags,
      ins.status,
      ins.lat,
      ins.lng,
      ins.ward,
      ins.severity,
      ins.completedAt,
      ins.isLocked
    );
  }
  console.log(`✅ Seeded ${sampleInspections.length} sample inspections with coordinates and violations`);

  // 10. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (id, userId, action, entityType, entityId, detail, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 days'))
  `);

  insertAudit.run(1, 1, 'SEED_DATABASE', 'SYSTEM', 0, JSON.stringify({ message: 'Khởi tạo dữ liệu mẫu hệ thống demo PA04' }));
  insertAudit.run(2, 4, 'CREATE_PLAN', 'PLANS', 1, JSON.stringify({ quarter: 'Q2/2026', ward: 'Phường Hoàn Kiếm' }));
  insertAudit.run(3, 2, 'APPROVE_PLAN', 'PLANS', 1, JSON.stringify({ approvedBy: 'leader_pa04', itemsCount: 4 }));
  console.log('✅ Seeded audit logs');

  console.log('🎉 Database seeding completed successfully!');
}

// Run immediately if called directly via CLI
if (require.main === module) {
  try {
    runSeed();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}
