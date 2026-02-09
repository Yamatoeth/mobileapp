/**
 * HealthKit Service - iOS Health data integration
 * Provides access to HRV, BPM, sleep, and other biometric data
 */
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';

// ============================================
// Types
// ============================================

export interface BiometricReading {
  value: number;
  startDate: string;
  endDate: string;
}

export interface HRVReading extends BiometricReading {
  // HRV in milliseconds (SDNN)
}

export interface HeartRateReading extends BiometricReading {
  // Heart rate in BPM
}

export interface SleepSample {
  value: string;
  startDate: string;
  endDate: string;
}

export interface HealthKitStatus {
  isAvailable: boolean;
  isAuthorized: boolean;
  permissions: {
    hrv: boolean;
    heartRate: boolean;
    sleep: boolean;
    steps: boolean;
    activeEnergy: boolean;
  };
}

// ============================================
// Permissions Configuration
// ============================================

const HEALTHKIT_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.WalkingHeartRateAverage,
    ],
    write: [],
  },
};

// ============================================
// Retry Logic
// ============================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================
// HealthKit Service Class
// ============================================

class HealthKitService {
  private initialized = false;

  /**
   * Check if HealthKit is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((err: Object, available: boolean) => {
        if (err) {
          console.error('HealthKit availability check failed:', err);
          resolve(false);
          return;
        }
        resolve(available);
      });
    });
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('HealthKit is only available on iOS');
      return false;
    }

    if (this.initialized) {
      return true;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (error: string) => {
        if (error) {
          console.error('HealthKit initialization failed:', error);
          resolve(false);
          return;
        }

        this.initialized = true;
        console.log('HealthKit initialized successfully');
        resolve(true);
      });
    });
  }

  /**
   * Get the current authorization status
   */
  async getAuthorizationStatus(): Promise<HealthKitStatus> {
    const available = await this.isAvailable();

    if (!available) {
      return {
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
    }

    // If initialized, we have authorization
    return {
      isAvailable: true,
      isAuthorized: this.initialized,
      permissions: {
        hrv: this.initialized,
        heartRate: this.initialized,
        sleep: this.initialized,
        steps: this.initialized,
        activeEnergy: this.initialized,
      },
    };
  }

  // ============================================
  // Heart Rate Variability
  // ============================================

  /**
   * Get the latest HRV reading
   */
  async getLatestHRV(): Promise<HRVReading | null> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return withRetry(
      () =>
        new Promise((resolve, reject) => {
          const options = {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
            ascending: false,
            limit: 1,
          };

          AppleHealthKit.getHeartRateVariabilitySamples(
            options,
            (error: string, results: HealthValue[]) => {
              if (error) {
                reject(new Error(`Failed to get HRV: ${error}`));
                return;
              }

              if (!results || results.length === 0) {
                resolve(null);
                return;
              }

              const latest = results[0];
              resolve({
                value: latest.value * 1000, // Convert to milliseconds
                startDate: latest.startDate,
                endDate: latest.endDate,
              });
            }
          );
        })
    );
  }

  /**
   * Get HRV history for a time range
   */
  async getHRVHistory(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HRVReading[]> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: true,
      };

      AppleHealthKit.getHeartRateVariabilitySamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(`Failed to get HRV history: ${error}`));
            return;
          }

          const readings: HRVReading[] = (results || []).map((r) => ({
            value: r.value * 1000,
            startDate: r.startDate,
            endDate: r.endDate,
          }));

          resolve(readings);
        }
      );
    });
  }

  // ============================================
  // Heart Rate
  // ============================================

  /**
   * Get the latest heart rate reading
   */
  async getLatestBPM(): Promise<HeartRateReading | null> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return withRetry(
      () =>
        new Promise((resolve, reject) => {
          const options = {
            startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
            endDate: new Date().toISOString(),
            ascending: false,
            limit: 1,
          };

          AppleHealthKit.getHeartRateSamples(
            options,
            (error: string, results: HealthValue[]) => {
              if (error) {
                reject(new Error(`Failed to get heart rate: ${error}`));
                return;
              }

              if (!results || results.length === 0) {
                resolve(null);
                return;
              }

              const latest = results[0];
              resolve({
                value: latest.value,
                startDate: latest.startDate,
                endDate: latest.endDate,
              });
            }
          );
        })
    );
  }

  /**
   * Get heart rate history for a time range
   */
  async getHeartRateHistory(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HeartRateReading[]> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: true,
      };

      AppleHealthKit.getHeartRateSamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(`Failed to get heart rate history: ${error}`));
            return;
          }

          const readings: HeartRateReading[] = (results || []).map((r) => ({
            value: r.value,
            startDate: r.startDate,
            endDate: r.endDate,
          }));

          resolve(readings);
        }
      );
    });
  }

  /**
   * Get resting heart rate
   */
  async getRestingHeartRate(): Promise<number | null> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const options = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      };

      AppleHealthKit.getRestingHeartRate(
        options,
        (error: string, result: HealthValue) => {
          if (error) {
            reject(new Error(`Failed to get resting heart rate: ${error}`));
            return;
          }

          if (!result) {
            resolve(null);
            return;
          }

          resolve(result.value);
        }
      );
    });
  }

  // ============================================
  // Sleep Analysis
  // ============================================

  /**
   * Get sleep samples for a date range
   */
  async getSleepSamples(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<SleepSample[]> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getSleepSamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(`Failed to get sleep samples: ${error}`));
            return;
          }

          // Map HealthValue to SleepSample
          const sleepSamples: SleepSample[] = (results || []).map((r) => ({
            value: String(r.value),
            startDate: r.startDate,
            endDate: r.endDate,
          }));
          resolve(sleepSamples);
        }
      );
    });
  }

  /**
   * Calculate total sleep duration for last night
   */
  async getLastNightSleep(): Promise<{
    totalMinutes: number;
    deepMinutes: number;
    remMinutes: number;
  } | null> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);

    const todayMorning = new Date(now);
    todayMorning.setHours(12, 0, 0, 0);

    try {
      const samples = await this.getSleepSamples(yesterday, todayMorning);

      let total = 0;
      let deep = 0;
      let rem = 0;

      for (const sample of samples) {
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        const duration = (end - start) / (1000 * 60);

        if (sample.value === 'ASLEEP' || sample.value === 'CORE') {
          total += duration;
        } else if (sample.value === 'DEEP') {
          total += duration;
          deep += duration;
        } else if (sample.value === 'REM') {
          total += duration;
          rem += duration;
        }
      }

      if (total === 0) {
        return null;
      }

      return {
        totalMinutes: Math.round(total),
        deepMinutes: Math.round(deep),
        remMinutes: Math.round(rem),
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // Activity
  // ============================================

  /**
   * Get step count for today
   */
  async getTodaySteps(): Promise<number> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const options = {
        date: today.toISOString(),
        includeManuallyAdded: true,
      };

      AppleHealthKit.getStepCount(
        options,
        (error: string, result: { value: number }) => {
          if (error) {
            reject(new Error(`Failed to get steps: ${error}`));
            return;
          }

          resolve(result?.value ?? 0);
        }
      );
    });
  }

  /**
   * Get active energy burned today (calories)
   */
  async getTodayActiveEnergy(): Promise<number> {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve, reject) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const options = {
        startDate: today.toISOString(),
        endDate: new Date().toISOString(),
      };

      AppleHealthKit.getActiveEnergyBurned(
        options,
        (error: string, results: HealthValue[]) => {
          if (error) {
            reject(new Error(`Failed to get active energy: ${error}`));
            return;
          }

          const total = (results || []).reduce((sum, r) => sum + r.value, 0);
          resolve(Math.round(total));
        }
      );
    });
  }

  /**
   * Clean up
   */
  cleanup(): void {
    this.initialized = false;
  }
}

// Export singleton instance
export const healthKitService = new HealthKitService();

// Export class for testing
export { HealthKitService };
