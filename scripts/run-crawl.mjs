#!/usr/bin/env node
// scripts/run-crawl.mjs — chạy crawl trực tiếp không cần dev server
// Usage: node scripts/run-crawl.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => { const i = l.indexOf('='); if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc; }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const FIRECRAWL_URL = env.FIRECRAWL_API_URL ?? '';
const FIRECRAWL_KEY = env.FIRECRAWL_API_KEY ?? '';
const THACO_BRANDS  = ['KIA', 'Mazda', 'Stellantis', 'STELLANTIS', 'Tải', 'Bus', 'BMW', 'MINI'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function stripCDATA(s) { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(); }
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripCDATA(m[1]).trim() : '';
}

function parseRSSXML(xml) {
  const isAtom = /<feed[\s>]/i.test(xml);
  const tag = isAtom ? 'entry' : 'item';
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
  const items = []; let m;
  while ((m = re.exec(xml)) !== null && items.length < 30) {
    const b = m[0];
    const title = extractTag(b, 'title');
    let link = extractTag(b, 'link');
    if (!link) { const lm = b.match(/<link[^>]+href=["']([^"']+)["']/i); if (lm) link = lm[1]; }
    const desc = extractTag(b, 'description') || extractTag(b, 'summary') || extractTag(b, 'content:encoded') || extractTag(b, 'content');
    const pub  = extractTag(b, 'pubDate') || extractTag(b, 'published') || extractTag(b, 'updated') || extractTag(b, 'dc:date');
    if (title && link) items.push({ title, link, description: desc, pubDate: pub || null });
  }
  return items;
}

async function fetchRSSFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!/<(rss|feed|channel)[\s>]/i.test(text)) return null;
    const items = parseRSSXML(text);
    return items.length > 0 ? { rssUrl: url, items } : null;
  } catch { return null; }
}

async function tryFetchRSS(url) {
  const direct = await fetchRSSFeed(url);
  if (direct) return direct;
  try {
    const { origin } = new URL(url);
    for (const path of ['/feed', '/rss', '/feed/rss2', '/tin-tuc/feed', '/news/feed']) {
      const items = await fetchRSSFeed(origin + path);
      if (items) return items;
    }
  } catch {}
  return null;
}

async function fetchPageText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12000);
  } catch { return null; }
}

async function fetchPageTextFirecrawl(url) {
  if (!FIRECRAWL_URL) return null;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (FIRECRAWL_KEY) headers['Authorization'] = `Bearer ${FIRECRAWL_KEY}`;
    const res = await fetch(`${FIRECRAWL_URL.replace(/\/$/, '')}/v1/scrape`, {
      method: 'POST', headers,
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, timeout: 20000 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md = data?.data?.markdown ?? '';
    return md.length > 100 ? md.slice(0, 12000) : null;
  } catch { return null; }
}

const RSS_CLASSIFY_PROMPT = `Bạn là chuyên gia phân tích thị trường ô tô Việt Nam.
Dưới đây là danh sách bài viết từ nguồn {domain}. Phân loại TỪNG BÀI và trả về JSON array đúng thứ tự.
Mỗi phần tử JSON gồm:
- category: "promotion"|"new_model"|"event"|"price_change"|"market_news"|"other"
- summary: 1-2 câu tóm tắt tiếng Việt, súc tích
- promo_detail: mô tả ưu đãi cụ thể nếu là promotion, ngược lại null
- price_info: thông tin giá nếu có, ngược lại null
- comp_brands: mảng thương hiệu ô tô được nhắc
- comp_models: mảng model xe được nhắc
Chỉ trả về JSON array, KHÔNG text thêm.
Bài viết (nguồn: {domain}):
{items}`;

const HTML_EXTRACT_PROMPT = `Bạn là hệ thống phân tích thông tin thị trường ô tô Việt Nam.
Từ nội dung trang web dưới đây (nguồn: {domain}), hãy trích xuất TẤT CẢ bài viết, tin tức, thông báo có giá trị.
Với mỗi bài, trả về JSON object:
- title, summary (2-3 câu), category ("promotion"|"new_model"|"event"|"price_change"|"market_news"|"other")
- promo_detail, promo_deadline (YYYY-MM-DD hoặc null), price_info
- comp_brands, comp_models (mảng)
- published_date (YYYY-MM-DD hoặc null), date_confidence ("high"|"medium"|"low")
Trả về JSON array. Nếu không có bài nào, trả về []. KHÔNG thêm text ngoài JSON.
Nội dung ({domain}):
{content}`;

async function classifyRSSItems(items, domain) {
  if (items.length === 0) return [];
  const itemsText = items.map((it, i) => {
    const cleanDesc = it.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250);
    return `${i + 1}. TIÊU ĐỀ: ${it.title}\n   MÔ TẢ: ${cleanDesc}`;
  }).join('\n\n');
  try {
    const result = await model.generateContent(RSS_CLASSIFY_PROMPT.replace(/{domain}/g, domain).replace('{items}', itemsText));
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const classified = JSON.parse(match[0]);
    return items.map((it, i) => {
      const c = classified[i] ?? {};
      let pubDate = null;
      if (it.pubDate) { try { pubDate = new Date(it.pubDate).toISOString().slice(0, 10); } catch {} }
      return { title: it.title, summary: c.summary ?? '', category: c.category ?? 'other', promo_detail: c.promo_detail ?? null, promo_deadline: null, price_info: c.price_info ?? null, comp_brands: Array.isArray(c.comp_brands) ? c.comp_brands : [], comp_models: Array.isArray(c.comp_models) ? c.comp_models : [], published_date: pubDate, date_confidence: pubDate ? 'high' : 'low', source_url: it.link };
    });
  } catch (err) { console.error(`Gemini classify error (${domain}):`, err.message); return []; }
}

async function extractArticlesFromPage(pageText, domain) {
  if (!pageText || pageText.length < 100) return [];
  try {
    const result = await model.generateContent(HTML_EXTRACT_PROMPT.replace(/{domain}/g, domain).replace('{content}', pageText));
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const articles = JSON.parse(match[0]);
    return Array.isArray(articles) ? articles : [];
  } catch (err) { console.error(`Gemini extract error (${domain}):`, err.message); return []; }
}

// ── Main crawl ─────────────────────────────────────────────────────────────────

async function crawl() {
  console.log('=== Starting crawl ===');
  if (FIRECRAWL_URL) console.log('Firecrawl enabled:', FIRECRAWL_URL);

  const { data: competitors } = await supabase
    .from('thaco_competitor_mapping')
    .select('news_url, comp_brand, thaco_brand, thaco_model, crawl_method')
    .eq('is_active', true)
    .not('news_url', 'is', null);

  // Deduplicate theo news_url
  const urlMap = new Map();
  for (const c of competitors ?? []) {
    if (!c.news_url) continue;
    const ex = urlMap.get(c.news_url);
    if (ex) {
      if (!ex.thaco_brands.includes(c.thaco_brand)) ex.thaco_brands.push(c.thaco_brand);
      if (c.thaco_model && !ex.thaco_models.includes(c.thaco_model)) ex.thaco_models.push(c.thaco_model);
    } else {
      urlMap.set(c.news_url, { comp_brand: c.comp_brand, thaco_brands: [c.thaco_brand], thaco_models: c.thaco_model ? [c.thaco_model] : [], crawl_method: c.crawl_method ?? 'html' });
    }
  }

  let sourcesCrawled = 0, articlesFound = 0, articlesNew = 0;

  for (const [url, meta] of urlMap.entries()) {
    const domain = getDomain(url);
    const isJS   = meta.crawl_method === 'js';
    process.stdout.write(`[${meta.comp_brand}] ${domain} (${meta.crawl_method}) ... `);

    if (isJS && !FIRECRAWL_URL) { console.log('skip (no Firecrawl)'); continue; }

    let articles = [], method = 'html';

    const rssResult = await tryFetchRSS(url);
    if (rssResult) {
      console.log(`RSS ${rssResult.items.length} items`);
      method   = 'rss';
      articles = await classifyRSSItems(rssResult.items, domain);
    } else if (isJS) {
      const pageText = await fetchPageTextFirecrawl(url);
      if (!pageText) { console.log('Firecrawl failed'); sourcesCrawled++; continue; }
      method   = 'firecrawl';
      articles = await extractArticlesFromPage(pageText, domain);
      console.log(`Firecrawl → ${articles.length} articles`);
    } else {
      const pageText = await fetchPageText(url);
      if (!pageText) { console.log('fetch failed'); sourcesCrawled++; continue; }
      articles = await extractArticlesFromPage(pageText, domain);
      console.log(`HTML → ${articles.length} articles`);
    }

    sourcesCrawled++;
    articlesFound += articles.length;

    for (const a of articles) {
      const articleUrl    = a.source_url || url;
      const articleDomain = getDomain(articleUrl);

      const { data: existing } = await supabase
        .from('thaco_market_articles').select('id')
        .eq('source_domain', articleDomain).eq('title', a.title).maybeSingle();
      if (existing) continue;

      const merged_thaco_brands = [...new Set([...meta.thaco_brands, ...((a.comp_brands ?? []).filter(b => THACO_BRANDS.some(tb => tb.toLowerCase() === b.toLowerCase())))])];

      const { error } = await supabase.from('thaco_market_articles').insert({
        title:           a.title,
        summary:         a.summary,
        source_url:      articleUrl,
        source_domain:   articleDomain,
        category:        a.category,
        promo_detail:    a.promo_detail ?? null,
        promo_deadline:  a.promo_deadline ?? null,
        price_info:      a.price_info ?? null,
        comp_brands:     (a.comp_brands ?? []).length > 0 ? a.comp_brands : [meta.comp_brand],
        comp_models:     a.comp_models ?? [],
        thaco_brands:    merged_thaco_brands,
        thaco_models:    meta.thaco_models,
        published_at:    a.published_date ? new Date(a.published_date).toISOString() : null,
        date_confidence: a.date_confidence ?? 'low',
        status:          (a.date_confidence === 'low' || !a.published_date) && (method === 'html' || method === 'firecrawl') ? 'review' : 'published',
      });
      if (!error) articlesNew++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n=== Done: ${sourcesCrawled} sources, ${articlesFound} found, ${articlesNew} new ===`);
}

crawl().catch(console.error);
