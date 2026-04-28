'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  Copy, Check, Database, Shield, Building2, User, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, type UserRole } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = 'idle' | 'checking' | 'ok' | 'warn' | 'error';

interface CheckItem {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  detail?: string;
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
      background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
      color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.6)',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.2s', letterSpacing: '0.03em',
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Đã sao chép' : 'Sao chép'}
    </button>
  );
}

// ─── SQL Block ────────────────────────────────────────────────────────────────

function SqlBlock({ title, sql, step }: { title: string; sql: string; step: number }) {
  const [open, setOpen] = useState(step === 1);
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: '#0f172a', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>{step}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{title}</span>
        {open ? <ChevronDown size={14} style={{ color: '#64748b' }} /> : <ChevronRight size={14} style={{ color: '#64748b' }} />}
      </button>
      {open && (
        <div style={{ background: '#020817', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 10 }}>
            <CopyButton text={sql} />
          </div>
          <pre style={{
            margin: 0, padding: '16px 16px 16px 16px',
            fontSize: 12, lineHeight: 1.7, color: '#94a3b8',
            overflowX: 'auto', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <code>{sql}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Status Icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'checking') return <Loader2 size={18} style={{ color: '#60a5fa', animation: 'spin 1s linear infinite' }} />;
  if (status === 'ok') return <CheckCircle2 size={18} style={{ color: '#34d399' }} />;
  if (status === 'warn') return <AlertCircle size={18} style={{ color: '#fbbf24' }} />;
  if (status === 'error') return <XCircle size={18} style={{ color: '#f87171' }} />;
  return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #334155' }} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SQL_MIGRATION = `-- Chạy file: supabase/migrations/202604110007_auth_rbac.sql
-- Hoặc paste toàn bộ nội dung file đó vào SQL Editor của Supabase`;

const SQL_SET_SUPER_ADMIN = (email: string) =>
  `-- Chạy trong Supabase SQL Editor sau khi tạo user:
UPDATE public.thaco_users
SET role = 'super_admin',
    unit_id = NULL,
    is_active = true
WHERE email = '${email}';

-- Kiểm tra kết quả:
SELECT id, email, role, is_active FROM public.thaco_users WHERE email = '${email}';`;

const SQL_CREATE_AUTH_USER = (email: string) =>
  `-- Nếu chưa có user trong auth.users, tạo bằng Supabase Dashboard:
-- Authentication → Users → Add user
-- Email: ${email}
-- Sau đó chạy SQL gán super_admin ở bước 3`;

export default function SystemPage() {
  const { profile, effectiveIsSuperAdmin: isSuperAdmin, refreshProfile } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);
  const userEmail = profile?.email ?? 'nguyenxuanngoc@thaco.com.vn';

  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'connection', label: 'Kết nối Supabase', description: 'Kiểm tra URL + anon key hợp lệ', status: 'idle' },
    { id: 'migration', label: 'Migration RBAC', description: 'Bảng thaco_showrooms + thaco_users (v2)', status: 'idle' },
    { id: 'profile', label: 'Profile tài khoản', description: 'Tìm thấy profile trong thaco_users', status: 'idle' },
    { id: 'super_admin', label: 'Quyền Super Admin', description: 'Role = super_admin, is_active = true', status: 'idle' },
    { id: 'units', label: 'Dữ liệu Công ty', description: 'Có ít nhất 1 công ty (thaco_units)', status: 'idle' },
    { id: 'brands', label: 'Thương hiệu & Dòng xe', description: 'Có brands trong thaco_master_brands', status: 'idle' },
  ]);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const updateCheck = useCallback((id: string, status: CheckStatus, detail?: string) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status, detail } : c));
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setDone(false);
    setChecks(prev => prev.map(c => ({ ...c, status: 'idle', detail: undefined })));

    // 1. Connection
    updateCheck('connection', 'checking');
    await new Promise(r => setTimeout(r, 200));
    try {
      const { error } = await supabase.from('thaco_units').select('count').limit(1);
      if (error && error.code !== 'PGRST116') throw error;
      updateCheck('connection', 'ok', 'Supabase phản hồi bình thường');
    } catch (e: any) {
      updateCheck('connection', 'error', e.message);
      setRunning(false);
      setDone(true);
      return;
    }

    // 2. Migration
    updateCheck('migration', 'checking');
    await new Promise(r => setTimeout(r, 300));
    try {
      const { error } = await supabase.from('thaco_showrooms').select('id').limit(1);
      if (error) throw error;

      // Kiểm tra column brands[] trong thaco_users
      const { data: userSample } = await supabase.from('thaco_users').select('brands, showroom_id').limit(1);
      const hasBrands = userSample !== null; // nếu query không lỗi thì migration đã chạy
      updateCheck('migration', hasBrands ? 'ok' : 'warn', hasBrands ? 'Tất cả bảng RBAC tồn tại' : 'thaco_showrooms OK nhưng cần kiểm tra schema thaco_users');
    } catch (e: any) {
      updateCheck('migration', 'error', 'Bảng thaco_showrooms chưa tồn tại — cần chạy migration');
    }

    // 3. Profile
    updateCheck('profile', 'checking');
    await new Promise(r => setTimeout(r, 200));
    try {
      const { data, error } = await supabase
        .from('thaco_users')
        .select('id, email, role, is_active, full_name')
        .eq('email', userEmail)
        .single();
      if (error || !data) throw new Error('Không tìm thấy profile trong thaco_users');
      updateCheck('profile', 'ok', `Tìm thấy: ${data.full_name} (${data.email})`);

      // 4. Super Admin
      updateCheck('super_admin', 'checking');
      await new Promise(r => setTimeout(r, 150));
      if (data.role === 'super_admin' && data.is_active) {
        updateCheck('super_admin', 'ok', 'Role = super_admin, is_active = true');
      } else if (data.role !== 'super_admin') {
        updateCheck('super_admin', 'error', `Hiện tại role = "${data.role}" — cần chạy SQL để gán super_admin`);
      } else {
        updateCheck('super_admin', 'warn', 'Role đúng nhưng is_active = false');
      }
    } catch (e: any) {
      updateCheck('profile', 'error', e.message);
      updateCheck('super_admin', 'warn', 'Bỏ qua — cần có profile trước');
    }

    // 5. Units
    updateCheck('units', 'checking');
    await new Promise(r => setTimeout(r, 200));
    try {
      const { data, error } = await supabase.from('thaco_units').select('id, name').order('code');
      if (error) throw error;
      const count = data?.length ?? 0;
      updateCheck('units', count > 0 ? 'ok' : 'warn', count > 0 ? `${count} công ty: ${data.map((u: any) => u.name).join(', ')}` : 'Chưa có công ty nào');
    } catch (e: any) {
      updateCheck('units', 'error', e.message);
    }

    // 6. Brands
    updateCheck('brands', 'checking');
    await new Promise(r => setTimeout(r, 200));
    try {
      const { data, error } = await supabase.from('thaco_master_brands').select('name').eq('is_active', true).order('sort_order');
      if (error) throw error;
      const count = data?.length ?? 0;
      updateCheck('brands', count > 0 ? 'ok' : 'warn', count > 0 ? `${count} thương hiệu: ${data.slice(0, 4).map((b: any) => b.name).join(', ')}${count > 4 ? '...' : ''}` : 'Chưa có brand nào — cần seed dữ liệu');
    } catch (e: any) {
      updateCheck('brands', 'error', e.message);
    }

    setRunning(false);
    setDone(true);
    refreshProfile();
  }, [supabase, userEmail, updateCheck, refreshProfile]);

  useEffect(() => { runChecks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const passed = checks.filter(c => c.status === 'ok').length;
  const total = checks.length;
  const allGreen = passed === total;

  return (
    <div style={{ padding: '24px', maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={22} style={{ color: '#f59e0b' }} />
            Thiết lập Hệ thống
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Kiểm tra trạng thái cấu hình, kết nối database và quyền tài khoản
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: running ? '#e2e8f0' : '#0f172a',
            color: running ? '#94a3b8' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
        </button>
      </div>

      {/* ── Progress Bar ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {allGreen ? 'Hệ thống sẵn sàng' : done ? 'Cần thực hiện thêm bước' : 'Đang kiểm tra...'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: allGreen ? '#059669' : '#f59e0b' }}>{passed}/{total}</span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: allGreen ? '#10b981' : '#f59e0b',
              width: `${(passed / total) * 100}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
        {allGreen && (
          <CheckCircle2 size={36} style={{ color: '#10b981', flexShrink: 0 }} />
        )}
      </div>

      {/* ── Checks List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map(check => (
          <div key={check.id} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
            borderLeft: `3px solid ${check.status === 'ok' ? '#10b981' : check.status === 'error' ? '#f87171' : check.status === 'warn' ? '#fbbf24' : '#e2e8f0'}`,
            transition: 'border-color 0.3s',
          }}>
            <StatusIcon status={check.status} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{check.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{check.description}</div>
              {check.detail && (
                <div style={{
                  fontSize: 11, marginTop: 4, fontWeight: 500,
                  color: check.status === 'ok' ? '#059669' : check.status === 'error' ? '#dc2626' : '#92400e',
                }}>
                  {check.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Profile Card ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={15} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Thông tin tài khoản đang đăng nhập</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {profile ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Họ tên', value: profile.full_name },
                { label: 'Email', value: profile.email },
                { label: 'Vai trò', value: ROLE_LABELS[profile.role as UserRole] ?? profile.role },
                { label: 'Đơn vị', value: profile.unit?.name ?? '— Tất cả công ty —' },
                { label: 'Showroom', value: profile.showroom?.name ?? '—' },
                { label: 'Thương hiệu', value: profile.brands?.length ? profile.brands.join(', ') : '— Tất cả —' },
                { label: 'Trạng thái', value: profile.is_active ? 'Đang hoạt động' : 'Bị khóa' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
              Chưa có profile — cần chạy SQL migration và tạo tài khoản
            </div>
          )}
        </div>
      </div>

      {/* ── Setup Guide ── */}
      {!allGreen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Database size={16} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Hướng dẫn thiết lập</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Chạy theo thứ tự trong Supabase SQL Editor</span>
          </div>

          <SqlBlock
            step={1}
            title="Chạy Migration RBAC (tạo bảng thaco_showrooms, rebuild thaco_users)"
            sql={SQL_MIGRATION}
          />
          <SqlBlock
            step={2}
            title="Tạo tài khoản trong Supabase Authentication"
            sql={SQL_CREATE_AUTH_USER(userEmail)}
          />
          <SqlBlock
            step={3}
            title={`Gán quyền Super Admin cho ${userEmail}`}
            sql={SQL_SET_SUPER_ADMIN(userEmail)}
          />
        </div>
      )}

      {/* ── Quick Links ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} style={{ color: '#2563eb' }} />
          Cài đặt nhanh sau khi thiết lập xong
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { href: '/settings/companies', icon: Building2, label: 'Quản lý Công ty', desc: 'Thêm/sửa showroom' },
            { href: '/settings/accounts', icon: Shield, label: 'Phân quyền Users', desc: 'Tạo + gán role' },
            { href: '/settings/brands', icon: Database, label: 'Thương hiệu', desc: 'Brands & dòng xe' },
          ].map(link => {
            const Icon = link.icon;
            return (
              <a key={link.href} href={link.href} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
                textDecoration: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{link.desc}</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
