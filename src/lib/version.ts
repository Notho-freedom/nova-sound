// Auto-generated version info
// This file is updated automatically by build scripts
import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const APP_NAME = packageJson.name;
export const APP_DESCRIPTION = packageJson.description;

// Get build date from version.json if available (Electron builds)
export async function getBuildInfo() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    // Try to get from electron's local-ui/version.json
    try {
      const response = await fetch('/version.json');
      if (response.ok) {
        const data = await response.json();
        return {
          version: data.version || APP_VERSION,
          buildDate: data.buildDate ? new Date(data.buildDate).toLocaleDateString() : 'Unknown',
          buildNumber: data.buildNumber,
          changelog: data.changelog
        };
      }
    } catch (error) {
      console.warn('Could not fetch version.json:', error);
    }
  }
  
  // Fallback for web builds
  return {
    version: APP_VERSION,
    buildDate: new Date().toLocaleDateString(),
    buildNumber: Date.now(),
    changelog: null
  };
}
