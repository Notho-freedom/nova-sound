import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { firebaseSyncService } from "@/services/firebase-sync";
import { firebaseService } from "@/services/firebase";
import { isOnline, onConnectivityChange, isElectron } from "@/lib/connectivity";

export type SyncStatus = "loading" | "idle" | "syncing" | "synced" | "error" | "offline";

interface SyncStatusIndicatorProps {
  collapsed?: boolean;
  className?: string;
}

export const SyncStatusIndicator = ({ collapsed, className }: SyncStatusIndicatorProps) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let authUnsubscribe: (() => void) | null = null;
    
    // Helper function to update auth state based on current user and profile
    const updateAuthState = () => {
      if (!mounted) return;
      
      const user = firebaseService.getCurrentUser();
      const profile = firebaseService.getUserProfile();
      const profileEmail = profile?.email;
      
      // Consider authenticated if:
      // 1. User is NOT anonymous, OR
      // 2. Profile has a valid email (Google data was merged)
      const hasValidEmail = !!profileEmail && profileEmail.includes('@');
      const authenticated = !!user && (!user.isAnonymous || hasValidEmail);
      const isPro = profile?.plan === 'pro' && profile?.subscriptionStatus === 'active';
      
      console.log('📊 SyncStatusIndicator: Updating auth state', { 
        authenticated, 
        email: user?.email || profileEmail,
        isPro,
        hasProfile: !!profile
      });
      
      setIsAuthenticated(authenticated);
      setUserEmail(user?.email || profileEmail || null);
      setSyncStatus("idle");
    };
    
    // Wait for Firebase to be initialized before checking auth
    const initializeAuth = async () => {
      try {
        // Wait for Firebase to be ready
        await firebaseService.ensureInitialized();
        
        if (!mounted) return;
        
        // Listen for auth state changes
        authUnsubscribe = firebaseService.onAuthStateChange((user) => {
          if (!mounted) return;
          
          console.log('🔄 SyncStatusIndicator: Auth state changed', { 
            user: user ? { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous } : null
          });
          
          // Update auth state immediately
          updateAuthState();
          
          // Also set a short delay to catch profile that loads after auth state
          setTimeout(() => {
            if (mounted) updateAuthState();
          }, 500);
        });
        
        // Also poll for profile changes (in case profile loads after auth state change)
        // This handles the case where signInAnonymously returns a Google user
        let profileCheckInterval: NodeJS.Timeout | null = null;
        profileCheckInterval = setInterval(() => {
          if (!mounted) {
            if (profileCheckInterval) clearInterval(profileCheckInterval);
            return;
          }
          const profile = firebaseService.getUserProfile();
          const currentUser = firebaseService.getCurrentUser();
          const hasValidEmail = !!profile?.email && profile.email.includes('@');
          const shouldBeAuthenticated = !!currentUser && (!currentUser.isAnonymous || hasValidEmail);
          
          // Only update if we detect authentication but state shows not authenticated
          if (shouldBeAuthenticated && !isAuthenticated) {
            console.log('🔄 SyncStatusIndicator: Profile detected, updating auth state');
            updateAuthState();
            // Stop polling once authenticated
            if (profileCheckInterval) clearInterval(profileCheckInterval);
          }
        }, 1000);
        
        // Clear interval after 10 seconds (profile should be loaded by then)
        setTimeout(() => {
          if (profileCheckInterval) clearInterval(profileCheckInterval);
        }, 10000);
        
      } catch (error) {
        console.error("SyncStatusIndicator: Firebase init error:", error);
        if (mounted) {
          setSyncStatus("idle");
        }
      }
    };

    initializeAuth();

    // Listen to sync events
    const handleSyncStart = () => {
      setSyncStatus("syncing");
    };

    const handleSyncComplete = () => {
      setSyncStatus("synced");
      setLastSyncTime(new Date());
      // Reset to idle after 3 seconds
      setTimeout(() => setSyncStatus("idle"), 3000);
    };

    const handleSyncError = () => {
      setSyncStatus("error");
      // Reset to idle after 5 seconds
      setTimeout(() => setSyncStatus("idle"), 5000);
    };

    // Check online status using robust connectivity utility
    const handleOnline = () => {
      setSyncStatus((prev) => prev === "offline" ? "idle" : prev);
    };

    const handleOffline = () => {
      setSyncStatus("offline");
    };

    // Use robust connectivity listener (handles Electron quirks)
    const cleanupConnectivity = onConnectivityChange((online) => {
      if (online) {
        handleOnline();
      } else {
        handleOffline();
      }
    });

    // Check initial online status using robust check
    // In Electron, assume online initially - let Firebase handle actual connectivity
    if (!isElectron()) {
      isOnline().then((online) => {
        if (!online && mounted) {
          setSyncStatus("offline");
        }
      });
    }

    // Custom event listeners for sync status
    window.addEventListener("nexus-sync-start", handleSyncStart);
    window.addEventListener("nexus-sync-complete", handleSyncComplete);
    window.addEventListener("nexus-sync-error", handleSyncError);

    return () => {
      mounted = false;
      cleanupConnectivity();
      window.removeEventListener("nexus-sync-start", handleSyncStart);
      window.removeEventListener("nexus-sync-complete", handleSyncComplete);
      window.removeEventListener("nexus-sync-error", handleSyncError);
      if (authUnsubscribe) {
        authUnsubscribe();
      }
    };
  }, []);

  const getIcon = () => {
    switch (syncStatus) {
      case "loading":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "syncing":
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case "synced":
        return <Check className="w-4 h-4" />;
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      case "offline":
        return <CloudOff className="w-4 h-4" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (syncStatus) {
      case "loading":
        return "text-muted-foreground";
      case "syncing":
        return "text-primary";
      case "synced":
        return "text-green-500";
      case "error":
        return "text-destructive";
      case "offline":
        return "text-muted-foreground";
      default:
        return isAuthenticated ? "text-primary/70" : "text-muted-foreground";
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case "loading":
        return "Initialisation...";
      case "syncing":
        return "Synchronisation...";
      case "synced":
        return "Synchronisé";
      case "error":
        return "Erreur de sync";
      case "offline":
        return "Hors ligne";
      default:
        return isAuthenticated ? "Cloud connecté" : "Non connecté";
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return lastSyncTime.toLocaleDateString();
  };

  const handleManualSync = async () => {
    if (!isAuthenticated || syncStatus === "syncing" || syncStatus === "offline" || syncStatus === "loading") return;
    
    window.dispatchEvent(new CustomEvent("nexus-sync-start"));
    
    try {
      // Synchroniser Firebase d'abord
      await firebaseSyncService.forceSyncNow();
      
      // Ensuite, synchroniser Stripe avec Firestore
      try {
        const currentUser = firebaseService.getCurrentUser();
        if (currentUser && !currentUser.isAnonymous) {
          const idToken = await firebaseService.getIdToken();
          if (idToken) {
            console.log('🔄 SyncStatusIndicator: Synchronisation Stripe ↔ Firestore...');
            const syncResponse = await fetch('/api/stripe/sync-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
            });
            
            if (syncResponse.ok) {
              console.log('✅ SyncStatusIndicator: Profil Stripe synchronisé');
              // Ne pas appeler refreshProfile() ici - le listener Firestore mettra à jour l'UI automatiquement
              // Cela évite de déclencher une nouvelle synchronisation
            } else {
              console.warn('⚠️ SyncStatusIndicator: Erreur lors de la synchronisation Stripe:', await syncResponse.text());
            }
          }
        }
      } catch (stripeError) {
        // Ne pas bloquer la synchronisation Firebase si Stripe échoue
        console.warn('⚠️ SyncStatusIndicator: Erreur lors de la synchronisation Stripe (non-bloquant):', stripeError);
      }
      
      window.dispatchEvent(new CustomEvent("nexus-sync-complete"));
    } catch (error) {
      console.error("Manual sync failed:", error);
      window.dispatchEvent(new CustomEvent("nexus-sync-error"));
    }
  };

  const content = (
    <button
      onClick={handleManualSync}
      disabled={!isAuthenticated || syncStatus === "syncing" || syncStatus === "offline" || syncStatus === "loading"}
      className={cn(
        "flex items-center gap-2 rounded-lg transition-all duration-200 ease-out",
        collapsed ? "p-2 justify-center" : "px-3 py-2.5 w-full",
        "hover:bg-muted/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        getStatusColor(),
        className
      )}
    >
      <div className={cn(
        "relative",
        (syncStatus === "syncing" || syncStatus === "loading") && "animate-pulse"
      )}>
        {getIcon()}
        {isAuthenticated && syncStatus !== "offline" && syncStatus !== "error" && syncStatus !== "loading" && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-medium truncate">{getStatusText()}</p>
          {isAuthenticated && lastSyncTime && syncStatus === "idle" && (
            <p className="text-[10px] text-muted-foreground truncate">
              {formatLastSync()}
            </p>
          )}
          {userEmail && syncStatus === "idle" && (
            <p className="text-[10px] text-muted-foreground truncate">
              {userEmail}
            </p>
          )}
        </div>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="space-y-1">
          <p className="font-medium">{getStatusText()}</p>
          {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {formatLastSync()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
