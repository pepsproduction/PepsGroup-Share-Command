import { useState, useEffect } from 'react';
import './styles/global.css';
import type { AppPage } from './types';
import { campaignStorage, groupStorage, leadStorage, queueStorage, settingsStorage } from './lib/storage';
import { loadSeedData } from './lib/seedData';
import { BACKUP_MARKER_KEY, collectAutomationReminders, reminderRunKey } from './lib/automation';

import { NotificationProvider } from './components/NotificationCenter';
import { useNotifications } from './components/NotificationContexts';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { Dashboard } from './pages/Dashboard';
import { GroupFinder } from './pages/GroupFinder';
import { GroupLibrary } from './pages/GroupLibrary';
import { CampaignBuilder } from './pages/CampaignBuilder';
import { CaptionStudio } from './pages/CaptionStudio';
import { GroupSelector } from './pages/GroupSelector';
import { ScheduleQueue } from './pages/ScheduleQueue';
import { ShareSession } from './pages/ShareSession';
import { PendingApproval } from './pages/PendingApproval';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

// Load seed data on first run
loadSeedData();

function AppContent() {
  const { addNotification } = useNotifications();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Apply saved theme on mount
  useEffect(() => {
    const settings = settingsStorage.get();
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, []);

  useEffect(() => {
    const settings = settingsStorage.get();
    const runKey = reminderRunKey();
    if (localStorage.getItem(runKey)) return;

    const reminders = collectAutomationReminders({
      queue: queueStorage.getAll(),
      groups: groupStorage.getAll(),
      campaigns: campaignStorage.getAll(),
      leads: leadStorage.getAll(),
      settings,
      lastBackupAt: localStorage.getItem(BACKUP_MARKER_KEY),
    });
    if (reminders.length === 0) {
      localStorage.setItem(runKey, '1');
      return;
    }

    const timer = window.setTimeout(() => {
      localStorage.setItem(runKey, '1');
      reminders.forEach((reminder) => {
        addNotification(reminder.severity, reminder.title, reminder.message);
        if (
          settings.automation.browserNotificationsEnabled &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(reminder.title, { body: reminder.message });
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [addNotification]);

  // Close sidebar on mobile when page changes
  function handleNavigate(page: AppPage) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  const pageComponents: Record<AppPage, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={handleNavigate} />,
    group_finder: <GroupFinder />,
    group_library: <GroupLibrary />,
    campaign_builder: <CampaignBuilder />,
    caption_studio: <CaptionStudio />,
    group_selector: <GroupSelector />,
    schedule_queue: <ScheduleQueue />,
    share_session: <ShareSession />,
    pending_approval: <PendingApproval />,
    reports: <Reports />,
    settings: <Settings />,
  };

  return (
    <div className="app-layout">
      {/* Background Effects */}
      <div className="bg-fx" aria-hidden="true">
        <div className="bg-glow-1" />
        <div className="bg-glow-2" />
        <div className="bg-grid" />
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, backdropFilter: 'blur(2px)',
          }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
      />

      <div className="main-content">
        <Header
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main id="main-content">
          {pageComponents[currentPage]}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;
