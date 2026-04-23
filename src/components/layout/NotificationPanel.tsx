'use client';

/**
 * NotificationPanel — Bảng thông báo popup mở từ StatusBar
 *
 * Tích hợp notifications-engine.ts để sinh thông báo tự động từ:
 * - Budget Plans (kế hoạch ngân sách)
 * - Actual Entries (báo cáo thực hiện)
 * - Events (sự kiện marketing)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  RefreshCw,
  Search,
  MoreHorizontal,
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ClipboardList,
  Clock,
  ChevronRight,
  Info,
  CheckCheck,
} from 'lucide-react';
import {
  generateNotifications,
  invalidateNotifCache,
  type NotificationItem,
  type NotificationResult,
  type NotificationType,
} from '@/lib/notifications-engine';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ─── DB Notification helpers ─────────────────────────────────────────────────

interface DBNotif {
  id: string;
  type: string;
  showroom_name: string | null;
  year: number | null;
  month: number | null;
  entry_type: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  created_by_name: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

function dbNotifToItem(n: DBNotif): NotificationItem {
  const isSubmit = n.type === 'plan_submitted';
  const typeLabel = n.entry_type === 'actual' ? 'Thực hiện' : 'Kế hoạch';
  const deepLink = isSubmit && n.showroom_name
    ? `/planning?showroom=${encodeURIComponent(n.showroom_name)}`
    : '/planning';
  return {
    id: `db-${n.id}`,
    type: isSubmit ? 'approval' : 'info',
    priority: isSubmit ? 'high' : 'normal',
    title: isSubmit
      ? `Gửi ${typeLabel} — ${n.showroom_name || ''}`
      : `GĐ SR đã xem — ${n.showroom_name || ''}`,
    message: n.message,
    time: relativeTime(n.created_at),
    timestamp: new Date(n.created_at).getTime(),
    read: n.is_read,
    important: isSubmit,
    deepLink,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export type NotificationTab = 'all' | 'unread' | 'important' | 'approval' | 'task';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// ─── Tab config ─────────────────────────────────────────────────────────────────

const TABS: { key: NotificationTab; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'important', label: 'Quan trọng' },
  { key: 'approval', label: 'Duyệt' },
  { key: 'task', label: 'Công việc' },
];

// ─── Icon theo loại ─────────────────────────────────────────────────────────────

function getNotifIcon(type: NotificationType) {
  const iconProps = { size: 16 };
  switch (type) {
    case 'success':
      return <CheckCircle2 {...iconProps} style={{ color: '#10b981' }} />;
    case 'warning':
      return <AlertTriangle {...iconProps} style={{ color: '#f59e0b' }} />;
    case 'approval':
      return <FileText {...iconProps} style={{ color: '#3b82f6' }} />;
    case 'task':
      return <ClipboardList {...iconProps} style={{ color: '#8b5cf6' }} />;
    default:
      return <Info {...iconProps} style={{ color: '#64748b' }} />;
  }
}

// ─── Priority color helper ──────────────────────────────────────────────────────

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return '#dc2626';
    case 'high': return '#f59e0b';
    case 'normal': return '#3b82f6';
    default: return '#94a3b8';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function NotificationPanel({ open, onClose, anchorRef }: NotificationPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const { activeUnitId } = useUnit();
  const { effectiveRole, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [result, setResult] = useState<NotificationResult | null>(null);
  const [dbItems, setDbItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load read state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('thaco_read_notifs');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch { /* silent */ }
  }, []);

  // Load notifications when panel opens
  useEffect(() => {
    if (open && !result) {
      loadNotifications();
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMenu) setShowMenu(false);
        else if (showSearch) setShowSearch(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, showMenu, showSearch]);

  // Focus search
  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const fetchDbNotifications = useCallback(async () => {
    if (!effectiveRole) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('thaco_notifications')
        .select('id, type, showroom_name, year, month, entry_type, message, is_read, created_at, created_by_name')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setDbItems(data.map(dbNotifToItem));
    } catch { /* silent */ }
  }, [effectiveRole]);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    let timerId: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('Notification load timeout')), 5_000);
      });
      const [data] = await Promise.race([
        Promise.all([
          generateNotifications(activeUnitId !== 'all' ? activeUnitId : undefined, false, profile),
          fetchDbNotifications(),
        ]),
        timeoutPromise,
      ]) as [NotificationResult, void];
      if (timerId) clearTimeout(timerId);
      setResult(data);
    } catch (err) {
      console.error('[NotificationPanel] loadNotifications failed:', err);
      if (timerId) clearTimeout(timerId);
      setResult({ notifications: [], counts: { total: 0, unread: 0, urgent: 0 } });
    } finally {
      setIsLoading(false);
    }
  }, [activeUnitId, fetchDbNotifications]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      invalidateNotifCache();
      const [data] = await Promise.all([
        generateNotifications(activeUnitId !== 'all' ? activeUnitId : undefined, true, profile),
        fetchDbNotifications(),
      ]);
      setResult(data);
    } catch {
      // silent
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [activeUnitId, fetchDbNotifications]);

  const handleMarkAllRead = useCallback(() => {
    if (!result) return;
    const allIds = new Set([
      ...result.notifications.map(n => n.id),
      ...dbItems.map(n => n.id),
    ]);
    setReadIds(allIds);
    // Mark DB notifications as read in Supabase
    const unreadDbIds = dbItems
      .filter(n => !n.read && !readIds.has(n.id))
      .map(n => n.id.replace('db-', ''));
    if (unreadDbIds.length > 0) {
      const supabase = createClient();
      supabase
        .from('thaco_notifications')
        .update({ is_read: true })
        .in('id', unreadDbIds)
        .then(() => {});
    }
    setShowMenu(false);
  }, [result, dbItems, readIds]);

  const handleMarkRead = useCallback((id: string) => {
    setReadIds(prev => new Set(prev).add(id));
  }, []);

  const handleNavigate = useCallback((notif: NotificationItem) => {
    handleMarkRead(notif.id);
    if (notif.deepLink) {
      router.push(notif.deepLink);
      onClose();
    }
  }, [router, onClose, handleMarkRead]);

  // Sync to localStorage
  useEffect(() => {
    if (readIds.size > 0) {
      try {
        localStorage.setItem('thaco_read_notifs', JSON.stringify(Array.from(readIds)));
      } catch { /* silent */ }
    }
  }, [readIds]);

  // Merge read states — DB notifications đứng đầu (mới nhất, theo timestamp)
  const notifications = [
    ...dbItems.map(n => ({ ...n, read: n.read || readIds.has(n.id) })),
    ...(result?.notifications ?? []).map(n => ({ ...n, read: n.read || readIds.has(n.id) })),
  ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  // Filter
  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.read) return false;
    if (activeTab === 'important' && !n.important) return false;
    if (activeTab === 'approval' && n.type !== 'approval') return false;
    if (activeTab === 'task' && n.type !== 'task') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const tabCounts: Record<NotificationTab, number> = {
    all: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    important: notifications.filter(n => n.important).length,
    approval: notifications.filter(n => n.type === 'approval').length,
    task: notifications.filter(n => n.type === 'task').length,
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 6,
        width: 420,
        height: 520,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 -12px 48px rgba(0, 0, 0, 0.12), 0 -4px 16px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 700,
        animation: 'notifSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Header ── */}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
            Thông báo
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#fff',
                background: '#3b82f6', borderRadius: 10, padding: '1px 7px', verticalAlign: 'middle',
              }}>
                {unreadCount}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HeaderIconBtn
              icon={<RefreshCw size={15} style={{
                transition: 'transform 0.3s',
                ...(isRefreshing ? { animation: 'notifSpin 0.8s linear infinite' } : {}),
              }} />}
              title="Làm mới"
              onClick={handleRefresh}
            />
            <HeaderIconBtn
              icon={<Search size={15} />}
              title="Tìm kiếm"
              onClick={() => setShowSearch(v => !v)}
              active={showSearch}
            />
            {/* More options with dropdown menu */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <HeaderIconBtn
                icon={<MoreHorizontal size={15} />}
                title="Tuỳ chọn"
                onClick={() => setShowMenu(v => !v)}
                active={showMenu}
              />
              {showMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  width: 200, background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  zIndex: 800, overflow: 'hidden',
                }}>
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      cursor: 'pointer', fontSize: 12, color: '#374151', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <CheckCheck size={14} style={{ color: '#3b82f6' }} />
                    Đánh dấu tất cả đã đọc
                  </button>
                </div>
              )}
            </div>
            <HeaderIconBtn icon={<X size={15} />} title="Đóng" onClick={onClose} />
          </div>
        </div>

        {/* Search bar */}
        <div style={{
          overflow: 'hidden',
          maxHeight: showSearch ? 40 : 0, opacity: showSearch ? 1 : 0,
          transition: 'max-height 0.2s ease, opacity 0.15s ease',
          marginBottom: showSearch ? 8 : 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: 6,
          }}>
            <Search size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm thông báo..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', fontSize: 12, color: '#0f172a',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: '#94a3b8', display: 'flex',
              }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 12px', fontSize: 12,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#2563eb' : '#64748b',
                background: 'transparent', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap', position: 'relative',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.key) (e.currentTarget as HTMLElement).style.color = '#334155';
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.key) (e.currentTarget as HTMLElement).style.color = '#64748b';
              }}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && tab.key !== 'all' && (
                <span style={{
                  marginLeft: 4, fontSize: 9, fontWeight: 700,
                  color: activeTab === tab.key ? '#2563eb' : '#94a3b8',
                  background: activeTab === tab.key ? '#eff6ff' : '#f1f5f9',
                  borderRadius: 8, padding: '0 4px', verticalAlign: 'middle',
                }}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          /* Loading state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 20px', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6',
              animation: 'notifSpin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Đang tải thông báo...</span>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '52px 20px', gap: 10,
          }}>
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <path d="M12 28L36 16L60 28L36 40Z" fill="#e2e8f0" />
              <path d="M12 28L36 40L36 56L12 44Z" fill="#cbd5e1" />
              <path d="M60 28L36 40L36 56L60 44Z" fill="#dde3ea" />
              <path d="M12 28L24 22L24 30L12 28Z" fill="#d4dbe5" opacity="0.6" />
              <path d="M60 28L48 22L48 30L60 28Z" fill="#c8d1dc" opacity="0.6" />
            </svg>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              {activeTab === 'all'
                ? 'Hiện tại không có thông báo!'
                : activeTab === 'unread'
                  ? 'Không có thông báo chưa đọc'
                  : activeTab === 'important'
                    ? 'Không có thông báo quan trọng'
                    : activeTab === 'approval'
                      ? 'Không có thông báo duyệt'
                      : 'Không có công việc nào'}
            </span>
          </div>
        ) : (
          /* Notification items */
          <div style={{ padding: '4px 0' }}>
            {filtered.map((notif, idx) => (
              <button
                key={notif.id}
                onClick={() => handleNavigate(notif)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 16px',
                  background: notif.read ? 'transparent' : '#f8fbff',
                  border: 'none',
                  borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = notif.read ? '#f8fafc' : '#eff6ff';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = notif.read ? 'transparent' : '#f8fbff';
                }}
              >
                {/* Unread dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: notif.read ? 'transparent' : getPriorityColor(notif.priority),
                  flexShrink: 0, marginTop: 6,
                }} />
                {/* Icon */}
                <div style={{ flexShrink: 0, marginTop: 1 }}>{getNotifIcon(notif.type)}</div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: notif.read ? 500 : 600, color: '#0f172a',
                    marginBottom: 2, lineHeight: 1.4,
                  }}>
                    {notif.title}
                    {notif.important && !notif.read && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontWeight: 700,
                        color: '#dc2626', background: '#fef2f2',
                        borderRadius: 3, padding: '1px 4px', verticalAlign: 'middle',
                      }}>
                        !
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#64748b', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {notif.message}
                  </div>
                  <div style={{
                    fontSize: 10, color: '#94a3b8', marginTop: 4,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Clock size={10} />
                    {notif.time}
                    {notif.deepLink && (
                      <>
                        <span style={{ margin: '0 2px' }}>·</span>
                        <span style={{ color: '#3b82f6', fontWeight: 500 }}>Xem chi tiết</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Arrow */}
                {notif.deepLink && (
                  <ChevronRight size={14} style={{ color: '#cbd5e1', flexShrink: 0, marginTop: 4 }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {notifications.length > 0 && (
        <div style={{
          padding: '8px 16px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={() => { router.push('/tasks'); onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, color: '#3b82f6', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1d4ed8'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
          >
            Xem tất cả việc cần làm →
          </button>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes notifSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes notifSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Header Icon Button ─────────────────────────────────────────────────────────

function HeaderIconBtn({
  icon, title, onClick, active,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6,
        background: active ? '#f1f5f9' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: active ? '#0f172a' : '#64748b',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
        (e.currentTarget as HTMLElement).style.color = '#0f172a';
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#64748b';
        }
      }}
    >
      {icon}
    </button>
  );
}
