'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ElementType; desc: string }[] = [
  {
    value: 'light',
    label: 'Light Mode',
    icon: Sun,
    desc: 'Giao diện sáng, phù hợp làm việc ban ngày',
  },
  {
    value: 'dark',
    label: 'Dark Mode',
    icon: Moon,
    desc: 'Giao diện tối, giảm mỏi mắt khi làm việc trong môi trường thiếu sáng',
  },
  {
    value: 'system',
    label: 'Theo hệ thống',
    icon: Monitor,
    desc: 'Tự động theo cài đặt Light/Dark của thiết bị',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppearancePage() {
  const [selected, setSelected] = useState<ThemeMode>('light');

  // Load từ localStorage nếu có
  useEffect(() => {
    const saved = localStorage.getItem('thaco_theme') as ThemeMode | null;
    if (saved) setSelected(saved);
  }, []);

  const handleSelect = (mode: ThemeMode) => {
    setSelected(mode);
    localStorage.setItem('thaco_theme', mode);
    // TODO: Apply theme khi hoàn thiện Dark Mode
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sun size={20} style={{ color: '#2563eb' }} />
          Giao diện
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Chọn chủ đề hiển thị cho ứng dụng. Dark Mode hiện đang được phát triển.
        </p>
      </div>

      {/* Theme selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {THEME_OPTIONS.map(({ value, label, icon: Icon, desc }) => {
          const active = selected === value;
          const isReady = value === 'light'; // chỉ light mode đang hoạt động

          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={!isReady}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px', borderRadius: 8, textAlign: 'left',
                border: `1.5px solid ${active ? '#2563eb' : '#e5e7eb'}`,
                background: active ? '#eff6ff' : '#fff',
                cursor: isReady ? 'pointer' : 'not-allowed',
                opacity: isReady ? 1 : 0.5,
                transition: 'all 0.15s',
                width: '100%',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: active ? '#2563eb' : '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} style={{ color: active ? '#fff' : '#64748b' }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: active ? '#1d4ed8' : '#0f172a' }}>
                    {label}
                  </span>
                  {!isReady && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                      background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
                      letterSpacing: '0.05em',
                    }}>
                      SẮP RA MẮT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
              </div>

              {/* Check indicator */}
              {active && (
                <Check size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Info banner */}
      <div style={{
        marginTop: 24, padding: '12px 16px', borderRadius: 8,
        background: '#fefce8', border: '1px solid #fde68a',
        fontSize: 12, color: '#92400e', display: 'flex', gap: 8,
      }}>
        <Sun size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Dark Mode đang trong quá trình phát triển và sẽ được cập nhật trong phiên bản tới.
          Hiện tại ứng dụng chỉ hỗ trợ Light Mode.
        </span>
      </div>
    </div>
  );
}
