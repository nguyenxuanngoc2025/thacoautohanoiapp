// src/lib/gemini-intel.ts
// Gemini AI service: RSS parsing + HTML scraping + AI classification

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ── Types ──────────────────────────────────────────────────────────────────────

export type ArticleCategory =
  | 'promotion'    // Khuyến mại
  | 'new_model'    // Xe / sản phẩm mới
  | 'event'        // Sự kiện
  | 'price_change' // Thay đổi giá
  | 'market_news'  // Tin thị trường
  | 'other';

export interface ExtractedArticle {
  title: string;
  summary: string;
  category: ArticleCategory;
  promo_detail: string | null;
  promo_deadline: string | null;
  price_info: string | null;
  comp_brands: string[];
  comp_models: string[];
  published_date: string | null;
  date_confidence: 'high' | 'medium' | 'low';
  source_url?: string; // chỉ có khi parse từ RSS
}

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

// ── RSS Parser ─────────────────────────────────────────────────────────────────

function stripCDATA(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripCDATA(m[1]).trim() : '';
}

export function parseRSSXML(xml: string): RSSItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const tag = isAtom ? 'entry' : 'item';
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
  const items: RSSItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && items.length < 30) {
    const b = m[0];
    const title = extractTag(b, 'title');
    let link = extractTag(b, 'link');
    if (!link) {
      const lm = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (lm) link = lm[1];
    }
    const desc = extractTag(b, 'description')
      || extractTag(b, 'summary')
      || extractTag(b, 'content:encoded')
      || extractTag(b, 'content');
    const pub = extractTag(b, 'pubDate')
      || extractTag(b, 'published')
      || extractTag(b, 'updated')
      || extractTag(b, 'dc:date');
    if (title && link) {
      items.push({ title, link, description: desc, pubDate: pub || null });
    }
  }
  return items;
}

/** Fetch một URL và kiểm tra có phải RSS/Atom không */
export async function fetchRSSFeed(url: string): Promise<RSSItem[] | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0; +https://thaco.vn)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Kiểm tra có phải XML feed không
    if (!/<(rss|feed|channel)[\s>]/i.test(text)) return null;
    const items = parseRSSXML(text);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

const COMMON_RSS_PATHS = [
  '',         // Chính URL đó
  '/feed',
  '/rss',
  '/feed/rss2',
  '/tin-tuc/feed',
  '/news/feed',
  '/khuyen-mai/feed',
  '/tin-tuc-su-kien/feed',
];

/** Thử nhiều path RSS cho một domain */
export async function tryFetchRSS(url: string): Promise<{ rssUrl: string; items: RSSItem[] } | null> {
  // Thử chính URL trước
  const direct = await fetchRSSFeed(url);
  if (direct) return { rssUrl: url, items: direct };

  // Thử các path phổ biến
  try {
    const { origin } = new URL(url);
    for (const path of COMMON_RSS_PATHS.slice(1)) {
      const rssUrl = origin + path;
      const items = await fetchRSSFeed(rssUrl);
      if (items) return { rssUrl, items };
    }
  } catch { /* ignore */ }
  return null;
}

// ── Gemini: Batch classify RSS items ─────────────────────────────────────────

const RSS_CLASSIFY_PROMPT = `Bạn là chuyên gia phân tích thị trường ô tô Việt Nam.

Dưới đây là danh sách bài viết từ nguồn {domain}. Phân loại TỪNG BÀI và trả về JSON array đúng thứ tự.

Mỗi phần tử JSON gồm:
- category: "promotion"|"new_model"|"event"|"price_change"|"market_news"|"other"
- summary: 1-2 câu tóm tắt tiếng Việt, súc tích
- promo_detail: mô tả ưu đãi cụ thể nếu là promotion, ngược lại null
- price_info: thông tin giá nếu có VD "Từ 825 triệu", ngược lại null
- comp_brands: mảng thương hiệu ô tô được nhắc VD ["KIA","Hyundai"]
- comp_models: mảng model xe được nhắc VD ["Seltos","Tucson"]

Chỉ trả về JSON array, KHÔNG text thêm.

Bài viết (nguồn: {domain}):
{items}`;

export async function classifyRSSItems(items: RSSItem[], domain: string): Promise<ExtractedArticle[]> {
  if (items.length === 0) return [];

  const itemsText = items.map((it, i) => {
    const cleanDesc = it.description
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 250);
    return `${i + 1}. TIÊU ĐỀ: ${it.title}\n   MÔ TẢ: ${cleanDesc}`;
  }).join('\n\n');

  const prompt = RSS_CLASSIFY_PROMPT
    .replace(/{domain}/g, domain)
    .replace('{items}', itemsText);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const classified = JSON.parse(match[0]) as any[];

    return items.map((it, i) => {
      const c = classified[i] ?? {};
      let pubDate: string | null = null;
      if (it.pubDate) {
        try { pubDate = new Date(it.pubDate).toISOString().slice(0, 10); } catch { /* ignore */ }
      }
      return {
        title: it.title,
        summary: c.summary ?? '',
        category: (c.category as ArticleCategory) ?? 'other',
        promo_detail: c.promo_detail ?? null,
        promo_deadline: null,
        price_info: c.price_info ?? null,
        comp_brands: Array.isArray(c.comp_brands) ? c.comp_brands : [],
        comp_models: Array.isArray(c.comp_models) ? c.comp_models : [],
        published_date: pubDate,
        date_confidence: pubDate ? 'high' as const : 'low' as const,
        source_url: it.link,
      };
    });
  } catch (err) {
    console.error(`Gemini classify error (${domain}):`, err);
    return [];
  }
}

// ── HTML scraping fallback ─────────────────────────────────────────────────────

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

const HTML_EXTRACT_PROMPT = `Bạn là hệ thống phân tích thông tin thị trường ô tô Việt Nam.

Từ nội dung trang web dưới đây (nguồn: {domain}), hãy trích xuất TẤT CẢ bài viết, tin tức, thông báo có giá trị.

Với mỗi bài, trả về JSON object:
- title: tiêu đề
- summary: tóm tắt 2-3 câu tiếng Việt
- category: "promotion"|"new_model"|"event"|"price_change"|"market_news"|"other"
- promo_detail: mô tả ưu đãi hoặc null
- promo_deadline: hạn chót YYYY-MM-DD hoặc null
- price_info: thông tin giá hoặc null
- comp_brands: mảng thương hiệu ô tô
- comp_models: mảng model xe
- published_date: YYYY-MM-DD hoặc null
- date_confidence: "high"|"medium"|"low"

Trả về JSON array. Nếu không có bài nào, trả về [].
KHÔNG thêm text ngoài JSON.

Nội dung ({domain}):
{content}`;

export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
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

export async function extractArticlesFromPage(
  pageText: string,
  domain: string
): Promise<ExtractedArticle[]> {
  if (!pageText || pageText.length < 100) return [];

  const prompt = HTML_EXTRACT_PROMPT
    .replace(/{domain}/g, domain)
    .replace('{content}', pageText);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const articles = JSON.parse(match[0]) as ExtractedArticle[];
    return Array.isArray(articles) ? articles : [];
  } catch (err) {
    console.error(`Gemini extract error (${domain}):`, err);
    return [];
  }
}

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
