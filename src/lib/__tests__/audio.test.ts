import { describe, it, expect } from 'vitest';
import { getAudioSrc, formatDuration, getCoverUrl } from '../audio';

describe('audio utilities', () => {
  describe('getAudioSrc', () => {
    it('should return local-audio protocol for file paths', () => {
      const src = getAudioSrc('/path/to/file.mp3');
      expect(src).toBe('local-audio:///path/to/file.mp3');
    });

    it('should return http/https URLs as-is', () => {
      const httpUrl = getAudioSrc('http://example.com/audio.mp3');
      const httpsUrl = getAudioSrc('https://example.com/audio.mp3');
      
      expect(httpUrl).toBe('http://example.com/audio.mp3');
      expect(httpsUrl).toBe('https://example.com/audio.mp3');
    });

    it('should handle Windows paths', () => {
      const src = getAudioSrc('C:\\Users\\user\\music\\track.mp3');
      expect(src).toContain('local-audio://');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(3665)).toBe('61:05');
    });
  });

  describe('getCoverUrl', () => {
    it('should return coverUrl if provided', () => {
      expect(getCoverUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
    });

    it('should return default cover if no coverUrl', () => {
      const defaultCover = getCoverUrl('');
      expect(defaultCover).toBeTruthy();
      expect(defaultCover).not.toBe('');
    });
  });
});

