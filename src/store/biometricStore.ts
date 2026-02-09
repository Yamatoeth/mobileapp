/**
 * Biometric Store - Real-time HRV, BPM, and life state management
 */
import { create } from 'zustand';

export type LifeState =
  | 'sleeping'
  | 'exercising'
  | 'working'
  | 'meeting'
  | 'leisure'
  | 'stressed';

export type BiometricTrend = 'rising' | 'falling' | 'stable';

interface BiometricData {
  hrvMs: number;
  bpm: number;
  stressScore: number;
  timestamp: Date;
}

interface BiometricState {
  // Current readings
  hrvMs: number;
  bpm: number;
  stressScore: number;
  trend: BiometricTrend;
  lastUpdated: Date | null;
  
  // Life state
  currentState: LifeState;
  previousState: LifeState | null;
  
  // History (last hour)
  history: BiometricData[];
  
  // Loading/error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateBiometrics: (hrv: number, bpm: number) => void;
  setStressScore: (score: number) => void;
  setLifeState: (state: LifeState) => void;
  addToHistory: (data: BiometricData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  hrvMs: 0,
  bpm: 0,
  stressScore: 0,
  trend: 'stable' as BiometricTrend,
  lastUpdated: null,
  currentState: 'leisure' as LifeState,
  previousState: null,
  history: [],
  isLoading: false,
  error: null,
};

export const useBiometricStore = create<BiometricState>((set, get) => ({
  ...initialState,

  updateBiometrics: (hrv: number, bpm: number) => {
    const { hrvMs: prevHrv, history } = get();
    
    // Calculate trend
    const trend: BiometricTrend =
      hrv > prevHrv + 2 ? 'rising' : hrv < prevHrv - 2 ? 'falling' : 'stable';
    
    // Calculate stress score (simplified: lower HRV + higher BPM = more stress)
    // Real implementation would use more sophisticated algorithms
    const normalizedHrv = Math.max(0, Math.min(100, (hrv - 20) / 80 * 100));
    const normalizedBpm = Math.max(0, Math.min(100, (bpm - 50) / 100 * 100));
    const stressScore = Math.max(0, Math.min(1, (100 - normalizedHrv + normalizedBpm) / 200));
    
    const newData: BiometricData = {
      hrvMs: hrv,
      bpm,
      stressScore,
      timestamp: new Date(),
    };
    
    // Keep only last hour of history (assuming 5-second intervals = 720 points max)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const filteredHistory = history.filter((h) => h.timestamp > oneHourAgo);
    
    set({
      hrvMs: hrv,
      bpm,
      stressScore,
      trend,
      lastUpdated: new Date(),
      history: [...filteredHistory, newData],
    });
  },

  setStressScore: (score: number) => {
    set({ stressScore: Math.max(0, Math.min(1, score)) });
  },

  setLifeState: (state: LifeState) => {
    const { currentState } = get();
    set({
      previousState: currentState,
      currentState: state,
    });
  },

  addToHistory: (data: BiometricData) => {
    const { history } = get();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const filteredHistory = history.filter((h) => h.timestamp > oneHourAgo);
    set({ history: [...filteredHistory, data] });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  
  setError: (error: string | null) => set({ error }),

  reset: () => set(initialState),
}));
