import { createContext, useContext } from 'react';
import type { NotificationItem, NotificationType } from '../types';

export interface ToastContextValue {
  showToast: (type: NotificationType, title: string, message?: string) => void;
}

export interface NotifContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, message: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const NotifContext = createContext<NotifContextValue>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markRead: () => {},
  markAllRead: () => {},
});

export const useToast = () => useContext(ToastContext);
export const useNotifications = () => useContext(NotifContext);
