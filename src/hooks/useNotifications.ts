import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

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

interface Notification extends NotificationOptions {
  id: string;
  timestamp: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  notify: (options: NotificationOptions) => void;
  notifyTrackChange: (title: string, artist: string, coverUrl?: string) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  clearNotifications: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [enabled, setEnabledState] = useState(true);

  // Load settings from localStorage and Firebase
  useEffect(() => {
    const loadNotificationsEnabled = async () => {
      // Load from localStorage first
      const saved = localStorage.getItem("nexus-notifications-enabled");
      if (saved !== null) {
        setEnabledState(saved === "true");
      }
      
      // Load from Firebase if authenticated
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        const firestoreData = await firebaseSyncService.loadFromFirestore();
        if (firestoreData?.notificationsEnabled !== undefined) {
          setEnabledState(firestoreData.notificationsEnabled);
          localStorage.setItem("nexus-notifications-enabled", String(firestoreData.notificationsEnabled));
        }
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    };
    
    loadNotificationsEnabled();
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem("nexus-notifications-enabled", String(value));
    
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
    if (!enabled) return;

    const notification: Notification = {
      ...options,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50));

    // Show toast
    const toastOptions = {
      description: options.description,
      duration: options.duration || 3000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    };

    switch (options.type) {
      case "success":
        toast.success(options.title, toastOptions);
        break;
      case "error":
        toast.error(options.title, toastOptions);
        break;
      case "warning":
        toast.warning(options.title, toastOptions);
        break;
      case "info":
        toast.info(options.title, toastOptions);
        break;
      default:
        toast(options.title, toastOptions);
    }

    // Also show native notification if available
    if (enabled && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(options.title, {
          body: options.description,
          icon: "/favicon.ico",
          silent: true,
        });
      } catch (e) {
        // Ignore errors for native notifications
      }
    }
  }, [enabled]);

  const notifyTrackChange = useCallback((title: string, artist: string, coverUrl?: string) => {
    if (!enabled) return;

    toast(title, {
      description: artist,
      duration: 2000,
    });

    // Native notification for track change
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: artist,
          icon: coverUrl || "/favicon.ico",
          silent: true,
        });
      } catch (e) {
        // Ignore
      }
    }
  }, [enabled]);

  const notifySuccess = useCallback((message: string) => {
    notify({ title: message, type: "success" });
  }, [notify]);

  const notifyError = useCallback((message: string) => {
    notify({ title: message, type: "error" });
  }, [notify]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return {
    notifications,
    enabled,
    setEnabled,
    notify,
    notifyTrackChange,
    notifySuccess,
    notifyError,
    clearNotifications,
  };
}

