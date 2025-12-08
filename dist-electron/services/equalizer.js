/**
 * Equalizer Service
 *
 * Note: The actual audio processing happens in the renderer process using Web Audio API.
 * This service handles preset management and persistence in the main process.
 *
 * The renderer-side equalizer component will use these presets and apply them
 * using BiquadFilterNode in the Web Audio API.
 */
import { ipcMain } from 'electron';
import { storage } from './storage.js';
// 10-band equalizer frequency centers (Hz)
export const EQUALIZER_FREQUENCIES = [
    32, // Sub-bass
    64, // Bass
    125, // Low-mid
    250, // Mid
    500, // Mid
    1000, // Mid
    2000, // Upper-mid
    4000, // Presence
    8000, // Brilliance
    16000, // Air
];
// Default presets with their band gains (in dB)
export const DEFAULT_PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Rock: [5, 4, 3, 1, -1, -1, 0, 2, 3, 4],
    Pop: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
    Jazz: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
    Classical: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
    'Bass Boost': [6, 5, 4, 3, 1, 0, 0, 0, 0, 0],
    'Treble Boost': [0, 0, 0, 0, 0, 1, 3, 4, 5, 6],
    Electronic: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5],
    Vocal: [-2, -3, -3, 1, 4, 4, 3, 1, 0, -2],
    'Hip-Hop': [5, 4, 1, 3, -1, -1, 1, -1, 2, 3],
    Acoustic: [5, 4, 3, 1, 2, 1, 3, 3, 3, 2],
    'R&B': [3, 6, 5, 1, -2, -1, 2, 2, 3, 3],
    'Loud': [6, 4, 0, 0, 0, 0, 0, 0, 4, 5],
    'Soft': [-2, -1, 0, 1, 1, 1, 0, -1, -2, -3],
    'Deep': [5, 4, 2, 0, 0, 0, 0, 0, 0, -3],
};
/**
 * Initialize IPC handlers for equalizer
 */
export function initEqualizer() {
    // Get current equalizer state
    ipcMain.handle('equalizer:getState', async () => {
        const settings = await storage.getSettings();
        const presets = await storage.getEqualizerPresets();
        const currentPreset = presets.find(p => p.name === settings.equalizerPreset);
        return {
            enabled: settings.equalizerEnabled,
            presetName: settings.equalizerPreset,
            bands: currentPreset?.bands || settings.customEqualizer,
            preamp: currentPreset?.preamp || 0,
        };
    });
    // Set equalizer enabled state
    ipcMain.handle('equalizer:setEnabled', async (_event, enabled) => {
        await storage.updateSettings({ equalizerEnabled: enabled });
        return enabled;
    });
    // Apply a preset
    ipcMain.handle('equalizer:applyPreset', async (_event, presetName) => {
        const presets = await storage.getEqualizerPresets();
        const preset = presets.find(p => p.name === presetName);
        if (preset) {
            await storage.updateSettings({
                equalizerPreset: presetName,
                customEqualizer: preset.bands,
            });
            return preset;
        }
        return null;
    });
    // Set custom band values
    ipcMain.handle('equalizer:setBands', async (_event, bands) => {
        await storage.updateSettings({
            customEqualizer: bands,
            equalizerPreset: 'Custom',
        });
        return bands;
    });
    // Set single band value
    ipcMain.handle('equalizer:setBand', async (_event, index, value) => {
        const settings = await storage.getSettings();
        const bands = [...settings.customEqualizer];
        bands[index] = value;
        await storage.updateSettings({
            customEqualizer: bands,
            equalizerPreset: 'Custom',
        });
        return bands;
    });
    // Get frequencies info
    ipcMain.handle('equalizer:getFrequencies', () => {
        return EQUALIZER_FREQUENCIES;
    });
    // Reset to flat
    ipcMain.handle('equalizer:reset', async () => {
        const flatBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        await storage.updateSettings({
            customEqualizer: flatBands,
            equalizerPreset: 'Flat',
        });
        return flatBands;
    });
}
/**
 * Helper function to interpolate between frequency bands
 * Useful for visualizing the EQ curve
 */
export function interpolateEQCurve(bands, numPoints = 100) {
    const curve = [];
    const minFreq = EQUALIZER_FREQUENCIES[0];
    const maxFreq = EQUALIZER_FREQUENCIES[EQUALIZER_FREQUENCIES.length - 1];
    for (let i = 0; i < numPoints; i++) {
        // Logarithmic frequency scale
        const t = i / (numPoints - 1);
        const frequency = minFreq * Math.pow(maxFreq / minFreq, t);
        // Find the two nearest bands
        let lowerIndex = 0;
        for (let j = 0; j < EQUALIZER_FREQUENCIES.length - 1; j++) {
            if (EQUALIZER_FREQUENCIES[j + 1] > frequency) {
                lowerIndex = j;
                break;
            }
            lowerIndex = j;
        }
        const upperIndex = Math.min(lowerIndex + 1, EQUALIZER_FREQUENCIES.length - 1);
        // Interpolate gain
        const lowerFreq = EQUALIZER_FREQUENCIES[lowerIndex];
        const upperFreq = EQUALIZER_FREQUENCIES[upperIndex];
        const ratio = Math.log(frequency / lowerFreq) / Math.log(upperFreq / lowerFreq);
        const gain = bands[lowerIndex] + ratio * (bands[upperIndex] - bands[lowerIndex]);
        curve.push({ frequency, gain });
    }
    return curve;
}
//# sourceMappingURL=equalizer.js.map