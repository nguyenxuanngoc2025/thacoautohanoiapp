'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  type ThacUser,
  type UserRole,
  roleIsAdmin,
  roleNeedsShowroom,
  roleNeedsBrands,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Supabase Auth user (null khi chưa đăng nhập) */
  authUser: User | null;
  /** Profile trong thaco_users */
  profile: ThacUser | null;
  session: Session | null;
  isLoading: boolean;
  /** Đăng nhập email/password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Đăng xuất */
  signOut: () => Promise<void>;
  /** Reload profile (sau khi super_admin cập nhật) */
  refreshProfile: () => Promise<void>;
  // Shortcuts
  role: UserRole | null;
  isAdmin: boolean;          // super_admin hoặc bld
  isSuperAdmin: boolean;
  /** Role đang giả lập (chỉ super_admin có thể set) */
  previewRole: UserRole | null;
  /** Đặt preview role — null = tẫt giả lập */
  setPreviewRole: (role: UserRole | null) => void;
  /** Role hiệu lực: previewRole nếu đang giả lập, ngược lại = role thực */
  effectiveRole: UserRole | null;
  /** false khi đang preview role khác super_admin — dùng thay isSuperAdmin trong UI */
  effectiveIsSuperAdmin: boolean;

  // ─── Phase 1 Bottom-Up helpers ─────────────────────────────────────────────
  /** Các showroom CODES user được phép truy cập. [] = không có quyền SR nào (trừ aggregate view). Empty = admin/company-wide → sẽ là tất cả SR trong unit */
  accessibleShowroomCodes: string[];
  /** true nếu user được xem tất cả SR trong unit (admin/BLĐ/TP MKT/finance/mkt_brand) */
  canViewAllShowrooms: boolean;
  /** true nếu user có quyền edit data showroom này (Draft status) */
  canEditShowroom: (code: string) => boolean;
  /** true nếu user có quyền approve data của showroom này */
  canApproveShowroom: (code: string) => boolean;
  /** true nếu user có quyền unlock Approved (pt_mkt_cty, super_admin) */
  canUnlockApproved: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  authUser: null,
  profile: null,
  session: null,
  isLoading: true,
  signIn: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
  refreshProfile: async () => {},
  role: null,
  isAdmin: false,
  isSuperAdmin: false,
  previewRole: null,
  setPreviewRole: () => {},
  effectiveRole: null,
  effectiveIsSuperAdmin: false,
  accessibleShowroomCodes: [],
  canViewAllShowrooms: false,
  canEditShowroom: () => false,
  canApproveShowroom: () => false,
  canUnlockApproved: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ThacUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(null);

  // Chỉ super_admin mới được set preview role
  const setPreviewRole = (r: UserRole | null) => {
    if (profile?.role === 'super_admin') setPreviewRoleState(r);
  };

  const fetchProfile = useCallback(async (userId: string): Promise<ThacUser | null> => {
    const { data, error } = await supabase
      .from('thaco_users')
      .select(`
        *,
        unit:thaco_units(*),
        showroom:thaco_showrooms(*)
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn('[AuthContext] fetchProfile error:', error?.message);
      return null;
    }
    return data as ThacUser;
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (!authUser) return;
    const p = await fetchProfile(authUser.id);
    setProfile(p);
  }, [authUser, fetchProfile]);

  // Timeout safety net: force isLoading = false sau 3s
  useEffect(() => {
    const t = setTimeout(() => {
      console.warn('[AuthContext] TIMEOUT 3s — force isLoading=false');
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Khởi tạo session + lắng nghe thay đổi auth
  useEffect(() => {
    let mounted = true;
    let resolved = false;

    const handleSession = (source: string, s: Session | null) => {
      if (!mounted) return;
      console.log(`[AuthContext] handleSession from ${source}, user=${s?.user?.email ?? 'null'}`);
      if (!resolved) {
        resolved = true;
      }
      setSession(s);
      setAuthUser(s?.user ?? null);
      setIsLoading(false);
      if (s?.user) {
        fetchProfile(s.user.id).then(p => {
          if (mounted) setProfile(p);
        }).catch(err => {
          console.warn('[AuthContext] fetchProfile failed:', err);
        });
      } else {
        setProfile(null);
      }
    };

    console.log('[AuthContext] init — calling getSession()');
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[AuthContext] getSession() resolved');
      handleSession('getSession', s);
    }).catch(err => {
      console.warn('[AuthContext] getSession() FAILED:', err);
      if (mounted) setIsLoading(false);
    });

    console.log('[AuthContext] registering onAuthStateChange');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log(`[AuthContext] onAuthStateChange event=${event}`);
      handleSession('onAuthStateChange:' + event, s);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Timeout 4 giây nếu Supabase/VPS phản hồi chậm
      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<any>((resolve) => 
        setTimeout(() => resolve({ error: { message: 'Máy chủ phản hồi quá chậm (Timeout). Vui lòng thử lại sau.' } }), 4000)
      );

      const { error } = await Promise.race([loginPromise, timeoutPromise]);
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Lỗi ngoại lệ khi đăng nhập' };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
  }, [supabase]);

  const role = profile?.role ?? null;
  const effectiveRole: UserRole | null = previewRole ?? role;

  // ─── Phase 1 Bottom-Up access control ───────────────────────────────────────
  // Các role được xem tất cả SR trong unit (không giới hạn theo showroom_ids)
  const canViewAllShowrooms = !!effectiveRole && (
    effectiveRole === 'super_admin' ||
    effectiveRole === 'bld' ||
    effectiveRole === 'pt_mkt_cty' ||
    effectiveRole === 'finance' ||
    effectiveRole === 'mkt_brand'  // mkt_brand xem mọi SR có bán brand của mình
  );

  // showroom_ids của profile (codes). Nếu thiếu, fallback showroom.code (legacy single)
  const assignedShowroomCodes: string[] = React.useMemo(() => {
    if (!profile) return [];
    if (Array.isArray(profile.showroom_ids) && profile.showroom_ids.length > 0) {
      return profile.showroom_ids;
    }
    // fallback legacy: showroom_id → join đã trả về showroom.code
    if (profile.showroom?.code) return [profile.showroom.code];
    return [];
  }, [profile]);

  // Khi canViewAllShowrooms = true, accessibleShowroomCodes sẽ là [] (empty) —
  // caller (planning page) hiểu ký hiệu này = "không filter, lấy tất cả SR của unit"
  const accessibleShowroomCodes = canViewAllShowrooms ? [] : assignedShowroomCodes;

  const canEditShowroom = useCallback((code: string) => {
    if (!effectiveRole) return false;
    // BLD (ban lãnh đạo) chỉ xem, không edit
    if (effectiveRole === 'bld' || effectiveRole === 'finance') return false;
    // super_admin, pt_mkt_cty: edit tất cả
    if (effectiveRole === 'super_admin' || effectiveRole === 'pt_mkt_cty') return true;
    // mkt_brand: edit được mọi SR (nhưng chỉ cột brand của mình — enforce ở UI layer)
    if (effectiveRole === 'mkt_brand') return true;
    // mkt_showroom, gd_showroom: chỉ SR của mình
    return assignedShowroomCodes.includes(code);
  }, [effectiveRole, assignedShowroomCodes]);

  const canApproveShowroom = useCallback((code: string) => {
    if (!effectiveRole) return false;
    if (effectiveRole === 'super_admin' || effectiveRole === 'pt_mkt_cty') return true;
    if (effectiveRole === 'gd_showroom') return assignedShowroomCodes.includes(code);
    return false;
  }, [effectiveRole, assignedShowroomCodes]);

  const canUnlockApproved = !!effectiveRole && (
    effectiveRole === 'super_admin' || effectiveRole === 'pt_mkt_cty'
  );

  return (
    <AuthContext.Provider value={{
      authUser,
      profile,
      session,
      isLoading,
      signIn,
      signOut,
      refreshProfile,
      role,
      isAdmin: role ? roleIsAdmin(role) : false,
      isSuperAdmin: role === 'super_admin',
      previewRole,
      setPreviewRole,
      effectiveRole,
      // effectiveIsSuperAdmin: false khi đang preview role khác super_admin
      effectiveIsSuperAdmin: effectiveRole === 'super_admin',
      accessibleShowroomCodes,
      canViewAllShowrooms,
      canEditShowroom,
      canApproveShowroom,
      canUnlockApproved,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}

// Re-export helpers cho tiện dùng
export { roleIsAdmin, roleNeedsShowroom, roleNeedsBrands };
