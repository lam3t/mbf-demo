import bcrypt from 'bcryptjs';
import { db, initDatabase } from './connection';

export function runSeed(skipInit: boolean = false) {
  console.log('🌱 Starting Database Seeding with Rich Demo Dataset...');
  if (!skipInit) {
    initDatabase();
  }

  // Hash demo password
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);

  // 1. Seed Users (4 demo accounts required)
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, passwordHash, fullName, role, unit, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const users = [
    { id: 1, username: 'admin', fullName: 'Quản trị viên Hệ thống', role: 'admin', unit: 'TNT - Quản trị' },
    { id: 2, username: 'leader', fullName: 'Nguyễn Văn An - Lãnh đạo TNT', role: 'leader_tnt', unit: 'Phòng TNT' },
    { id: 3, username: 'officer1', fullName: 'Trần Thị Bình - Cán bộ TNT', role: 'officer_tnt', unit: 'Phòng TNT' },
    { id: 4, username: 'ward1', fullName: 'Lê Văn Cường - Cán bộ Phường Hoàn Kiếm', role: 'officer_ward', unit: 'Phường Hoàn Kiếm' }
  ];

  for (const u of users) {
    insertUser.run(u.id, u.username, passwordHash, u.fullName, u.role, u.unit, 1);
  }
  console.log(`✅ Seeded ${users.length} demo users (password: 123456)`);

  // 2. Seed Inspection Domains (5 specialized domains)
  db.exec(`
    INSERT OR REPLACE INTO inspection_domains (id, code, name, icon, color) VALUES
      (1, 'PCCC', 'Phòng cháy chữa cháy', 'local_fire_department', '#ef4444'),
      (2, 'ATTP', 'An toàn thực phẩm', 'restaurant', '#f59e0b'),
      (3, 'MOI_TRUONG', 'Bảo vệ môi trường', 'eco', '#10b981'),
      (4, 'TTDT', 'Trật tự đô thị', 'location_city', '#3b82f6'),
      (5, 'THUE', 'Thuế & Nghĩa vụ tài chính', 'receipt_long', '#8b5cf6');
  `);
  console.log('✅ Seeded 5 inspection domains');

  // 3. Seed Violation Catalog
  const insertViolation = db.prepare(`
    INSERT OR REPLACE INTO violation_catalog (id, code, name)
    VALUES (?, ?, ?)
  `);

  const violations = [
    { id: 1, code: 'L01', name: 'Lỗi 01 - Không có giấy ĐKKD / Sai ngành nghề' },
    { id: 2, code: 'L02', name: 'Lỗi 02 - Vi phạm tiêu chuẩn an toàn PCCC' },
    { id: 3, code: 'L03', name: 'Lỗi 03 - Lấn chiếm lòng đường, vỉa hè, sai địa điểm kinh doanh' },
    { id: 4, code: 'L04', name: 'Lỗi 04 - Không niêm yết giá hàng hóa / dịch vụ công khai' },
    { id: 5, code: 'L05', name: 'Lỗi 05 - Vi phạm vệ sinh an toàn thực phẩm' },
    { id: 6, code: 'L06', name: 'Lỗi 06 - Xả thải gây ô nhiễm môi trường / tiếng ồn' }
  ];

  for (const v of violations) {
    insertViolation.run(v.id, v.code, v.name);
  }
  console.log(`✅ Seeded ${violations.length} violation catalog items`);

  // 4. Seed Recommendation Tag Catalog
  const insertTag = db.prepare(`
    INSERT OR REPLACE INTO recommendation_tag_catalog (id, code, name)
    VALUES (?, ?, ?)
  `);

  const tags = [
    { id: 1, code: 'PCCC', name: 'Phòng cháy chữa cháy' },
    { id: 2, code: 'ATTP', name: 'An toàn thực phẩm' },
    { id: 3, code: 'MOI_TRUONG', name: 'Bảo vệ môi trường' },
    { id: 4, code: 'ANTT', name: 'Trật tự đô thị & ANTT' },
    { id: 5, code: 'THUE', name: 'Thuế & Tài chính' },
    { id: 6, code: 'DAT_DAI', name: 'Đất đai & Xây dựng' }
  ];

  for (const t of tags) {
    insertTag.run(t.id, t.code, t.name);
  }
  console.log(`✅ Seeded ${tags.length} recommendation tag catalog items`);

  // 5. Seed Quota Configs (5 wards, Q2/2026, min 3, max 10)
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
    insertQuota.run(index + 1, ward, 'Q2/2026', 3, 10);
  });
  console.log(`✅ Seeded quota configs for ${wards.length} wards (Q2/2026: 3 - 10)`);

  // 6. Seed Cutoff Config
  const insertCutoff = db.prepare(`
    INSERT OR REPLACE INTO cutoff_configs (id, quarter, cutoffDateTime)
    VALUES (?, ?, ?)
  `);
  insertCutoff.run(1, 'Q2/2026', '2026-06-30 23:59:59');
  console.log('✅ Seeded cutoff config for Q2/2026');

  // 7. Seed Plans
  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans (id, quarter, year, ward, status, rejectReason, signedDocumentUrl, submittedBy, submittedAt, approvedBy, approvedAt, dueDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))
  `);

  const samplePlans = [
    { id: 1, quarter: 'Q2/2026', year: 2026, ward: 'Phường Hoàn Kiếm', status: 'approved', rejectReason: null, signedDocumentUrl: '/uploads/sample_scan_hoankiem.pdf', submittedBy: 4, submittedAt: '2026-04-05 08:30:00', approvedBy: 2, approvedAt: '2026-04-06 09:15:00', dueDate: '2026-06-25 17:00:00' },
    { id: 2, quarter: 'Q2/2026', year: 2026, ward: 'Phường Ba Đình', status: 'approved', rejectReason: null, signedDocumentUrl: '/uploads/sample_scan_badinh.pdf', submittedBy: 3, submittedAt: '2026-04-07 10:00:00', approvedBy: 2, approvedAt: '2026-04-08 14:00:00', dueDate: '2026-06-25 17:00:00' },
    { id: 3, quarter: 'Q2/2026', year: 2026, ward: 'Phường Đống Đa', status: 'pending', rejectReason: null, signedDocumentUrl: '/uploads/sample_scan_dongda.pdf', submittedBy: 3, submittedAt: '2026-04-10 11:20:00', approvedBy: null, approvedAt: null, dueDate: '2026-06-28 17:00:00' },
    { id: 4, quarter: 'Q2/2026', year: 2026, ward: 'Phường Hai Bà Trưng', status: 'draft', rejectReason: null, signedDocumentUrl: null, submittedBy: 3, submittedAt: null, approvedBy: null, approvedAt: null, dueDate: '2026-06-30 17:00:00' },
    { id: 5, quarter: 'Q2/2026', year: 2026, ward: 'Phường Cầu Giấy', status: 'rejected', rejectReason: 'Số lượng đối tượng chưa đạt chỉ tiêu theo Quota tối thiểu 3 cơ sở.', signedDocumentUrl: null, submittedBy: 3, submittedAt: '2026-04-09 15:45:00', approvedBy: 2, approvedAt: '2026-04-10 08:30:00', dueDate: '2026-06-30 17:00:00' }
  ];

  for (const p of samplePlans) {
    insertPlan.run(p.id, p.quarter, p.year, p.ward, p.status, p.rejectReason, p.signedDocumentUrl, p.submittedBy, p.submittedAt, p.approvedBy, p.approvedAt, p.dueDate);
  }
  console.log(`✅ Seeded ${samplePlans.length} sample plans`);

  // 8. Seed Digital Signature for Plan 1 & Plan 2
  const insertSig = db.prepare(`
    INSERT OR REPLACE INTO digital_signatures (id, planId, signedByUserId, signedByRole, signatureType, certificateInfo, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-4 days'))
  `);

  insertSig.run(
    1,
    1,
    2,
    'leader_tnt',
    'digital_token',
    JSON.stringify({
      serialNumber: '54:02:AA:7E:9C:31:2026',
      issuer: 'Ban Cơ yếu Chính phủ - Ban Quản lý Chứng thư số',
      subject: 'Nguyễn Văn An - Trưởng phòng PA04',
      validFrom: '2025-01-01T00:00:00.000Z',
      validTo: '2028-01-01T00:00:00.000Z',
      signedAt: '2026-04-06T09:15:00.000Z'
    })
  );

  insertSig.run(
    2,
    2,
    2,
    'leader_tnt',
    'digital_token',
    JSON.stringify({
      serialNumber: '54:02:AA:7E:AF:88:2026',
      issuer: 'Ban Cơ yếu Chính phủ - Ban Quản lý Chứng thư số',
      subject: 'Nguyễn Văn An - Trưởng phòng PA04',
      validFrom: '2025-01-01T00:00:00.000Z',
      validTo: '2028-01-01T00:00:00.000Z',
      signedAt: '2026-04-08T14:00:00.000Z'
    })
  );

  // 9. Seed Business Objects (50 records: 28 in plans, 20 unassigned ready for cart & adhoc, 2 cross-ward joint candidates)
  const insertObject = db.prepare(`
    INSERT OR REPLACE INTO business_objects (id, type, taxCode, idNumber, name, representative, address, ward, status, lastCheckedYear, planId, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-10 days'))
  `);

  const sampleObjects = [
    // --- Hoàn Kiếm: Plan 1 (Objects 1-8) ---
    { id: 1, type: 'enterprise', taxCode: '0101234567', idNumber: null, name: 'Công ty TNHH Thương mại Dịch vụ Tràng Tiền', representative: 'Nguyễn Văn Hùng', address: 'Số 15 Tràng Tiền', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 2, type: 'enterprise', taxCode: '0102345678', idNumber: null, name: 'Công ty CP Khách sạn & Du lịch Phố Cổ', representative: 'Trần Thị Mai', address: 'Số 38 Hàng Bạc', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 3, type: 'household', taxCode: '0103456789', idNumber: '001090012345', name: 'Hộ kinh doanh Cà phê Đinh Liệt', representative: 'Lê Văn Tuấn', address: 'Số 12 Đinh Liệt', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 4, type: 'household', taxCode: '0104567890', idNumber: '001090023456', name: 'Hộ kinh doanh Tạp hóa Hàng Gai', representative: 'Phạm Thị Lan', address: 'Số 55 Hàng Gai', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 5, type: 'individual', taxCode: null, idNumber: '001090034567', name: 'Nguyễn Văn Minh (Dịch vụ Phố đi bộ)', representative: 'Nguyễn Văn Minh', address: 'Số 2 Lê Thái Tổ', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 6, type: 'enterprise', taxCode: '0105112233', idNumber: null, name: 'Công ty TNHH Ẩm thực Hồ Gươm', representative: 'Vũ Hải Đăng', address: 'Số 9 Đinh Tiên Hoàng', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 7, type: 'household', taxCode: '0105223344', idNumber: '001090033445', name: 'Hộ KD Quán Bar Tạ Hiện', representative: 'Bùi Thế Vinh', address: 'Số 22 Tạ Hiện', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },
    { id: 8, type: 'enterprise', taxCode: '0105334455', idNumber: null, name: 'Công ty CP Thời trang Hàng Bông', representative: 'Đỗ Thùy Linh', address: 'Số 112 Hàng Bông', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: 2026, planId: 1, createdBy: 4 },

    // --- Ba Đình: Plan 2 (Objects 9-15) ---
    { id: 9, type: 'enterprise', taxCode: '0105678901', idNumber: null, name: 'Công ty CP Đầu tư Ẩm thực Kim Mã', representative: 'Hoàng Văn Nam', address: 'Số 280 Kim Mã', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: 2026, planId: 2, createdBy: 3 },
    { id: 10, type: 'enterprise', taxCode: '0106789012', idNumber: null, name: 'Công ty TNHH Dịch vụ Bảo vệ Ba Đình', representative: 'Vũ Quốc Toàn', address: 'Số 95 Đội Cấn', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: 2026, planId: 2, createdBy: 3 },
    { id: 11, type: 'household', taxCode: '0107890123', idNumber: '001090045678', name: 'Hộ kinh doanh Karaoke Trúc Bạch', representative: 'Đỗ Văn Hưng', address: 'Số 18 Trúc Bạch', ward: 'Phường Ba Đình', status: 'suspended', lastCheckedYear: 2026, planId: 2, createdBy: 3 },
    { id: 12, type: 'individual', taxCode: null, idNumber: '001090056789', name: 'Trần Văn Đức (Kinh doanh Đồ uống mang đi)', representative: 'Trần Văn Đức', address: 'Số 42 Giảng Võ', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: 2026, planId: 2, createdBy: 3 },
    { id: 13, type: 'enterprise', taxCode: '0106112233', idNumber: null, name: 'Công ty CP Khách sạn Giảng Võ Plaza', representative: 'Lý Quốc Sư', address: 'Số 152 Giảng Võ', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: 2026, planId: 2, createdBy: 3 },
    { id: 14, type: 'household', taxCode: '0106223344', idNumber: '001090066778', name: 'Hộ KD Phòng trà Liễu Giai', representative: 'Phan Thị Yến', address: 'Số 68 Liễu Giai', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },
    { id: 15, type: 'enterprise', taxCode: '0106334455', idNumber: null, name: 'Công ty TNHH Spa & Massage Quán Thánh', representative: 'Lê Thu Hương', address: 'Số 89 Quán Thánh', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: 2, createdBy: 3 },

    // --- Đống Đa: Plan 3 (Objects 16-21) ---
    { id: 16, type: 'enterprise', taxCode: '0108901234', idNumber: null, name: 'Công ty CP Thiết bị Điện tử Thái Hà', representative: 'Bùi Anh Tuấn', address: 'Số 120 Thái Hà', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: 2026, planId: 3, createdBy: 3 },
    { id: 17, type: 'household', taxCode: '0109012345', idNumber: '001090067890', name: 'Hộ kinh doanh Quán ăn Chùa Bộc', representative: 'Ngô Thị Thúy', address: 'Số 88 Chùa Bộc', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: 2026, planId: 3, createdBy: 3 },
    { id: 18, type: 'enterprise', taxCode: '0109123456', idNumber: null, name: 'Công ty TNHH Tư vấn & Giáo dục Tây Sơn', representative: 'Dương Đình Nghệ', address: 'Số 229 Tây Sơn', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: 2026, planId: 3, createdBy: 3 },
    { id: 19, type: 'household', taxCode: '0107112233', idNumber: '001090077889', name: 'Hộ KD Cửa hàng Máy tính Láng Hạ', representative: 'Nguyễn Tấn Đạt', address: 'Số 45 Láng Hạ', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 20, type: 'enterprise', taxCode: '0107223344', idNumber: null, name: 'Công ty TNHH Dịch vụ Game Xã Đàn', representative: 'Lương Thế Vinh', address: 'Số 360 Xã Đàn', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },
    { id: 21, type: 'household', taxCode: '0107334455', idNumber: '001090088990', name: 'Hộ KD Quán bia Tôn Đức Thắng', representative: 'Hoàng Trung Hải', address: 'Số 178 Tôn Đức Thắng', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 },

    // --- Hai Bà Trưng: Plan 4 (Objects 22-25) ---
    { id: 22, type: 'enterprise', taxCode: '0109234567', idNumber: null, name: 'Công ty CP May mặc & Thời trang Phố Huế', representative: 'Phan Minh Hoàng', address: 'Số 310 Phố Huế', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: 2026, planId: 4, createdBy: 3 },
    { id: 23, type: 'household', taxCode: '0109345678', idNumber: '001090078901', name: 'Hộ kinh doanh Cửa hàng Tiện lợi Bạch Mai', representative: 'Vũ Thị Hoa', address: 'Số 145 Bạch Mai', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: 2026, planId: 4, createdBy: 3 },
    { id: 24, type: 'enterprise', taxCode: '0108112233', idNumber: null, name: 'Công ty TNHH Thương mại Bà Triệu', representative: 'Lê Ngọc Hân', address: 'Số 54 Bà Triệu', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },
    { id: 25, type: 'household', taxCode: '0108223344', idNumber: '001090099001', name: 'Hộ KD Đại Cồ Việt BBQ', representative: 'Trần Đại Nghĩa', address: 'Số 29 Đại Cồ Việt', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: 4, createdBy: 3 },

    // --- Cầu Giấy: Plan 5 (Objects 26-28) ---
    { id: 26, type: 'enterprise', taxCode: '0109456789', idNumber: null, name: 'Công ty Cổ phần Công nghệ Thông tin Duy Tân', representative: 'Trịnh Quốc Dũng', address: 'Số 78 Duy Tân', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: 2026, planId: 5, createdBy: 3 },
    { id: 27, type: 'household', taxCode: '0109567890', idNumber: '001090089012', name: 'Hộ kinh doanh Trò chơi Điện tử Xuân Thủy', representative: 'Đặng Thái Hà', address: 'Số 204 Xuân Thủy', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: 2026, planId: 5, createdBy: 3 },
    { id: 28, type: 'enterprise', taxCode: '0109667788', idNumber: null, name: 'Công ty TNHH Dịch vụ Vận tải Trần Thái Tông', representative: 'Cao Bá Quát', address: 'Số 62 Trần Thái Tông', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: 5, createdBy: 3 },

    // --- UNASSIGNED / FREE OBJECTS: READY TO ADD TO PLAN CART & CREATE AD-HOC (Objects 29-48) ---
    // Hoàn Kiếm Free
    { id: 29, type: 'enterprise', taxCode: '0109700001', idNumber: null, name: 'Công ty TNHH Dịch vụ Lữ hành Quốc tế Hàng Trống', representative: 'Nguyễn Thu Hà', address: 'Số 42 Hàng Trống', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: null, createdBy: 4 },
    { id: 30, type: 'household', taxCode: '0109700002', idNumber: '001090011223', name: 'Hộ kinh doanh Phở Bát Đàn Truyền Thống', representative: 'Phạm Văn Nam', address: 'Số 49 Bát Đàn', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: null, createdBy: 4 },
    { id: 31, type: 'enterprise', taxCode: '0109700003', idNumber: null, name: 'Công ty CP Mỹ phẩm & Chăm sóc Da Lương Văn Can', representative: 'Trần Hương Giang', address: 'Số 18 Lương Văn Can', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: null, createdBy: 4 },
    { id: 32, type: 'household', taxCode: '0109700004', idNumber: '001090022334', name: 'Hộ KD Tiệm Bánh Cốm Hàng Than', representative: 'Đỗ Hữu Thắng', address: 'Số 11 Hàng Than', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: null, createdBy: 4 },

    // Ba Đình Free
    { id: 33, type: 'enterprise', taxCode: '0109700005', idNumber: null, name: 'Công ty TNHH Xuất nhập khẩu Dược phẩm Kim Mã', representative: 'Lê Minh Trí', address: 'Số 195 Kim Mã', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 34, type: 'household', taxCode: '0109700006', idNumber: '001090033445', name: 'Hộ kinh doanh Bún chả Đội Cấn', representative: 'Bùi Thị Dung', address: 'Số 216 Đội Cấn', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 35, type: 'enterprise', taxCode: '0109700007', idNumber: null, name: 'Công ty CP Đầu tư Giáo dục Mầm non Liễu Giai', representative: 'Hoàng Kim Dung', address: 'Số 35 Liễu Giai', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 36, type: 'household', taxCode: '0109700008', idNumber: '001090044556', name: 'Hộ KD Cửa hàng Sữa chua Nếp cẩm Trúc Bạch', representative: 'Vũ Đức Thịnh', address: 'Số 5 Trúc Bạch', ward: 'Phường Ba Đình', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },

    // Đống Đa Free
    { id: 37, type: 'enterprise', taxCode: '0109700009', idNumber: null, name: 'Công ty CP Đầu tư & Phát triển Bất động sản Huỳnh Thúc Kháng', representative: 'Nguyễn Thành Trung', address: 'Số 16 Huỳnh Thúc Kháng', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 38, type: 'household', taxCode: '0109700010', idNumber: '001090055667', name: 'Hộ kinh doanh Trà sữa Ô Long Ô Chợ Dừa', representative: 'Trịnh Mai Linh', address: 'Số 82 Ô Chợ Dừa', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 39, type: 'enterprise', taxCode: '0109700011', idNumber: null, name: 'Công ty TNHH Truyền thông Kỹ thuật số Hoàng Cầu', representative: 'Đặng Tuấn Anh', address: 'Số 33 Hoàng Cầu', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 40, type: 'household', taxCode: '0109700012', idNumber: '001090066778', name: 'Hộ KD Bánh mì Kebab Chùa Láng', representative: 'Phan Quốc Huy', address: 'Số 110 Chùa Láng', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },

    // Hai Bà Trưng Free
    { id: 41, type: 'enterprise', taxCode: '0109700013', idNumber: null, name: 'Công ty TNHH Thiết bị Y tế Minh Khai', representative: 'Dương Văn Quý', address: 'Số 412 Minh Khai', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 42, type: 'household', taxCode: '0109700014', idNumber: '001090077889', name: 'Hộ kinh doanh Cơm tấm Sài Gòn Lạc Trung', representative: 'Võ Thành Đạt', address: 'Số 74 Lạc Trung', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 43, type: 'enterprise', taxCode: '0109700015', idNumber: null, name: 'Công ty CP Thể thao & Fitness Đại Cồ Việt', representative: 'Ngô Bảo Long', address: 'Số 102 Đại Cồ Việt', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 44, type: 'household', taxCode: '0109700016', idNumber: '001090088990', name: 'Hộ KD Tiệm hoa tươi Thanh Nhàn', representative: 'Bùi Lan Anh', address: 'Số 58 Thanh Nhàn', ward: 'Phường Hai Bà Trưng', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },

    // Cầu Giấy Free
    { id: 45, type: 'enterprise', taxCode: '0109700017', idNumber: null, name: 'Công ty CP Giải pháp Phần mềm Cloud Cầu Giấy', representative: 'Lương Hoàng Nam', address: 'Số 12 Duy Tân', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 46, type: 'household', taxCode: '0109700018', idNumber: '001090099001', name: 'Hộ kinh doanh Nhà hàng Lẩu nấm Trung Hòa', representative: 'Tô Văn Hải', address: 'Số 89 Trung Hòa', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 47, type: 'enterprise', taxCode: '0109700019', idNumber: null, name: 'Công ty TNHH Dịch vụ Kế toán & Kiểm toán Hoàng Quốc Việt', representative: 'Phạm Thanh Thủy', address: 'Số 234 Hoàng Quốc Việt', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },
    { id: 48, type: 'household', taxCode: '0109700020', idNumber: '001090099002', name: 'Hộ KD Siêu thị mini Dịch Vọng', representative: 'Trần Văn Kiên', address: 'Số 15 Dịch Vọng Hậu', ward: 'Phường Cầu Giấy', status: 'active', lastCheckedYear: null, planId: null, createdBy: 3 },

    // --- INTER-WARD CROSS CANDIDATES (Boundary objects between 2 wards for Joint Inspection warnings) ---
    { id: 49, type: 'enterprise', taxCode: '0109999001', idNumber: null, name: 'Công ty CP Tập đoàn Bán lẻ & Dịch vụ Thủ Đô (Giáp ranh Hoàn Kiếm - Ba Đình)', representative: 'Hoàng Đình Cảnh', address: 'Số 1 Phan Đình Phùng (Khu vực giáp ranh)', ward: 'Phường Hoàn Kiếm', status: 'active', lastCheckedYear: null, planId: 1, createdBy: 4 },
    { id: 50, type: 'enterprise', taxCode: '0109999002', idNumber: null, name: 'Công ty TNHH Trung tâm Thương mại & Dịch vụ Tổng hợp Giáp Ranh Đống Đa - Hai Bà Trưng', representative: 'Lê Minh Quân', address: 'Số 334 Lê Duẩn (Khu vực giáp ranh)', ward: 'Phường Đống Đa', status: 'active', lastCheckedYear: null, planId: 3, createdBy: 3 }
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
  console.log(`✅ Seeded ${sampleObjects.length} business objects (including 20 unassigned ready for cart & adhoc)`);

  // 10. Seed Plan Items
  const insertPlanItem = db.prepare(`
    INSERT OR REPLACE INTO plan_items (id, planId, objectId, createdAt)
    VALUES (?, ?, ?, datetime('now', '-5 days'))
  `);

  let planItemIdx = 1;
  sampleObjects.forEach(obj => {
    if (obj.planId) {
      insertPlanItem.run(planItemIdx++, obj.planId, obj.id);
    }
  });

  // Cross-ward joint plan items (Object 49 is in Plan 1 and also added to Plan 2 for joint demo; Object 50 in Plan 3 and Plan 4)
  insertPlanItem.run(planItemIdx++, 2, 49);
  insertPlanItem.run(planItemIdx++, 4, 50);
  console.log(`✅ Seeded ${planItemIdx - 1} plan items (including inter-ward joint links)`);

  // 11. Seed Ad-hoc Inspection Requests
  const insertAdhoc = db.prepare(`
    INSERT OR REPLACE INTO adhoc_inspection_requests (
      id, objectId, wardRequestedBy, reason, status, rejectReason, requestedBy, requestedAt, approvedBy, approvedAt, relatedQuarter, relatedYear, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
  `);

  const sampleAdhocs = [
    {
      id: 1, objectId: 30, wardRequestedBy: 'Phường Hoàn Kiếm',
      reason: 'Người dân phản ánh cơ sở có dấu hiệu vi phạm vệ sinh ATTP và để rác thải lấn chiếm lòng đường Bát Đàn.',
      status: 'pending', rejectReason: null, requestedBy: 4, requestedAt: '2026-04-18 09:30:00', approvedBy: null, approvedAt: null,
      relatedQuarter: 'Q2/2026', relatedYear: 2026
    },
    {
      id: 2, objectId: 35, wardRequestedBy: 'Phường Ba Đình',
      reason: 'Phát hiện cơ sở mầm non tự ý mở rộng phòng học tầng thượng chưa thẩm duyệt thiết kế PCCC.',
      status: 'pending', rejectReason: null, requestedBy: 3, requestedAt: '2026-04-19 14:15:00', approvedBy: null, approvedAt: null,
      relatedQuarter: 'Q2/2026', relatedYear: 2026
    },
    {
      id: 3, objectId: 38, wardRequestedBy: 'Phường Đống Đa',
      reason: 'Đơn thư công dân về tiếng ồn quán trà sữa và tụ tập xe máy cản trở giao thông giờ cao điểm.',
      status: 'approved', rejectReason: null, requestedBy: 3, requestedAt: '2026-04-15 10:00:00', approvedBy: 2, approvedAt: '2026-04-16 11:30:00',
      relatedQuarter: 'Q2/2026', relatedYear: 2026
    },
    {
      id: 4, objectId: 42, wardRequestedBy: 'Phường Hai Bà Trưng',
      reason: 'Yêu cầu kiểm tra đột xuất đối tượng do có phản ánh về việc không niêm yết giá dịch vụ.',
      status: 'rejected', rejectReason: 'Chưa đủ chứng cứ vi phạm rõ ràng, đề nghị cán bộ phường xác minh thêm trước khi trình lại.', requestedBy: 3, requestedAt: '2026-04-16 16:45:00', approvedBy: 2, approvedAt: '2026-04-17 08:30:00',
      relatedQuarter: 'Q2/2026', relatedYear: 2026
    },
    {
      id: 5, objectId: 46, wardRequestedBy: 'Phường Cầu Giấy',
      reason: 'Kiểm tra đột xuất chuyên đề phòng chống dịch bệnh và an toàn nguồn nguyên liệu thực phẩm tươi sống.',
      status: 'pending', rejectReason: null, requestedBy: 3, requestedAt: '2026-04-20 08:00:00', approvedBy: null, approvedAt: null,
      relatedQuarter: 'Q2/2026', relatedYear: 2026
    }
  ];

  for (const a of sampleAdhocs) {
    insertAdhoc.run(
      a.id, a.objectId, a.wardRequestedBy, a.reason, a.status, a.rejectReason,
      a.requestedBy, a.requestedAt, a.approvedBy, a.approvedAt, a.relatedQuarter, a.relatedYear
    );
  }
  console.log(`✅ Seeded ${sampleAdhocs.length} sample ad-hoc inspection requests`);

  // 12. Seed Inspections (28 records: 15 completed, 10 in_progress / not_started, 3 adhoc/overdue)
  const insertInspection = db.prepare(`
    INSERT OR REPLACE INTO inspections (
      id, objectId, planId, checklist, violationCodes, evidenceFiles, recommendationNote, recommendationTags,
      status, lat, lng, ward, severity, completedAt, dueDate, isOverdue, isLocked, isAdhoc, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-4 days'))
  `);

  const sampleInspections = [
    // --- Hoàn Kiếm Completed ---
    {
      id: 1, objectId: 1, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_1.jpg']),
      recommendationNote: 'Yêu cầu khắc phục lối thoát hiểm tầng 2 và trang bị bổ sung 03 bình bọt PCCC trong 15 ngày.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'completed', lat: 21.0255, lng: 105.8572, ward: 'Phường Hoàn Kiếm', severity: 4,
      completedAt: '2026-04-12 10:30:00', dueDate: '2026-05-12 10:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 2, objectId: 2, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Đề nghị niêm yết công khai bảng giá dịch vụ phòng nghỉ bằng cả tiếng Việt và tiếng Anh.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0342, lng: 105.8515, ward: 'Phường Hoàn Kiếm', severity: 2,
      completedAt: '2026-04-13 14:15:00', dueDate: '2026-05-13 14:15:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 3, objectId: 3, planId: 1,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_2.jpg']),
      recommendationNote: 'Cơ sở hoạt động không có giấy chứng nhận ĐKKD và không có thẩm duyệt PCCC. Đề xuất tạm đình chỉ hoạt động.',
      recommendationTags: JSON.stringify(['ANTT', 'THUE']),
      status: 'completed', lat: 21.0318, lng: 105.8528, ward: 'Phường Hoàn Kiếm', severity: 5,
      completedAt: '2026-04-14 09:00:00', dueDate: '2026-05-14 09:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 4, objectId: 4, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở chấp hành tốt các quy định pháp luật.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0325, lng: 105.8492, ward: 'Phường Hoàn Kiếm', severity: 1,
      completedAt: '2026-04-15 16:00:00', dueDate: '2026-05-15 16:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 5, objectId: 5, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Lấn chiếm vỉa hè dành cho người đi bộ để đặt biển hiệu quảng cáo trái phép.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'ANTT']),
      status: 'completed', lat: 21.0289, lng: 105.8535, ward: 'Phường Hoàn Kiếm', severity: 3,
      completedAt: '2026-04-15 17:30:00', dueDate: '2026-05-15 17:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 6, objectId: 6, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: false, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Vi phạm an toàn PCCC bếp nấu và không niêm yết giá phụ thu ngày lễ.',
      recommendationTags: JSON.stringify(['PCCC', 'THUE']),
      status: 'completed', lat: 21.0305, lng: 105.8540, ward: 'Phường Hoàn Kiếm', severity: 4,
      completedAt: '2026-04-16 09:30:00', dueDate: '2026-05-16 09:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 7, objectId: 7, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Kinh doanh quá giờ quy định, gây tiếng ồn và để bàn ghế lấn chiếm lòng đường Tạ Hiện.',
      recommendationTags: JSON.stringify(['ANTT', 'MOI_TRUONG']),
      status: 'completed', lat: 21.0348, lng: 105.8522, ward: 'Phường Hoàn Kiếm', severity: 5,
      completedAt: '2026-04-16 15:45:00', dueDate: '2026-05-16 15:45:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 8, objectId: 8, planId: 1,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Nhắc nhở niêm yết giá tem nhãn đầy đủ trên sản phẩm may mặc.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0298, lng: 105.8475, ward: 'Phường Hoàn Kiếm', severity: 2,
      completedAt: '2026-04-17 11:00:00', dueDate: '2026-05-17 11:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },

    // --- Ba Đình Completed & In Progress ---
    {
      id: 9, objectId: 9, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify(['/uploads/sample_evidence_3.jpg']),
      recommendationNote: 'Cơ sở mở rộng diện tích kinh doanh lấn chiếm đất đai công cộng và chưa nghiệm thu PCCC.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'ANTT']),
      status: 'completed', lat: 21.0310, lng: 105.8235, ward: 'Phường Ba Đình', severity: 4,
      completedAt: '2026-04-16 11:20:00', dueDate: '2026-05-16 11:20:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 10, objectId: 10, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở chấp hành nghiêm túc quy định đăng ký dịch vụ bảo vệ.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0380, lng: 105.8290, ward: 'Phường Ba Đình', severity: 1,
      completedAt: '2026-04-16 14:00:00', dueDate: '2026-05-16 14:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 11, objectId: 11, planId: 2,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Đình chỉ hoạt động kinh doanh Karaoke do không đủ điều kiện PCCC theo Nghị định 136.',
      recommendationTags: JSON.stringify(['PCCC', 'ANTT']),
      status: 'completed', lat: 21.0450, lng: 105.8380, ward: 'Phường Ba Đình', severity: 5,
      completedAt: '2026-04-17 10:15:00', dueDate: '2026-05-17 10:15:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 12, objectId: 12, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Bán hàng rong lấn chiếm vỉa hè phố Giảng Võ.',
      recommendationTags: JSON.stringify(['DAT_DAI']),
      status: 'completed', lat: 21.0265, lng: 105.8240, ward: 'Phường Ba Đình', severity: 2,
      completedAt: '2026-04-17 14:30:00', dueDate: '2026-05-17 14:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 13, objectId: 13, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Hệ thống báo cháy tự động tầng hầm bị lỗi kết nối, yêu cầu bảo trì ngay.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'completed', lat: 21.0280, lng: 105.8210, ward: 'Phường Ba Đình', severity: 3,
      completedAt: '2026-04-18 09:00:00', dueDate: '2026-05-18 09:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    // Ba Đình UNLOCKED & EDITABLE
    {
      id: 14, objectId: 14, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Đang tiến hành kiểm tra thực tế điều kiện âm thanh và giấy phép kinh doanh biểu diễn.',
      recommendationTags: JSON.stringify(['ANTT']),
      status: 'in_progress', lat: 21.0345, lng: 105.8155, ward: 'Phường Ba Đình', severity: 1,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
    },
    {
      id: 15, objectId: 15, planId: 2,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Nhắc nhở niêm yết bảng giá dịch vụ tại quầy tiếp đón khách.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'in_progress', lat: 21.0420, lng: 105.8395, ward: 'Phường Ba Đình', severity: 2,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
    },

    // --- Đống Đa: Completed & In Progress & Overdue ---
    {
      id: 16, objectId: 16, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Cơ sở đáp ứng đầy đủ tiêu chuẩn kinh doanh thiết bị điện tử.',
      recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0125, lng: 105.8210, ward: 'Phường Đống Đa', severity: 1,
      completedAt: '2026-04-18 15:00:00', dueDate: '2026-05-18 15:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 17, objectId: 17, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: false, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Bếp ăn không có bình chữa cháy, không niêm yết giá thực đơn chi tiết.',
      recommendationTags: JSON.stringify(['PCCC', 'THUE']),
      status: 'completed', lat: 21.0080, lng: 105.8285, ward: 'Phường Đống Đa', severity: 3,
      completedAt: '2026-04-19 10:00:00', dueDate: '2026-05-19 10:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 18, objectId: 18, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Trung tâm đào tạo chặn cửa thoát hiểm cầu thang bộ bằng bàn ghế cũ.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'completed', lat: 21.0110, lng: 105.8240, ward: 'Phường Đống Đa', severity: 4,
      completedAt: '2026-04-19 14:20:00', dueDate: '2026-05-19 14:20:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    // Đống Đa UNLOCKED & EDITABLE
    {
      id: 19, objectId: 19, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Để xe của khách tràn ra vỉa hè phố Láng Hạ.',
      recommendationTags: JSON.stringify(['ANTT']),
      status: 'in_progress', lat: 21.0165, lng: 105.8150, ward: 'Phường Đống Đa', severity: 2,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
    },
    {
      id: 20, objectId: 20, planId: 3,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Quán game không giấy phép hoạt động điểm truy nhập internet công cộng, không có tiêu lệnh PCCC.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'in_progress', lat: 21.0145, lng: 105.8340, ward: 'Phường Đống Đa', severity: 4,
      completedAt: null, dueDate: '2026-04-01 17:00:00', isOverdue: 1, isLocked: 0, isAdhoc: 0
    },
    {
      id: 21, objectId: 21, planId: 3,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Kê bàn ghế kinh doanh ngoài hành lang bảo vệ đê điều và lòng đường.',
      recommendationTags: JSON.stringify(['DAT_DAI', 'MOI_TRUONG']),
      status: 'not_started', lat: 21.0230, lng: 105.8315, ward: 'Phường Đống Đa', severity: 3,
      completedAt: null, dueDate: '2026-04-01 17:00:00', isOverdue: 1, isLocked: 0, isAdhoc: 0
    },

    // --- Hai Bà Trưng: Completed & Not Started (UNLOCKED) ---
    {
      id: 22, objectId: 22, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Doanh nghiệp thời trang tuân thủ tốt.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0090, lng: 105.8510, ward: 'Phường Hai Bà Trưng', severity: 1,
      completedAt: '2026-04-20 09:30:00', dueDate: '2026-05-20 09:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 23, objectId: 23, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: false, hygiene: true }),
      violationCodes: JSON.stringify(['L04']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Niêm yết giá không rõ ràng trên các mặt hàng tiêu dùng thiết yếu.',
      recommendationTags: JSON.stringify(['THUE']),
      status: 'completed', lat: 21.0015, lng: 105.8490, ward: 'Phường Hai Bà Trưng', severity: 2,
      completedAt: '2026-04-20 11:00:00', dueDate: '2026-05-20 11:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    // Hai Bà Trưng UNLOCKED & EDITABLE
    {
      id: 24, objectId: 24, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Tủ điện chính không có nắp bảo vệ chống cháy nổ.',
      recommendationTags: JSON.stringify(['PCCC']),
      status: 'not_started', lat: 21.0180, lng: 105.8495, ward: 'Phường Hai Bà Trưng', severity: 3,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
    },
    {
      id: 25, objectId: 25, planId: 4,
      checklist: JSON.stringify({ dkkd: true, pccc: false, location: false, price_tag: true, hygiene: false }),
      violationCodes: JSON.stringify(['L02', 'L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Khói nướng xả trực tiếp ra đường phố gây ô nhiễm môi trường, chưa trang bị bình chữa cháy.',
      recommendationTags: JSON.stringify(['MOI_TRUONG', 'PCCC']),
      status: 'in_progress', lat: 21.0075, lng: 105.8450, ward: 'Phường Hai Bà Trưng', severity: 4,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
    },

    // --- Cầu Giấy: Completed & Not Started (UNLOCKED) ---
    {
      id: 26, objectId: 26, planId: 5,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify([]), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Doanh nghiệp công nghệ tuân thủ tốt các quy định pháp luật.', recommendationTags: JSON.stringify([]),
      status: 'completed', lat: 21.0310, lng: 105.7830, ward: 'Phường Cầu Giấy', severity: 1,
      completedAt: '2026-04-20 14:00:00', dueDate: '2026-05-20 14:00:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    {
      id: 27, objectId: 27, planId: 5,
      checklist: JSON.stringify({ dkkd: false, pccc: false, location: true, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L01', 'L02']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Điểm kinh doanh game online không khoảng cách quy định với trường học, thiếu bình cứu hỏa.',
      recommendationTags: JSON.stringify(['ANTT', 'PCCC']),
      status: 'completed', lat: 21.0360, lng: 105.7895, ward: 'Phường Cầu Giấy', severity: 5,
      completedAt: '2026-04-20 16:30:00', dueDate: '2026-05-20 16:30:00', isOverdue: 0, isLocked: 1, isAdhoc: 0
    },
    // Cầu Giấy UNLOCKED & EDITABLE
    {
      id: 28, objectId: 28, planId: 5,
      checklist: JSON.stringify({ dkkd: true, pccc: true, location: false, price_tag: true, hygiene: true }),
      violationCodes: JSON.stringify(['L03']), evidenceFiles: JSON.stringify([]),
      recommendationNote: 'Sử dụng bãi đất trống chưa được quy hoạch làm bãi đỗ xe tải chở hàng.',
      recommendationTags: JSON.stringify(['DAT_DAI']),
      status: 'not_started', lat: 21.0300, lng: 105.7880, ward: 'Phường Cầu Giấy', severity: 3,
      completedAt: null, dueDate: '2026-06-30 17:00:00', isOverdue: 0, isLocked: 0, isAdhoc: 0
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
      ins.dueDate,
      ins.isOverdue,
      ins.isLocked,
      ins.isAdhoc
    );
  }
  console.log(`✅ Seeded ${sampleInspections.length} sample inspections (15 completed, 10 unlocked & editable for evaluation testing)`);

  // 13. Seed Inspection Checklist Items for 5 Specialized Domains
  db.exec('DELETE FROM inspection_checklist_items;');
  const insertItem = db.prepare(`
    INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const ins of sampleInspections) {
    let chkObj: Record<string, boolean> = { dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true };
    if (ins.checklist) {
      try {
        const parsed = JSON.parse(ins.checklist);
        if (typeof parsed === 'object') {
          chkObj = { ...chkObj, ...parsed };
        }
      } catch {}
    }

    const pcccPass = chkObj['pccc'] !== false ? 'pass' : 'fail';
    const attpPass = chkObj['hygiene'] !== false ? 'pass' : 'fail';
    const envPass = chkObj['hygiene'] !== false ? 'pass' : 'fail';
    const ttdtPass = chkObj['location'] !== false ? 'pass' : 'fail';
    const taxPass = (chkObj['price_tag'] !== false && chkObj['dkkd'] !== false) ? 'pass' : 'fail';

    // Domain 1: PCCC
    insertItem.run(ins.id, 1, 'pccc_1', 'Trang bị bình chữa cháy còn hạn & tiêu lệnh PCCC', pcccPass, pcccPass === 'fail' ? 'Bình chữa cháy hết hạn hoặc thiếu tiêu lệnh' : '');
    insertItem.run(ins.id, 1, 'pccc_2', 'Lối thoát nạn & hành lang thoát hiểm thông thoáng', pcccPass, pcccPass === 'fail' ? 'Cửa thoát hiểm bị chặn hoặc không có biển chỉ dẫn' : '');

    // Domain 2: ATTP
    insertItem.run(ins.id, 2, 'attp_1', 'Giấy chứng nhận cơ sở đủ điều kiện ATTP / Cam kết ATTP', attpPass, attpPass === 'fail' ? 'Chưa xuất trình được giấy chứng nhận ATTP' : '');
    insertItem.run(ins.id, 2, 'attp_2', 'Nguồn gốc nguyên liệu & điều kiện vệ sinh bảo quản', attpPass, attpPass === 'fail' ? 'Bảo quản thực phẩm chưa đạt chuẩn vệ sinh' : '');

    // Domain 3: MOI_TRUONG
    insertItem.run(ins.id, 3, 'env_1', 'Thu gom, phân loại & xử lý rác thải / nước thải đúng quy định', envPass, envPass === 'fail' ? 'Chưa phân loại rác thải tại nguồn' : '');
    insertItem.run(ins.id, 3, 'env_2', 'Không gây ô nhiễm tiếng ồn, khói bụi vượt quy chuẩn', 'pass', '');

    // Domain 4: TTDT
    insertItem.run(ins.id, 4, 'ttdt_1', 'Không lấn chiếm lòng lề đường, vỉa hè, hành lang an toàn', ttdtPass, ttdtPass === 'fail' ? 'Bàn ghế, biển quảng cáo lấn chiếm vỉa hè' : '');
    insertItem.run(ins.id, 4, 'ttdt_2', 'Biển hiệu, bảng quảng cáo đúng quy chuẩn cấp phép', 'pass', '');

    // Domain 5: THUE
    insertItem.run(ins.id, 5, 'tax_1', 'Đăng ký kinh doanh & niêm yết giá công khai', taxPass, taxPass === 'fail' ? 'Không niêm yết bảng giá hoặc sai ngành nghề ĐKKD' : '');
    insertItem.run(ins.id, 5, 'tax_2', 'Kê khai & thực hiện đầy đủ nghĩa vụ thuế / hóa đơn', chkObj['dkkd'] !== false ? 'pass' : 'fail', '');
  }
  console.log(`✅ Seeded checklist items across all 5 domains for all inspections`);

  // 14. Seed Business Notices
  const insertNotice = db.prepare(`
    INSERT OR REPLACE INTO business_notices (id, inspectionId, objectId, sentByUserId, method, sentAt, note, fileUrl, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
  `);

  insertNotice.run(1, 1, 1, 4, 'van_ban_giay', '2026-04-13 09:00:00', 'Đã chuyển văn bản thông báo số 12/TB-UBND yêu cầu khắc phục PCCC.', '/uploads/notice_sample_1.pdf');
  insertNotice.run(2, 3, 3, 4, 'van_ban_giay', '2026-04-15 10:30:00', 'Đã gửi thông báo yêu cầu tạm dừng hoạt động do thiếu ĐKKD và PCCC.', '/uploads/notice_sample_2.pdf');
  console.log(`✅ Seeded sample business notices`);

  // 15. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (id, userId, action, entityType, entityId, detail, ward, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 days'))
  `);

  insertAudit.run(1, 1, 'SEED_DATABASE', 'SYSTEM', 0, JSON.stringify({ message: 'Khởi tạo dữ liệu mẫu hệ thống demo TNT' }), 'Toàn thành phố');
  insertAudit.run(2, 4, 'CREATE_PLAN', 'PLANS', 1, JSON.stringify({ quarter: 'Q2/2026', ward: 'Phường Hoàn Kiếm' }), 'Phường Hoàn Kiếm');
  insertAudit.run(3, 2, 'APPROVE_PLAN', 'PLANS', 1, JSON.stringify({ approvedBy: 'Nguyễn Văn An - Lãnh đạo TNT', itemsCount: 8 }), 'Phường Hoàn Kiếm');
  insertAudit.run(4, 4, 'CREATE_ADHOC_REQUEST', 'ADHOC_REQUESTS', 1, JSON.stringify({ objectId: 30, reason: 'Phản ánh vệ sinh ATTP' }), 'Phường Hoàn Kiếm');
  console.log('✅ Seeded audit logs');

  console.log('🎉 Full rich database seeding completed successfully!');
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
