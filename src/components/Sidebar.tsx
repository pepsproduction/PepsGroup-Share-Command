import type { AppPage } from '../types';

interface NavItem {
  page: AppPage;
  icon: string;
  label: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { section: 'ภาพรวม', page: 'dashboard', icon: '📊', label: 'Dashboard' },
  { section: 'จัดการกลุ่ม', page: 'group_finder', icon: '🔍', label: 'Group Finder' },
  { page: 'group_library', icon: '📚', label: 'Group Library' },
  { section: 'แคมเปญ', page: 'campaign_builder', icon: '🚀', label: 'Campaign Builder' },
  { page: 'caption_studio', icon: '✍️', label: 'Caption Studio' },
  { page: 'group_selector', icon: '☑️', label: 'Group Selector' },
  { section: 'แชร์', page: 'schedule_queue', icon: '📅', label: 'Schedule Queue' },
  { page: 'share_session', icon: '▶️', label: 'Share Session' },
  { page: 'pending_approval', icon: '⏳', label: 'Pending Approval' },
  { section: 'รายงาน', page: 'reports', icon: '📈', label: 'Reports' },
  { page: 'settings', icon: '⚙️', label: 'Settings' },
];

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isOpen: boolean;
}

export function Sidebar({ currentPage, onNavigate, isOpen }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="เมนูหลัก">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">PepsGroup</div>
        <div className="sidebar-brand-name" style={{ fontSize: '0.8rem' }}>Share Command</div>
        <div className="sidebar-brand-sub">Manual Share Planner</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, index) => {
          const previousSection = NAV_ITEMS[index - 1]?.section;
          const showSection = item.section && item.section !== previousSection;
          return (
            <div key={item.page}>
              {showSection && (
                <div className="nav-section-label">{item.section}</div>
              )}
              <button
                className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => onNavigate(item.page)}
                aria-current={currentPage === item.page ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot" aria-hidden="true" />
          <span>Manual Share Only</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          v1.0.0 · No Auto-Post
        </div>
      </div>
    </aside>
  );
}
