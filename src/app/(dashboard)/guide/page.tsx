'use client';

import React, { useState } from 'react';
import {
  BookOpen, LayoutDashboard, CalendarRange, CalendarCheck,
  FileText, Newspaper, CheckSquare, Settings, Users,
  Route, Zap, ShieldCheck, Info, ChevronDown, ChevronRight,
  Wallet, BarChart3, TrendingUp, Activity, Bell, Globe,
} from 'lucide-react';

// ─── Section accordion ────────────────────────────────────────────────────────
function Section({
  id, icon, iconColor = '#3B82F6', title, children, defaultOpen = true,
}: {
  id?: string; icon: React.ReactNode; iconColor?: string;
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      id={id}
      style={{ marginBottom: 20, background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', background: 'var(--color-surface-alt, #f8fafc)',
          borderBottom: open ? '1px solid var(--color-border-light, #f1f5f9)' : 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: iconColor, display: 'flex', flexShrink: 0 }}>{icon}</span>
        <h2 style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text, #0f172a)', margin: 0 }}>{title}</h2>
        {open ? <ChevronDown size={15} color="#94a3b8" /> : <ChevronRight size={15} color="#94a3b8" />}
      </button>
      {open && <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--color-text-secondary, #334155)', lineHeight: 1.7 }}>{children}</div>}
    </section>
  );
}

// ─── Subsection ───────────────────────────────────────────────────────────────
function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)', marginBottom: 6, fontSize: 13.5 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Highlight box ────────────────────────────────────────────────────────────
function Box({ color = '#3B82F6', children }: { color?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: color + '0d', border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`, borderRadius: 6,
      padding: '12px 14px', marginTop: 12, fontSize: 13,
    }}>
      {children}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      background: color + '15', color, fontWeight: 600,
      fontSize: 11.5, border: `1px solid ${color}30`,
    }}>{label}</span>
  );
}

// ─── Metric pill ──────────────────────────────────────────────────────────────
function Metric({ label, desc, color }: { label: string; desc: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid var(--color-border-light, #f1f5f9)', borderRadius: 6, flex: 1, minWidth: 140 }}>
      <span style={{ fontWeight: 700, color, fontSize: 14, flexShrink: 0, minWidth: 52 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted, #64748b)' }}>{desc}</span>
    </div>
  );
}

// ─── Code span ────────────────────────────────────────────────────────────────
function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: 'var(--color-surface-alt, #f1f5f9)', padding: '1px 6px', borderRadius: 4, fontSize: 12.5, fontFamily: 'monospace' }}>{children}</code>;
}

// ─── Table of contents ────────────────────────────────────────────────────────
const TOC = [
  { href: '#overview',  label: 'Tổng quan hệ thống' },
  { href: '#concepts',  label: 'Khái niệm cốt lõi' },
  { href: '#roles',     label: 'Phân quyền người dùng' },
  { href: '#dashboard', label: 'Module Dashboard' },
  { href: '#planning',  label: 'Module Kế hoạch' },
  { href: '#events',    label: 'Module Sự kiện' },
  { href: '#reports',   label: 'Module Báo cáo' },
  { href: '#market',    label: 'Module Thị trường' },
  { href: '#tasks',     label: 'Module Việc cần làm' },
  { href: '#settings',  label: 'Module Cài đặt' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GuidePage() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1040, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text, #0f172a)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <BookOpen size={24} color="var(--color-brand, #004B9B)" />
          Sổ tay Hướng dẫn Hệ thống
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--color-text-muted, #64748b)', marginTop: 6 }}>
          Tài liệu mô tả đầy đủ các module chức năng, phân quyền người dùng và quy trình vận hành của Hệ thống Quản trị Ngân sách Marketing — THACO AUTO.
        </p>
      </div>

      {/* TOC */}
      <div style={{
        background: 'var(--color-surface-alt, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 8, padding: '14px 20px', marginBottom: 24,
      }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted, #64748b)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mục lục
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
          {TOC.map(item => (
            <a key={item.href} href={item.href} style={{ fontSize: 13, color: 'var(--color-brand, #004B9B)', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── 1. TỔNG QUAN ─────────────────────────────────────────────────────── */}
      <Section id="overview" icon={<Info size={18} />} iconColor="#3B82F6" title="1. Tổng quan hệ thống">
        <p>
          Hệ thống Quản trị Ngân sách Marketing (THACO MKT Budget) là nền tảng tập trung để <b>lập kế hoạch, theo dõi thực hiện và báo cáo</b> toàn bộ ngân sách marketing của THACO AUTO — bao gồm nhiều Công ty con (Unit), nhiều Showroom và nhiều Thương hiệu xe.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            { icon: <LayoutDashboard size={15} />, label: 'Dashboard', desc: 'Tổng quan KPI theo thời gian thực' },
            { icon: <CalendarRange size={15} />, label: 'Kế hoạch', desc: 'Nhập & phê duyệt ngân sách' },
            { icon: <CalendarCheck size={15} />, label: 'Sự kiện', desc: 'Quản lý sự kiện marketing' },
            { icon: <FileText size={15} />, label: 'Báo cáo', desc: 'Phân tích Kế hoạch vs Thực tế' },
            { icon: <Newspaper size={15} />, label: 'Thị trường', desc: 'Tin tức đối thủ cạnh tranh' },
            { icon: <CheckSquare size={15} />, label: 'Việc cần làm', desc: 'Tác vụ & nhắc nhở' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: 6, background: 'var(--color-surface, #fff)', minWidth: 160 }}>
              <span style={{ color: '#3B82F6' }}>{m.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. KHÁI NIỆM CỐT LÕI ─────────────────────────────────────────────── */}
      <Section id="concepts" icon={<Route size={18} />} iconColor="#10B981" title="2. Khái niệm cốt lõi">

        <Sub title="Phễu chuyển đổi Marketing (Sales Funnel)">
          <p>Toàn bộ hệ thống xoay quanh 4 chỉ số theo dõi hành trình khách hàng từ tiếp cận đến mua xe:</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <Metric label="NS" desc="Ngân sách — số tiền chi marketing (đồng)" color="#3B82F6" />
            <Metric label="KHQT" desc="Khách hàng quan tâm — số lead thu được" color="#10B981" />
            <Metric label="GDTD" desc="Gặp dùng thử — lead chuyển đổi thành lịch hẹn" color="#F59E0B" />
            <Metric label="KHĐ" desc="Khách hàng đặt cọc — giao dịch thành công" color="#EF4444" />
          </div>
          <Box color="#3B82F6">
            <b>Tỷ lệ chuyển đổi (CR)</b> giữa các bước là chỉ số quan trọng để đánh giá hiệu quả chiến dịch:
            <div style={{ marginTop: 6 }}>
              <Code>CR1 = GDTD / KHQT</Code> &nbsp;|&nbsp;
              <Code>CR2 = KHĐ / GDTD</Code> &nbsp;|&nbsp;
              <Code>CPL = NS / KHQT</Code> &nbsp;|&nbsp;
              <Code>CPA = NS / KHĐ</Code>
            </div>
          </Box>
        </Sub>

        <Sub title="Kênh Marketing (4 nhóm)">
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Digital', color: '#3B82F6', desc: 'Facebook, Google, Zalo, Youtube...' },
              { label: 'Sự kiện', color: '#10B981', desc: 'Sự kiện ra mắt, lái thử, hội chợ...' },
              { label: 'CSKH', color: '#F59E0B', desc: 'Chăm sóc khách hàng cũ, tái mua' },
              { label: 'Nhận diện', color: '#8B5CF6', desc: 'Băng rôn, biển quảng cáo, OOH' },
            ].map(c => (
              <div key={c.label} style={{ padding: '8px 12px', borderRadius: 6, background: c.color + '10', border: `1px solid ${c.color}30`, flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, color: c.color, fontSize: 13 }}>{c.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Chế độ nhập liệu (2 mode)">
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1, padding: '10px 14px', border: '2px solid #3B82F6', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#3B82F6', fontSize: 13, marginBottom: 4 }}>KẾ HOẠCH</div>
              <p style={{ margin: 0, fontSize: 12.5 }}>Nhập số liệu <b>kế hoạch</b> đầu tháng — chỉ tiêu mục tiêu cho từng thương hiệu / showroom / kênh.</p>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', border: '2px solid #10B981', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#10B981', fontSize: 13, marginBottom: 4 }}>THỰC HIỆN</div>
              <p style={{ margin: 0, fontSize: 12.5 }}>Nhập số liệu <b>thực tế</b> trong tháng — kết quả đạt được để so sánh với kế hoạch.</p>
            </div>
          </div>
        </Sub>

        <Sub title="Quy trình phê duyệt kế hoạch">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Draft', color: '#94a3b8' },
              { label: '→' , color: '#94a3b8' },
              { label: 'Submitted', color: '#F59E0B' },
              { label: '→' , color: '#94a3b8' },
              { label: 'Pending GD', color: '#3B82F6' },
              { label: '→' , color: '#94a3b8' },
              { label: 'Pending BLD', color: '#8B5CF6' },
              { label: '→' , color: '#94a3b8' },
              { label: 'Approved', color: '#10B981' },
            ].map((s, i) => (
              s.label === '→'
                ? <span key={i} style={{ color: '#94a3b8', fontSize: 16 }}>→</span>
                : <span key={i} style={{ padding: '3px 10px', borderRadius: 4, background: s.color + '18', color: s.color, fontWeight: 600, fontSize: 12, border: `1px solid ${s.color}30` }}>{s.label}</span>
            ))}
          </div>
          <p style={{ marginTop: 10, fontSize: 13 }}>MKT Showroom nộp → GĐ Showroom duyệt → Ban Lãnh Đạo duyệt → Khoá sổ.</p>
        </Sub>
      </Section>

      {/* ── 3. PHÂN QUYỀN ────────────────────────────────────────────────────── */}
      <Section id="roles" icon={<ShieldCheck size={18} />} iconColor="#8B5CF6" title="3. Phân quyền người dùng (7 vai trò)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-alt, #f8fafc)', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                {['Vai trò', 'Nhãn hiển thị', 'Phạm vi dữ liệu', 'Nhập liệu', 'Phê duyệt', 'Cài đặt'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { role: 'super_admin',  label: 'Super Admin',       scope: 'Toàn hệ thống',           nhap: 'Tất cả',             duyet: 'Mọi cấp',         caidat: 'Toàn bộ',          color: '#EF4444' },
                { role: 'pt_mkt_cty',  label: 'PT Marketing Cty',  scope: 'Công ty được gán',         nhap: 'Toàn công ty',       duyet: 'Kế hoạch công ty', caidat: 'Nội bộ công ty',   color: '#F59E0B' },
                { role: 'bld',         label: 'Ban Lãnh Đạo',      scope: 'Toàn hệ thống (đọc)',     nhap: 'Không',              duyet: 'Cấp cao nhất',    caidat: 'Không',            color: '#8B5CF6' },
                { role: 'gd_showroom', label: 'GĐ Showroom',       scope: 'Showroom phụ trách',       nhap: 'Không (chỉ duyệt)',  duyet: 'Cấp showroom',    caidat: 'Không',            color: '#3B82F6' },
                { role: 'mkt_brand',   label: 'MKT Thương hiệu',   scope: 'Thương hiệu được giao',    nhap: 'Theo thương hiệu',   duyet: 'Không',           caidat: 'Không',            color: '#10B981' },
                { role: 'mkt_showroom',label: 'MKT Showroom',      scope: 'Showroom phụ trách',       nhap: 'Đầy đủ',            duyet: 'Không',           caidat: 'Không',            color: '#06B6D4' },
                { role: 'finance',     label: 'Kế Toán',           scope: 'Toàn hệ thống (đọc)',     nhap: 'Không',              duyet: 'Không',           caidat: 'Không',            color: '#64748b' },
              ].map((r, i) => (
                <tr key={r.role} style={{ borderBottom: '1px solid var(--color-border-light, #f1f5f9)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-alt, #fafafa)' }}>
                  <td style={{ padding: '8px 12px' }}><RoleBadge label={r.role} color={r.color} /></td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.label}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.scope}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.nhap}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.duyet}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.caidat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Box color="#8B5CF6">
          <b>Preview Role (super_admin):</b> Super Admin có thể giả lập bất kỳ vai trò nào (Role Preview) để kiểm tra giao diện và quyền hạn mà không cần đăng xuất/đăng nhập lại. Vai trò đang giả lập sẽ hiển thị <Code>(Preview)</Code> ở footer sidebar.
        </Box>
      </Section>

      {/* ── 4. DASHBOARD ─────────────────────────────────────────────────────── */}
      <Section id="dashboard" icon={<LayoutDashboard size={18} />} iconColor="#3B82F6" title="4. Module Dashboard">
        <p>Màn hình tổng quan cung cấp cái nhìn tức thời về hiệu quả marketing toàn hệ thống hoặc theo đơn vị.</p>
        <Sub title="Các thẻ KPI chính">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {[
              { icon: <Wallet size={14} />,    label: 'Ngân sách', desc: 'Tổng ngân sách đã duyệt vs đã chi', color: '#3B82F6' },
              { icon: <Users size={14} />,     label: 'KHQT',      desc: 'Tổng khách hàng quan tâm',          color: '#10B981' },
              { icon: <Activity size={14} />,  label: 'GDTD',      desc: 'Lượt gặp dùng thử',                color: '#F59E0B' },
              { icon: <TrendingUp size={14} />,label: 'KHĐ',       desc: 'Khách hàng đặt cọc',               color: '#EF4444' },
            ].map(k => (
              <div key={k.label} style={{ flex: 1, minWidth: 140, padding: '10px 12px', border: `1px solid ${k.color}30`, borderRadius: 6, background: k.color + '08' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: k.color, fontWeight: 600, fontSize: 13 }}>
                  {k.icon} {k.label}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{k.desc}</div>
              </div>
            ))}
          </div>
        </Sub>
        <Sub title="Biểu đồ & phân tích">
          <ul style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li><b>Funnel</b> — Phễu chuyển đổi trực quan NS → KHQT → GDTD → KHĐ</li>
            <li><b>Bar Chart theo thương hiệu</b> — So sánh ngân sách & KPI giữa KIA / Mazda / Stellantis / BMW / MINI / Tải / Bus</li>
            <li><b>Pie Chart theo kênh</b> — Tỷ trọng phân bổ ngân sách Digital / Sự kiện / CSKH / Nhận diện</li>
            <li><b>Bảng chi tiết theo Showroom</b> — KPI từng showroom, tỷ lệ thực hiện so kế hoạch</li>
          </ul>
        </Sub>
        <Sub title="Bộ lọc">
          <p>Dashboard hỗ trợ lọc theo: <b>Tháng / Quý / Năm</b>, <b>Thương hiệu</b>, <b>Showroom</b>. Khi lọc theo thương hiệu, bảng showroom chỉ hiển thị các showroom có dữ liệu tương ứng. Super Admin có thêm bộ lọc <b>Công ty (Unit)</b>.</p>
        </Sub>
      </Section>

      {/* ── 5. KẾ HOẠCH ─────────────────────────────────────────────────────── */}
      <Section id="planning" icon={<CalendarRange size={18} />} iconColor="#10B981" title="5. Module Quản trị Kế hoạch">
        <p>
          Module trung tâm của hệ thống — nơi MKT Showroom / MKT Thương hiệu nhập kế hoạch ngân sách và kết quả thực hiện hàng tháng.
        </p>

        <Sub title="Cấu trúc bảng nhập liệu">
          <p>Bảng dạng ma trận (grid) với cấu trúc:</p>
          <Box color="#10B981">
            <b>Hàng:</b> Thương hiệu → Model xe (VD: KIA → Seltos, Carens...)<br />
            <b>Cột:</b> Kênh marketing → 4 chỉ số (NS / KHQT / GDTD / KHĐ)<br />
            <b>Ô:</b> Giá trị kế hoạch <i>hoặc</i> thực tế tương ứng với tổ hợp trên
          </Box>
        </Sub>

        <Sub title="Chuyển đổi chế độ KẾ HOẠCH / THỰC HIỆN">
          <p>Thanh topbar có toggle chuyển giữa 2 mode. Dữ liệu được lưu riêng biệt — thay đổi ở một mode không ảnh hưởng mode kia. Cùng một giao diện, cùng cấu trúc bảng, nhưng dữ liệu khác nhau.</p>
        </Sub>

        <Sub title="Nộp kế hoạch để phê duyệt">
          <p>Khi hoàn thành nhập liệu, MKT Showroom bấm <b>"Nộp kế hoạch"</b>. Hệ thống tạo bản nộp (submission) kèm trạng thái duyệt. GĐ Showroom và BLD nhận thông báo để phê duyệt.</p>
        </Sub>

        <Sub title="Khoá kỳ (Lock Period)">
          <p>Sau khi tháng đã qua và được khoá bởi Super Admin, dữ liệu tháng đó trở thành chỉ đọc — không ai có thể chỉnh sửa nhằm đảm bảo tính toàn vẹn dữ liệu lịch sử.</p>
        </Sub>

        <Sub title="Xuất / Nhập Excel">
          <p>Trang Kế hoạch hỗ trợ <b>Export</b> toàn bộ dữ liệu ra file Excel và <b>Import</b> từ file Excel theo đúng template — giúp offline planning rồi upload lại.</p>
        </Sub>
      </Section>

      {/* ── 6. SỰ KIỆN ──────────────────────────────────────────────────────── */}
      <Section id="events" icon={<CalendarCheck size={18} />} iconColor="#F59E0B" title="6. Module Quản trị Sự kiện">
        <p>Quản lý toàn bộ vòng đời của sự kiện marketing: lên kế hoạch → thực hiện → báo cáo kết quả.</p>

        <Sub title="Thông tin một sự kiện">
          <ul style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li><b>Thông tin cơ bản:</b> Tên, ngày tổ chức, địa điểm, loại sự kiện, thương hiệu, showroom</li>
            <li><b>Ngân sách & chỉ tiêu kế hoạch:</b> NS / KHQT / GDTD / KHĐ dự kiến</li>
            <li><b>Mức độ ưu tiên:</b> Khẩn cấp / Tuần này / Tháng này</li>
            <li><b>Trạng thái:</b> Hệ thống tự suy ra dựa trên ngày tổ chức</li>
          </ul>
        </Sub>

        <Sub title="Trạng thái sự kiện (tự động)">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {[
              { label: 'Planning',  color: '#3B82F6', desc: 'Chưa đến ngày' },
              { label: 'Upcoming',  color: '#F59E0B', desc: 'Trong 14 ngày tới' },
              { label: 'Ongoing',   color: '#10B981', desc: 'Đang diễn ra' },
              { label: 'Completed', color: '#64748b', desc: 'Đã qua ngày' },
              { label: 'Reported',  color: '#8B5CF6', desc: 'Đã có báo cáo kết quả' },
            ].map(s => (
              <div key={s.label} style={{ padding: '6px 10px', borderRadius: 5, background: s.color + '12', border: `1px solid ${s.color}30`, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: s.color }}>{s.label}</span>
                <span style={{ color: '#64748b', marginLeft: 5 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Báo cáo kết quả (Close Report)">
          <p>Sau khi sự kiện kết thúc, MKT điền <b>Báo cáo kết thúc</b> với số liệu thực tế đạt được (KHQT / GDTD / KHĐ / Chi phí thực). Dữ liệu này tự động được <b>đồng bộ vào bảng Kế hoạch</b> tại kênh "Sự kiện" — không cần nhập tay 2 lần.</p>
        </Sub>

        <Sub title="Đồng bộ sự kiện vào Kế hoạch">
          <p>
            Khi tạo hoặc cập nhật sự kiện, hệ thống tự động gọi API đồng bộ để ghi số liệu kế hoạch và thực tế của sự kiện vào bảng Kế hoạch tại kênh <b>Sự kiện</b>. Kết quả hiển thị thống nhất giữa trang Sự kiện và trang Kế hoạch / Báo cáo.
          </p>
          <Box color="#F59E0B">
            Nếu phát hiện số liệu giữa trang Sự kiện và trang Kế hoạch chênh lệch, dùng nút <b>"Đồng bộ lại"</b> trong cảnh báo trên trang Kế hoạch để khôi phục dữ liệu đúng.
          </Box>
        </Sub>

        <Sub title="Chế độ xem">
          <p>Hỗ trợ 3 chế độ xem: <b>Tháng / Quý / Năm</b>. Có dashboard nhanh phía trên bảng với các KPI: tổng sự kiện, tổng ngân sách, tỷ lệ hoàn thành, số sự kiện sắp tới.</p>
        </Sub>
      </Section>

      {/* ── 7. BÁO CÁO ──────────────────────────────────────────────────────── */}
      <Section id="reports" icon={<FileText size={18} />} iconColor="#EF4444" title="7. Module Báo cáo">
        <p>Phân tích số liệu tổng hợp theo nhiều chiều: thương hiệu, kênh, thời gian, so sánh kế hoạch vs thực tế.</p>

        <Sub title="Các tab báo cáo">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <div style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, marginBottom: 4 }}>Tổng hợp ngân sách</div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>Bảng tổng hợp ngân sách theo tháng, thương hiệu, showroom. Xuất Excel.</p>
            </div>
            <div style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, marginBottom: 4 }}>Kế hoạch vs Thực tế</div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>So sánh trực tiếp kế hoạch vs thực tế theo từng kênh và tháng. Hiển thị % thực hiện và chênh lệch.</p>
            </div>
          </div>
        </Sub>

        <Sub title="Ẩn dòng trống">
          <p>Bật toggle <b>"Ẩn dòng trống"</b> để lọc bỏ các dòng kênh, thương hiệu hoặc showroom không có số liệu — giúp bảng báo cáo gọn hơn khi chỉ cần xem các mục có phát sinh.</p>
        </Sub>

        <Sub title="Bộ lọc báo cáo">
          <p>Lọc theo: <b>Kỳ báo cáo</b> (tháng đơn / quý / bán năm / cả năm), <b>Showroom</b>, <b>Thương hiệu</b>, <b>Kênh</b>. Super Admin thêm lọc <b>Công ty</b>.</p>
        </Sub>
      </Section>

      {/* ── 8. THỊ TRƯỜNG ────────────────────────────────────────────────────── */}
      <Section id="market" icon={<Newspaper size={18} />} iconColor="#06B6D4" title="8. Module Thị trường (Market Intel)">
        <p>Hệ thống tự động thu thập và phân loại tin tức từ <b>website chính thức của các thương hiệu đối thủ</b> — không từ báo chí hay aggregator.</p>

        <Sub title="Nguồn dữ liệu đối thủ">
          <p>Theo dõi các thương hiệu: Toyota, Hyundai, Honda, Mitsubishi, Ford, Volkswagen, Lexus, Suzuki, Isuzu, Hino, Vinfast, SAMCO, Kim Long... tương ứng với từng nhóm xe THACO đang cạnh tranh.</p>
        </Sub>

        <Sub title="Phân loại bài viết (AI)">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {[
              { label: 'Khuyến mãi',    color: '#EF4444' },
              { label: 'Model mới',     color: '#3B82F6' },
              { label: 'Sự kiện',       color: '#10B981' },
              { label: 'Thay đổi giá', color: '#F59E0B' },
              { label: 'Tin thị trường',color: '#8B5CF6' },
              { label: 'Khác',          color: '#64748b' },
            ].map(c => (
              <span key={c.label} style={{ padding: '3px 10px', borderRadius: 4, background: c.color + '15', color: c.color, fontWeight: 600, fontSize: 12, border: `1px solid ${c.color}30` }}>{c.label}</span>
            ))}
          </div>
          <p style={{ marginTop: 8 }}>AI (Gemini) tự động tóm tắt nội dung, phân loại danh mục, trích xuất thông tin giá và ưu đãi.</p>
        </Sub>

        <Sub title="Lọc & duyệt nội dung">
          <p>Lọc theo <b>Thương hiệu THACO</b> (KIA / Mazda / Stellantis...), <b>Loại tin</b>, <b>Thời gian</b> (7/30/90 ngày). Bài chưa xác định ngày đăng vào hàng chờ <b>Review</b> để người dùng duyệt trước khi hiển thị.</p>
        </Sub>

        <Sub title="Thu thập thủ công (Super Admin)">
          <p>Nút <b>"Thu thập ngay"</b> chỉ hiển thị với Super Admin — kích hoạt crawl ngay lập tức mà không cần đợi lịch tự động.</p>
        </Sub>
      </Section>

      {/* ── 9. VIỆC CẦN LÀM ─────────────────────────────────────────────────── */}
      <Section id="tasks" icon={<CheckSquare size={18} />} iconColor="#F59E0B" title="9. Module Việc cần làm (Tasks)">
        <p>Trung tâm nhắc nhở thông minh — tổng hợp mọi tác vụ cần xử lý từ tất cả module.</p>

        <Sub title="Task tự động sinh (6 loại)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {[
              { label: 'Báo cáo sự kiện',   desc: 'Sự kiện đã qua, chưa có báo cáo kết quả',        color: '#EF4444' },
              { label: 'Xác nhận lịch',      desc: 'Sự kiện sắp tới cần xác nhận chuẩn bị',          color: '#F59E0B' },
              { label: 'Sự kiện sắp tới',   desc: 'Nhắc về sự kiện trong vòng 14 ngày',             color: '#3B82F6' },
              { label: 'Chuẩn bị sự kiện',  desc: 'Checklist công việc trước sự kiện 3 ngày',        color: '#8B5CF6' },
              { label: 'Nộp kế hoạch',      desc: 'Nhắc nộp kế hoạch tháng mới trước ngày 5',       color: '#10B981' },
              { label: 'Vượt ngân sách',    desc: 'Cảnh báo khi thực tế vượt kế hoạch',             color: '#DC2626' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', border: '1px solid var(--color-border-light, #f1f5f9)', borderRadius: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 12.5, minWidth: 130, color: t.color }}>{t.label}</span>
                <span style={{ fontSize: 12.5, color: '#64748b' }}>{t.desc}</span>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Task thủ công">
          <p>Người dùng có thể tạo task thủ công với tiêu đề, mô tả, mức ưu tiên và hạn deadline. Task tự hoàn thành khi bấm "Done".</p>
        </Sub>

        <Sub title="Mức độ ưu tiên">
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5' }}>Khẩn cấp</span>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#fffbeb', color: '#d97706', fontWeight: 600, fontSize: 12, border: '1px solid #fcd34d' }}>Tuần này</span>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, border: '1px solid #93c5fd' }}>Tháng này</span>
          </div>
        </Sub>
      </Section>

      {/* ── 10. CÀI ĐẶT ─────────────────────────────────────────────────────── */}
      <Section id="settings" icon={<Settings size={18} />} iconColor="#64748b" title="10. Module Cài đặt">
        <p>Truy cập bằng menu <b>Cài đặt</b> trên sidebar. Nội dung hiển thị khác nhau theo vai trò.</p>

        <Sub title="Cài đặt cho mọi người dùng">
          <ul style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <li><b>Hồ sơ cá nhân:</b> Cập nhật tên, avatar</li>
            <li><b>Đổi mật khẩu:</b> Đổi mật khẩu đăng nhập</li>
            <li><b>Giao diện:</b> Chuyển sang chế độ tối (Dark Mode)</li>
          </ul>
        </Sub>

        <Sub title="Quản trị hệ thống (Super Admin + PT MKT Cty)">
          <ul style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <li><b>Quản lý tài khoản:</b> Tạo, sửa, khoá/mở tài khoản người dùng, gán vai trò và showroom</li>
            <li><b>Công ty (Units):</b> Quản lý danh sách Công ty con trong hệ thống</li>
            <li><b>Thương hiệu & Model:</b> Thêm/sửa thương hiệu xe và model</li>
            <li><b>Kênh marketing:</b> Quản lý danh sách kênh và nhóm kênh</li>
            <li><b>Chỉ số KPI:</b> Cấu hình tên và thứ tự hiển thị chỉ số</li>
            <li><b>Khoá kỳ:</b> Khoá/mở kỳ báo cáo để ngăn chỉnh sửa dữ liệu lịch sử</li>
          </ul>
        </Sub>
      </Section>

    </div>
  );
}
