// src/lib/market-intel-data.ts
// SWR hooks cho Market Intelligence

import useSWR, { mutate } from 'swr';

export type ArticleCategory =
  | 'promotion' | 'new_model' | 'event' | 'price_change' | 'market_news' | 'other';

export interface MarketArticle {
  id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_domain: string | null;
  published_at: string | null;
  crawled_at: string;
  category: ArticleCategory;
  promo_detail: string | null;
  price_info: string | null;
  comp_brands: string[];
  comp_models: string[];
  thaco_brands: string[];
  thaco_models: string[];
  status: 'published' | 'review' | 'archived';
  date_confidence: 'high' | 'medium' | 'low';
}

export interface CrawlJob {
  id: string;
  started_at: string;
  completed_at: string | null;
  sources_crawled: number;
  articles_found: number;
  articles_new: number;
  status: 'running' | 'success' | 'error';
  error_msg: string | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildUrl(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  return `/api/market-intel/articles?${p.toString()}`;
}

export function useArticles(opts: {
  status?: 'published' | 'review';
  brand?: string;
  model?: string;
  category?: string;
  days?: number;
}) {
  const url = buildUrl({
    status:   opts.status ?? 'published',
    brand:    opts.brand,
    model:    opts.model,
    category: opts.category,
    days:     opts.days ?? 30,
  });

  const { data, error, isLoading, mutate: revalidate } = useSWR<MarketArticle[]>(url, fetcher, {
    refreshInterval: 5 * 60_000, // re-fetch mỗi 5 phút
    revalidateOnFocus: false,
  });

  return {
    articles:   Array.isArray(data) ? data : [],
    isLoading,
    isError:    !!error,
    revalidate,
  };
}

export function useCrawlJobs() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<CrawlJob[]>(
    '/api/market-intel/crawl',
    fetcher,
    { revalidateOnFocus: false }
  );

  const jobs = Array.isArray(data) ? data : [];
  return {
    jobs,
    latestJob:  jobs[0] ?? null,
    isLoading,
    isError:    !!error,
    revalidate,
  };
}

/** Gọi crawl endpoint + invalidate articles cache */
export async function triggerCrawl(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/market-intel/crawl', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error ?? 'Lỗi không xác định' };

    // Invalidate tất cả article keys
    await mutate((key: string) => typeof key === 'string' && key.startsWith('/api/market-intel/articles'));
    await mutate('/api/market-intel/crawl');

    return { ok: true, message: `+${data.articles_new} bài mới từ ${data.sources_crawled} nguồn` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Network error' };
  }
}

/** Approve hoặc archive 1 bài */
export async function updateArticleStatus(id: string, status: 'published' | 'archived') {
  await fetch('/api/market-intel/articles', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  // Invalidate review cache
  await mutate((key: string) => typeof key === 'string' && key.startsWith('/api/market-intel/articles'));
}
