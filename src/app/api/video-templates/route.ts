import { NextRequest, NextResponse } from 'next/server';
import { getAllVideoTemplates, renderVideoTemplate, VideoTemplateId } from '@/services/video/templates';
import { getDefaultVideoTemplate } from '@/lib/db';
import { VideoSlideScript } from '@/services/video-script-generator';

const DEMO_SCRIPT: VideoSlideScript = {
  intro: {
    categoryLabel: 'TIÊU ĐIỂM THỊ TRƯỜNG',
    mainTitle: 'VN-INDEX VƯỢT MỐC 1.300 ĐIỂM, THANH KHOẢN BÙNG NỔ',
    tagline: 'Dòng tiền ngoại và khối tự doanh đẩy mạnh mua ròng toàn thị trường.',
  },
  slide1: {
    category: 'CHỨNG KHOÁN & TÀI CHÍNH',
    headline: 'Thanh khoản khớp lệnh toàn thị trường đạt kỷ lục 35.000 tỷ đồng',
    timestamp: 'Vừa cập nhật 10 phút trước',
  },
  contentSlides: [
    {
      title: 'Tăng trưởng nhóm ngành & Dòng tiền',
      fragments: [
        'Nhóm cổ phiếu ngân hàng và chứng khoán dẫn sóng với mức tăng bình quân +3.8%, đóng góp hơn 15 điểm cho chỉ số chung.',
        'Khối ngoại quay lại mua ròng mạnh mẽ hơn 1.250 tỷ đồng sau 4 phiên bán ròng liên tiếp, tập trung vào nhóm vốn hóa lớn.',
      ],
    },
    {
      title: 'Dự báo chuyên gia & Khuyến nghị',
      fragments: [
        'Các quỹ đầu tư nhận định ngưỡng hỗ trợ ngắn hạn được thiết lập vững chắc tại vùng 1.280 điểm.',
        'Nhà đầu tư được khuyến nghị duy trì tỷ trọng cổ phiếu ở mức 70% danh mục và quản trị rủi ro đòn bẩy margin.',
      ],
    },
  ],
  outro: {
    ctaText: 'Đăng ký để nhận tin mỗi ngày',
    subText: 'CẢM ƠN BẠN ĐÃ THEO DÕI',
  },
};

/**
 * GET: Lấy danh sách thông tin templates và template mặc định
 */
export async function GET() {
  try {
    const templates = getAllVideoTemplates();
    const defaultTemplate = getDefaultVideoTemplate();

    return NextResponse.json({
      success: true,
      templates,
      defaultTemplate,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi lấy danh sách templates' },
      { status: 500 }
    );
  }
}

/**
 * POST: Tạo preview HTML cho một template cụ thể
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const templateId = (body.templateId as VideoTemplateId) || 'modern_dark';
    const script: VideoSlideScript = body.script || DEMO_SCRIPT;

    const { html, usedTemplateId } = renderVideoTemplate(templateId, script, {
      width: 720,
      height: 1280,
      duration: 20,
    });

    return NextResponse.json({
      success: true,
      templateId: usedTemplateId,
      html,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi tạo HTML preview' },
      { status: 500 }
    );
  }
}
