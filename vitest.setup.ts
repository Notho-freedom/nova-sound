import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.electronAPI for tests
Object.defineProperty(window, 'electronAPI', {
  value: {
    getLibrary: async () => [],
    getVideos: async () => [],
    getPlaylists: async () => [],
    openDirectory: async () => [],
    scanLibrary: async () => {},
    onScanProgress: () => () => {},
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = vi.fn();

