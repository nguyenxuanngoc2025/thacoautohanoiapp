// app/src/app/(dashboard)/market-intel/page.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { RefreshCw, ExternalLink, CheckCircle, Archive, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { useBrands } from '@/contexts/BrandsContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts';

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_ARTICLES = [
  {
    id: '1',
    title: 'KIA tung chương trình ưu đãi tháng 4/2026 – Hỗ trợ 100% lệ phí trước bạ cho Seltos và Sportage',
    summary: 'KIA Việt Nam triển khai chương trình khuyến mại hấp dẫn trong tháng 4/2026 với mức hỗ trợ 100% lệ phí trước bạ cho hai mẫu xe bán chạy là Seltos và Sportage. Chương trình áp dụng từ ngày 1–30/4/2026 tại tất cả đại lý chính hãng trên toàn quốc. Đây là động thái cạnh tranh trực tiếp với các chương trình ưu đãi tháng 4 của Toyota và Hyundai.',
    source: 'kia.com.vn',
    published_at: '2026-04-16T08:30:00+07:00',
    brands: ['KIA'],
    models: ['New Seltos', 'Sportage'],
    category: 'promotion' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '2',
    title: 'Hyundai TUCSON 2026 chính thức ra mắt tại Việt Nam với nhiều nâng cấp đáng kể',
    summary: 'Hyundai Thành Công chính thức giới thiệu TUCSON 2026 tại sự kiện ra mắt tối ngày 15/4 tại Hà Nội và TP.HCM. Xe được nâng cấp hệ thống giải trí màn hình 10.25 inch, bổ sung gói an toàn ADAS và có thêm màu mới Xanh Abyss. Giá bán giữ nguyên từ 825 triệu đồng. Hyundai ước tính sẽ giao 500 xe trong tháng đầu tiên.',
    source: 'hyundai-thanh-cong.com.vn',
    published_at: '2026-04-15T19:00:00+07:00',
    brands: ['Hyundai'],
    models: ['TUCSON'],
    category: 'new_model' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '3',
    title: 'Toyota Việt Nam điều chỉnh giá Innova Cross và Corolla Cross từ tháng 5/2026',
    summary: 'Toyota Việt Nam thông báo điều chỉnh giá bán lẻ đề xuất cho hai mẫu xe Innova Cross và Corolla Cross từ tháng 5/2026. Cụ thể, Innova Cross tăng 10 triệu đồng do chi phí nhập khẩu tăng, trong khi Corolla Cross giảm 15 triệu cho phiên bản HEV để tăng sức cạnh tranh với VinFast VF6. Đây là lần đầu Toyota điều chỉnh giá trong năm 2026.',
    source: 'toyota.com.vn',
    published_at: '2026-04-15T10:15:00+07:00',
    brands: ['Toyota'],
    models: ['Innova Cross', 'Corolla Cross'],
    category: 'price_change' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '4',
    title: 'Mazda tổ chức lái thử xuyên Việt "Mazda Drive Together 2026" với 500 km hành trình',
    summary: 'Mazda Việt Nam khởi động sự kiện lái thử quy mô lớn "Mazda Drive Together 2026" dự kiến diễn ra từ 20–22/4/2026. Hành trình bắt đầu từ Hà Nội qua các tỉnh miền Trung đến TP.HCM với sự tham gia của hơn 200 khách hàng tiềm năng. Sự kiện tập trung giới thiệu CX-5 2026 và CX-60 mới ra mắt.',
    source: 'mazdavn.com',
    published_at: '2026-04-14T14:00:00+07:00',
    brands: ['Mazda'],
    models: ['Mazda CX-5', 'CX-60'],
    category: 'event' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '5',
    title: 'Thị trường ô tô tháng 3/2026: KIA và Hyundai tăng trưởng mạnh, Toyota giảm nhẹ',
    summary: 'Theo số liệu từ VAMA, doanh số thị trường ô tô tháng 3/2026 tăng 18% so với cùng kỳ năm 2025. KIA ghi nhận mức tăng trưởng ấn tượng 32% với 4.820 xe, vươn lên vị trí thứ 3 toàn thị trường. Hyundai tăng 24% với 5.100 xe. Toyota vẫn dẫn đầu với 6.800 xe nhưng chỉ tăng 8%. Phân khúc SUV tiếp tục chiếm 58% tổng doanh số.',
    source: 'baoxehoi.com',
    published_at: '2026-04-13T09:00:00+07:00',
    brands: ['KIA', 'Hyundai', 'Toyota'],
    models: ['New Seltos', 'Sportage', 'TUCSON', 'Fortuner'],
    category: 'market_news' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '6',
    title: 'Mitsubishi Việt Nam hỗ trợ 50% phí đăng ký cho Xpander dịp 30/4',
    summary: 'Mitsubishi Motors Việt Nam công bố chương trình ưu đãi đặc biệt nhân dịp Lễ 30/4 với mức hỗ trợ 50% lệ phí đăng ký cho dòng xe MPV bán chạy Xpander. Chương trình áp dụng từ 20/4 đến hết 30/4/2026. Đây là lần thứ hai liên tiếp Mitsubishi triển khai ưu đãi lớn cho Xpander, sau chương trình Tết 2026 đạt kết quả tích cực.',
    source: 'mitsubishi-motors.com.vn',
    published_at: '2026-04-12T11:30:00+07:00',
    brands: ['Mitsubishi'],
    models: ['Xpander'],
    category: 'promotion' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '7',
    title: 'Honda HR-V 2026 xuất hiện tại Việt Nam, trang bị thêm Honda Sensing tiêu chuẩn',
    summary: 'Honda Việt Nam xác nhận sẽ ra mắt HR-V 2026 với gói an toàn Honda Sensing được trang bị tiêu chuẩn trên tất cả phiên bản. Mẫu xe cũng được làm mới ngoại thất với lưới tản nhiệt mới và cụm đèn hậu liền khối. Dự kiến giá bán tăng khoảng 20–25 triệu so với hiện tại. Thời điểm ra mắt chính thức dự kiến cuối tháng 5/2026.',
    source: 'xe.com.vn',
    published_at: '2026-04-11T16:00:00+07:00',
    brands: ['Honda'],
    models: ['HR-V'],
    category: 'new_model' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '8',
    title: 'VinFast VF3 giao xe hàng loạt tại miền Bắc, lượng đặt cọc vượt 15.000 xe',
    summary: 'VinFast chính thức bàn giao VF3 cho các khách hàng tại Hà Nội và các tỉnh miền Bắc từ ngày 10/4. Tính đến ngày bàn giao, tổng lượng đặt cọc VF3 trên toàn quốc vượt mốc 15.000 xe — con số cao nhất trong lịch sử ra mắt xe điện tại Việt Nam. VinFast cam kết giao đủ trong quý 2/2026 với công suất nhà máy 500 xe/ngày.',
    source: 'vnexpress.net',
    published_at: '2026-04-10T08:00:00+07:00',
    brands: ['VinFast'],
    models: ['VF3'],
    category: 'market_news' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '9',
    title: 'KIA Carens 2026 nhận ưu đãi thêm phụ kiện trị giá 15 triệu, tháng 4/2026',
    summary: 'Chương trình ưu đãi mới nhất của KIA dành cho Carens trong tháng 4/2026 bao gồm gói phụ kiện chính hãng trị giá 15 triệu đồng, hỗ trợ phí bảo hiểm thân vỏ năm đầu và lãi suất vay ưu đãi 0% trong 12 tháng. Carens hiện là mẫu MPV bán chạy thứ 2 phân khúc, chỉ sau Mitsubishi Xpander.',
    source: 'kia.com.vn',
    published_at: '2026-04-09T10:00:00+07:00',
    brands: ['KIA'],
    models: ['Carens'],
    category: 'promotion' as const,
    date_confidence: 'high' as const,
  },
  {
    id: '10',
    title: 'Peugeot 3008 2026 ra mắt tại Việt Nam với động cơ hybrid mới, giá từ 1,2 tỷ',
    summary: 'Peugeot Việt Nam chính thức giới thiệu 3008 2026 với tùy chọn động cơ hybrid 48V lần đầu tiên tại thị trường Việt Nam. Xe được trang bị màn hình i-Cockpit thế hệ mới, tích hợp trợ lý AI và bản đồ Here. Giá bán khởi điểm từ 1,199 tỷ đồng cho phiên bản xăng tiêu chuẩn.',
    source: 'xe.com.vn',
    published_at: '2026-04-08T14:00:00+07:00',
    brands: ['Peugeot'],
    models: ['3008'],
    category: 'new_model' as const,
    date_confidence: 'high' as const,
  },
];

const MOCK_REVIEWS = [
  {
    id: 'r1',
    title: 'Thị trường SUV cỡ C tháng tư có nhiều biến động...',
    summary: 'Bài viết đề cập đến biến động trong phân khúc SUV cỡ C. Tuy nhiên nội dung crawl được bị thiếu phần kết vì trang yêu cầu đăng nhập để xem đầy đủ.',
    source: 'otosaigon.com',
    published_at: null,
    brands: ['KIA', 'Mazda', 'Toyota'],
    models: ['Sportage', 'Mazda CX-5', 'Fortuner'],
    category: 'market_news' as const,
    date_confidence: 'low' as const,
  },
  {
    id: 'r2',
    title: 'Chương trình ưu đãi dịp 30/4 của các hãng xe Nhật',
    summary: 'Nội dung ngắn, chỉ capture được phần mô tả ngắn từ trang danh sách. Cần crawl lại trang bài viết đầy đủ.',
    source: 'carmudi.vn',
    published_at: '2026-04-09T00:00:00+07:00',
    brands: ['Toyota', 'Honda', 'Mitsubishi'],
    models: ['Fortuner', 'HR-V', 'Xpander'],
    category: 'promotion' as const,
    date_confidence: 'medium' as const,
  },
];

// ── Chart data ────────────────────────────────────────────────────────────────
// Màu thương hiệu
const BRAND_COLORS: Record<string, string> = {
  KIA: '#1A4B8C', Hyundai: '#00447C', Toyota: '#EB0A1E', Mazda: '#9B0E17',
  Honda: '#CC0000', Mitsubishi: '#E60012', VinFast: '#1E4DB7', Peugeot: '#003399',
  STELLANTIS: '#6B21A8', BMW: '#0066B1', MINI: '#1B1B1B', MG: '#C41E3A',
  Ford: '#003B8E', Suzuki: '#005BAA',
};

// Màu category
const CAT_COLORS: Record<string, string> = {
  promotion: '#F97316', new_model: '#3B82F6', market_news: '#10B981',
  event: '#8B5CF6', price_change: '#EF4444', other: '#9CA3AF',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = 'promotion' | 'new_model' | 'event' | 'price_change' | 'market_news' | 'other';
type TabId = 'published' | 'review';

const CATEGORY_LABELS: Record<Category, string> = {
  promotion: 'Khuyến mại', new_model: 'Xe mới', event: 'Sự kiện',
  price_change: 'Giá xe', market_news: 'Tin thị trường', other: 'Khác',
};
const CATEGORY_STYLE: Record<Category, { bg: string; text: string }> = {
  promotion:    { bg: '#FFF7ED', text: '#C2410C' },
  new_model:    { bg: '#EFF6FF', text: '#1D4ED8' },
  event:        { bg: '#F5F3FF', text: '#6D28D9' },
  price_change: { bg: '#FFF1F2', text: '#BE123C' },
  market_news:  { bg: '#F0FDF4', text: '#15803D' },
  other:        { bg: '#F9FAFB', text: '#6B7280' },
};

// Đối thủ cạnh tranh (ngoài thương hiệu THACO quản lý)
const COMPETITOR_BRANDS = ['Toyota', 'Hyundai', 'Honda', 'Mitsubishi', 'VinFast', 'MG', 'Ford', 'Suzuki'];

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

// ── Article Card ──────────────────────────────────────────────────────────────
function ArticleCard({ article, isReview = false, onApprove, onArchive }: {
  article: typeof MOCK_ARTICLES[0];
  isReview?: boolean;
  onApprove?: () => void;
  onArchive?: () => void;
}) {
  const cat = article.category;
  const catStyle = CATEGORY_STYLE[cat];
  return (
    <div
      style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Row 1: badges + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {article.brands.map(b => (
          <span key={b} style={{ fontSize: 'var(--fs-label)', fontWeight: 700, background: '#F3F4F6', color: '#374151', padding: '1px 7px', borderRadius: 4 }}>{b}</span>
        ))}
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 500, background: catStyle.bg, color: catStyle.text, padding: '1px 8px', borderRadius: 4 }}>
          {CATEGORY_LABELS[cat]}
        </span>
        {(article as any).date_confidence === 'low' && (
          <span style={{ fontSize: 'var(--fs-label)', color: '#B45309', background: '#FFFBEB', padding: '1px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <AlertCircle size={10} /> Ngày chưa chắc
          </span>
        )}
        <span style={{ fontSize: 'var(--fs-label)', color: '#9CA3AF', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} /> {timeAgo(article.published_at)}
        </span>
      </div>

      {/* Title */}
      <a href="#" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: '#111827', textDecoration: 'none', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 5 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563EB'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#111827'; }}
      >
        {article.title}
        <ExternalLink size={11} style={{ flexShrink: 0, marginTop: 3, opacity: 0.35 }} />
      </a>

      {/* Dòng xe liên quan */}
      {article.models && article.models.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {article.models.map(m => (
            <span key={m} style={{ fontSize: 'var(--fs-label)', background: '#F0F9FF', color: '#0369A1', padding: '1px 7px', borderRadius: 4, border: '1px solid #BAE6FD' }}>
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      <p style={{ fontSize: 'var(--fs-table)', color: '#4B5563', lineHeight: 1.55, margin: 0 }}>
        {article.summary}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 'var(--fs-label)', color: '#9CA3AF' }}>{article.source}</span>
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
  const [reviews, setReviews]               = useState(MOCK_REVIEWS);
  const [showCharts, setShowCharts]         = useState(true);

  // Dòng xe của brand được chọn (từ danh sách THACO quản lý)
  const modelsOfSelected = filterBrand
    ? (brands.find(b => b.name === filterBrand)?.models ?? [])
    : [];

  // Filter articles
  const filtered = MOCK_ARTICLES.filter(a => {
    if (filterBrand && !a.brands.includes(filterBrand)) return false;
    if (filterModel && !a.models.includes(filterModel)) return false;
    if (filterCategory && a.category !== filterCategory) return false;
    return true;
  });

  // ── Chart data động từ filtered ────────────────────────────────────────────
  const chartByBrand = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(a => a.brands.forEach(b => { counts[b] = (counts[b] || 0) + 1; }));
    return Object.entries(counts)
      .map(([brand, count]) => ({ brand, count, fill: BRAND_COLORS[brand] ?? '#94A3B8' }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const chartByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    return Object.entries(counts)
      .map(([cat, value]) => ({ name: CATEGORY_LABELS[cat as Category] ?? cat, value, fill: CAT_COLORS[cat] ?? '#9CA3AF' }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const chart7Days = useMemo(() => {
    // Tạo 7 slot ngày gần nhất
    const TODAY = new Date('2026-04-17'); // mock today
    const slots: { day: string; date: Date; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - i);
      slots.push({ day: i === 0 ? 'Hôm nay' : `T.${d.getDate()}`, date: d, count: 0 });
    }
    filtered.forEach(a => {
      if (!a.published_at) return;
      const pub = new Date(a.published_at);
      slots.forEach(s => {
        if (pub.getDate() === s.date.getDate() && pub.getMonth() === s.date.getMonth()) {
          s.count++;
        }
      });
    });
    return slots.map(({ day, count }) => ({ day, count }));
  }, [filtered]);

  const total7Days = useMemo(() => chart7Days.reduce((s, d) => s + d.count, 0), [chart7Days]);

  const handleCrawlDemo = () => {
    setIsCrawling(true);
    setTimeout(() => setIsCrawling(false), 2000);
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
              Tin tức tự động · Cập nhật 6:45 sáng hàng ngày · 18 nguồn crawl đang hoạt động
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, padding: '6px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              {[
                { label: 'Hôm nay', value: '8', color: '#2563EB' },
                { label: 'Tháng này', value: '142', color: '#374151' },
                { label: 'Cần review', value: '2', color: '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Crawl status */}
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '6px 12px', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--fs-label)', color: '#15803D', fontWeight: 600 }}>Cập nhật thành công</div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Hôm nay 6:48 sáng · +8 bài mới</div>
            </div>
          </div>
        </div>

        {/* ── Thương hiệu filter (row 1) ───────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
            Thương hiệu quản lý
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <BrandChip label="Tất cả" active={filterBrand === ''} onClick={() => { setFilterBrand(''); setFilterModel(''); }} />
            {brands.filter(b => !['TẢI BUS', 'BMW MTR'].includes(b.name)).map(b => (
              <BrandChip key={b.name} label={b.name} active={filterBrand === b.name} color={b.color} onClick={() => selectBrand(b.name)} />
            ))}
            {/* Divider */}
            <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Đối thủ</span>
            {COMPETITOR_BRANDS.map(name => (
              <BrandChip key={name} label={name} active={filterBrand === name} onClick={() => selectBrand(name)} />
            ))}
          </div>
        </div>

        {/* ── Dòng xe filter (row 2 — chỉ hiện khi chọn brand THACO quản lý) ─ */}
        {modelsOfSelected.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
              Dòng xe — {filterBrand}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterModel('')}
                style={{ fontSize: 'var(--fs-label)', padding: '2px 10px', borderRadius: 4, border: `1px solid ${filterModel === '' ? '#2563EB' : '#E5E7EB'}`, background: filterModel === '' ? '#EFF6FF' : '#fff', color: filterModel === '' ? '#2563EB' : '#6B7280', cursor: 'pointer', fontWeight: filterModel === '' ? 600 : 400 }}
              >
                Tất cả
              </button>
              {modelsOfSelected.map(m => (
                <button
                  key={m}
                  onClick={() => setFilterModel(filterModel === m ? '' : m)}
                  style={{ fontSize: 'var(--fs-label)', padding: '2px 10px', borderRadius: 4, border: `1px solid ${filterModel === m ? '#2563EB' : '#E5E7EB'}`, background: filterModel === m ? '#EFF6FF' : '#fff', color: filterModel === m ? '#2563EB' : '#6B7280', cursor: 'pointer', fontWeight: filterModel === m ? 600 : 400 }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter row: category + time + crawl ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ fontSize: 'var(--fs-table)', padding: '4px 9px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Tất cả chủ đề</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
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

          <button
            onClick={handleCrawlDemo}
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
          Tin tức ({filtered.length})
        </button>
        <button style={TAB('review')} onClick={() => setActiveTab('review')}>
          Cần review ({reviews.length})
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 40px' }}>

        {activeTab === 'published' && (
          <>
            {/* ── Charts section ───────────────────────────────────────────── */}
            {showCharts && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 260px', gap: 12, marginBottom: 16 }}>

                {/* Chart 1: Tần suất theo thương hiệu */}
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    Tần suất tin tức theo thương hiệu (tháng này)
                  </div>
                  {chartByBrand.length === 0 ? (
                    <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 'var(--fs-label)' }}>Không có dữ liệu</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={chartByBrand} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="brand" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB' }} formatter={(v) => [`${v} bài`, 'Số tin']} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#94A3B8">
                          {chartByBrand.map((entry, i) => (
                            <Cell key={i} fill={entry.fill ?? '#94A3B8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Chart 2: Phân loại nội dung */}
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Phân loại nội dung
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flexShrink: 0, width: 110, height: 110 }}>
                      <PieChart width={110} height={110}>
                        <Pie data={chartByCategory} dataKey="value" cx={55} cy={55} innerRadius={28} outerRadius={48} paddingAngle={3}>
                          {chartByCategory.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 5 }} formatter={(v) => [`${v} bài`]} />
                      </PieChart>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                      {chartByCategory.length === 0
                        ? <span style={{ fontSize: 10, color: '#9CA3AF' }}>Không có dữ liệu</span>
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

                {/* Chart 3: Hoạt động 7 ngày qua */}
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
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0', fontSize: 'var(--fs-body)' }}>
                Không có bài viết nào khớp với bộ lọc.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(a => <ArticleCard key={a.id} article={a} />)}
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
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '50px 0' }}>
                <CheckCircle size={30} style={{ margin: '0 auto 8px', display: 'block', color: '#10B981' }} />
                <p style={{ fontSize: 'var(--fs-body)' }}>Không có bài nào cần review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviews.map(a => (
                  <ArticleCard
                    key={a.id}
                    article={a as any}
                    isReview
                    onApprove={() => setReviews(prev => prev.filter(r => r.id !== a.id))}
                    onArchive={() => setReviews(prev => prev.filter(r => r.id !== a.id))}
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
