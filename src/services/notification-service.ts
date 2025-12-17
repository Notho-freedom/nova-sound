/**
 * Global Notification Service
 * Singleton service for managing notifications across the app
 */

import { toast } from "sonner";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  type: "default" | "success" | "error" | "warning" | "info";
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

type NotificationListener = (notifications: AppNotification[]) => void;

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private enabled: boolean = true;
  private maxNotifications: number = 100;

  constructor() {
    // Load enabled state from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexus-notifications-enabled");
      this.enabled = saved !== "false";
    }
  }

  // Subscribe to notification changes
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current notifications
    listener(this.notifications);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  // Get all notifications
  getNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  // Check if notifications are enabled
  isEnabled(): boolean {
    return this.enabled;
  }

  // Enable/disable notifications
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("nexus-notifications-enabled", String(enabled));
    }
  }

  // Add a notification
  notify(options: {
    title: string;
    description?: string;
    type?: "default" | "success" | "error" | "warning" | "info";
    duration?: number;
    action?: { label: string; onClick: () => void };
  }) {
    if (!this.enabled) return;

    const notification: AppNotification = {
      id: crypto.randomUUID(),
      title: options.title,
      description: options.description,
      type: options.type || "default",
      timestamp: Date.now(),
      action: options.action,
    };

    // Add to notifications list (newest first)
    this.notifications = [notification, ...this.notifications].slice(0, this.maxNotifications);
    this.notifyListeners();

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

    // Show native notification if available
    this.showNativeNotification(options.title, options.description);
  }

  // Convenience methods
  success(title: string, description?: string) {
    this.notify({ title, description, type: "success" });
  }

  error(title: string, description?: string) {
    this.notify({ title, description, type: "error" });
  }

  warning(title: string, description?: string) {
    this.notify({ title, description, type: "warning" });
  }

  info(title: string, description?: string) {
    this.notify({ title, description, type: "info" });
  }

  // Track change notification
  trackChange(title: string, artist: string, coverUrl?: string) {
    if (!this.enabled) return;

    toast(title, {
      description: artist,
      duration: 2000,
    });

    this.showNativeNotification(title, artist, coverUrl);
  }

  // Upload notifications
  uploadStarted(fileName: string, provider: string) {
    this.notify({
      title: "Upload en cours",
      description: `${fileName} vers ${provider}`,
      type: "info",
    });
  }

  uploadCompleted(fileName: string, provider: string) {
    this.notify({
      title: "Upload terminé",
      description: `${fileName} uploadé vers ${provider}`,
      type: "success",
    });
  }

  uploadFailed(fileName: string, error?: string) {
    this.notify({
      title: "Échec de l'upload",
      description: error || `Impossible d'uploader ${fileName}`,
      type: "error",
    });
  }

  // Sync notifications
  syncStarted() {
    this.notify({
      title: "Synchronisation en cours",
      description: "Synchronisation de vos données...",
      type: "info",
    });
  }

  syncCompleted() {
    this.notify({
      title: "Synchronisation terminée",
      description: "Vos données sont à jour",
      type: "success",
    });
  }

  syncFailed(error?: string) {
    this.notify({
      title: "Échec de la synchronisation",
      description: error || "Impossible de synchroniser vos données",
      type: "error",
    });
  }

  // Auth notifications
  loginSuccess(email: string) {
    this.notify({
      title: "Connexion réussie",
      description: `Bienvenue ${email}`,
      type: "success",
    });
  }

  logoutSuccess() {
    this.notify({
      title: "Déconnexion",
      description: "Vous êtes maintenant déconnecté",
      type: "info",
    });
  }

  // Playlist notifications
  playlistCreated(name: string) {
    this.notify({
      title: "Playlist créée",
      description: `"${name}" a été créée`,
      type: "success",
    });
  }

  playlistDeleted(name: string) {
    this.notify({
      title: "Playlist supprimée",
      description: `"${name}" a été supprimée`,
      type: "info",
    });
  }

  trackAddedToPlaylist(trackTitle: string, playlistName: string) {
    this.notify({
      title: "Ajouté à la playlist",
      description: `"${trackTitle}" ajouté à "${playlistName}"`,
      type: "success",
    });
  }

  // Library notifications
  libraryScanned(trackCount: number) {
    this.notify({
      title: "Bibliothèque scannée",
      description: `${trackCount} pistes trouvées`,
      type: "success",
    });
  }

  newTracksAdded(count: number) {
    if (count === 0) return;
    this.notify({
      title: "Nouvelles pistes",
      description: `${count} nouvelle${count > 1 ? "s" : ""} piste${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""}`,
      type: "info",
    });
  }

  // Clear all notifications
  clearAll() {
    this.notifications = [];
    this.notifyListeners();
  }

  // Show native notification
  private showNativeNotification(title: string, body?: string, icon?: string) {
    if (!this.enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        silent: true,
      });
    } catch (e) {
      // Ignore errors for native notifications
    }
  }

  // Request native notification permission
  async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
