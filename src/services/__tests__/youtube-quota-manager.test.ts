/**
 * Tests unitaires pour YouTubeQuotaManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { youtubeQuotaManager, QuotaState } from '../youtube-quota-manager';

describe('YouTubeQuotaManager', () => {
  beforeEach(() => {
    // Reset le quota manager
    youtubeQuotaManager.reset();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('getState', () => {
    it('devrait retourner OK si le quota est disponible', () => {
      const state = youtubeQuotaManager.getState();
      expect(state).toBe(QuotaState.OK);
    });

    it('devrait retourner LOW si le quota est à 80%', () => {
      // Consommer 80% du quota
      for (let i = 0; i < 8000; i++) {
        youtubeQuotaManager.consumeMetadata(1);
      }
      
      const state = youtubeQuotaManager.getState();
      expect(state).toBe(QuotaState.LOW);
    });

    it('devrait retourner EXHAUSTED si le quota est à 95%', () => {
      // Consommer 95% du quota
      for (let i = 0; i < 9500; i++) {
        youtubeQuotaManager.consumeMetadata(1);
      }
      
      const state = youtubeQuotaManager.getState();
      expect(state).toBe(QuotaState.EXHAUSTED);
    });
  });

  describe('canUseAPI', () => {
    it('devrait retourner true si le quota est disponible', () => {
      const canUse = youtubeQuotaManager.canUseAPI();
      expect(canUse).toBe(true);
    });

    it('devrait retourner false si le quota est épuisé', () => {
      // Consommer tout le quota
      for (let i = 0; i < 10000; i++) {
        youtubeQuotaManager.consumeMetadata(1);
      }
      
      const canUse = youtubeQuotaManager.canUseAPI();
      expect(canUse).toBe(false);
    });
  });

  describe('canSearch', () => {
    it('devrait retourner true si le budget de recherche est disponible', () => {
      const canSearch = youtubeQuotaManager.canSearch();
      expect(canSearch).toBe(true);
    });

    it('devrait retourner false si le budget de recherche est épuisé', () => {
      // Consommer tout le budget de recherche (10 recherches)
      for (let i = 0; i < 10; i++) {
        youtubeQuotaManager.consumeSearch();
      }
      
      const canSearch = youtubeQuotaManager.canSearch();
      expect(canSearch).toBe(false);
    });
  });

  describe('consumeSearch', () => {
    it('devrait consommer 100 unités de quota', () => {
      const initialRemaining = youtubeQuotaManager.getRemainingBudget();
      
      youtubeQuotaManager.consumeSearch();
      
      const newRemaining = youtubeQuotaManager.getRemainingBudget();
      expect(newRemaining.daily).toBe(initialRemaining.daily - 100);
      expect(newRemaining.search).toBe(initialRemaining.search - 100);
    });
  });

  describe('consumeMetadata', () => {
    it('devrait consommer le nombre d\'unités spécifié', () => {
      const initialRemaining = youtubeQuotaManager.getRemainingBudget();
      
      youtubeQuotaManager.consumeMetadata(5);
      
      const newRemaining = youtubeQuotaManager.getRemainingBudget();
      expect(newRemaining.daily).toBe(initialRemaining.daily - 5);
      expect(newRemaining.metadata).toBe(initialRemaining.metadata - 5);
    });
  });

  describe('recordFailure', () => {
    it('devrait ouvrir le circuit breaker après 3 échecs consécutifs', () => {
      // Enregistrer 3 échecs
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      
      const canUse = youtubeQuotaManager.canUseAPI();
      expect(canUse).toBe(false);
    });
  });

  describe('recordSuccess', () => {
    it('devrait fermer le circuit breaker après un succès', () => {
      // Ouvrir le circuit breaker
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      
      // Enregistrer un succès
      youtubeQuotaManager.recordSuccess();
      
      const canUse = youtubeQuotaManager.canUseAPI();
      expect(canUse).toBe(true);
    });
  });

  describe('getRemainingBudget', () => {
    it('devrait retourner le budget restant', () => {
      const budget = youtubeQuotaManager.getRemainingBudget();
      
      expect(budget.daily).toBeGreaterThan(0);
      expect(budget.search).toBeGreaterThan(0);
      expect(budget.metadata).toBeGreaterThan(0);
      expect(budget.percentage).toBeGreaterThanOrEqual(0);
      expect(budget.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('getUXMessage', () => {
    it('devrait retourner un message si le quota est épuisé', () => {
      // Consommer tout le quota
      for (let i = 0; i < 10000; i++) {
        youtubeQuotaManager.consumeMetadata(1);
      }
      
      const message = youtubeQuotaManager.getUXMessage();
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('devrait retourner null si le quota est disponible', () => {
      const message = youtubeQuotaManager.getUXMessage();
      expect(message).toBeNull();
    });
  });
});

