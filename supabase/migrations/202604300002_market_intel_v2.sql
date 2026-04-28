-- Market Intel v2: dùng thaco_competitor_mapping (tránh xung đột thaco_competitors cũ)

-- 1. Competitor mapping mới
CREATE TABLE IF NOT EXISTS thaco_competitor_mapping (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thaco_brand  text NOT NULL,
  thaco_model  text,
  segment      text,
  comp_brand   text NOT NULL,
  comp_model   text,
  website_url  text,
  news_url     text,
  facebook_url text,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_mapping_thaco_brand ON thaco_competitor_mapping(thaco_brand);
CREATE INDEX IF NOT EXISTS idx_comp_mapping_thaco_model ON thaco_competitor_mapping(thaco_model);

-- 2. Crawled articles
CREATE TABLE IF NOT EXISTS thaco_market_articles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  summary         text,
  source_url      text,
  source_domain   text,
  published_at    timestamptz,
  crawled_at      timestamptz DEFAULT now(),
  category        text NOT NULL DEFAULT 'other',
  promo_detail    text,
  promo_deadline  date,
  price_info      text,
  comp_brands     text[] DEFAULT '{}',
  comp_models     text[] DEFAULT '{}',
  thaco_brands    text[] DEFAULT '{}',
  thaco_models    text[] DEFAULT '{}',
  status          text DEFAULT 'published',
  date_confidence text DEFAULT 'high',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_category    ON thaco_market_articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_status      ON thaco_market_articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_crawled_at  ON thaco_market_articles(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_thaco_brands ON thaco_market_articles USING gin(thaco_brands);
CREATE INDEX IF NOT EXISTS idx_articles_comp_brands  ON thaco_market_articles USING gin(comp_brands);

-- 3. Crawl job log
CREATE TABLE IF NOT EXISTS thaco_crawl_jobs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at       timestamptz DEFAULT now(),
  completed_at     timestamptz,
  sources_crawled  int DEFAULT 0,
  articles_found   int DEFAULT 0,
  articles_new     int DEFAULT 0,
  status           text DEFAULT 'running',
  error_msg        text
);

-- RLS
ALTER TABLE thaco_competitor_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE thaco_market_articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE thaco_crawl_jobs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read competitor_mapping" ON thaco_competitor_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY "read market_articles"    ON thaco_market_articles    FOR SELECT TO authenticated USING (true);
CREATE POLICY "read crawl_jobs"         ON thaco_crawl_jobs         FOR SELECT TO authenticated USING (true);

CREATE POLICY "update article status"   ON thaco_market_articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
