import { useState, useEffect, useCallback } from "react";
import { notificationService, AppNotification } from "@/services/notification-service";

export type { AppNotification };

export interface NotificationOptions {
  title: string;
  description?: string;
  type?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Re-export with old interface name for backward compatibility
export interface Notification extends AppNotification {}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  notify: (options: NotificationOptions) => void;
  notifyTrackChange: (title: string, artist: string, coverUrl?: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string) => void;
  notifyInfo: (message: string, description?: string) => void;
  notifyWarning: (message: string, description?: string) => void;
  clearNotifications: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [enabled, setEnabledState] = useState(notificationService.isEnabled());

  // Subscribe to notification service
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notifs) => {
      setNotifications(notifs);
    });
    
    // Request permission on mount
    notificationService.requestPermission();
    
    return unsubscribe;
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    notificationService.setEnabled(value);
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('notifications', value);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
  }, []);

  const notify = useCallback((options: NotificationOptions) => {
    notificationService.notify(options);
  }, []);

  const notifyTrackChange = useCallback((title: string, artist: string, coverUrl?: string) => {
    notificationService.trackChange(title, artist, coverUrl);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    notificationService.success(message, description);
  }, []);

  const notifyError = useCallback((message: string, description?: string) => {
    notificationService.error(message, description);
  }, []);

  const notifyInfo = useCallback((message: string, description?: string) => {
    notificationService.info(message, description);
  }, []);

  const notifyWarning = useCallback((message: string, description?: string) => {
    notificationService.warning(message, description);
  }, []);

  const clearNotifications = useCallback(() => {
    notificationService.clearAll();
  }, []);

  return {
    notifications,
    enabled,
    setEnabled,
    notify,
    notifyTrackChange,
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning,
    clearNotifications,
  };
}
