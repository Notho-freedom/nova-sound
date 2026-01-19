/**
 * Utilitaire de connectivité robuste pour Electron et navigateur
 * 
 * navigator.onLine est peu fiable dans Electron - il peut renvoyer false
 * même quand l'appareil est connecté. Cette solution utilise une approche
 * plus robuste basée sur des requêtes réseau réelles.
 */

// Cache the connectivity state
let lastKnownOnlineState: boolean | null = null;
let lastCheckTime: number = 0;
const CACHE_DURATION_MS = 5000; // 5 seconds cache

/**
 * Check if we're running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Simple browser-based online check (unreliable in Electron)
 */
function browserOnlineCheck(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Perform an actual network request to verify connectivity
 * Uses multiple endpoints for reliability
 */
async function actualNetworkCheck(): Promise<boolean> {
  // List of endpoints to try (fast, reliable services)
  const endpoints = [
    // Google's generate_204 - returns quickly with no content
    'https://www.google.com/generate_204',
    // Firebase/Google APIs
    'https://firestore.googleapis.com/',
    // Cloudflare
    'https://1.1.1.1/cdn-cgi/trace',
  ];

  for (const endpoint of endpoints) {
    try {
      const signal = AbortSignal.timeout(3000); // 3 second timeout

      const response = await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors', // Bypass CORS - we just care if request succeeds
        cache: 'no-store',
        signal,
      });
      
      // If we get here, we're online
      return true;
    } catch {
      // This endpoint failed, try next one
      continue;
    }
  }

  // All endpoints failed - we're likely offline
  return false;
}

/**
 * Check connectivity with caching to avoid excessive network requests
 * 
 * @param forceCheck - If true, bypass the cache and perform a fresh check
 * @returns Promise<boolean> - True if online, false if offline
 */
export async function isOnline(forceCheck: boolean = false): Promise<boolean> {
  const now = Date.now();

  // Return cached result if recent enough (and not forcing check)
  if (!forceCheck && lastKnownOnlineState !== null && (now - lastCheckTime) < CACHE_DURATION_MS) {
    return lastKnownOnlineState;
  }

  // In Electron, always do an actual network check
  // In browser, trust navigator.onLine more (but still verify on important operations)
  if (isElectron()) {
    // For Electron, do actual network check
    const isConnected = await actualNetworkCheck();
    lastKnownOnlineState = isConnected;
    lastCheckTime = now;
    return isConnected;
  } else {
    // In browser, use navigator.onLine as primary (more reliable)
    // but fall back to actual check if it says offline
    const browserSays = browserOnlineCheck();
    
    if (!browserSays) {
      // Browser says offline, verify with actual check
      const isConnected = await actualNetworkCheck();
      lastKnownOnlineState = isConnected;
      lastCheckTime = now;
      return isConnected;
    }
    
    lastKnownOnlineState = true;
    lastCheckTime = now;
    return true;
  }
}

/**
 * Synchronous connectivity check - uses cached value or browser API
 * Use this when you can't await (e.g., in constructors)
 * 
 * @returns boolean - Best guess at online state (may be inaccurate in Electron)
 */
export function isOnlineSync(): boolean {
  // If we have a recent cached value, use it
  const now = Date.now();
  if (lastKnownOnlineState !== null && (now - lastCheckTime) < CACHE_DURATION_MS) {
    return lastKnownOnlineState;
  }

  // In Electron, assume online unless we have evidence otherwise
  // This prevents false "offline" states from blocking Firebase operations
  if (isElectron()) {
    return true; // Assume online - let Firebase handle actual offline scenarios
  }

  // In browser, trust navigator.onLine
  return browserOnlineCheck();
}

/**
 * Listen for connectivity changes
 * 
 * @param callback - Called when connectivity state changes
 * @returns Cleanup function to remove listener
 */
export function onConnectivityChange(callback: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    lastKnownOnlineState = true;
    lastCheckTime = Date.now();
    callback(true);
  };

  const handleOffline = async () => {
    // In Electron, verify with actual network check before reporting offline
    if (isElectron()) {
      const actuallyOnline = await actualNetworkCheck();
      if (actuallyOnline) {
        // False alarm - we're actually online
        lastKnownOnlineState = true;
        lastCheckTime = Date.now();
        return;
      }
    }
    
    lastKnownOnlineState = false;
    lastCheckTime = Date.now();
    callback(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Wait for connectivity to be restored
 * 
 * @param timeout - Maximum time to wait in ms (default: 30000)
 * @returns Promise that resolves when online or rejects on timeout
 */
export function waitForConnectivity(timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutSignal = AbortSignal.timeout(timeout);

    // Check if already online
    isOnline().then((online) => {
      if (online) {
        resolve();
        return;
      }

      // Set up listener
      const cleanup = onConnectivityChange((isOnline) => {
        if (isOnline) {
          cleanup();
          resolve();
        }
      });

      timeoutSignal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Connectivity timeout'));
      });
    });
  });
}
