import { ipcMain, shell, BrowserWindow } from 'electron';
import { net } from 'electron';
import * as crypto from 'crypto';
import { storage } from './storage.js';

// API Configuration
// Last.fm API credentials from environment variables
// Get your API key from: https://www.last.fm/api/account/create
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '';
const LASTFM_API_SECRET = process.env.LASTFM_API_SECRET || '';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/';

/**
 * Check if Last.fm API is configured
 */
export function isScrobblerConfigured(): boolean {
  return Boolean(LASTFM_API_KEY && LASTFM_API_SECRET && 
    LASTFM_API_KEY !== '' && LASTFM_API_SECRET !== '');
}

// Libre.fm uses the same API as Last.fm
const LIBREFM_API_URL = 'https://libre.fm/2.0/';
const LIBREFM_AUTH_URL = 'https://libre.fm/api/auth/';

interface ScrobbleTrack {
  artist: string;
  title: string;
  album?: string;
  duration: number;
  timestamp?: number;
}

interface ScrobbleStatus {
  lastFm: {
    connected: boolean;
    username?: string;
  };
  libreFm: {
    connected: boolean;
    username?: string;
  };
}

/**
 * Generate Last.fm API signature
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  // Sort parameters alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort();
  let signatureString = '';
  
  for (const key of sortedKeys) {
    signatureString += key + params[key];
  }
  
  signatureString += secret;
  
  // MD5 hash
  return crypto.createHash('md5').update(signatureString, 'utf8').digest('hex');
}

/**
 * Make signed API request
 */
async function makeAPIRequest(
  baseUrl: string,
  params: Record<string, string>,
  secret: string,
  method: 'GET' | 'POST' = 'POST'
): Promise<any> {
  // Add signature
  const sig = generateSignature(params, secret);
  params.api_sig = sig;
  params.format = 'json';
  
  return new Promise((resolve, reject) => {
    let url = baseUrl;
    let body: string | undefined;
    
    if (method === 'GET') {
      url += '?' + new URLSearchParams(params).toString();
    } else {
      body = new URLSearchParams(params).toString();
    }
    
    const request = net.request({
      url,
      method,
    });
    
    if (method === 'POST') {
      request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    }
    
    let data = '';
    
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.message || 'API Error'));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    request.on('error', reject);
    
    if (body) {
      request.write(body);
    }
    
    request.end();
  });
}

/**
 * Get authentication token (step 1 of auth flow)
 */
async function getAuthToken(service: 'lastfm' | 'librefm'): Promise<string> {
  if (!isScrobblerConfigured()) {
    throw new Error('Last.fm API is not configured. Please set LASTFM_API_KEY and LASTFM_API_SECRET environment variables.');
  }
  
  const apiUrl = service === 'lastfm' ? LASTFM_API_URL : LIBREFM_API_URL;
  
  const params = {
    method: 'auth.getToken',
    api_key: LASTFM_API_KEY,
  };
  
  const response = await makeAPIRequest(apiUrl, params, LASTFM_API_SECRET, 'GET');
  return response.token;
}

/**
 * Get session key (step 3 of auth flow, after user authorizes)
 */
async function getSessionKey(service: 'lastfm' | 'librefm', token: string): Promise<{ key: string; name: string }> {
  const apiUrl = service === 'lastfm' ? LASTFM_API_URL : LIBREFM_API_URL;
  
  const params = {
    method: 'auth.getSession',
    api_key: LASTFM_API_KEY,
    token,
  };
  
  const response = await makeAPIRequest(apiUrl, params, LASTFM_API_SECRET, 'GET');
  return {
    key: response.session.key,
    name: response.session.name,
  };
}

/**
 * Start authentication flow
 */
async function authenticate(service: 'lastfm' | 'librefm'): Promise<void> {
  try {
    // Step 1: Get token
    const token = await getAuthToken(service);
    
    // Step 2: Open browser for user authorization
    const authUrl = service === 'lastfm' ? LASTFM_AUTH_URL : LIBREFM_AUTH_URL;
    const authorizationUrl = `${authUrl}?api_key=${LASTFM_API_KEY}&token=${token}`;
    
    await shell.openExternal(authorizationUrl);
    
    // Wait a bit for user to authorize, then try to get session
    // In a real app, you'd show a dialog for the user to click when done
    setTimeout(async () => {
      try {
        const session = await getSessionKey(service, token);
        
        if (service === 'lastfm') {
          await storage.updateSettings({
            lastFmConnected: true,
            lastFmSessionKey: session.key,
            lastFmUsername: session.name,
          });
        } else {
          await storage.updateSettings({
            libreFmConnected: true,
            libreFmSessionKey: session.key,
            libreFmUsername: session.name,
          });
        }
        
        // Notify renderer
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
          window.webContents.send('scrobbler:authenticated', { service, username: session.name });
        });
      } catch (error) {
        console.error('Failed to complete authentication:', error);
      }
    }, 30000); // Wait 30 seconds for user to authorize
    
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

/**
 * Update "Now Playing" status
 */
async function updateNowPlaying(track: ScrobbleTrack): Promise<void> {
  if (!isScrobblerConfigured()) {
    console.warn('Scrobbling disabled: Last.fm API not configured');
    return;
  }
  
  const settings = await storage.getSettings();
  
  if (!settings.scrobblingEnabled) return;
  
  const params: Record<string, string> = {
    method: 'track.updateNowPlaying',
    api_key: LASTFM_API_KEY,
    artist: track.artist,
    track: track.title,
    duration: track.duration.toString(),
  };
  
  if (track.album) {
    params.album = track.album;
  }
  
  // Send to Last.fm if connected
  if (settings.lastFmConnected && settings.lastFmSessionKey) {
    try {
      params.sk = settings.lastFmSessionKey;
      await makeAPIRequest(LASTFM_API_URL, { ...params }, LASTFM_API_SECRET);
    } catch (error) {
      console.error('Failed to update Now Playing on Last.fm:', error);
    }
  }
  
  // Send to Libre.fm if connected
  if (settings.libreFmConnected && settings.libreFmSessionKey) {
    try {
      params.sk = settings.libreFmSessionKey;
      await makeAPIRequest(LIBREFM_API_URL, { ...params }, LASTFM_API_SECRET);
    } catch (error) {
      console.error('Failed to update Now Playing on Libre.fm:', error);
    }
  }
}

/**
 * Scrobble a track
 */
async function scrobbleTrack(track: ScrobbleTrack): Promise<void> {
  if (!isScrobblerConfigured()) {
    console.warn('Scrobbling disabled: Last.fm API not configured');
    return;
  }
  
  const settings = await storage.getSettings();
  
  if (!settings.scrobblingEnabled) return;
  
  const timestamp = track.timestamp || Math.floor(Date.now() / 1000);
  
  const params: Record<string, string> = {
    method: 'track.scrobble',
    api_key: LASTFM_API_KEY,
    artist: track.artist,
    track: track.title,
    timestamp: timestamp.toString(),
  };
  
  if (track.album) {
    params.album = track.album;
  }
  
  if (track.duration) {
    params.duration = track.duration.toString();
  }
  
  let scrobbled = false;
  
  // Scrobble to Last.fm if connected
  if (settings.lastFmConnected && settings.lastFmSessionKey) {
    try {
      params.sk = settings.lastFmSessionKey;
      await makeAPIRequest(LASTFM_API_URL, { ...params }, LASTFM_API_SECRET);
      scrobbled = true;
    } catch (error) {
      console.error('Failed to scrobble to Last.fm:', error);
      // Add to offline queue
      await storage.addToScrobbleQueue({ ...track, timestamp, service: 'lastfm' });
    }
  }
  
  // Scrobble to Libre.fm if connected
  if (settings.libreFmConnected && settings.libreFmSessionKey) {
    try {
      params.sk = settings.libreFmSessionKey;
      await makeAPIRequest(LIBREFM_API_URL, { ...params }, LASTFM_API_SECRET);
      scrobbled = true;
    } catch (error) {
      console.error('Failed to scrobble to Libre.fm:', error);
      // Add to offline queue
      await storage.addToScrobbleQueue({ ...track, timestamp, service: 'librefm' });
    }
  }
  
  if (scrobbled) {
    // Also add to local history
    const library = await storage.getLibrary();
    const localTrack = library.find(
      t => t.artist.toLowerCase() === track.artist.toLowerCase() &&
           t.title.toLowerCase() === track.title.toLowerCase()
    );
    
    if (localTrack) {
      await storage.addToHistory({
        trackId: localTrack.id,
        playedAt: new Date(timestamp * 1000).toISOString(),
        duration: track.duration,
        completedPercentage: 100,
      });
    }
  }
}

/**
 * Process offline scrobble queue
 */
async function processScrobbleQueue(): Promise<void> {
  if (!isScrobblerConfigured()) {
    return; // Silent return - can't process without API keys
  }
  
  const queue = await storage.getScrobbleQueue();
  const settings = await storage.getSettings();
  
  for (let i = queue.length - 1; i >= 0; i--) {
    const item = queue[i];
    
    try {
      const params: Record<string, string> = {
        method: 'track.scrobble',
        api_key: LASTFM_API_KEY,
        artist: item.artist,
        track: item.title,
        timestamp: item.timestamp.toString(),
      };
      
      if (item.album) params.album = item.album;
      if (item.duration) params.duration = item.duration.toString();
      
      if (item.service === 'lastfm' && settings.lastFmConnected && settings.lastFmSessionKey) {
        params.sk = settings.lastFmSessionKey;
        await makeAPIRequest(LASTFM_API_URL, { ...params }, LASTFM_API_SECRET);
        await storage.removeFromScrobbleQueue(i);
      } else if (item.service === 'librefm' && settings.libreFmConnected && settings.libreFmSessionKey) {
        params.sk = settings.libreFmSessionKey;
        await makeAPIRequest(LIBREFM_API_URL, { ...params }, LASTFM_API_SECRET);
        await storage.removeFromScrobbleQueue(i);
      }
    } catch (error) {
      console.error('Failed to process queued scrobble:', error);
      // Keep in queue for later
    }
  }
}

/**
 * Disconnect from a scrobbling service
 */
async function disconnect(service: 'lastfm' | 'librefm'): Promise<void> {
  if (service === 'lastfm') {
    await storage.updateSettings({
      lastFmConnected: false,
      lastFmSessionKey: undefined,
      lastFmUsername: undefined,
    });
  } else {
    await storage.updateSettings({
      libreFmConnected: false,
      libreFmSessionKey: undefined,
      libreFmUsername: undefined,
    });
  }
}

/**
 * Get scrobbler status
 */
async function getStatus(): Promise<ScrobbleStatus & { configured: boolean }> {
  const settings = await storage.getSettings();
  
  return {
    configured: isScrobblerConfigured(),
    lastFm: {
      connected: settings.lastFmConnected,
      username: settings.lastFmUsername,
    },
    libreFm: {
      connected: settings.libreFmConnected,
      username: settings.libreFmUsername,
    },
  };
}

/**
 * Check if a track should be scrobbled
 * According to Last.fm rules: after 50% or 4 minutes, whichever comes first
 */
export function shouldScrobble(playedSeconds: number, trackDuration: number): boolean {
  const halfDuration = trackDuration / 2;
  const fourMinutes = 240;
  
  return playedSeconds >= Math.min(halfDuration, fourMinutes);
}

/**
 * Initialize IPC handlers for scrobbler
 */
export function initScrobbler() {
  ipcMain.handle('scrobbler:scrobble', async (_event, track: ScrobbleTrack) => {
    return scrobbleTrack(track);
  });

  ipcMain.handle('scrobbler:nowPlaying', async (_event, track: ScrobbleTrack) => {
    return updateNowPlaying(track);
  });

  ipcMain.handle('scrobbler:status', async () => {
    return getStatus();
  });

  ipcMain.handle('scrobbler:authenticate', async (_event, service: 'lastfm' | 'librefm') => {
    return authenticate(service);
  });

  ipcMain.handle('scrobbler:disconnect', async (_event, service: 'lastfm' | 'librefm') => {
    return disconnect(service);
  });

  ipcMain.handle('scrobbler:processQueue', async () => {
    return processScrobbleQueue();
  });

  // Process queue periodically
  setInterval(() => {
    processScrobbleQueue().catch(console.error);
  }, 60000); // Every minute
}

