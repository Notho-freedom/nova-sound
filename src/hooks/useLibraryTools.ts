import { useState, useCallback } from 'react';
import type { QualityAnalysis, DuplicateGroup, IntegrityCheckResult, MetadataCompletionReport } from '@/types/library-tools';

interface UseLibraryToolsReturn {
  // Quality Analysis
  qualityAnalysis: QualityAnalysis | null;
  qualityLoading: boolean;
  qualityError: string | null;
  analyzeQuality: () => Promise<void>;

  // Duplicate Detection
  duplicates: DuplicateGroup[] | null;
  duplicatesLoading: boolean;
  duplicatesError: string | null;
  detectDuplicates: () => Promise<void>;

  // Integrity Check
  integrityResult: IntegrityCheckResult | null;
  integrityLoading: boolean;
  integrityError: string | null;
  checkIntegrity: () => Promise<void>;
  cleanupMissing: () => Promise<{ removed: number; remaining: number } | null>;
  cleanupLoading: boolean;

  // Metadata Analysis
  metadataReport: MetadataCompletionReport | null;
  metadataLoading: boolean;
  metadataError: string | null;
  analyzeMetadata: () => Promise<void>;
}

export function useLibraryTools(): UseLibraryToolsReturn {
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);

  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityError, setIntegrityError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const [metadataReport, setMetadataReport] = useState<MetadataCompletionReport | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  const analyzeQualityFn = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.analyzeQuality) {
      setQualityError('Electron API not available');
      return;
    }

    setQualityLoading(true);
    setQualityError(null);

    try {
      const result = await window.electronAPI.analyzeQuality();
      setQualityAnalysis(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze quality';
      setQualityError(message);
      console.error('Quality analysis failed:', error);
    } finally {
      setQualityLoading(false);
    }
  }, [isElectron]);

  const detectDuplicatesFn = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.detectDuplicates) {
      setDuplicatesError('Electron API not available');
      return;
    }

    setDuplicatesLoading(true);
    setDuplicatesError(null);

    try {
      const result = await window.electronAPI.detectDuplicates();
      setDuplicates(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detect duplicates';
      setDuplicatesError(message);
      console.error('Duplicate detection failed:', error);
    } finally {
      setDuplicatesLoading(false);
    }
  }, [isElectron]);

  const checkIntegrityFn = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.checkIntegrity) {
      setIntegrityError('Electron API not available');
      return;
    }

    setIntegrityLoading(true);
    setIntegrityError(null);

    try {
      const result = await window.electronAPI.checkIntegrity();
      setIntegrityResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check integrity';
      setIntegrityError(message);
      console.error('Integrity check failed:', error);
    } finally {
      setIntegrityLoading(false);
    }
  }, [isElectron]);

  const cleanupMissingFn = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.cleanupMissing) {
      setIntegrityError('Electron API not available');
      return null;
    }

    setCleanupLoading(true);
    setIntegrityError(null);

    try {
      const result = await window.electronAPI.cleanupMissing();
      // Refresh integrity result after cleanup
      await checkIntegrityFn();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cleanup missing files';
      setIntegrityError(message);
      console.error('Cleanup failed:', error);
      return null;
    } finally {
      setCleanupLoading(false);
    }
  }, [isElectron, checkIntegrityFn]);

  const analyzeMetadataFn = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.analyzeMetadata) {
      setMetadataError('Electron API not available');
      return;
    }

    setMetadataLoading(true);
    setMetadataError(null);

    try {
      const result = await window.electronAPI.analyzeMetadata();
      setMetadataReport(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze metadata';
      setMetadataError(message);
      console.error('Metadata analysis failed:', error);
    } finally {
      setMetadataLoading(false);
    }
  }, [isElectron]);

  return {
    qualityAnalysis,
    qualityLoading,
    qualityError,
    analyzeQuality: analyzeQualityFn,

    duplicates,
    duplicatesLoading,
    duplicatesError,
    detectDuplicates: detectDuplicatesFn,

    integrityResult,
    integrityLoading,
    integrityError,
    checkIntegrity: checkIntegrityFn,
    cleanupMissing: cleanupMissingFn,
    cleanupLoading,

    metadataReport,
    metadataLoading,
    metadataError,
    analyzeMetadata: analyzeMetadataFn,
  };
}
