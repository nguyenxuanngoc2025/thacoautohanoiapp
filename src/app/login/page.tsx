'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/*
 * PERFORMANCE RULES:
 * ✅ ONLY use transform + opacity for animations (GPU composited, zero CPU)
 * ❌ NEVER animate filter:blur — it forces CPU rasterization every frame
 * ❌ NEVER animate with rotate() inside keyframes on large elements
 * ❌ NEVER use mixBlendMode on animated elements
 * Static blur on non-animated elements is fine.
 */
const KEYFRAMES = `
  /* Entrance — pure opacity + translate3d (60fps GPU) */
  @keyframes fadeUp {
    from { opacity: 0; transform: translate3d(0, 24px, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes smoothSlideUp {
    from { opacity: 0; transform: translate3d(0, 40px, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes twinkle {
    0%   { opacity: 0.05; }
    100% { opacity: 0.3; }
  }

  /* Orb float — translate3d only on background layer */
  @keyframes orbFloat1 {
    0%   { transform: translate3d(0, 0, 0); }
    50%  { transform: translate3d(40px, -60px, 0); }
    100% { transform: translate3d(0, 0, 0); }
  }
  @keyframes orbFloat2 {
    0%   { transform: translate3d(0, 0, 0); }
    50%  { transform: translate3d(-50px, 40px, 0); }
    100% { transform: translate3d(0, 0, 0); }
  }
  @keyframes orbFloat3 {
    0%   { transform: translate3d(0, 0, 0); }
    50%  { transform: translate3d(30px, 50px, 0); }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

function TimeDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  const timeStr = currentTime.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
  const dateStr = (() => {
    const s = currentTime.toLocaleDateString('vi-VN', { weekday:'long', day:'numeric', month:'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div style={{
      position: 'absolute', bottom: 36, left: 0, right: 0, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none',
      animation: 'fadeIn 0.8s ease 0.3s both'
    }}>
      <div style={{
        fontSize: 'clamp(48px, 5vw, 72px)', fontWeight: 200, color: 'rgba(255,255,255,0.65)',
        letterSpacing: '-0.03em', fontFamily: '"SF Pro Display", -apple-system, "Helvetica Neue", sans-serif',
        lineHeight: 1,
      }}>
        {timeStr}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.04em', marginTop: 8,
      }}>
        {dateStr}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn, authUser, isLoading } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [focused, setFocused]   = useState<'email' | 'password' | null>(null);
  const [rememberMe, setRememberMe]   = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved email
    const saved = localStorage.getItem('thaco_remembered_email');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  useEffect(() => {
    if (!isLoading && authUser) {
      router.replace('/dashboard');
    }
  }, [authUser, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setError(null);
    setSubmitting(true);
    
    try {
      if (rememberMe) {
        localStorage.setItem('thaco_remembered_email', email.trim());
      } else {
        localStorage.removeItem('thaco_remembered_email');
      }

      const { error: err } = await signIn(email.trim(), password);
      
      if (err) {
        setError(err === 'Invalid login credentials' ? 'Tài khoản hoặc mật khẩu không chính xác.' : err);
        setSubmitting(false);
        return;
      }
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#001529' }}>
        <div style={{ width:32, height:32, border:'2px solid rgba(255,255,255,0.15)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{KEYFRAMES}</style>
      </div>
    );
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
      }}>

        {/* ══════════ LEFT PANEL ══════════ */}
        <div style={{
          flex: 1.4, position: 'relative', overflow: 'hidden',
          /* Static premium gradient instead of heavy blur/orbs */
          background: 'radial-gradient(circle at 30% 70%, #0468BF 0%, #001a3d 60%)',
        }}>

          {/* Static minimal grid mask — zero GPU cost */}
          <div style={{
            position: 'absolute', inset: -80, zIndex: 2,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
            pointerEvents: 'none',
          }} />

          {/* ── ZONE 1: Brand Logo — top left corner ── */}
          <div style={{
            position: 'absolute', top: 32, left: 36, zIndex: 20,
            opacity: mounted ? 1 : 0,
            animation: mounted ? 'fadeIn 0.6s ease 0.1s both' : 'none',
          }}>
            <img
              src="https://thacoautohanoi.vn/storage/logo/header-website.webp"
              alt="Thaco Auto"
              style={{ height: 24, objectFit: 'contain', opacity: 0.85 }}
            />
          </div>

          {/* ── ZONE 2: System Title — center hero ── */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            opacity: mounted ? 1 : 0,
            animation: mounted ? 'smoothSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both' : 'none',
          }}>
            <h1 style={{
              margin: 0, fontSize: 'clamp(18px, 2.8vw, 38px)', fontWeight: 300,
              color: '#ffffff',
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: '"SF Pro Display", -apple-system, sans-serif',
              textShadow: '0 2px 20px rgba(0,0,0,0.25)',
              textAlign: 'center',
              padding: '0 24px',
            }}>
              Quản Trị Marketing
            </h1>

            {/* Line gradient tĩnh */}
            <div style={{
              width: 120, height: 1, marginTop: 18,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
            }} />
          </div>

          {/* ── ZONE 3: Clock + Date — bottom center ── */}
          <TimeDisplay />
        </div>

        {/* ══════════ RIGHT PANEL — Login Form ══════════ */}
        <div style={{
          width: 520, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#ffffff', position: 'relative',
        }}>

          {/* Top accent bar — static gradient */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, #004B9B 0%, #0468BF 100%)',
          }} />

          {/* Form card */}
          <div style={{
            width: '100%', maxWidth: 360, padding: '0 32px',
            opacity: mounted ? 1 : 0,
            animation: mounted ? 'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both' : 'none',
          }}>

            {/* Header */}
            <div style={{ marginBottom: 36, textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'linear-gradient(135deg, #004B9B, #0468BF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px',
                boxShadow: '0 6px 20px rgba(0,75,155,0.22)',
              }}>
                <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Đăng nhập
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
                Truy cập hệ thống bằng tài khoản nội bộ
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Email — floating label */}
              <FloatInput
                id="login-email"
                type="email"
                label="Địa chỉ Email"
                value={email}
                onChange={setEmail}
                focused={focused === 'email'}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoComplete="email"
              />

              {/* Password — floating label */}
              <FloatInput
                id="login-password"
                type="password"
                label="Mật khẩu"
                value={password}
                onChange={setPassword}
                focused={focused === 'password'}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                autoComplete="current-password"
              />

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 10,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: 13, fontWeight: 500, color: '#dc2626',
                }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Remember me */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', userSelect: 'none',
              }}>
                <div
                  onClick={() => setRememberMe(v => !v)}
                  style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `1.5px solid ${rememberMe ? '#004B9B' : 'rgba(0,0,0,0.15)'}`,
                    background: rememberMe ? '#004B9B' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {rememberMe && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span
                  onClick={() => setRememberMe(v => !v)}
                  style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}
                >
                  Nhớ đăng nhập trên thiết bị này
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 6,
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #004B9B 0%, #0468BF 100%)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.02em',
                  boxShadow: '0 4px 14px rgba(0,75,155,0.3)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                      <span style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />
                      Đang đăng nhập...
                    </span>
                  : 'Đăng nhập hệ thống'
                }
              </button>

              {/* Forgot password */}
              <div style={{ textAlign:'center' }}>
                <button type="button" onClick={() => alert('Vui lòng liên hệ PT Marketing để được cấp lại mật khẩu.')} style={{
                  background:'none', border:'none', padding:'6px 8px',
                  fontSize:13, color:'#94a3b8', cursor:'pointer', fontWeight:500,
                  transition:'color 0.15s ease',
                }}>
                  Quên mật khẩu hoặc cần hỗ trợ?
                </button>
              </div>
            </form>

            {/* Footer logo */}
            <div style={{ marginTop: 40, textAlign:'center', opacity: mounted ? 1 : 0, animation: mounted ? 'fadeIn 0.6s ease 0.6s both' : 'none' }}>
              <img
                src="https://thacoautohanoi.vn/storage/logo/header-website.webp"
                alt="Thaco Auto"
                style={{ height: 22, opacity: 0.35, filter:'grayscale(1)' }}
              />
            </div>
          </div>

          {/* Copyright */}
          <div style={{ position:'absolute', bottom:16, fontSize:10, color:'#cbd5e1' }}>
            © 2026 THACO AUTO Hà Nội
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Reusable floating-label input (no state changes trigger parent re-render) ── */
function FloatInput({
  id, type, label, value, onChange, focused, onFocus, onBlur, autoComplete,
}: {
  id: string; type: string; label: string; value: string;
  onChange: (v: string) => void; focused: boolean;
  onFocus: () => void; onBlur: () => void; autoComplete?: string;
}) {
  const lifted = focused || value.length > 0;
  return (
    <div style={{ position:'relative' }}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          width: '100%',
          padding: '21px 16px 9px',
          borderRadius: 12,
          border: `1.5px solid ${focused ? '#004B9B' : 'rgba(0,0,0,0.1)'}`,
          fontSize: 15,
          fontWeight: 500,
          outline: 'none',
          boxSizing: 'border-box',
          background: '#f8fafc',
          color: '#0f172a',
          letterSpacing: (type === 'password' && value) ? '0.15em' : 'normal',
          boxShadow: focused ? '0 0 0 4px rgba(0,75,155,0.08)' : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      />
      <label
        htmlFor={id}
        style={{
          position: 'absolute', left: 16,
          top: lifted ? 7 : 15,
          fontSize: lifted ? 11 : 15,
          fontWeight: lifted ? 600 : 400,
          color: focused ? '#004B9B' : '#94a3b8',
          pointerEvents: 'none',
          transition: 'top 0.18s ease, font-size 0.18s ease, color 0.18s ease',
        }}
      >
        {label}
      </label>
    </div>
  );
}
