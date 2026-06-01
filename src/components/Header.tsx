import type { AppPage } from '../types';
import { NotificationCenter } from './NotificationCenter';

const PAGE_LABELS: Record<AppPage, string> = {
  dashboard: 'Dashboard',
  group_finder: 'Group Finder',
  group_library: 'Group Library',
  campaign_builder: 'Campaign Builder',
  caption_studio: 'Caption Studio',
  group_selector: 'Group Selector',
  schedule_queue: 'Schedule Queue',
  share_session: 'Share Session',
  pending_approval: 'Pending Approval',
  reports: 'Reports',
  settings: 'Settings',
};

interface HeaderProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onToggleSidebar: () => void;
}

export function Header({ currentPage, onNavigate, onToggleSidebar }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="hamburger"
          onClick={onToggleSidebar}
          aria-label="เปิด/ปิดเมนู"
        >
          ☰
        </button>
        <div>
          <div className="header-title">PepsGroup Share Command</div>
          <div className="header-breadcrumb">
            <span>🏠</span>
            <span>›</span>
            <span>{PAGE_LABELS[currentPage]}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="quick-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate('campaign_builder')}
            aria-label="สร้างแคมเปญใหม่"
            title="สร้างแคมเปญใหม่"
          >
            🚀 New Campaign
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate('group_finder')}
            aria-label="เพิ่มกลุ่ม"
            title="เพิ่มกลุ่ม"
          >
            ➕ Add Group
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('share_session')}
            aria-label="เริ่ม Session"
            title="เริ่ม Share Session"
          >
            ▶️ Start Session
          </button>
        </div>
        <NotificationCenter />
      </div>
    </header>
  );
}
