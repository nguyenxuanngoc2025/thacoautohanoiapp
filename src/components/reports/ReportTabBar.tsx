'use client';

export type ReportTabId = 'budget-summary' | 'plan-vs-actual' | 'channel-efficiency' | 'events';

export const REPORT_TABS: Array<{ id: ReportTabId; label: string; icon: string }> = [
  { id: 'budget-summary',      label: 'Tổng hợp NS',        icon: '' },
  { id: 'plan-vs-actual',      label: 'KH vs Thực hiện',    icon: '' },
  { id: 'channel-efficiency',  label: 'Hiệu quả kênh',      icon: '' },
  { id: 'events',              label: 'Sự kiện',             icon: '' },
];

export function ReportTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: ReportTabId;
  onTabChange: (id: ReportTabId) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 2,
      borderBottom: '2px solid var(--color-border)',
      marginBottom: 0,
    }}>
      {REPORT_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: isActive ? 700 : 400,
              fontSize: 'var(--fs-body)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon && <span style={{ marginRight: 5 }}>{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
