-- Market Intelligence: competitor mapping + crawled articles + crawl jobs

-- 1. Competitor mapping: THACO model <-> competitor
CREATE TABLE IF NOT EXISTS thaco_competitors (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thaco_brand text NOT NULL,   -- 'KIA', 'Mazda', 'Stellantis', 'Tải', 'Bus'
  thaco_model text,            -- NULL = áp dụng cho cả brand
  segment     text,            -- 'SUV cỡ B', 'MPV', 'Tải nhẹ máy xăng'...
  comp_brand  text NOT NULL,   -- 'Hyundai', 'Toyota', 'Suzuki'...
  comp_model  text,            -- 'Creta', 'Xpander'... (NULL = theo dõi cả brand)
  website_url text,            -- URL trang chủ hoặc trang sản phẩm
  news_url    text,            -- URL trang tin tức / khuyến mãi để crawl
  facebook_url text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_thaco_brand ON thaco_competitors(thaco_brand);
CREATE INDEX IF NOT EXISTS idx_competitors_thaco_model ON thaco_competitors(thaco_model);

-- 2. Crawled & AI-processed articles
CREATE TABLE IF NOT EXISTS thaco_market_articles (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title             text NOT NULL,
  summary           text,          -- AI tóm tắt tiếng Việt 2-3 câu
  full_content      text,          -- Nội dung gốc đã extract
  source_url        text,
  source_domain     text,
  published_at      timestamptz,
  crawled_at        timestamptz DEFAULT now(),

  -- AI classification
  category          text NOT NULL DEFAULT 'other',
  -- 'promotion' | 'new_model' | 'event' | 'price_change' | 'market_news' | 'other'
  promo_detail      text,   -- "Hỗ trợ 100% LPTB", "Giảm 50tr"
  promo_deadline    date,
  price_info        text,   -- "Từ 825 triệu"

  -- Tags (ai lọc)
  comp_brands       text[] DEFAULT '{}',   -- thương hiệu đối thủ được nhắc
  comp_models       text[] DEFAULT '{}',   -- model đối thủ được nhắc
  thaco_brands      text[] DEFAULT '{}',   -- brand THACO bị ảnh hưởng
  thaco_models      text[] DEFAULT '{}',   -- model THACO bị ảnh hưởng

  -- Moderation
  status            text DEFAULT 'published',
  -- 'published' | 'review' | 'archived'
  date_confidence   text DEFAULT 'high',
  -- 'high' | 'medium' | 'low'

  created_at        timestamptz DEFAULT now()
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
  -- 'running' | 'success' | 'error'
  error_msg        text
);

-- RLS: tất cả authenticated user đọc được, chỉ service_role mới write
ALTER TABLE thaco_competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE thaco_market_articles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE thaco_crawl_jobs        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read competitors"     ON thaco_competitors       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read articles"        ON thaco_market_articles   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read crawl jobs"      ON thaco_crawl_jobs        FOR SELECT TO authenticated USING (true);

-- Cho phép update status bởi authenticated user (duyệt/ẩn bài)
CREATE POLICY "auth update article status" ON thaco_market_articles
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
