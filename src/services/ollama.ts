import { getSetting, logActivity } from '@/lib/db';

export interface OllamaHealthResult {
  ok: boolean;
  message: string;
  models?: string[];
  hasRequestedModel?: boolean;
}

/**
 * Lấy cấu hình Ollama từ database hoặc giá trị mặc định
 */
export function getOllamaConfig() {
  const enabled = getSetting('ollama_enabled') === 'true';
  const endpoint = getSetting('ollama_endpoint') || 'http://127.0.0.1:11434';
  const model = getSetting('ollama_model') || 'qwen2.5:3b';
  const role = getSetting('ollama_role') || 'extract_only'; // 'extract_only' | 'extract_and_fallback'

  return {
    enabled,
    endpoint: endpoint.replace(/\/+$/, ''),
    model,
    role,
  };
}

/**
 * Kiểm tra kết nối đến Ollama trên VPS và xác minh model đã được tải về hay chưa
 */
export async function checkOllamaHealth(customEndpoint?: string, customModel?: string): Promise<OllamaHealthResult> {
  const config = getOllamaConfig();
  const endpoint = (customEndpoint || config.endpoint).replace(/\/+$/, '');
  const targetModel = customModel || config.model;

  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return {
        ok: false,
        message: `Máy chủ Ollama phản hồi lỗi HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name || m.model);

    const hasRequestedModel = models.some(
      (m) => m === targetModel || m.startsWith(`${targetModel}:`) || targetModel.startsWith(`${m}:`)
    );

    if (!hasRequestedModel) {
      return {
        ok: true,
        hasRequestedModel: false,
        models,
        message: `Đã kết nối Ollama thành công, nhưng chưa tìm thấy model "${targetModel}". Bạn có thể chạy lệnh: "ollama run ${targetModel}" trên VPS để tải về. Danh sách model hiện có: ${models.join(', ') || 'Chưa có model nào'}.`,
      };
    }

    return {
      ok: true,
      hasRequestedModel: true,
      models,
      message: `Kết nối thành công! Model "${targetModel}" đã sẵn sàng hoạt động trên VPS.`,
    };
  } catch (err: any) {
    let errMsg = err.message || 'Không thể kết nối đến Ollama';
    if (err.name === 'TimeoutError' || err.message?.includes('aborted')) {
      errMsg = 'Quá thời gian kết nối (Timeout 4s) tới cổng 11434';
    } else if (err.code === 'ECONNREFUSED' || errMsg.includes('ECONNREFUSED')) {
      errMsg = 'Kết nối bị từ chối (Connection Refused). Ollama chưa được bật trên VPS (thử chạy lệnh: ollama serve).';
    }
    return {
      ok: false,
      message: `Không thể kết nối Ollama tại ${endpoint}: ${errMsg}`,
    };
  }
}

/**
 * Gửi yêu cầu sinh văn bản hoặc tóm tắt tới Ollama
 */
export async function queryOllama(
  prompt: string,
  options?: {
    system?: string;
    temperature?: number;
    timeoutMs?: number;
  }
): Promise<string> {
  const config = getOllamaConfig();
  const endpoint = config.endpoint;
  const model = config.model;
  const timeoutMs = options?.timeoutMs || 25000;

  const bodyPayload: any = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: options?.temperature ?? 0.2,
    },
  };

  if (options?.system) {
    bodyPayload.system = options.system;
  }

  const res = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama API error (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  return (data.response || '').trim();
}

/**
 * Đọc hiểu toàn văn bài báo và trích xuất Fact Sheet súc tích giàu số liệu
 */
export async function summarizeAndExtractArticleWithOllama(
  fullArticleText: string,
  articleTitle: string,
  trendKeyword: string
): Promise<string> {
  if (!fullArticleText || fullArticleText.length < 150) {
    return fullArticleText;
  }

  // Cắt bớt văn bản quá dài để tối ưu thời gian xử lý của Ollama (~3500 từ tối đa)
  const truncatedSource = fullArticleText.length > 8000 ? fullArticleText.slice(0, 8000) + '...' : fullArticleText;

  const system = `Bạn là một trợ lý phân tích dữ liệu và tin tức báo chí chuyên nghiệp.
Nhiệm vụ của bạn là đọc toàn văn bài báo, loại bỏ toàn bộ quảng cáo, câu chữ rác và trích xuất ra một "BẢN TỔNG HỢP DỮ KIỆN CỐT LÕI (FACT SHEET)" bằng tiếng Việt chuẩn mực.

NGUYÊN TẮC:
1. Giữ lại đầy đủ các SỐ LIỆU ĐỊNH LƯỢNG (tỷ giá, giá tiền, phần trăm tăng/giảm, số lượng, khối lượng, mốc thời gian, ngày tháng).
2. Tóm tắt sự kiện chính (Ai, làm gì, ở đâu, khi nào, nguyên nhân, hệ quả).
3. Trích dẫn ngắn gọn phát biểu của lãnh đạo, chuyên gia hoặc cơ quan chức năng (nếu có).
4. KHÔNG suy diễn hư cấu, KHÔNG thêm nhận định ngoài bài báo.
5. Định dạng đầu ra: Ngắn gọn, có gạch đầu dòng rõ ràng, dài khoảng 250 - 400 từ.`;

  const prompt = `Từ khóa xu hướng đang theo dõi: "${trendKeyword}"
Tiêu đề bài báo: "${articleTitle}"

Toàn văn bài báo:
"""
${truncatedSource}
"""

Hãy tạo BẢN TỔNG HỢP DỮ KIỆN CỐT LÕI (Fact Sheet) từ bài báo trên:`;

  logActivity('INFO', 'OLLAMA', `Đang gửi bài báo "${articleTitle.slice(0, 50)}..." sang Ollama (${getOllamaConfig().model}) để trích xuất dữ kiện...`);

  const factSheet = await queryOllama(prompt, {
    system,
    temperature: 0.15,
    timeoutMs: 25000,
  });

  if (!factSheet || factSheet.length < 50) {
    throw new Error('Ollama trả về kết quả rỗng hoặc quá ngắn');
  }

  logActivity('SUCCESS', 'OLLAMA', `Ollama đã trích xuất thành công Fact Sheet (${factSheet.length} ký tự) cho "${articleTitle.slice(0, 50)}..."`);
  return factSheet;
}

/**
 * Tạo bài đăng Facebook dự phòng bằng Ollama khi Gemini gặp sự cố (Rate Limit 429 hoặc lỗi mạng)
 */
export async function generateFacebookPostWithOllama(
  trendTitle: string,
  factsContext: string,
  sourceUrls: string[],
  tone = 'chuyên gia, sắc sảo, khách quan'
): Promise<{ postContent: string; commentContent: string }> {
  const system = `Bạn là một chuyên gia sáng tạo nội dung mạng xã hội hàng đầu về tài chính, kinh tế và tin tức xã hội tại Việt Nam.
Nhiệm vụ của bạn là viết một bài đăng Facebook hấp dẫn, sâu sắc dựa trên các dữ kiện được cung cấp.

QUY CÁCH BÀI VIẾT:
1. Hook mở đầu thu hút, có emoji phù hợp chủ đề.
2. Thân bài gồm 3-4 ý chính có số liệu thực tế, sự kiện từ dữ liệu cung cấp (gạch đầu dòng rõ ràng, không sao chép nguyên văn).
3. 1 câu hỏi tương tác văn minh kích thích thảo luận.
4. 3-5 hashtag phù hợp (#TinTuc #XuHuong #KinhTe).
5. TUYỆT ĐỐI KHÔNG chèn link bài báo vào bài viết (để không bị bóp tương tác). Cuối bài ghi: "👇 Chi tiết các bài báo gốc và nguồn tin được để ở phần bình luận đầu tiên!".
6. Định dạng đầu ra JSON duy nhất:
{
  "post_content": "nội dung bài đăng...",
  "comment_content": "bình luận chứa link nguồn..."
}`;

  const prompt = `Chủ đề xu hướng: "${trendTitle}"
Phong cách: ${tone}

Dữ kiện và số liệu báo chí:
${factsContext}

Danh sách link nguồn báo chí:
${sourceUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Hãy tạo bài viết Facebook và bình luận nguồn theo định dạng JSON yêu cầu:`;

  logActivity('INFO', 'OLLAMA_FALLBACK', `Đang kích hoạt Ollama dự phòng để tạo bài viết cho: "${trendTitle}"...`);

  const response = await queryOllama(prompt, {
    system,
    temperature: 0.5,
    timeoutMs: 35000,
  });

  let postContent = '';
  let commentContent = '';

  try {
    // Trích xuất JSON từ phản hồi của Ollama
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      postContent = parsed.post_content || '';
      commentContent = parsed.comment_content || '';
    }
  } catch (err) {
    // Nếu Ollama không trả về JSON chuẩn, dùng trực tiếp response làm postContent
    postContent = response;
  }

  if (!postContent) {
    postContent = `🔥 XU HƯỚNG MỚI: ${trendTitle}\n\nThông tin cập nhật chi tiết về sự việc đang thu hút sự chú ý của dư luận.\n\n👇 Chi tiết các bài báo gốc và nguồn tin được để ở phần bình luận đầu tiên!`;
  }

  if (!commentContent && sourceUrls.length > 0) {
    commentContent = `🔗 Nguồn tin và bài viết chi tiết để bạn đọc tham khảo:\n${sourceUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`;
  }

  logActivity('SUCCESS', 'OLLAMA_FALLBACK', `Ollama đã tạo bài viết dự phòng thành công cho "${trendTitle}".`);
  return { postContent, commentContent };
}
