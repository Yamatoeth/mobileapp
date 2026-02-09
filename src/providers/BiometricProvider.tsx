/**
 * BiometricProvider - Context provider for HealthKit biometric data
 * Handles initialization, polling, and real-time updates
 */
import { createContext, useContext, useEffect, useCallback, useState, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { healthKitService, HRVReading, HeartRateReading } from '../services/healthKit';
import { useBiometricStore } from '../store/biometricStore';

// Polling configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds
const HISTORY_FETCH_INTERVAL_MS = 60000; // 1 minute

interface BiometricContextValue {
  // Status
  isInitialized: boolean;
  isAuthorized: boolean;
  isPolling: boolean;
  error: string | null;

  // Latest readings
  latestHRV: HRVReading | null;
  latestBPM: HeartRateReading | null;

  // History (last hour)
  hrvHistory: HRVReading[];
  bpmHistory: HeartRateReading[];

  // Actions
  initialize: () => Promise<boolean>;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
}

const BiometricContext = createContext<BiometricContextValue | null>(null);

interface BiometricProviderProps {
  children: ReactNode;
  autoStart?: boolean;
}

export function BiometricProvider({ children, autoStart = false }: BiometricProviderProps) {
  // Status
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest readings
  const [latestHRV, setLatestHRV] = useState<HRVReading | null>(null);
  const [latestBPM, setLatestBPM] = useState<HeartRateReading | null>(null);

  // History
  const [hrvHistory, setHrvHistory] = useState<HRVReading[]>([]);
  const [bpmHistory, setBpmHistory] = useState<HeartRateReading[]>([]);

  // Store actions
  const updateBiometrics = useBiometricStore((state) => state.updateBiometrics);
  const addToHistory = useBiometricStore((state) => state.addToHistory);
  const setStoreLoading = useBiometricStore((state) => state.setLoading);
  const setStoreError = useBiometricStore((state) => state.setError);

  // Polling refs
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const historyIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Initialize HealthKit
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      setError('HealthKit is only available on iOS');
      return false;
    }

    try {
      const success = await healthKitService.initialize();
      setIsInitialized(success);
      setIsAuthorized(success);

      if (!success) {
        setError('Failed to initialize HealthKit');
      }

      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    }
  }, []);

  /**
   * Fetch latest biometric data
   */
  const fetchLatest = useCallback(async () => {
    if (!isInitialized || Platform.OS !== 'ios') return;

    try {
      const [hrv, bpm] = await Promise.all([
        healthKitService.getLatestHRV().catch(() => null),
        healthKitService.getLatestBPM().catch(() => null),
      ]);

      if (hrv) setLatestHRV(hrv);
      if (bpm) setLatestBPM(bpm);

      // Update store
      const hrvValue = hrv?.value ?? 0;
      const bpmValue = bpm?.value ?? 0;

      if (hrvValue > 0 || bpmValue > 0) {
        updateBiometrics(hrvValue, bpmValue);

        // Add to store history
        addToHistory({
          hrvMs: hrvValue,
          bpm: bpmValue,
          stressScore: 0, // Will be calculated by store
          timestamp: new Date(),
        });
      }

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch biometrics';
      setError(message);
      setStoreError(message);
    }
  }, [isInitialized, updateBiometrics, addToHistory, setStoreError]);

  /**
   * Fetch history data
   */
  const fetchHistory = useCallback(async () => {
    if (!isInitialized || Platform.OS !== 'ios') return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    try {
      const [hrvHist, bpmHist] = await Promise.all([
        healthKitService.getHRVHistory(oneHourAgo).catch(() => []),
        healthKitService.getHeartRateHistory(oneHourAgo).catch(() => []),
      ]);

      setHrvHistory(hrvHist);
      setBpmHistory(bpmHist);
    } catch (err) {
      console.error('Failed to fetch biometric history:', err);
    }
  }, [isInitialized]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    setStoreLoading(true);
    await Promise.all([fetchLatest(), fetchHistory()]);
    setStoreLoading(false);
  }, [fetchLatest, fetchHistory, setStoreLoading]);

  /**
   * Start polling for updates
   */
  const startPolling = useCallback(() => {
    if (isPolling || !isInitialized) return;

    setIsPolling(true);

    // Initial fetch
    refresh();

    // Set up polling intervals
    pollIntervalRef.current = setInterval(fetchLatest, POLL_INTERVAL_MS);
    historyIntervalRef.current = setInterval(fetchHistory, HISTORY_FETCH_INTERVAL_MS);
  }, [isPolling, isInitialized, refresh, fetchLatest, fetchHistory]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (historyIntervalRef.current) {
      clearInterval(historyIntervalRef.current);
      historyIntervalRef.current = null;
    }
  }, []);

  /**
   * Handle app state changes
   */
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && isPolling) {
          // App came to foreground, refresh immediately
          refresh();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isPolling, refresh]);

  /**
   * Auto-start if configured
   */
  useEffect(() => {
    if (autoStart && Platform.OS === 'ios') {
      initialize().then((success) => {
        if (success) {
          startPolling();
        }
      });
    }

    return () => {
      stopPolling();
      healthKitService.cleanup();
    };
  }, [autoStart, initialize, startPolling, stopPolling]);

  const value: BiometricContextValue = {
    isInitialized,
    isAuthorized,
    isPolling,
    error,
    latestHRV,
    latestBPM,
    hrvHistory,
    bpmHistory,
    initialize,
    startPolling,
    stopPolling,
    refresh,
  };

  return (
    <BiometricContext.Provider value={value}>
      {children}
    </BiometricContext.Provider>
  );
}

/**
 * Hook to access biometric context
 */
export function useBiometricContext(): BiometricContextValue {
  const context = useContext(BiometricContext);

  if (!context) {
    throw new Error('useBiometricContext must be used within a BiometricProvider');
  }

  return context;
}

// Need React import for useRef
import React from 'react';
