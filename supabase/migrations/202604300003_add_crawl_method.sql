-- Thêm crawl_method vào thaco_competitor_mapping
-- 'html'  = static HTML, dùng fetch thường
-- 'rss'   = ưu tiên RSS (mặc định đã thử RSS trước)
-- 'js'    = JS-rendered, cần Firecrawl
ALTER TABLE thaco_competitor_mapping
  ADD COLUMN IF NOT EXISTS crawl_method text DEFAULT 'html';
