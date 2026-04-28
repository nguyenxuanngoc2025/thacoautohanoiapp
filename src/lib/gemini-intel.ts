// src/lib/gemini-intel.ts
// Gemini AI service: extract + classify + summarize articles từ trang đối thủ

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export type ArticleCategory =
  | 'promotion'    // Khuyến mại
  | 'new_model'    // Xe / sản phẩm mới
  | 'event'        // Sự kiện
  | 'price_change' // Thay đổi giá
  | 'market_news'  // Tin thị trường
  | 'other';

export interface ExtractedArticle {
  title: string;
  summary: string;              // 2-3 câu tiếng Việt
  category: ArticleCategory;
  promo_detail: string | null;  // "Hỗ trợ 100% LPTB", "Giảm 50 triệu"
  promo_deadline: string | null; // "YYYY-MM-DD"
  price_info: string | null;    // "Từ 825 triệu"
  comp_brands: string[];
  comp_models: string[];
  published_date: string | null; // "YYYY-MM-DD"
  date_confidence: 'high' | 'medium' | 'low';
}

const PROMPT_TEMPLATE = `Bạn là hệ thống phân tích thông tin thị trường ô tô Việt Nam.

Từ nội dung trang web dưới đây (nguồn: {domain}), hãy trích xuất TẤT CẢ bài viết, tin tức, thông báo có giá trị.

Với mỗi bài, trả về JSON object có các trường:
- title: tiêu đề bài viết (tiếng Việt)
- summary: tóm tắt 2-3 câu bằng tiếng Việt, súc tích, khách quan
- category: phân loại — CHỈ chọn 1 trong: promotion | new_model | event | price_change | market_news | other
- promo_detail: nếu category=promotion, mô tả cụ thể ưu đãi VD "Hỗ trợ 100% lệ phí trước bạ" hoặc null
- promo_deadline: nếu có hạn chót khuyến mãi, định dạng YYYY-MM-DD hoặc null
- price_info: nếu có thông tin giá VD "Từ 825 triệu" hoặc null
- comp_brands: mảng tên thương hiệu ô tô được nhắc đến VD ["Hyundai", "Toyota"]
- comp_models: mảng tên model được nhắc đến VD ["Tucson", "Fortuner"]
- published_date: ngày đăng bài YYYY-MM-DD hoặc null nếu không rõ
- date_confidence: "high" nếu ngày rõ ràng, "medium" nếu ước tính, "low" nếu không rõ

Trả về JSON array. Nếu không tìm thấy bài nào, trả về [].
KHÔNG trả về text nào khác ngoài JSON array.

Nội dung trang ({domain}):
{content}`;

/** Strip HTML tags và lấy text thuần */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000); // Giới hạn 12k chars để tiết kiệm token
}

/** Fetch trang web và trả về text content */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractText(html);
  } catch {
    return null;
  }
}

/** Gửi text lên Gemini để extract articles */
export async function extractArticlesFromPage(
  pageText: string,
  domain: string
): Promise<ExtractedArticle[]> {
  if (!pageText || pageText.length < 100) return [];

  const prompt = PROMPT_TEMPLATE
    .replace(/{domain}/g, domain)
    .replace('{content}', pageText);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Tìm JSON array trong response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const articles = JSON.parse(match[0]) as ExtractedArticle[];
    return Array.isArray(articles) ? articles : [];
  } catch (err) {
    console.error(`Gemini extract error (${domain}):`, err);
    return [];
  }
}

/** Lấy domain từ URL */
export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
