'use client';

import React from 'react';
import { BookOpen, Route, Goal, Info, ShieldAlert } from 'lucide-react';

export default function GuidePage() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BookOpen size={28} color="var(--color-brand)" />
          Sổ tay Hướng dẫn Hệ thống
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          Tài liệu mô tả chi tiết các nguyên lý nội suy, thuật toán tự động và cách sử dụng các tính năng nâng cao của Console Lập kế hoạch.
        </p>
      </div>

      {/* Guide Section 1 */}
      <section style={{ marginBottom: 32, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Route size={18} color="#3B82F6" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>1. Thuật toán Funnel Sync (Đồng bộ Phễu lịch sử)</h2>
        </div>
        <div style={{ padding: 20, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
          <p>
            <b>Cơ sở toán học:</b> Khi một tháng mới được lập kế hoạch, hệ thống không bắt đầu từ số 0, mà lấy <b>Bản ghi thực tế của tháng liền kề (Tháng Base)</b> làm Hệ quy chiếu (Benchmark).
          </p>
          <p style={{ marginTop: 12 }}>
            Thay vì phải tính tay từng bước trong phễu: <code>Ngân sách → KHQT → GDTD → KHĐ</code>, Hệ thống sẽ ghi nhận bất kỳ sự thay đổi nào từ Planner và lập tức <b>Nội suy tỷ lệ (Ratio)</b> để phóng to/thu nhỏ toàn bộ phễu.
          </p>

          <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 6, marginTop: 16, borderLeft: '3px solid #3B82F6' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Công thức ánh xạ (Mapping Formula):</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Ratio</code> = <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Input_mới</code> / <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Value_Cũ_Trong_Tháng_Base</code></li>
              <li><code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Metric_A_Mới</code> = <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Metric_A_Cũ</code> × Ratio</li>
              <li><code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Metric_B_Mới</code> = <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>Metric_B_Cũ</code> × Ratio</li>
            </ul>
          </div>
          
          <p style={{ marginTop: 16 }}>
            <b>Đặc biệt: Zero Cascade.</b> Nếu một ô chức năng được xoá trắng (hoặc set = 0), thuật toán sẽ khởi chạy Zero Cascade để dọn sạch toàn bộ các ô liên đới trong cùng một kênh về 0.
          </p>
        </div>
      </section>

      {/* Guide Section 2 */}
      <section style={{ marginBottom: 32, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Goal size={18} color="#10B981" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>2. Goal Seek (Tính ngược từ Mục tiêu)</h2>
        </div>
        <div style={{ padding: 20, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
          <p>
            Đây là hệ quả của kiến trúc <b>Dynamic Two-way Binding</b>. Nghĩa là không có ô nào là Cội nguồn (Primary) duy nhất.
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><b>Cách 1 (Truyền thống):</b> Thay Ngân sách (VD: Tăng từ 10tr lên 20tr) → Hệ thống tự nội suy số KHQT và Số xe thu được.</li>
            <li><b>Cách 2 (Reverse - Goal Seek):</b> Xóa Ngân sách. Nhập ấn định <b>Số xe mục tiêu (GDTD) = 30</b>. Hệ thống tự động truy vấn <em>Tỷ lệ chuyển đổi</em> và <em>Chi phí/Số (CPL)</em> của tháng trước để tự bơm ngược ra "Cần bao nhiêu Leads" và "Phải chi bao nhiêu tiền".</li>
          </ul>
        </div>
      </section>

      {/* Guide Section 3 */}
      <section style={{ marginBottom: 32, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Info size={18} color="#F59E0B" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>3. Mass Allocation (Phân bổ hàng loạt)</h2>
        </div>
        <div style={{ padding: 20, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
          <p>
            Trên thanh tiêu đề cụm (Ví dụ: <b>Tổng Digital</b> hoặc <b>Kênh Facebook</b>) có biểu tượng Tia chớp (Trợ lý điều chỉnh nhanh). 
            Tính năng này giúp Planner không cần gõ từng dòng xe, mà có thể Tăng/Giảm đồng loạt toàn bộ các dòng xe trực thuộc kênh đó.
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Dải Trượt (Slider)</div>
              <p style={{ fontSize: 13 }}>Cho phép điều chỉnh nhanh từ -100% (Xóa sổ kênh) đến +500% (Bơm thêm 5 lần ngân sách).</p>
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Bảo toàn Tỷ trọng</div>
              <p style={{ fontSize: 13 }}>Nếu CX-5 chiếm 70% ngân sách Facebook tháng trước, khi tăng 10% tổng thì CX-5 vẫn sẽ nhận được dòng tiền tỷ lệ 70%.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
