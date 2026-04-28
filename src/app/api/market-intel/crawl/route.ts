// src/app/api/market-intel/crawl/route.ts
// Crawl tất cả nguồn đối thủ → extract bằng Gemini → lưu DB
// POST /api/market-intel/crawl
// Header: Authorization: Bearer <CRON_SECRET> (tùy chọn để bảo vệ endpoint)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPageText, extractArticlesFromPage, getDomain } from '@/lib/gemini-intel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300; // 5 phút cho Vercel/Hostinger

export async function POST(req: Request) {
  // Bảo vệ endpoint (tùy chọn)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Tạo job log
  const { data: job, error: jobErr } = await supabase
    .from('thaco_crawl_jobs')
    .insert({ status: 'running' })
    .select()
    .single();

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  const jobId = job.id;
  let sourcesCrawled = 0;
  let articlesFound = 0;
  let articlesNew = 0;

  try {
    // Lấy danh sách nguồn crawl (unique news_url)
    const { data: competitors, error: compErr } = await supabase
      .from('thaco_competitor_mapping')
      .select('news_url, comp_brand, thaco_brand, thaco_model')
      .eq('is_active', true)
      .not('news_url', 'is', null);

    if (compErr) throw new Error(compErr.message);

    // Deduplicate theo news_url
    const urlMap = new Map<string, { comp_brand: string; thaco_brands: string[]; thaco_models: string[] }>();
    for (const c of (competitors ?? [])) {
      if (!c.news_url) continue;
      const existing = urlMap.get(c.news_url);
      if (existing) {
        if (!existing.thaco_brands.includes(c.thaco_brand)) existing.thaco_brands.push(c.thaco_brand);
        if (c.thaco_model && !existing.thaco_models.includes(c.thaco_model)) existing.thaco_models.push(c.thaco_model);
      } else {
        urlMap.set(c.news_url, {
          comp_brand: c.comp_brand,
          thaco_brands: [c.thaco_brand],
          thaco_models: c.thaco_model ? [c.thaco_model] : [],
        });
      }
    }

    // Crawl từng URL
    for (const [url, meta] of urlMap.entries()) {
      const domain = getDomain(url);
      console.log(`Crawling: ${domain}`);

      const pageText = await fetchPageText(url);
      if (!pageText) { sourcesCrawled++; continue; }

      const articles = await extractArticlesFromPage(pageText, domain);
      sourcesCrawled++;
      articlesFound += articles.length;

      for (const a of articles) {
        // Kiểm tra duplicate theo title + source_domain
        const { data: existing } = await supabase
          .from('thaco_market_articles')
          .select('id')
          .eq('source_domain', domain)
          .eq('title', a.title)
          .maybeSingle();

        if (existing) continue; // Bỏ qua nếu đã có

        // Merge thaco_brands từ competitor mapping
        const merged_thaco_brands = Array.from(new Set([
          ...meta.thaco_brands,
          ...a.comp_brands.filter(b => ['KIA', 'Mazda', 'Stellantis', 'Tải', 'Bus', 'BMW', 'MINI'].includes(b)),
        ]));

        const { error: insertErr } = await supabase
          .from('thaco_market_articles')
          .insert({
            title:            a.title,
            summary:          a.summary,
            source_url:       url,
            source_domain:    domain,
            category:         a.category,
            promo_detail:     a.promo_detail,
            promo_deadline:   a.promo_deadline,
            price_info:       a.price_info,
            comp_brands:      a.comp_brands.length > 0 ? a.comp_brands : [meta.comp_brand],
            comp_models:      a.comp_models,
            thaco_brands:     merged_thaco_brands,
            thaco_models:     meta.thaco_models,
            published_at:     a.published_date ? new Date(a.published_date).toISOString() : null,
            date_confidence:  a.date_confidence,
            status:           a.date_confidence === 'low' || !a.published_date ? 'review' : 'published',
          });

        if (!insertErr) articlesNew++;
      }

      // Throttle 500ms giữa các request để tránh bị block
      await new Promise(r => setTimeout(r, 500));
    }

    // Cập nhật job thành công
    await supabase
      .from('thaco_crawl_jobs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        sources_crawled: sourcesCrawled,
        articles_found: articlesFound,
        articles_new: articlesNew,
      })
      .eq('id', jobId);

    // Trigger notification nếu có bài mới quan trọng
    if (articlesNew > 0) {
      await triggerNotifications(articlesNew);
    }

    return NextResponse.json({
      success: true,
      sources_crawled: sourcesCrawled,
      articles_found: articlesFound,
      articles_new: articlesNew,
    });

  } catch (err: any) {
    await supabase
      .from('thaco_crawl_jobs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_msg: err?.message ?? 'Unknown error',
      })
      .eq('id', jobId);

    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

/** Tạo notification trong app khi có bài mới quan trọng */
async function triggerNotifications(newCount: number) {
  try {
    // Lấy các bài mới nhất là promotion hoặc new_model
    const { data: hotArticles } = await supabase
      .from('thaco_market_articles')
      .select('title, category, thaco_brands')
      .eq('status', 'published')
      .in('category', ['promotion', 'new_model'])
      .order('crawled_at', { ascending: false })
      .limit(5);

    if (!hotArticles?.length) return;

    // Tạo 1 notification tổng hợp (dùng bảng notifications nếu có)
    // Hiện tại log ra console — có thể mở rộng sau
    console.log(`[Market Intel] ${newCount} bài mới, ${hotArticles.length} bài quan trọng`);
  } catch {
    // Notification không critical — bỏ qua lỗi
  }
}

// GET: lấy trạng thái job gần nhất
export async function GET() {
  const { data } = await supabase
    .from('thaco_crawl_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  return NextResponse.json(data ?? []);
}
