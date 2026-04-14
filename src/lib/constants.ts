import { type UserRole } from '@/types/database';

// Navigation items per role
export const NAV_ITEMS = [
  { 
    label: 'Dashboard', 
    href: '/dashboard', 
    icon: 'LayoutDashboard',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance'] as UserRole[]
  },
  {
    label: 'Quản trị kế hoạch',
    href: '/planning',
    icon: 'CalendarRange',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom'] as UserRole[]
  },
  {
    label: 'Quản trị sự kiện',
    href: '/events',
    icon: 'CalendarCheck',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom'] as UserRole[]
  },
  {
    label: 'Việc cần làm',
    href: '/tasks',
    icon: 'CheckSquare',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance'] as UserRole[]
  },
  { 
    label: 'Báo cáo', 
    href: '/reports', 
    icon: 'FileText',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance'] as UserRole[]
  },
  { 
    label: 'Cài đặt', 
    href: '/settings', 
    icon: 'Settings',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance'] as UserRole[],
  },
  { 
    label: 'Hướng dẫn', 
    href: '/guide', 
    icon: 'BookOpen',
    roles: ['super_admin', 'bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance'] as UserRole[]
  },
];


// Months
export const MONTHS = [
  { value: 1, label: 'Tháng 1' },
  { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' },
  { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' },
  { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' },
  { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' },
  { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' },
  { value: 12, label: 'Tháng 12' },
];

// Channel categories
export const CHANNEL_CATEGORIES = [
  { value: 'DIGITAL', label: 'Digital', color: '#3B82F6' },
  { value: 'SỰ KIỆN', label: 'Sự kiện', color: '#10B981' },
  { value: 'CSKH', label: 'CSKH', color: '#F59E0B' },
  { value: 'NHẬN DIỆN', label: 'Nhận diện', color: '#8B5CF6' },
];

// Budget alert thresholds
export const BUDGET_THRESHOLD_WARNING = 80;
export const BUDGET_THRESHOLD_DANGER = 100;

// Chart colors palette
export const CHART_COLORS = [
  '#3B82F6', // Blue  
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

// KPI field labels
export const KPI_LABELS = {
  budget_amount: 'Ngân sách',
  khqt: 'KHQT',
  gdtd: 'GDTD',
  khd: 'KHĐ',
  tlcd_khqt_gdtd: 'TL chuyển đổi KHQT→GDTD',
  tlcd_gdtd_khd: 'TL chuyển đổi GDTD→KHĐ',
  tlcd_khqt_khd: 'TL chuyển đổi KHQT→KHĐ',
  cost_per_lead: 'Chi phí/KHQT',
  cost_per_acquisition: 'Chi phí/KHĐ',
};
