import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { NotificationType, NotificationItem } from '../types';
import { notificationStorage } from '../lib/storage';
import { createId } from '../lib/ids';
import { NotifContext, ToastContext, useNotifications } from './NotificationContexts';
import { formatRelative } from '../lib/date';

// =====================================================
// TOAST CONTEXT
// =====================================================
interface ToastData {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
}

const ICON_MAP: Record<NotificationType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`toast toast-${toast.type}`} role="alert" aria-live="polite">
      <span className="toast-icon">{ICON_MAP[toast.type]}</span>
      <div className="toast-body">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-msg">{toast.message}</div>}
      </div>
      <button className="toast-close" onClick={onClose} aria-label="ปิดการแจ้งเตือน">×</button>
    </div>
  );
}

// =====================================================
// NOTIFICATION CENTER CONTEXT
// =====================================================
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => notificationStorage.getAll());

  const showToast = useCallback((type: NotificationType, title: string, message?: string) => {
    const id = createId('toast');
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const addNotification = useCallback((type: NotificationType, title: string, message: string) => {
    const item: NotificationItem = {
      id: createId('notif'),
      type, title, message,
      createdAt: new Date().toISOString(),
      read: false,
    };
    notificationStorage.add(item);
    setNotifications(notificationStorage.getAll());
    showToast(type, title, message);
  }, [showToast]);

  const markRead = useCallback((id: string) => {
    notificationStorage.markRead(id);
    setNotifications(notificationStorage.getAll());
  }, []);

  const markAllRead = useCallback(() => {
    notificationStorage.markAllRead();
    setNotifications(notificationStorage.getAll());
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, addNotification, markRead, markAllRead }}>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        <div className="toast-container" aria-label="การแจ้งเตือน">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>
      </ToastContext.Provider>
    </NotifContext.Provider>
  );
}

export function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="notif-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`การแจ้งเตือน ${unreadCount} รายการที่ยังไม่ได้อ่าน`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>การแจ้งเตือน {unreadCount > 0 && `(${unreadCount})`}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={markAllRead}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            >
              อ่านทั้งหมด
            </button>
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-icon">🔔</div>
                <div className="empty-state-desc">ไม่มีการแจ้งเตือน</div>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <span className="notif-item-icon">{ICON_MAP[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-msg">{n.message}</div>
                    <div className="notif-item-time">{formatRelative(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
