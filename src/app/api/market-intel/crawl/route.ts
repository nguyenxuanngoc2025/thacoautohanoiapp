// src/app/api/market-intel/crawl/route.ts
// RSS-first → HTML fallback → Gemini classify/extract → lưu DB
// POST /api/market-intel/crawl

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  tryFetchRSS, classifyRSSItems,
  fetchPageText, extractArticlesFromPage,
  getDomain,
  type ExtractedArticle,
} from '@/lib/gemini-intel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300;

const THACO_BRANDS = ['KIA', 'Mazda', 'Stellantis', 'STELLANTIS', 'Tải', 'Bus', 'BMW', 'MINI'];

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: job, error: jobErr } = await supabase
    .from('thaco_crawl_jobs')
    .insert({ status: 'running' })
    .select()
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  const jobId = job.id;
  let sourcesCrawled = 0;
  let articlesFound  = 0;
  let articlesNew    = 0;

  try {
    // Lấy danh sách nguồn crawl
    const { data: competitors, error: compErr } = await supabase
      .from('thaco_competitor_mapping')
      .select('news_url, comp_brand, thaco_brand, thaco_model')
      .eq('is_active', true)
      .not('news_url', 'is', null);

    if (compErr) throw new Error(compErr.message);

    // Deduplicate theo news_url, gộp thaco_brands
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

    for (const [url, meta] of urlMap.entries()) {
      const domain = getDomain(url);
      console.log(`[crawl] ${domain}`);

      let articles: (ExtractedArticle & { source_url?: string })[] = [];
      let method = 'html';

      // ── Thử RSS trước ──────────────────────────────────────────────────────
      const rssResult = await tryFetchRSS(url);
      if (rssResult) {
        console.log(`  → RSS OK (${rssResult.items.length} items)`);
        method = 'rss';
        articles = await classifyRSSItems(rssResult.items, domain);
      } else {
        // ── Fallback: HTML scraping ─────────────────────────────────────────
        const pageText = await fetchPageText(url);
        if (!pageText) {
          console.log(`  → fetch failed, skip`);
          sourcesCrawled++;
          continue;
        }
        articles = await extractArticlesFromPage(pageText, domain);
        console.log(`  → HTML (${articles.length} articles)`);
      }

      sourcesCrawled++;
      articlesFound += articles.length;

      for (const a of articles) {
        // Xác định source_url: dùng link từ RSS nếu có, fallback url gốc
        const articleUrl = a.source_url || url;
        const articleDomain = getDomain(articleUrl);

        // Dedup: title + domain
        const { data: existing } = await supabase
          .from('thaco_market_articles')
          .select('id')
          .eq('source_domain', articleDomain)
          .eq('title', a.title)
          .maybeSingle();

        if (existing) continue;

        // Tự động tag thaco_brands từ mapping + Gemini comp_brands detection
        const merged_thaco_brands = Array.from(new Set([
          ...meta.thaco_brands,
          ...a.comp_brands.filter(b => THACO_BRANDS.some(tb => tb.toLowerCase() === b.toLowerCase())),
        ]));

        const { error: insertErr } = await supabase
          .from('thaco_market_articles')
          .insert({
            title:           a.title,
            summary:         a.summary,
            source_url:      articleUrl,
            source_domain:   articleDomain,
            category:        a.category,
            promo_detail:    a.promo_detail,
            promo_deadline:  a.promo_deadline,
            price_info:      a.price_info,
            comp_brands:     a.comp_brands.length > 0 ? a.comp_brands : [meta.comp_brand],
            comp_models:     a.comp_models,
            thaco_brands:    merged_thaco_brands,
            thaco_models:    meta.thaco_models,
            published_at:    a.published_date ? new Date(a.published_date).toISOString() : null,
            date_confidence: a.date_confidence,
            status:          (a.date_confidence === 'low' || !a.published_date) && method === 'html'
                               ? 'review' : 'published',
          });

        if (!insertErr) articlesNew++;
      }

      // Throttle giữa các request
      await new Promise(r => setTimeout(r, 400));
    }

    await supabase
      .from('thaco_crawl_jobs')
      .update({
        status:          'success',
        completed_at:    new Date().toISOString(),
        sources_crawled: sourcesCrawled,
        articles_found:  articlesFound,
        articles_new:    articlesNew,
      })
      .eq('id', jobId);

    console.log(`[crawl] Done: ${sourcesCrawled} sources, ${articlesFound} found, ${articlesNew} new`);

    return NextResponse.json({ success: true, sources_crawled: sourcesCrawled, articles_found: articlesFound, articles_new: articlesNew });

  } catch (err: any) {
    await supabase
      .from('thaco_crawl_jobs')
      .update({ status: 'error', completed_at: new Date().toISOString(), error_msg: err?.message ?? 'Unknown error' })
      .eq('id', jobId);

    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function GET() {
  const { data } = await supabase
    .from('thaco_crawl_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);
  return NextResponse.json(data ?? []);
}
