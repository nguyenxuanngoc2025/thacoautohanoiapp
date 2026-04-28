'use client';

export type ReportTabId = 'plan-vs-actual' | 'budget-summary';

export const REPORT_TABS: Array<{ id: ReportTabId; label: string; icon: string }> = [
  { id: 'plan-vs-actual',  label: 'Kỳ báo cáo',        icon: '' },
  { id: 'budget-summary',  label: 'Xu hướng 12 tháng', icon: '' },
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
