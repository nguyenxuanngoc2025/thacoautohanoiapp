'use client';

/**
 * ChannelsContext — React Context cho dữ liệu Kênh và Nhóm Kênh Marketing
 *
 * ✅ Load 1 lần tại root layout (AppProviders)
 * ✅ Cung cấp channels + groups động từ DB thay thế CHANNELS hard-coded
 * ✅ Tự động inject channel đặc biệt "Tổng Digital" (aggregate) vào cuối nhóm DIGITAL
 * ✅ "Sự kiện" được đánh dấu readonly=true (driven by events[])
 * ✅ Khi Settings cập nhật kênh, gọi refreshChannels() để reload toàn app
 */

import React, { createContext, useContext } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChannelGroup {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Channel {
  id: string;
  name: string;
  code: string;
  color: string;
  group_id: string | null;
  sort_order: number;
  is_active: boolean;
  // computed fields (không có trong DB)
  category: string;       // tên nhóm hoặc 'KHÔNG NHÓM'
  readonly: boolean;      // true cho Sự kiện + Tổng Digital
  isAggregate: boolean;   // true cho Tổng Digital
}

// ─── Fallback tĩnh (sync với DB thực tế — dùng khi SWR chưa load xong) ────────

const STATIC_FALLBACK_CHANNELS: Channel[] = [
  { id: 'static-google',   name: 'Google',     code: 'google',   color: '#EA4335', group_id: null, sort_order: 1,  is_active: true, category: 'DIGITAL',    readonly: false, isAggregate: false },
  { id: 'static-facebook', name: 'Facebook',   code: 'facebook', color: '#1877F2', group_id: null, sort_order: 2,  is_active: true, category: 'DIGITAL',    readonly: false, isAggregate: false },
  { id: 'static-khac',     name: 'Khác',       code: 'digital_other', color: '#64748B', group_id: null, sort_order: 3,  is_active: true, category: 'DIGITAL',    readonly: false, isAggregate: false },
  { id: 'static-td',       name: 'Tổng Digital',code:'tong_digital',color:'#0F172A',group_id:null, sort_order: 4,  is_active: true, category: 'DIGITAL',    readonly: true,  isAggregate: true  },
  { id: 'static-event',    name: 'Sự kiện',    code: 'su_kien',  color: '#10B981', group_id: null, sort_order: 5,  is_active: true, category: 'SỰ KIỆN',   readonly: true,  isAggregate: false },
  { id: 'static-cskh',     name: 'CSKH',       code: 'cskh',     color: '#F59E0B', group_id: null, sort_order: 6,  is_active: true, category: 'CSKH',       readonly: false, isAggregate: false },
  { id: 'static-nd',       name: 'Nhận diện',  code: 'nhan_dien',color: '#8B5CF6', group_id: null, sort_order: 7,  is_active: true, category: 'NHẬN DIỆN', readonly: false, isAggregate: false },
];

// ─── Fetcher function ─────────────────────────────────────────────────────────

async function fetchChannelsWithGroups(): Promise<Channel[]> {
  const supabase = createClient();

  const [groupsRes, channelsRes] = await Promise.all([
    supabase.from('thaco_master_channel_groups').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('thaco_master_channels').select('*').eq('is_active', true).order('sort_order'),
  ]);

  // Nếu lỗi hoặc không có data — trả về fallback
  if (groupsRes.error || channelsRes.error || !groupsRes.data || !channelsRes.data) {
    console.warn('[ChannelsContext] Falling back to static channels');
    return STATIC_FALLBACK_CHANNELS;
  }

  const groups: ChannelGroup[] = groupsRes.data;
  const rawChannels = channelsRes.data;

  // Tạo map groupId -> groupName để tra cứu nhanh
  const groupMap = new Map<string, ChannelGroup>(groups.map(g => [g.id, g]));

  // Xác định nhóm DIGITAL (nhóm có ít nhất 1 kênh tên "Google" hoặc "Facebook")
  const digitalChannels = rawChannels.filter(c =>
    ['Google', 'Facebook', 'Khác'].includes(c.name)
  );
  const digitalGroupId = digitalChannels.length > 0 ? digitalChannels[0].group_id : null;

  // Xác định nhóm SỰ KIỆN (có kênh tên "Sự kiện")
  const eventChannel = rawChannels.find(c => c.name === 'Sự kiện');

  // Build danh sách channels chính thức, theo thứ tự group
  const result: Channel[] = [];

  // Group theo group_id
  const channelsByGroup = new Map<string | null, typeof rawChannels>();
  for (const ch of rawChannels) {
    const key = ch.group_id ?? 'null';
    if (!channelsByGroup.has(key)) channelsByGroup.set(key, []);
    channelsByGroup.get(key)!.push(ch);
  }

  // Thứ tự: từng group → channel trong group → sau đó là channels không có group
  for (const group of groups) {
    const groupChannels = channelsByGroup.get(group.id) ?? [];

    for (const ch of groupChannels) {
      const isEvent = ch.name === 'Sự kiện';
      result.push({
        id: ch.id,
        name: ch.name,
        code: ch.code,
        color: ch.color ?? '#64748B',
        group_id: ch.group_id,
        sort_order: ch.sort_order,
        is_active: ch.is_active,
        category: group.name.toUpperCase(),
        readonly: isEvent,
        isAggregate: false,
      });
    }

    // Inject "Tổng Digital" sau cùng của nhóm DIGITAL
    if (digitalGroupId && group.id === digitalGroupId && groupChannels.length > 1) {
      result.push({
        id: 'virtual-tong-digital',
        name: 'Tổng Digital',
        code: 'tong_digital',
        color: '#0F172A',
        group_id: digitalGroupId,
        sort_order: 9999,
        is_active: true,
        category: group.name.toUpperCase(),
        readonly: true,
        isAggregate: true,
      });
    }
  }

  // Channels không thuộc nhóm nào
  const orphaned = channelsByGroup.get('null') ?? [];
  for (const ch of orphaned) {
    result.push({
      id: ch.id,
      name: ch.name,
      code: ch.code,
      color: ch.color ?? '#64748B',
      group_id: null,
      sort_order: ch.sort_order,
      is_active: ch.is_active,
      category: 'KHÁC',
      readonly: ch.name === 'Sự kiện',
      isAggregate: false,
    });
  }

  return result.length > 0 ? result : STATIC_FALLBACK_CHANNELS;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChannelsContextValue {
  channels: Channel[];
  groups: ChannelGroup[];
  isLoading: boolean;
  /** Tên ('Google','Facebook','Khác') các kênh digital thực (non-aggregate, non-event) */
  digitalChannelNames: string[];
  refreshChannels: () => Promise<any>;
}

const ChannelsContext = createContext<ChannelsContextValue>({
  channels: STATIC_FALLBACK_CHANNELS,
  groups: [],
  isLoading: false,
  digitalChannelNames: ['Google', 'Facebook', 'Khác'],
  refreshChannels: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ChannelsProvider({ children }: { children: React.ReactNode }) {
  const { data: channels, isLoading, mutate } = useSWR<Channel[]>(
    'master_channels',
    fetchChannelsWithGroups,
    {
      fallbackData: STATIC_FALLBACK_CHANNELS,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      shouldRetryOnError: true,
      errorRetryCount: 8,
      errorRetryInterval: 2000,
    }
  );

  // Lấy group list (unique, theo thứ tự xuất hiện)
  const groups = React.useMemo((): ChannelGroup[] => {
    const seen = new Set<string>();
    const result: ChannelGroup[] = [];
    for (const ch of (channels ?? [])) {
      if (ch.group_id && !seen.has(ch.group_id) && !ch.isAggregate) {
        seen.add(ch.group_id);
        result.push({
          id: ch.group_id,
          name: ch.category,
          sort_order: ch.sort_order,
          is_active: ch.is_active,
        });
      }
    }
    return result;
  }, [channels]);

  // Danh sách tên kênh DIGITAL thực (không phải aggregate, không phải Sự kiện)
  const digitalChannelNames = React.useMemo(() => {
    return (channels ?? [])
      .filter(c => c.category === 'DIGITAL' && !c.isAggregate && !c.readonly)
      .map(c => c.name);
  }, [channels]);

  return (
    <ChannelsContext.Provider value={{
      channels: channels ?? STATIC_FALLBACK_CHANNELS,
      groups,
      isLoading,
      digitalChannelNames,
      refreshChannels: async () => { mutate(); },
    }}>
      {children}
    </ChannelsContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useChannels() {
  return useContext(ChannelsContext);
}
