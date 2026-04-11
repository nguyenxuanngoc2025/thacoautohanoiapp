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
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ─── DEV BYPASS ─────────────────────────────────────────────────────────────
  // Khi DEV_BYPASS_AUTH=true: fake super_admin, không cần đăng nhập
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true') {
    const fakeProfile: ThacUser = {
      id: 'dev-super-admin',
      unit_id: 'unit-hn',
      showroom_id: null,
      brands: [],
      email: 'admin@thaco.vn',
      full_name: 'Nguyễn Xuân Ngọc (Dev)',
      role: 'super_admin',
      is_active: true,
      created_at: new Date().toISOString(),
      unit: {
        id: 'unit-hn',
        code: 'HN',
        name: 'THACO AUTO HÀ NỘI',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };
    return (
      <AuthContext.Provider value={{
        authUser: { id: 'dev-super-admin', email: 'admin@thaco.vn' } as any,
        profile: fakeProfile,
        session: null,
        isLoading: false,
        signIn: async () => ({ error: null }),
        signOut: async () => {},
        refreshProfile: async () => {},
        role: 'super_admin',
        isAdmin: true,
        isSuperAdmin: true,
      }}>
        {children}
      </AuthContext.Provider>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  const supabase = createClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ThacUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Khởi tạo session + lắng nghe thay đổi auth
  useEffect(() => {
    let mounted = true;

    // DEV SPECIFIC MOCK: Khôi phục phiên tĩnh nếu cookie bypass còn hiệu lực (chế độ Duy trì Đăng nhập)
    if (typeof document !== 'undefined' && document.cookie.includes('dev_bypass_mock=true')) {
      const fakeProfile: ThacUser = {
        id: 'dev-super-admin-mock',
        unit_id: 'unit-hn',
        showroom_id: null,
        brands: [],
        email: 'nguyenxuanngoc@thaco.com.vn',
        full_name: 'Nguyễn Xuân Ngọc',
        role: 'super_admin',
        is_active: true,
        created_at: new Date().toISOString(),
        unit: {
          id: 'unit-hn',
          code: 'HN',
          name: 'THACO AUTO HÀ NỘI',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      };
      setAuthUser({ id: 'dev-super-admin-mock', email: 'nguyenxuanngoc@thaco.com.vn' } as User);
      setProfile(fakeProfile);
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (mounted) setProfile(p);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (mounted) setProfile(p);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // DEV SPECIFIC MOCK FOR LOCALHOST testing with customized 8 digit password
      if (email === 'nguyenxuanngoc@thaco.com.vn' && password === '12344321') {
        const fakeProfile: ThacUser = {
          id: 'dev-super-admin-mock',
          unit_id: 'unit-hn',
          showroom_id: null,
          brands: [],
          email: 'nguyenxuanngoc@thaco.com.vn',
          full_name: 'Nguyễn Xuân Ngọc',
          role: 'super_admin',
          is_active: true,
          created_at: new Date().toISOString(),
          unit: {
            id: 'unit-hn',
            code: 'HN',
            name: 'THACO AUTO HÀ NỘI',
            is_active: true,
            created_at: new Date().toISOString(),
          },
        };
        // Set fake cookie to bypass middleware loop
        document.cookie = "dev_bypass_mock=true; path=/; max-age=86400";
        // Fake session setup manually without hitting GoTrue db limitations
        setAuthUser({ id: 'dev-super-admin-mock', email } as User);
        setProfile(fakeProfile);
        return { error: null };
      }

      // Cắt đứt sau 4 giây nếu BE treo (Supabase lag/timout)
      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<any>((resolve) => 
        setTimeout(() => resolve({ error: { message: 'Máy chủ phản hồi quá chậm (Timeout). Khả năng cấu hình VPS đang gặp sự cố.' } }), 4000)
      );

      const { error } = await Promise.race([loginPromise, timeoutPromise]);
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Lỗi ngoại lệ khi đăng nhập' };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (typeof document !== 'undefined') {
      document.cookie = "dev_bypass_mock=; path=/; max-age=0";
    }
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
  }, [supabase]);

  const role = profile?.role ?? null;

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
