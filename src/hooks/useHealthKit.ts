/**
 * useHealthKit - Hook for HealthKit integration
 * Manages initialization, permissions, and real-time biometric updates
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  healthKitService,
  HealthKitStatus,
  HRVReading,
  HeartRateReading,
} from '../services/healthKit';
import { useBiometricStore } from '../store/biometricStore';

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 5000; // 5 seconds

export interface HRVHistoryItem {
  value: number;
  timestamp: number;
}

export interface UseHealthKitResult {
  // Status
  isAvailable: boolean;
  isAuthorized: boolean;
  isInitializing: boolean;
  error: string | null;

  // Data
  latestHRV: HRVReading | null;
  latestBPM: HeartRateReading | null;
  hrvHistory: HRVHistoryItem[];
  lastUpdated: Date | null;

  // Actions
  initialize: () => Promise<boolean>;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useHealthKit(): UseHealthKitResult {
  // Status state
  const [status, setStatus] = useState<HealthKitStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [latestHRV, setLatestHRV] = useState<HRVReading | null>(null);
  const [latestBPM, setLatestBPM] = useState<HeartRateReading | null>(null);
  const [hrvHistory, setHrvHistory] = useState<HRVHistoryItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  // Store actions
  const updateBiometrics = useBiometricStore((state) => state.updateBiometrics);
  const setStoreLoading = useBiometricStore((state) => state.setLoading);
  const setStoreError = useBiometricStore((state) => state.setError);

  /**
   * Initialize HealthKit and request permissions
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      setError('HealthKit is only available on iOS');
      return false;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const success = await healthKitService.initialize();

      if (success) {
        const authStatus = await healthKitService.getAuthorizationStatus();
        setStatus(authStatus);
      } else {
        setError('Failed to initialize HealthKit. Please check permissions.');
      }

      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  /**
   * Fetch latest biometric data
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;

    setStoreLoading(true);
    setStoreError(null);

    try {
      const [hrv, bpm] = await Promise.all([
        healthKitService.getLatestHRV().catch(() => null),
        healthKitService.getLatestBPM().catch(() => null),
      ]);

      setLatestHRV(hrv);
      setLatestBPM(bpm);
      setLastUpdated(new Date());

      // Update store
      if (hrv || bpm) {
        updateBiometrics(hrv?.value ?? 0, bpm?.value ?? 0);
      }

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch biometrics';
      setError(message);
      setStoreError(message);
    } finally {
      setStoreLoading(false);
    }
  }, [updateBiometrics, setStoreLoading, setStoreError]);

  /**
   * Start polling for biometric updates
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    if (Platform.OS !== 'ios') return;

    isPollingRef.current = true;

    // Initial fetch
    refresh();

    // Set up interval
    pollingRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh]);

  /**
   * Stop polling for biometric updates
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /**
   * Handle app state changes (pause polling when backgrounded)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && isPollingRef.current) {
          // App came back to foreground, refresh immediately
          refresh();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // Status
    isAvailable: Platform.OS === 'ios',
    isAuthorized: status?.isAuthorized ?? false,
    isInitializing,
    error,

    // Data
    latestHRV,
    latestBPM,
    hrvHistory,
    lastUpdated,

    // Actions
    initialize,
    refresh,
    startPolling,
    stopPolling,
  };
}

/**
 * Lighter hook for just checking HealthKit status
 */
export function useHealthKitStatus(): {
  isAvailable: boolean;
  isChecking: boolean;
  status: HealthKitStatus | null;
  checkStatus: () => Promise<HealthKitStatus | null>;
} {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<HealthKitStatus | null>(null);

  const checkStatus = useCallback(async (): Promise<HealthKitStatus | null> => {
    if (Platform.OS !== 'ios') {
      const unavailable: HealthKitStatus = {
        isAvailable: false,
        isAuthorized: false,
        permissions: {
          hrv: false,
          heartRate: false,
          sleep: false,
          steps: false,
          activeEnergy: false,
        },
      };
      setStatus(unavailable);
      return unavailable;
    }

    setIsChecking(true);

    try {
      const result = await healthKitService.getAuthorizationStatus();
      setStatus(result);
      return result;
    } catch {
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    isAvailable: Platform.OS === 'ios',
    isChecking,
    status,
    checkStatus,
  };
}
