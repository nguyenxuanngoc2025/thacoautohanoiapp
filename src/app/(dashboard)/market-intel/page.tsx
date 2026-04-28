// app/src/app/(dashboard)/market-intel/page.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { RefreshCw, ExternalLink, CheckCircle, Archive, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { useBrands } from '@/contexts/BrandsContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  useArticles, useCrawlJobs, triggerCrawl, updateArticleStatus,
  type MarketArticle, type ArticleCategory,
} from '@/lib/market-intel-data';

// ── Colors ────────────────────────────────────────────────────────────────────
const BRAND_COLORS: Record<string, string> = {
  KIA: '#1A4B8C', Hyundai: '#00447C', Toyota: '#EB0A1E', Mazda: '#9B0E17',
  Honda: '#CC0000', Mitsubishi: '#E60012', VinFast: '#1E4DB7', Peugeot: '#003399',
  STELLANTIS: '#6B21A8', BMW: '#0066B1', MINI: '#1B1B1B', MG: '#C41E3A',
  Ford: '#003B8E', Suzuki: '#005BAA',
};

const CAT_COLORS: Record<string, string> = {
  promotion: '#F97316', new_model: '#3B82F6', market_news: '#10B981',
  event: '#8B5CF6', price_change: '#EF4444', other: '#9CA3AF',
};

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  promotion: 'Khuyến mại', new_model: 'Xe mới', event: 'Sự kiện',
  price_change: 'Giá xe', market_news: 'Tin thị trường', other: 'Khác',
};

const CATEGORY_STYLE: Record<ArticleCategory, { bg: string; text: string }> = {
  promotion:    { bg: '#FFF7ED', text: '#C2410C' },
  new_model:    { bg: '#EFF6FF', text: '#1D4ED8' },
  event:        { bg: '#F5F3FF', text: '#6D28D9' },
  price_change: { bg: '#FFF1F2', text: '#BE123C' },
  market_news:  { bg: '#F0FDF4', text: '#15803D' },
  other:        { bg: '#F9FAFB', text: '#6B7280' },
};

const COMPETITOR_BRANDS = ['Toyota', 'Hyundai', 'Honda', 'Mitsubishi', 'VinFast', 'MG', 'Ford', 'Suzuki'];

type TabId = 'published' | 'review';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Chưa xác định ngày';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Chưa xác định ngày';
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffH < 1) return 'Vừa đăng';
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

/** Gộp brands/models từ DB record để hiển thị */
function articleBrands(a: MarketArticle): string[] {
  return Array.from(new Set([...a.thaco_brands, ...a.comp_brands]));
}
function articleModels(a: MarketArticle): string[] {
  return Array.from(new Set([...a.thaco_models, ...a.comp_models]));
}

// ── Article Card ──────────────────────────────────────────────────────────────
function ArticleCard({ article, isReview = false, onApprove, onArchive }: {
  article: MarketArticle;
  isReview?: boolean;
  onApprove?: () => void;
  onArchive?: () => void;
}) {
  const cat = article.category;
  const catStyle = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE.other;
  const brands = articleBrands(article);
  const models = articleModels(article);

  return (
    <div
      style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Row 1: badges + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {brands.map(b => (
          <span key={b} style={{ fontSize: 'var(--fs-label)', fontWeight: 700, background: '#F3F4F6', color: '#374151', padding: '1px 7px', borderRadius: 4 }}>{b}</span>
        ))}
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 500, background: catStyle.bg, color: catStyle.text, padding: '1px 8px', borderRadius: 4 }}>
          {CATEGORY_LABELS[cat] ?? cat}
        </span>
        {article.date_confidence === 'low' && (
          <span style={{ fontSize: 'var(--fs-label)', color: '#B45309', background: '#FFFBEB', padding: '1px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <AlertCircle size={10} /> Ngày chưa chắc
          </span>
        )}
        <span style={{ fontSize: 'var(--fs-label)', color: '#9CA3AF', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} /> {timeAgo(article.published_at)}
        </span>
      </div>

      {/* Title */}
      <a
        href={article.source_url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: '#111827', textDecoration: 'none', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 5 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563EB'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#111827'; }}
      >
        {article.title}
        <ExternalLink size={11} style={{ flexShrink: 0, marginTop: 3, opacity: 0.35 }} />
      </a>

      {/* Dòng xe */}
      {models.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {models.map(m => (
            <span key={m} style={{ fontSize: 'var(--fs-label)', background: '#F0F9FF', color: '#0369A1', padding: '1px 7px', borderRadius: 4, border: '1px solid #BAE6FD' }}>
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Promo detail nếu có */}
      {article.promo_detail && (
        <div style={{ fontSize: 'var(--fs-table)', background: '#FFF7ED', color: '#C2410C', padding: '4px 10px', borderRadius: 5, border: '1px solid #FED7AA' }}>
          {article.promo_detail}
          {article.price_info && <span style={{ marginLeft: 8, color: '#374151' }}> · {article.price_info}</span>}
        </div>
      )}

      {/* Summary */}
      {article.summary && (
        <p style={{ fontSize: 'var(--fs-table)', color: '#4B5563', lineHeight: 1.55, margin: 0 }}>
          {article.summary}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 'var(--fs-label)', color: '#9CA3AF' }}>{article.source_domain ?? ''}</span>
        {isReview && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onApprove} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-label)', padding: '3px 11px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
              <CheckCircle size={11} /> Duyệt
            </button>
            <button onClick={onArchive} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-label)', padding: '3px 11px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
              <Archive size={11} /> Ẩn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Brand Chip ────────────────────────────────────────────────────────────────
function BrandChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string | null; onClick: () => void }) {
  const bg = active ? (color ?? '#1E40AF') : '#F9FAFB';
  const txt = active ? '#fff' : '#374151';
  const border = active ? (color ?? '#1E40AF') : '#E5E7EB';
  return (
    <button onClick={onClick} style={{
      fontSize: 'var(--fs-label)', fontWeight: active ? 700 : 500,
      padding: '4px 12px', border: `1px solid ${border}`,
      background: bg, color: txt,
      borderRadius: 20, cursor: 'pointer',
      transition: 'all 0.14s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketIntelPage() {
  const { brands } = useBrands();

  const [activeTab, setActiveTab]           = useState<TabId>('published');
  const [filterBrand, setFilterBrand]       = useState('');
  const [filterModel, setFilterModel]       = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDays, setFilterDays]         = useState(30);
  const [isCrawling, setIsCrawling]         = useState(false);
  const [crawlMsg, setCrawlMsg]             = useState('');
  const [showCharts, setShowCharts]         = useState(true);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { articles, isLoading: loadingPub, revalidate: refetchPub } = useArticles({
    status: 'published',
    brand: filterBrand,
    model: filterModel,
    category: filterCategory,
    days: filterDays,
  });

  const { articles: reviewArticles, isLoading: loadingRev, revalidate: refetchRev } = useArticles({
    status: 'review',
    days: 90,
  });

  const { latestJob } = useCrawlJobs();

  // Stats
  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const todayCount = useMemo(
    () => articles.filter(a => a.crawled_at && new Date(a.crawled_at) >= todayMidnight).length,
    [articles, todayMidnight]
  );

  // Dòng xe của brand THACO được chọn
  const modelsOfSelected = filterBrand
    ? (brands.find(b => b.name === filterBrand)?.models ?? [])
    : [];

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartByBrand = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => articleBrands(a).forEach(b => { counts[b] = (counts[b] || 0) + 1; }));
    return Object.entries(counts)
      .map(([brand, count]) => ({ brand, count, fill: BRAND_COLORS[brand] ?? '#94A3B8' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [articles]);

  const chartByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    return Object.entries(counts)
      .map(([cat, value]) => ({ name: CATEGORY_LABELS[cat as ArticleCategory] ?? cat, value, fill: CAT_COLORS[cat] ?? '#9CA3AF' }))
      .sort((a, b) => b.value - a.value);
  }, [articles]);

  const chart7Days = useMemo(() => {
    const today = new Date();
    const slots: { day: string; date: Date; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      slots.push({ day: i === 0 ? 'Hôm nay' : `T.${d.getDate()}`, date: d, count: 0 });
    }
    articles.forEach(a => {
      if (!a.published_at) return;
      const pub = new Date(a.published_at);
      slots.forEach(s => {
        if (pub.getDate() === s.date.getDate() && pub.getMonth() === s.date.getMonth()) {
          s.count++;
        }
      });
    });
    return slots.map(({ day, count }) => ({ day, count }));
  }, [articles]);

  const total7Days = useMemo(() => chart7Days.reduce((s, d) => s + d.count, 0), [chart7Days]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCrawl = async () => {
    setIsCrawling(true);
    setCrawlMsg('');
    const result = await triggerCrawl();
    setIsCrawling(false);
    setCrawlMsg(result.message);
    if (result.ok) { refetchPub(); refetchRev(); }
    setTimeout(() => setCrawlMsg(''), 5000);
  };

  const handleApprove = async (id: string) => {
    await updateArticleStatus(id, 'published');
    refetchRev();
    refetchPub();
  };

  const handleArchive = async (id: string) => {
    await updateArticleStatus(id, 'archived');
    refetchRev();
  };

  const selectBrand = (name: string) => {
    if (filterBrand === name) { setFilterBrand(''); setFilterModel(''); }
    else { setFilterBrand(name); setFilterModel(''); }
  };

  const TAB = (id: TabId): React.CSSProperties => ({
    fontSize: 'var(--fs-table)', fontWeight: activeTab === id ? 600 : 400,
    padding: '8px 18px', border: 'none',
    borderBottom: activeTab === id ? '2px solid #2563EB' : '2px solid transparent',
    background: 'none', color: activeTab === id ? '#2563EB' : '#6B7280', cursor: 'pointer',
  });

  // ── Crawl status box ───────────────────────────────────────────────────────
  const crawlStatusBox = useMemo(() => {
    if (!latestJob) return { bg: '#F9FAFB', border: '#E5E7EB', label: 'Chưa có dữ liệu', sub: 'Chưa crawl lần nào', color: '#6B7280' };
    if (latestJob.status === 'running') return { bg: '#EFF6FF', border: '#BFDBFE', label: 'Đang thu thập...', sub: 'Vui lòng đợi', color: '#1D4ED8' };
    if (latestJob.status === 'error')   return { bg: '#FFF1F2', border: '#FECDD3', label: 'Lỗi crawl', sub: latestJob.error_msg ?? 'Xem log', color: '#BE123C' };
    const t = latestJob.completed_at ? new Date(latestJob.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    const d = latestJob.completed_at ? new Date(latestJob.completed_at).toLocaleDateString('vi-VN') : '';
    return {
      bg: '#F0FDF4', border: '#BBF7D0',
      label: 'Cập nhật thành công',
      sub: `${d} ${t} · +${latestJob.articles_new} bài mới`,
      color: '#15803D',
    };
  }, [latestJob]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F9FAFB' }}>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 }}>
              THACO AUTO HÀ NỘI · BÁO CÁO THỊ TRƯỜNG
            </div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Theo dõi đối thủ cạnh tranh
              <TrendingUp size={16} color="#2563EB" />
            </h1>
            <p style={{ fontSize: 'var(--fs-label)', color: '#6B7280', margin: '3px 0 0' }}>
              Tự động crawl thứ 2 &amp; thứ 5 · Phân tích bởi Gemini AI · Lọc theo brand/model
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, padding: '6px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              {[
                { label: 'Hôm nay', value: String(todayCount), color: '#2563EB' },
                { label: `${filterDays} ngày`, value: String(articles.length), color: '#374151' },
                { label: 'Cần review', value: String(reviewArticles.length), color: '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Crawl status */}
            <div style={{ background: crawlStatusBox.bg, border: `1px solid ${crawlStatusBox.border}`, borderRadius: 8, padding: '6px 12px', textAlign: 'right', minWidth: 160 }}>
              <div style={{ fontSize: 'var(--fs-label)', color: crawlStatusBox.color, fontWeight: 600 }}>{crawlStatusBox.label}</div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{crawlStatusBox.sub}</div>
            </div>
          </div>
        </div>

        {/* ── Brand filter ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
            Thương hiệu quản lý
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <BrandChip label="Tất cả" active={filterBrand === ''} onClick={() => { setFilterBrand(''); setFilterModel(''); }} />
            {brands.filter(b => !['TẢI BUS', 'BMW MTR'].includes(b.name)).map(b => (
              <BrandChip key={b.name} label={b.name} active={filterBrand === b.name} color={b.color} onClick={() => selectBrand(b.name)} />
            ))}
            <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Đối thủ</span>
            {COMPETITOR_BRANDS.map(name => (
              <BrandChip key={name} label={name} active={filterBrand === name} onClick={() => selectBrand(name)} />
            ))}
          </div>
        </div>

        {/* ── Model filter (chỉ hiện khi chọn THACO brand) ─────────────────── */}
        {modelsOfSelected.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
              Dòng xe — {filterBrand}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['', ...modelsOfSelected].map((m, i) => (
                <button
                  key={m || 'all'}
                  onClick={() => setFilterModel(m)}
                  style={{
                    fontSize: 'var(--fs-label)', padding: '2px 10px', borderRadius: 4,
                    border: `1px solid ${filterModel === m ? '#2563EB' : '#E5E7EB'}`,
                    background: filterModel === m ? '#EFF6FF' : '#fff',
                    color: filterModel === m ? '#2563EB' : '#6B7280',
                    cursor: 'pointer', fontWeight: filterModel === m ? 600 : 400,
                  }}
                >
                  {i === 0 ? 'Tất cả' : m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Controls row ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ fontSize: 'var(--fs-table)', padding: '4px 9px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Tất cả chủ đề</option>
            {(Object.keys(CATEGORY_LABELS) as ArticleCategory[]).map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>

          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #D1D5DB' }}>
            {[7, 30, 90].map((d, i) => (
              <button
                key={d}
                onClick={() => setFilterDays(d)}
                style={{ fontSize: 'var(--fs-label)', padding: '4px 12px', background: filterDays === d ? '#2563EB' : '#fff', color: filterDays === d ? '#fff' : '#374151', border: 'none', borderRight: i < 2 ? '1px solid #D1D5DB' : 'none', cursor: 'pointer' }}
              >
                {d} ngày
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCharts(v => !v)}
            style={{ fontSize: 'var(--fs-label)', padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 6, background: showCharts ? '#EFF6FF' : '#fff', color: showCharts ? '#2563EB' : '#6B7280', cursor: 'pointer' }}
          >
            Biểu đồ
          </button>

          {crawlMsg && (
            <span style={{ fontSize: 'var(--fs-label)', color: crawlMsg.startsWith('+') ? '#15803D' : '#BE123C', padding: '2px 8px', background: crawlMsg.startsWith('+') ? '#F0FDF4' : '#FFF1F2', borderRadius: 4 }}>
              {crawlMsg}
            </span>
          )}

          <button
            onClick={handleCrawl}
            disabled={isCrawling}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-table)', fontWeight: 600, padding: '5px 16px', background: isCrawling ? '#9CA3AF' : '#2563EB', color: '#fff', border: 'none', borderRadius: 6, cursor: isCrawling ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={12} style={{ animation: isCrawling ? 'spin 1s linear infinite' : 'none' }} />
            {isCrawling ? 'Đang thu thập...' : 'Thu thập ngay'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <button style={TAB('published')} onClick={() => setActiveTab('published')}>
          Tin tức {loadingPub ? '...' : `(${articles.length})`}
        </button>
        <button style={TAB('review')} onClick={() => setActiveTab('review')}>
          Cần review {loadingRev ? '...' : `(${reviewArticles.length})`}
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 40px' }}>

        {activeTab === 'published' && (
          <>
            {/* Charts */}
            {showCharts && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 260px', gap: 12, marginBottom: 16 }}>

                {/* Chart 1: Brand */}
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    Tần suất theo thương hiệu ({filterDays} ngày)
                  </div>
                  {chartByBrand.length === 0 ? (
                    <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 'var(--fs-label)' }}>
                      {loadingPub ? 'Đang tải...' : 'Không có dữ liệu'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={chartByBrand} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="brand" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB' }} formatter={(v) => [`${v} bài`, 'Số tin']} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {chartByBrand.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Chart 2: Category */}
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Phân loại nội dung
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flexShrink: 0, width: 110, height: 110 }}>
                      <PieChart width={110} height={110}>
                        <Pie data={chartByCategory} dataKey="value" cx={55} cy={55} innerRadius={28} outerRadius={48} paddingAngle={3}>
                          {chartByCategory.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 5 }} formatter={(v) => [`${v} bài`]} />
                      </PieChart>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                      {chartByCategory.length === 0
                        ? <span style={{ fontSize: 10, color: '#9CA3AF' }}>{loadingPub ? 'Đang tải...' : 'Không có dữ liệu'}</span>
                        : chartByCategory.map(c => (
                          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: c.fill, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: '#4B5563' }}>{c.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginLeft: 'auto' }}>{c.value}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>

                {/* Chart 3: 7 ngày */}
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Hoạt động 7 ngày qua
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2563EB', lineHeight: 1 }}>{total7Days}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>bài trong 7 ngày</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={chart7Days} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ fontSize: 10, borderRadius: 5 }} formatter={(v) => [`${v} bài`]} />
                      <Area type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: '#2563EB' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Article list */}
            {loadingPub ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0', fontSize: 'var(--fs-body)' }}>Đang tải...</div>
            ) : articles.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0', fontSize: 'var(--fs-body)' }}>
                Không có bài viết nào. Nhấn &quot;Thu thập ngay&quot; để lấy dữ liệu mới.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {articles.map(a => <ArticleCard key={a.id} article={a} />)}
              </div>
            )}
          </>
        )}

        {activeTab === 'review' && (
          <div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 14px', marginBottom: 12, fontSize: 'var(--fs-table)', color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} />
              Các bài này chưa đủ chất lượng để tự động hiển thị. Xem xét và duyệt thủ công hoặc ẩn đi.
            </div>
            {loadingRev ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0' }}>Đang tải...</div>
            ) : reviewArticles.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0' }}>
                <CheckCircle size={30} style={{ margin: '0 auto 8px', display: 'block', color: '#10B981' }} />
                <p style={{ fontSize: 'var(--fs-body)' }}>Không có bài nào cần review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviewArticles.map(a => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    isReview
                    onApprove={() => handleApprove(a.id)}
                    onArchive={() => handleArchive(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
