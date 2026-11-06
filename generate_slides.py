import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Brand Colors
    MBF_BLUE = RGBColor(0, 91, 170)        # MobiFone Primary Blue #005BAA
    MBF_DARK_BLUE = RGBColor(10, 37, 72)    # Deep Navy #0A2548
    MBF_RED = RGBColor(227, 24, 55)        # MobiFone Red #E31837
    MBF_LIGHT_BG = RGBColor(245, 247, 250) # Light Slate #F5F7FA
    WHITE = RGBColor(255, 255, 255)
    DARK_TEXT = RGBColor(30, 41, 59)       # #1E293B
    MUTED_TEXT = RGBColor(100, 116, 139)   # #64748B
    CARD_BG = RGBColor(255, 255, 255)
    CARD_BORDER = RGBColor(218, 225, 233)  # #DAE1E9
    ACCENT_GREEN = RGBColor(16, 185, 129)  # #10B981
    ACCENT_AMBER = RGBColor(245, 158, 11)  # #F59E0B
    ACCENT_BLUE_LIGHT = RGBColor(238, 246, 255) # #EEF6FF

    FONT_MAIN = "Calibri"
    FONT_TITLE = "Calibri"
    SCREENSHOTS_DIR = os.path.join("e:\\mobifone-demo", "screenshots")

    def add_header(slide, title_text, category_tag="CÔNG AN TP HÀ NỘI (PA04) - KẾ HOẠCH 83/KH-CAHN-ANKT", slide_num=""):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = MBF_LIGHT_BG
        bg.line.fill.background()

        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(1.15))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = WHITE
        top_bar.line.color.rgb = CARD_BORDER

        stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(0.18), Inches(0.12), Inches(0.78))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = MBF_BLUE
        stripe.line.fill.background()

        tag_box = slide.shapes.add_textbox(Inches(1.05), Inches(0.16), Inches(9.0), Inches(0.28))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = category_tag.upper()
        p_tag.font.name = FONT_TITLE
        p_tag.font.size = Pt(10.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = MBF_RED

        title_box = slide.shapes.add_textbox(Inches(1.05), Inches(0.46), Inches(9.5), Inches(0.55))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = FONT_TITLE
        p_title.font.size = Pt(19)
        p_title.font.bold = True
        p_title.font.color.rgb = MBF_DARK_BLUE

        brand_box = slide.shapes.add_textbox(Inches(10.8), Inches(0.28), Inches(1.8), Inches(0.5))
        tf_brand = brand_box.text_frame
        tf_brand.margin_left = tf_brand.margin_top = tf_brand.margin_right = tf_brand.margin_bottom = 0
        p_brand = tf_brand.paragraphs[0]
        p_brand.text = "mobiFone"
        p_brand.alignment = PP_ALIGN.RIGHT
        p_brand.font.name = FONT_TITLE
        p_brand.font.size = Pt(20)
        p_brand.font.bold = True
        p_brand.font.color.rgb = MBF_BLUE

        footer_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.12), Inches(11.733), Inches(0.3))
        tf_footer = footer_box.text_frame
        tf_footer.margin_left = tf_footer.margin_top = tf_footer.margin_right = tf_footer.margin_bottom = 0
        p_footer = tf_footer.paragraphs[0]
        p_footer.text = "MobiFone Digital Solutions © 2026 | Hệ Thống Số Hóa Quản Lý & Giám Sát Kiểm Tra"
        p_footer.font.size = Pt(9.5)
        p_footer.font.color.rgb = MUTED_TEXT

        if slide_num:
            p_num = tf_footer.add_paragraph()
            p_num.text = f"Trang {slide_num}/15"
            p_num.alignment = PP_ALIGN.RIGHT
            p_num.font.size = Pt(9.5)
            p_num.font.bold = True
            p_num.font.color.rgb = MBF_BLUE

    def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        return card

    def add_screenshot_frame(slide, img_name, left, top, width, height, title="GIAO DIỆN HỆ THỐNG THỰC TẾ"):
        img_path = os.path.join(SCREENSHOTS_DIR, img_name)
        
        # Outer Card
        add_card(slide, left, top, width, height, bg_color=WHITE, border_color=CARD_BORDER)
        
        # Header strip inside card
        header_h = 0.38
        strip = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(header_h))
        strip.fill.solid()
        strip.fill.fore_color.rgb = RGBColor(241, 245, 249)
        strip.line.color.rgb = CARD_BORDER

        # Mini window dots
        for idx, col in enumerate([RGBColor(239, 68, 68), RGBColor(245, 158, 11), RGBColor(16, 185, 129)]):
            dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(left + 0.15 + idx * 0.18), Inches(top + 0.12), Inches(0.12), Inches(0.12))
            dot.fill.solid()
            dot.fill.fore_color.rgb = col
            dot.line.fill.background()

        # Title
        tb = slide.shapes.add_textbox(Inches(left + 0.8), Inches(top + 0.06), Inches(width - 0.9), Inches(0.25))
        p = tb.text_frame.paragraphs[0]
        p.text = title.upper()
        p.font.size = Pt(9.5)
        p.font.bold = True
        p.font.color.rgb = DARK_TEXT

        # Insert Image if exists
        if os.path.exists(img_path):
            img_top = top + header_h + 0.05
            img_left = left + 0.08
            img_w = width - 0.16
            img_h = height - header_h - 0.12
            slide.shapes.add_picture(img_path, Inches(img_left), Inches(img_top), width=Inches(img_w), height=Inches(img_h))

    # =========================================================================
    # SLIDE 1: COVER
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    bg1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = MBF_DARK_BLUE
    bg1.line.fill.background()

    deco1 = slide1.shapes.add_shape(MSO_SHAPE.RIGHT_TRIANGLE, Inches(9.5), Inches(0), Inches(3.833), Inches(7.5))
    deco1.fill.solid()
    deco1.fill.fore_color.rgb = RGBColor(14, 48, 92)
    deco1.line.fill.background()

    deco2 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.2), Inches(0.18), Inches(4.6))
    deco2.fill.solid()
    deco2.fill.fore_color.rgb = MBF_RED
    deco2.line.fill.background()

    tbox = slide1.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(8.8), Inches(4.5))
    tf = tbox.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "TỔNG CÔNG TY VIỄN THÔNG MOBIFONE"
    p.font.name = FONT_TITLE
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RGBColor(200, 225, 255)
    p.space_after = Pt(10)

    p_proj = tf.add_paragraph()
    p_proj.text = "HỆ THỐNG QUẢN LÝ ĐĂNG KÝ VÀ KIỂM TRA TỔ CHỨC, CÁ NHÂN KINH DOANH"
    p_proj.font.name = FONT_TITLE
    p_proj.font.size = Pt(25)
    p_proj.font.bold = True
    p_proj.font.color.rgb = WHITE
    p_proj.space_after = Pt(12)

    p_sub = tf.add_paragraph()
    p_sub.text = "Giải pháp Số hóa Phục vụ Kế hoạch 83/KH-CAHN-ANKT — Công an TP Hà Nội"
    p_sub.font.name = FONT_MAIN
    p_sub.font.size = Pt(16)
    p_sub.font.color.rgb = RGBColor(186, 215, 248)
    p_sub.space_after = Pt(18)

    p_feat = tf.add_paragraph()
    p_feat.text = "✦  Nguyên tắc Single Check (1 Lần/Năm)  ✦  Ma trận Phê duyệt PA04  ✦  Bản đồ nhiệt GIS & BI Real-time"
    p_feat.font.name = FONT_MAIN
    p_feat.font.size = Pt(12)
    p_feat.font.bold = True
    p_feat.font.color.rgb = RGBColor(255, 190, 92)

    # Info card
    pcard = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(5.6), Inches(8.0), Inches(1.25))
    pcard.fill.solid()
    pcard.fill.fore_color.rgb = RGBColor(16, 52, 99)
    pcard.line.color.rgb = RGBColor(30, 80, 145)

    pctext = slide1.shapes.add_textbox(Inches(1.4), Inches(5.68), Inches(7.6), Inches(1.1))
    ptf = pctext.text_frame
    pp1 = ptf.paragraphs[0]
    pp1.text = "ĐƠN VỊ PHÁT TRIỂN & CUNG CẤP GIẢI PHÁP: MOBIFONE"
    pp1.font.size = Pt(11)
    pp1.font.bold = True
    pp1.font.color.rgb = RGBColor(255, 255, 255)
    pp2 = ptf.add_paragraph()
    pp2.text = "Cơ quan chủ quản: Công an TP Hà Nội (Phòng PA04) | Phạm vi: 126 Công an Xã/Phường"
    pp2.font.size = Pt(10.5)
    pp2.font.color.rgb = RGBColor(180, 205, 235)

    slide1.notes_slide.notes_text_frame.text = (
        "Kính thưa Ban Giám đốc Công an TP Hà Nội, chỉ huy Phòng PA04 và các đồng chí, "
        "MobiFone vinh dự giới thiệu giải pháp 'Hệ thống Quản lý Đăng ký và Kiểm tra Tổ chức, Cá nhân Kinh doanh' "
        "bám sát Kế hoạch số 83/KH-CAHN-ANKT. Hệ thống giúp quản lý 9.960 đối tượng, loại bỏ "
        "100% tình trạng chồng chéo kiểm tra và bảo đảm tính kỷ cương, minh bạch trong thực thi công vụ."
    )

    # =========================================================================
    # SLIDE 2: PAIN POINTS (CONCISE & VISUAL)
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "Bối Cảnh Nghiệp Vụ & Nhu Cầu Cấp Thiết (Kế Hoạch 83)", "1. BỐI CẢNH & THÁCH THỨC", "2")

    cards_data = [
        ("9.960+ Đối Tượng", "Quy mô quản lý rất lớn trên 126 xã/phường, biến động liên tục qua các quý.", MBF_BLUE),
        ("Kiểm Tra Chồng Chéo", "Dễ trùng lặp kiểm tra 1 doanh nghiệp nhiều lần hoặc bỏ sót cơ sở vi phạm.", MBF_RED),
        ("Tờ Trình Giấy & Rời Rạc", "File Excel thủ công gây chậm trễ, khó kiểm soát Quota và hạn chốt sổ Cut-off.", MBF_BLUE),
        ("Thiếu Giám Sát Real-Time", "Mất nhiều ngày tổng hợp báo cáo; thiếu bản đồ GIS khoanh vùng điểm nóng.", MBF_RED)
    ]

    for i, (ctitle, cdesc, ccolor) in enumerate(cards_data):
        left = 0.8 + i * 2.98
        top = 1.5
        width = 2.82
        height = 5.2
        add_card(slide2, left, top, width, height)

        c_bar = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(0.42))
        c_bar.fill.solid()
        c_bar.fill.fore_color.rgb = ccolor
        c_bar.line.fill.background()

        tb = slide2.shapes.add_textbox(Inches(left + 0.1), Inches(top + 0.08), Inches(width - 0.2), Inches(0.3))
        p = tb.text_frame.paragraphs[0]
        p.text = f"THÁCH THỨC 0{i+1}"
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = WHITE

        tb2 = slide2.shapes.add_textbox(Inches(left + 0.18), Inches(top + 0.6), Inches(width - 0.36), Inches(height - 0.8))
        tf2 = tb2.text_frame
        tf2.word_wrap = True
        p_t = tf2.paragraphs[0]
        p_t.text = ctitle
        p_t.font.size = Pt(14)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_t.space_after = Pt(12)

        p_d = tf2.add_paragraph()
        p_d.text = cdesc
        p_d.font.size = Pt(11.5)
        p_d.font.color.rgb = MUTED_TEXT

    slide2.notes_slide.notes_text_frame.text = (
        "Theo Kế hoạch 83 của Công an TP Hà Nội, nhiệm vụ quản lý gần 10.000 đối tượng trên 126 xã/phường "
        "đang gặp 4 thách thức lớn: Quy mô lớn, nguy cơ trùng lặp kiểm tra, tờ trình giấy chậm trễ và thiếu công cụ chỉ huy thời gian thực."
    )

    # =========================================================================
    # SLIDE 3: STRATEGIC GOALS & SINGLE CHECK
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "Mục Tiêu Chiến Lược & Nguyên Tắc 'Single Check' Cốt Lõi", "2. TỔNG QUAN GIẢI PHÁP", "3")

    goals = [
        ("MỤC TIÊU 1", "Số Hóa Toàn Diện Quy Trình Khép Kín",
         ["Chuyển đổi 100% việc đăng ký, phê duyệt và báo cáo lên hệ thống dùng chung.",
          "Giao diện hiện đại, trực quan, thao tác nhanh gọn cho Công an 126 xã/phường.",
          "Liên thông dữ liệu 2 cấp: Công an Xã/Phường ↔ Phòng PA04."], MBF_BLUE),
        ("MỤC TIÊU 2", "Nguyên Tắc 'Single Check' (1 Lần/Năm)",
         ["Ngăn chặn triệt để kiểm tra trùng lặp trên toàn thành phố.",
          "Mỗi doanh nghiệp chỉ kiểm tra TỐI ĐA 1 LẦN TRONG NĂM TÀI CHÍNH.",
          "Cam kết KPI: Tỷ lệ trùng lặp = 0% tuyệt đối."], MBF_RED),
        ("MỤC TIÊU 3", "Giám Sát Real-time & Đồng Hành Doanh Nghiệp",
         ["Hỗ trợ Lãnh đạo PA04 & Giám đốc CAHN theo dõi tiến độ thời gian thực.",
          "Ghi nhận vướng mắc (Thuế, Đất đai, PCCC) để tham mưu UBND TP tháo gỡ.",
          "Xây dựng môi trường kinh doanh minh bạch, an toàn tại Thủ đô."], MBF_DARK_BLUE)
    ]

    for i, (tag, gtitle, items, color) in enumerate(goals):
        left = 0.8 + i * 3.95
        top = 1.5
        width = 3.8
        height = 5.2
        add_card(slide3, left, top, width, height)

        top_strip = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(0.45))
        top_strip.fill.solid()
        top_strip.fill.fore_color.rgb = color
        top_strip.line.fill.background()

        tb_tag = slide3.shapes.add_textbox(Inches(left + 0.15), Inches(top + 0.08), Inches(width - 0.3), Inches(0.3))
        p = tb_tag.text_frame.paragraphs[0]
        p.text = tag
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = WHITE

        tb_body = slide3.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.6), Inches(width - 0.5), Inches(height - 0.8))
        tf = tb_body.text_frame
        tf.word_wrap = True
        p_t = tf.paragraphs[0]
        p_t.text = gtitle
        p_t.font.size = Pt(13)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_t.space_after = Pt(12)

        for item in items:
            p_i = tf.add_paragraph()
            p_i.text = f"•  {item}"
            p_i.font.size = Pt(11)
            p_i.font.color.rgb = MUTED_TEXT
            p_i.space_after = Pt(10)

    slide3.notes_slide.notes_text_frame.text = (
        "Mục tiêu tối thượng của hệ thống là thực hiện nguyên tắc 'Single Check' - kiểm tra duy nhất 1 lần trong năm, "
        "đảm bảo tỷ lệ trùng lặp bằng 0%. Đồng thời, hệ thống là kênh thu thập kiến nghị tháo gỡ khó khăn cho doanh nghiệp."
    )

    # =========================================================================
    # SLIDE 4: ROLES & LOGIN (WITH REAL SCREENSHOT)
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(slide4, "Mô Hình Phân Quyền 4 Cấp & Đăng Nhập Nhanh 1-Click", "2. TỔNG QUAN GIẢI PHÁP", "4")

    # Left: Concise bullet points
    add_card(slide4, 0.8, 1.45, 4.8, 5.35)
    tb_r = slide4.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True

    p = tf_r.paragraphs[0]
    p.text = "4 Nhóm Vai Trò Phân Quyền Bảo Mật"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(10)

    roles_summary = [
        ("Cán Bộ Xã/Phường (ward1)", "Nhập đối tượng, cảnh báo trùng on-typing, lập giỏ kế hoạch, kiểm tra hiện trường."),
        ("Cán Bộ PA04 (officer1)", "Rà soát trùng lặp toàn thành phố, thẩm định kế hoạch liên phường."),
        ("Lãnh Đạo PA04 (leader)", "Phê duyệt hàng loạt trên Ma trận lưới, chỉ huy điều hành Dashboard & GIS."),
        ("Quản Trị Hệ Thống (admin)", "Quản trị người dùng, cấu hình Quota/Cut-off, xem 100% Audit Logs.")
    ]
    for rname, rdesc in roles_summary:
        p_t = tf_r.add_paragraph()
        p_t.text = f"👤 {rname}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_r.add_paragraph()
        p_d.text = f"    {rdesc}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Login Screenshot
    add_screenshot_frame(slide4, "login.png", 5.8, 1.45, 6.733, 5.35, "MÀN HÌNH ĐĂNG NHẬP 4 NÚT 1-CLICK TỨC THÌ")

    slide4.notes_slide.notes_text_frame.text = (
        "Hệ thống phân quyền 4 cấp bảo mật theo chuẩn JWT. Tại màn hình đăng nhập, hệ thống trang bị 4 nút "
        "đăng nhập nhanh giúp chuyển đổi tức thì giữa các vai trò khi trình diễn hoặc kiểm thử."
    )

    # =========================================================================
    # SLIDE 5: MODULE A - OBJECTS & RULE-01 (WITH REAL SCREENSHOT)
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(slide5, "Phân Hệ A: Quản Lý Danh Mục Đối Tượng & Khóa Trùng (RULE-01)", "3. TÍNH NĂNG CHI TIẾT", "5")

    # Left: Bullets
    add_card(slide5, 0.8, 1.45, 4.8, 5.35)
    tb_a = slide5.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_a = tb_a.text_frame
    tf_a.word_wrap = True

    p = tf_a.paragraphs[0]
    p.text = "Quản Lý CSDL Đối Tượng & Khóa Trùng"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_a = [
        ("3 Nhóm đối tượng", "Doanh nghiệp (MST), Hộ KD (ĐKKD/CCCD chủ hộ), Cá nhân KD (CCCD)."),
        ("On-typing Validation", "Gõ 10 số MST hoặc 12 số CCCD ➔ Tự động kiểm tra và Auto-fill."),
        ("RULE-01 (Single Check)", "Phường A đưa vào kế hoạch 2026 ➔ Phường B nhập lại sẽ bật BANNER ĐỎ và KHÓA NÚT LƯU."),
        ("Import Excel / CSV", "Hỗ trợ nạp dữ liệu lớn, tiền kiểm định dạng và báo lỗi theo từng dòng.")
    ]
    for ft, fd in feats_a:
        p_t = tf_a.add_paragraph()
        p_t.text = f"✔ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = MBF_RED if "RULE-01" in ft else DARK_TEXT
        p_d = tf_a.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Objects Screenshot
    add_screenshot_frame(slide5, "objects.png", 5.8, 1.45, 6.733, 5.35, "MÀN HÌNH QUẢN LÝ ĐỐI TƯỢNG & TABS TRẠNG THÁI")

    slide5.notes_slide.notes_text_frame.text = (
        "Phân hệ A là nền tảng quản lý đối tượng. Khi cán bộ gõ MST, hệ thống kiểm tra ngay lập tức. "
        "Nếu doanh nghiệp đã nằm trong kế hoạch năm của phường khác, hệ thống bật cảnh báo đỏ và khóa lưu ngay."
    )

    # =========================================================================
    # SLIDE 6: MODULE B - PLANNING CART & QUOTA (WITH REAL SCREENSHOT)
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    add_header(slide6, "Phân Hệ B: Lập Kế Hoạch Quý, Giỏ Kế Hoạch & Quota Limit (RULE-02)", "3. TÍNH NĂNG CHI TIẾT", "6")

    # Left: Bullets
    add_card(slide6, 0.8, 1.45, 4.8, 5.35)
    tb_b = slide6.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_b = tb_b.text_frame
    tf_b.word_wrap = True

    p = tf_b.paragraphs[0]
    p.text = "Số Hóa Tờ Trình & Kiểm Soát Quota"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_b = [
        ("Giỏ Kế Hoạch (Planning Cart)", "Cán bộ chọn đối tượng đưa vào giỏ kế hoạch quý linh hoạt như mua sắm trực tuyến."),
        ("Kiểm Soát Quota (RULE-02)", "Tự động so khớp số lượng với định ngạch Min - Max của phường (Cảnh báo vàng nếu chưa đủ)."),
        ("Khóa Chốt Sổ (Cut-off Time)", "Đồng hồ đếm ngược; tự động khóa cổng trình duyệt vào 23:59 ngày quy định."),
        ("Gói Dữ Liệu Số", "Chuyển trạng thái Nháp ➔ Chờ duyệt ➔ Đã duyệt minh bạch.")
    ]
    for ft, fd in feats_b:
        p_t = tf_b.add_paragraph()
        p_t.text = f"✔ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = MBF_RED if "RULE-02" in ft else DARK_TEXT
        p_d = tf_b.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Planning Screenshot
    add_screenshot_frame(slide6, "planning.png", 5.8, 1.45, 6.733, 5.35, "MÀN HÌNH LẬP KẾ HOẠCH & BANNER CẢNH BÁO QUOTA")

    slide6.notes_slide.notes_text_frame.text = (
        "Phân hệ B giúp cán bộ lập kế hoạch vào giỏ số. Hệ thống tự động đối chiếu định ngạch Quota (RULE-02) "
        "và hiển thị đồng hồ đếm ngược hạn chốt sổ Cut-off để đảm bảo kỷ cương hành chính."
    )

    # =========================================================================
    # SLIDE 7: MODULE B (CONT) - GRID MATRIX (WITH REAL SCREENSHOT)
    # =========================================================================
    slide7 = prs.slides.add_slide(blank_layout)
    add_header(slide7, "Phân Hệ B: Ma Trận Phê Duyệt Dạng Lưới Của Phòng PA04", "3. TÍNH NĂNG CHI TIẾT", "7")

    # Left: Bullets
    add_card(slide7, 0.8, 1.45, 4.8, 5.35)
    tb_m = slide7.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_m = tb_m.text_frame
    tf_m.word_wrap = True

    p = tf_m.paragraphs[0]
    p.text = "Phê Duyệt Tập Trung Dạng Lưới (Grid)"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_m = [
        ("Ma Trận Phẳng", "PA04 xem toàn bộ cơ sở được đề xuất từ 126 xã/phường trên 1 giao diện lưới duy nhất."),
        ("Duyệt 100 Cơ Sở / Click", "Tích chọn hàng loạt và bấm Duyệt ngay tức thì (Bulk Approval)."),
        ("Từ Chối Kèm Lý Do", "Bắt buộc nhập lý do (như 'Sai thẩm quyền', 'Trùng đối tượng kiểm tra PCCC') ➔ Trả về Bản nháp."),
        ("Tự Động Sinh Hồ Sơ", "Ngay sau khi duyệt, hệ thống tự động sinh hồ sơ thực địa chuyển về cho Công an Phường.")
    ]
    for ft, fd in feats_m:
        p_t = tf_m.add_paragraph()
        p_t.text = f"✔ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_m.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Matrix Screenshot
    add_screenshot_frame(slide7, "matrix.png", 5.8, 1.45, 6.733, 5.35, "MA TRẬN PHÊ DUYỆT TẬP TRUNG HÀNG LOẠT (PA04)")

    slide7.notes_slide.notes_text_frame.text = (
        "Ma trận phê duyệt giúp Lãnh đạo PA04 duyệt hàng trăm cơ sở trong vài phút. Hồ sơ được phê duyệt "
        "sẽ tự động sinh các bản ghi kiểm tra thực địa đẩy thẳng về ứng dụng của cán bộ địa bàn."
    )

    # =========================================================================
    # SLIDE 8: MODULE B (CONT) - PLAN LIST (WITH REAL SCREENSHOT)
    # =========================================================================
    slide8 = prs.slides.add_slide(blank_layout)
    add_header(slide8, "Phân Hệ B: Quản Lý & Giám Sát Danh Sách Kế Hoạch Toàn TP", "3. TÍNH NĂNG CHI TIẾT", "8")

    # Left: Bullets
    add_card(slide8, 0.8, 1.45, 4.8, 5.35)
    tb_pl = slide8.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_pl = tb_pl.text_frame
    tf_pl.word_wrap = True

    p = tf_pl.paragraphs[0]
    p.text = "Theo Dõi Kế Hoạch Quý Toàn Thành Phố"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_pl = [
        ("Lọc Đa Chiều", "Lọc theo Quý kiểm tra, Đơn vị Xã/Phường phụ trách, và Trạng thái kế hoạch."),
        ("Tabs Trạng Thái Dạng Pill", "Tất cả / Bản nháp / Chờ duyệt / Đã duyệt / Từ chối kèm số đếm thời gian thực."),
        ("Đồng Bộ Trạng Thái", "Mọi thay đổi phê duyệt được đồng bộ ngay tức thì giữa cấp Phường và PA04."),
        ("Tra Cứu Lịch Sử", "Xem lại toàn bộ lịch sử kế hoạch các quý trước chỉ với 1 click.")
    ]
    for ft, fd in feats_pl:
        p_t = tf_pl.add_paragraph()
        p_t.text = f"✔ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_pl.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Plan List Screenshot
    add_screenshot_frame(slide8, "plan_list.png", 5.8, 1.45, 6.733, 5.35, "DANH SÁCH KẾ HOẠCH QUÝ & BỘ LỌC ĐA CHIỀU")

    slide8.notes_slide.notes_text_frame.text = (
        "Màn hình danh sách kế hoạch cung cấp góc nhìn tổng thể cho chuyên viên PA04, cho phép theo dõi "
        "kế hoạch của từng phường theo từng quý với các tab trạng thái màu trực quan."
    )

    # =========================================================================
    # SLIDE 9: MODULE C - FIELD INSPECTION (WITH REAL SCREENSHOT)
    # =========================================================================
    slide9 = prs.slides.add_slide(blank_layout)
    add_header(slide9, "Phân Hệ C: Công Cụ 'Thực Chiến' Giám Sát Kiểm Tra Thực Địa", "3. TÍNH NĂNG CHI TIẾT", "9")

    # Left: Bullets
    add_card(slide9, 0.8, 1.45, 4.8, 5.35)
    tb_c = slide9.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    p = tf_c.paragraphs[0]
    p.text = "Quy Trình Kiểm Tra Hiện Trường Số"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_c = [
        ("Checklist Tiêu Chuẩn", "Đánh giá dạng Đạt / Không đạt theo tiêu chí pháp luật (PCCC, ĐKKD, ATTP, Giá...)."),
        ("Mã Hóa Lỗi Vi Phạm", "Áp mã vi phạm có sẵn: Lỗi 01 (Không ĐKKD), Lỗi 02 (PCCC)... kèm mức độ nghiêm trọng."),
        ("Bằng Chứng Số Hiện Trường", "Upload ảnh chụp thực tế hoặc scan biên bản có chữ ký (< 5MB/file)."),
        ("Cảnh Báo Quá Hạn > 30 Ngày", "Tự động gắn cờ đỏ cảnh báo các hồ sơ tồn đọng chưa hoàn thành.")
    ]
    for ft, fd in feats_c:
        p_t = tf_c.add_paragraph()
        p_t.text = f"✔ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_c.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Inspections Screenshot
    add_screenshot_frame(slide9, "inspections.png", 5.8, 1.45, 6.733, 5.35, "MÀN HÌNH QUẢN LÝ HỒ SƠ KIỂM TRA THỰC ĐỊA")

    slide9.notes_slide.notes_text_frame.text = (
        "Phân hệ C là công cụ thực chiến của cán bộ kiểm tra. Biểu mẫu chuẩn hóa Đạt/Không đạt, "
        "mã lỗi vi phạm L01-L04 định hình sẵn và cho phép đính kèm ảnh bằng chứng số hiện trường."
    )

    # =========================================================================
    # SLIDE 10: MODULE C (CONT) - TICKET ROUTING & RULE-03
    # =========================================================================
    slide10 = prs.slides.add_slide(blank_layout)
    add_header(slide10, "Phân Hệ C: Phân Luồng Kiến Nghị & Khóa Hồ Sơ (RULE-03)", "3. TÍNH NĂNG CHI TIẾT", "10")

    # Left: Ticket Routing
    add_card(slide10, 0.8, 1.45, 5.8, 5.35)
    tb_g = slide10.shapes.add_textbox(Inches(1.05), Inches(1.7), Inches(5.3), Inches(4.9))
    tf_g = tb_g.text_frame
    tf_g.word_wrap = True

    p = tf_g.paragraphs[0]
    p.text = "Phân Luồng Kiến Nghị (Ticket Routing)"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(10)

    g_items = [
        ("Gắn thẻ chuyên ngành", "Ghi nhận vướng mắc và gắn thẻ lĩnh vực: Thuế, Đất đai, Môi trường, An ninh trật tự, PCCC."),
        ("Gom dữ liệu tự động", "Kiến nghị được bóc tách riêng vào bảng Dashboard chuyển tiếp Lãnh đạo."),
        ("Báo cáo tham mưu UBND TP", "Xuất báo cáo tổng hợp gửi UBND TP và các Sở ngành tháo gỡ khó khăn cho doanh nghiệp.")
    ]
    for gt, gd in g_items:
        p_t = tf_g.add_paragraph()
        p_t.text = f"🏷️  {gt}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_g.add_paragraph()
        p_d.text = f"    {gd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(8)

    # Right: RULE-03 Focus Box
    add_card(slide10, 6.8, 1.45, 5.733, 5.35, bg_color=RGBColor(254, 242, 242), border_color=MBF_RED)
    tb_r3 = slide10.shapes.add_textbox(Inches(7.05), Inches(1.7), Inches(5.2), Inches(4.9))
    tf_r3 = tb_r3.text_frame
    tf_r3.word_wrap = True

    p = tf_r3.paragraphs[0]
    p.text = "QUY TẮC NGHIỆP VỤ: RULE-03 (TÍNH BẤT BIẾN)"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = MBF_RED
    p.space_after = Pt(10)

    p_r3_title = tf_r3.add_paragraph()
    p_r3_title.text = "Khóa Hồ Sơ Tuyệt Đối Chống Tiêu Cực"
    p_r3_title.font.size = Pt(13)
    p_r3_title.font.bold = True
    p_r3_title.font.color.rgb = DARK_TEXT
    p_r3_title.space_after = Pt(8)

    r3_bullets = [
        "Sau khi bấm 'Kết thúc kiểm tra', toàn bộ dữ liệu KHÔNG ĐƯỢC PHÉP SỬA ĐỔI.",
        "Frontend chuyển sang chế độ Chỉ đọc (Read-only); Backend chặn 403 Forbidden với mọi lệnh cập nhật.",
        "Hiển thị Banner: 'HỒ SƠ ĐÃ ĐƯỢC CHỐT KẾT QUẢ VÀ KHÓA DỮ LIỆU (RULE-03)'.",
        "Bảo đảm tính minh bạch, bảo vệ danh dự và uy tín của đoàn kiểm tra."
    ]
    for b in r3_bullets:
        pb = tf_r3.add_paragraph()
        pb.text = f"🔒 {b}"
        pb.font.size = Pt(10.5)
        pb.font.color.rgb = DARK_TEXT
        pb.space_after = Pt(8)

    slide10.notes_slide.notes_text_frame.text = (
        "Hệ thống vừa hỗ trợ tháo gỡ vướng mắc cho doanh nghiệp qua phân luồng Ticket Routing, "
        "vừa bảo vệ kỷ cương với RULE-03: Khóa bất biến dữ liệu hồ sơ sau kiểm tra, chống mọi hành vi sửa chữa tiêu cực."
    )

    # =========================================================================
    # SLIDE 11: MODULE D - BI DASHBOARD (WITH REAL SCREENSHOT)
    # =========================================================================
    slide11 = prs.slides.add_slide(blank_layout)
    add_header(slide11, "Phân Hệ D: BI Dashboard Phục Vụ Giám Đốc CAHN & Lãnh Đạo PA04", "3. TÍNH NĂNG CHI TIẾT", "11")

    # Left: Bullets
    add_card(slide11, 0.8, 1.45, 4.8, 5.35)
    tb_d = slide11.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_d = tb_d.text_frame
    tf_d.word_wrap = True

    p = tf_d.paragraphs[0]
    p.text = "Chỉ Huy Điều Hành Real-time"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_d = [
        ("Gauge Tiến Độ 9.960 Đối Tượng", "Đồng hồ đo % hoàn thành so với mục tiêu chiến lược toàn thành phố trong Quý II/2026."),
        ("Cơ Cấu Tuân Thủ (Pie Chart)", "Tỷ lệ: Cơ sở tốt (Xanh), Có vi phạm (Cam), Đề nghị đình chỉ (Đỏ)."),
        ("Biểu Đồ Tiến Độ Theo Ngày", "Line chart theo dõi năng suất kiểm tra liên tục theo thời gian."),
        ("Cảnh Báo Top 5 Phường Quá Hạn", "Bảng xếp hạng bôi đỏ đôn đốc các phường chậm tiến độ.")
    ]
    for ft, fd in feats_d:
        p_t = tf_d.add_paragraph()
        p_t.text = f"📊 {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_d.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Dashboard Screenshot
    add_screenshot_frame(slide11, "dashboard.png", 5.8, 1.45, 6.733, 5.35, "EXECUTIVE BI DASHBOARD ĐIỀU HÀNH THỜI GIAN THỰC")

    slide11.notes_slide.notes_text_frame.text = (
        "BI Dashboard là trợ thủ đắc lực của Giám đốc CAHN và Trưởng phòng PA04. Lãnh đạo nắm ngay "
        "tiến độ trên 9.960 đối tượng, tỷ lệ tuân thủ và danh sách các phường cần đôn đốc chỉ đạo."
    )

    # =========================================================================
    # SLIDE 12: MODULE D (CONT) - GIS HEATMAP (WITH REAL SCREENSHOT)
    # =========================================================================
    slide12 = prs.slides.add_slide(blank_layout)
    add_header(slide12, "Phân Hệ D: Bản Đồ Nhiệt Tình Hình Vi Phạm (Hot Zones GIS)", "3. TÍNH NĂNG CHI TIẾT", "12")

    # Left: Bullets
    add_card(slide12, 0.8, 1.45, 4.8, 5.35)
    tb_map = slide12.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_map = tb_map.text_frame
    tf_map.word_wrap = True

    p = tf_map.paragraphs[0]
    p.text = "Nhận Diện 'Điểm Nóng' Trên Bản Đồ Số"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_map = [
        ("Chấm Tọa Độ Tự Động", "Tọa độ vi phạm tự động hiển thị ngay khi biên bản được cập nhật."),
        ("Vùng Đỏ Sậm (Hot zone)", "Khu vực mật độ vi phạm cao (như PCCC, ANTT) hiển thị màu Đỏ sậm rõ rệt."),
        ("Click Xem Chi Tiết Cơ Sở", "Click trực tiếp vào vùng Đỏ trên bản đồ để mở danh sách cơ sở vi phạm tại phường đó."),
        ("Marker Clustering", "Gom cụm điểm kiểm tra thông minh khi phóng to / thu nhỏ.")
    ]
    for ft, fd in feats_map:
        p_t = tf_map.add_paragraph()
        p_t.text = f"🗺️ {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_map.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Map Screenshot
    add_screenshot_frame(slide12, "map.png", 5.8, 1.45, 6.733, 5.35, "BẢN ĐỒ NHIỆT VI PHẠM KHÔNG GIAN GIS HÀ NỘI")

    slide12.notes_slide.notes_text_frame.text = (
        "Bản đồ nhiệt Heatmap GIS giúp Lãnh đạo nhìn thấy toàn cảnh các điểm nóng vi phạm. "
        "Chỉ cần click vào vùng Đỏ sậm là thấy ngay danh sách cơ sở vi phạm PCCC hay ANTT để chỉ đạo xử lý dứt điểm."
    )

    # =========================================================================
    # SLIDE 13: REPORTS & AUDIT LOGS (WITH REAL SCREENSHOT)
    # =========================================================================
    slide13 = prs.slides.add_slide(blank_layout)
    add_header(slide13, "Tổng Hợp Báo Cáo Chuẩn Hóa & Nhật Ký Ghi Vết (Audit Logs)", "3. TÍNH NĂNG CHI TIẾT", "13")

    # Left: Bullets
    add_card(slide13, 0.8, 1.45, 4.8, 5.35)
    tb_rep = slide13.shapes.add_textbox(Inches(1.0), Inches(1.65), Inches(4.4), Inches(4.9))
    tf_rep = tb_rep.text_frame
    tf_rep.word_wrap = True

    p = tf_rep.paragraphs[0]
    p.text = "Xuất Excel Chuẩn & Ghi Vết 100%"
    p.font.size = Pt(13.5)
    p.font.bold = True
    p.font.color.rgb = MBF_BLUE
    p.space_after = Pt(8)

    feats_rep = [
        ("Xuất Excel 1-Click", "Xuất file .xlsx chuẩn OpenXML cho Báo cáo kiến nghị theo lĩnh vực và Tổng kết quý theo địa bàn."),
        ("Audit Logs Tự Động", "Ghi vết 100% thao tác: User, Action, Entity, Timestamp và chi tiết thay đổi."),
        ("Minh Bạch Công Vụ", "Phục vụ thanh tra công vụ và đánh giá thi đua khen thưởng hàng quý."),
        ("Bảo Mật Toàn Vẹn", "Chống sửa đổi, xóa nhật ký ghi vết của hệ thống.")
    ]
    for ft, fd in feats_rep:
        p_t = tf_rep.add_paragraph()
        p_t.text = f"📑 {ft}"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_TEXT
        p_d = tf_rep.add_paragraph()
        p_d.text = f"    {fd}"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = MUTED_TEXT
        p_d.space_after = Pt(6)

    # Right: Real Reports Screenshot
    add_screenshot_frame(slide13, "reports.png", 5.8, 1.45, 6.733, 5.35, "GIAO DIỆN BÁO CÁO & XUẤT EXCEL (.XLSX)")

    slide13.notes_slide.notes_text_frame.text = (
        "Hệ thống cung cấp tính năng xuất báo cáo Excel chỉ với 1 click và hệ thống Audit Log ghi vết "
        "từng giây từng phút, đảm bảo tính minh bạch và trách nhiệm giải trình của cán bộ công vụ."
    )

    # =========================================================================
    # SLIDE 14: KPIS & COMPARISON TABLE
    # =========================================================================
    slide14 = prs.slides.add_slide(blank_layout)
    add_header(slide14, "Chỉ Số Đo Lường Hiệu Quả (KPIs) & So Sánh Năng Lực", "4. ĐO LƯỜNG HIỆU QUẢ", "14")

    # Top: 3 KPI Cards
    kpis = [
        ("9.960 ĐỐI TƯỢNG", "Bao phủ chỉ tiêu trong Quý II/2026", MBF_BLUE),
        ("0% TRÙNG LẶP", "Nguyên tắc Single Check (1 Lần/Năm)", MBF_RED),
        ("100% ĐÚNG HẠN", "Chốt hồ sơ kiểm tra đúng thời hạn", ACCENT_GREEN)
    ]
    for i, (knum, kdesc, kcolor) in enumerate(kpis):
        left = 0.8 + i * 3.95
        top = 1.45
        width = 3.8
        height = 1.35
        add_card(slide14, left, top, width, height, bg_color=WHITE, border_color=kcolor)

        tb_k = slide14.shapes.add_textbox(Inches(left + 0.15), Inches(top + 0.12), Inches(width - 0.3), Inches(1.1))
        tf_k = tb_k.text_frame
        p_num = tf_k.paragraphs[0]
        p_num.text = knum
        p_num.font.size = Pt(17)
        p_num.font.bold = True
        p_num.font.color.rgb = kcolor
        p_num.alignment = PP_ALIGN.CENTER

        p_desc = tf_k.add_paragraph()
        p_desc.text = kdesc
        p_desc.font.size = Pt(11)
        p_desc.font.color.rgb = DARK_TEXT
        p_desc.alignment = PP_ALIGN.CENTER

    # Bottom: Comparison Table
    rows = 5
    cols = 3
    t_left = Inches(0.8)
    t_top = Inches(3.0)
    t_width = Inches(11.733)
    t_height = Inches(3.8)

    table_shape = slide14.shapes.add_table(rows, cols, t_left, t_top, t_width, t_height)
    table = table_shape.table
    table.columns[0].width = Inches(2.6)
    table.columns[1].width = Inches(4.4)
    table.columns[2].width = Inches(4.733)

    headers = ["TIÊU CHÍ NGHIỆP VỤ", "QUẢN LÝ THỦ CÔNG / EXCEL", "GIẢI PHÁP SỐ HÓA MOBIFONE"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = MBF_DARK_BLUE if j < 2 else MBF_BLUE
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    data = [
        ("Kiểm soát Trùng lặp", "Dò thủ công bằng mắt, dễ trùng lặp nhiều đoàn kiểm tra.", "Tự động chặn 100% bằng RULE-01 (Single Check 1 lần/năm)."),
        ("Thời gian Phê duyệt", "Trình ký văn bản giấy mất 3 - 7 ngày qua nhiều cấp.", "Phê duyệt trực tuyến qua Ma trận phẳng trong vài phút (1-Click)."),
        ("Kiểm tra Hiện trường", "Biên bản giấy dễ thất lạc, không có ảnh/GPS thực tế.", "Checklist điện tử chuẩn, ảnh hiện trường, tọa độ GPS, khóa RULE-03."),
        ("Báo cáo Giám đốc CAHN", "Chờ tổng hợp mất 5 - 10 ngày, số liệu trễ hạn.", "BI Dashboard & Bản đồ nhiệt Heatmap Real-time.")
    ]

    for i, row in enumerate(data):
        for j, val in enumerate(row):
            cell = table.cell(i + 1, j)
            cell.fill.solid()
            if j == 2:
                cell.fill.fore_color.rgb = RGBColor(240, 249, 255)
            else:
                cell.fill.fore_color.rgb = WHITE if i % 2 == 0 else RGBColor(248, 250, 252)

            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10.5 if j > 0 else 11)
            p.font.bold = (j != 1)
            p.font.color.rgb = MBF_BLUE if j == 2 else DARK_TEXT

    slide14.notes_slide.notes_text_frame.text = (
        "So với phương thức thủ công, giải pháp của MobiFone đem lại 3 chỉ số KPI vượt trội: Bao phủ 9.960 đối tượng, "
        "0% trùng lặp và 100% đúng hạn, tiết kiệm hơn 80% thời gian xử lý thủ tục hành chính."
    )

    # =========================================================================
    # SLIDE 15: DEMO TRANSITION
    # =========================================================================
    slide15 = prs.slides.add_slide(blank_layout)
    bg15 = slide15.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg15.fill.solid()
    bg15.fill.fore_color.rgb = MBF_DARK_BLUE
    bg15.line.fill.background()

    deco_end = slide15.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.0), Inches(0.18), Inches(5.5))
    deco_end.fill.solid()
    deco_end.fill.fore_color.rgb = MBF_RED
    deco_end.line.fill.background()

    tb_e = slide15.shapes.add_textbox(Inches(1.2), Inches(1.0), Inches(11.0), Inches(5.5))
    tf_e = tb_e.text_frame
    tf_e.word_wrap = True

    p = tf_e.paragraphs[0]
    p.text = "SẴN SÀNG CHO PHẦN TRÌNH DIỄN THỰC TẾ (LIVE DEMO)"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(200, 225, 255)
    p.space_after = Pt(10)

    p_et = tf_e.add_paragraph()
    p_et.text = "KỊCH BẢN TRẢI NGHIỆM 5 BƯỚC KHÉP KÍN TRÊN HỆ THỐNG THẬT:"
    p_et.font.size = Pt(21)
    p_et.font.bold = True
    p_et.font.color.rgb = WHITE
    p_et.space_after = Pt(16)

    demo_steps = [
        ("BƯỚC 1", "Công an Phường nhập cơ sở & Trải nghiệm Cảnh báo trùng lặp tức thì (RULE-01)"),
        ("BƯỚC 2", "Lập Giỏ kế hoạch Quý II/2026, kiểm tra định ngạch Quota & Hạn chốt sổ Cut-off (RULE-02)"),
        ("BƯỚC 3", "Lãnh đạo PA04 phê duyệt hàng loạt trên Ma trận lưới & Tự động sinh hồ sơ thực địa"),
        ("BƯỚC 4", "Kiểm tra thực địa: Checklist động, mã lỗi L01-L04, ảnh GPS & Khóa hồ sơ (RULE-03)"),
        ("BƯỚC 5", "Trung tâm điều hành BI Dashboard mục tiêu 9.960 & Bản đồ nhiệt Hot zones GIS")
    ]

    for snum, sdesc in demo_steps:
        ps = tf_e.add_paragraph()
        ps.text = f"➤  [{snum}] : {sdesc}"
        ps.font.size = Pt(12)
        ps.font.bold = True
        ps.font.color.rgb = RGBColor(255, 220, 150)
        ps.space_after = Pt(8)

    p_end = tf_e.add_paragraph()
    p_end.text = "MobiFone xin trân trọng cảm ơn Ban Giám đốc CAHN, Lãnh đạo PA04 & Kính mời theo dõi Live Demo!"
    p_end.font.size = Pt(13.5)
    p_end.font.bold = True
    p_end.font.color.rgb = WHITE
    p_end.space_before = Pt(14)

    slide15.notes_slide.notes_text_frame.text = (
        "Sau đây, em xin phép kính mời Ban Giám đốc Công an TP Hà Nội và các đồng chí cùng theo dõi "
        "phần Live Demo trực tiếp 5 bước trên hệ thống đang chạy thực tế."
    )

    # Save presentation
    output_path = os.path.join("e:\\mobifone-demo", "MBF_Gioi_Thieu_He_Thong_Quan_Ly_Kiem_Tra.pptx")
    prs.save(output_path)
    print(f"Presentation successfully updated with real screenshots at: {output_path}")

if __name__ == "__main__":
    create_presentation()
