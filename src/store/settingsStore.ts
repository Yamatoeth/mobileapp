/**
 * Settings Store - User preferences and app configuration
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrustLevel = 'consultant' | 'advisor' | 'manager' | 'executive';

interface UserSettings {
  // Notification preferences
  notificationsEnabled: boolean;
  voiceInterruptionsEnabled: boolean;
  
  // Intervention preferences
  breathingRemindersEnabled: boolean;
  movementRemindersEnabled: boolean;
  hydrationRemindersEnabled: boolean;
  
  // Privacy settings
  locationTrackingEnabled: boolean;
  calendarAccessEnabled: boolean;
  
  // Display preferences
  darkModeEnabled: boolean;
  hapticFeedbackEnabled: boolean;
}

interface SettingsState {
  // User info
  userId: string | null;
  email: string | null;
  fullName: string | null;
  
  // Trust system
  trustLevel: TrustLevel;
  trustScore: number;
  
  // Settings
  settings: UserSettings;
  
  // API keys (stored securely)
  openAiApiKey: string | null;
  groqApiKey: string | null;
  
  // Onboarding
  hasCompletedOnboarding: boolean;
  hasGrantedHealthKitPermissions: boolean;
  hasGrantedMicrophonePermissions: boolean;
  
  // Actions
  setUser: (userId: string, email: string, fullName: string) => void;
  setTrustLevel: (level: TrustLevel) => void;
  incrementTrustScore: (amount: number) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  setApiKey: (key: 'openai' | 'groq', value: string) => void;
  completeOnboarding: () => void;
  setHealthKitPermissions: (granted: boolean) => void;
  setMicrophonePermissions: (granted: boolean) => void;
  logout: () => void;
}

const defaultSettings: UserSettings = {
  notificationsEnabled: true,
  voiceInterruptionsEnabled: false,
  breathingRemindersEnabled: true,
  movementRemindersEnabled: true,
  hydrationRemindersEnabled: true,
  locationTrackingEnabled: false,
  calendarAccessEnabled: false,
  darkModeEnabled: false,
  hapticFeedbackEnabled: true,
};

const initialState = {
  userId: null,
  email: null,
  fullName: null,
  trustLevel: 'consultant' as TrustLevel,
  trustScore: 0,
  settings: defaultSettings,
  openAiApiKey: null,
  groqApiKey: null,
  hasCompletedOnboarding: false,
  hasGrantedHealthKitPermissions: false,
  hasGrantedMicrophonePermissions: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (userId, email, fullName) => {
        set({ userId, email, fullName });
      },

      setTrustLevel: (level) => {
        set({ trustLevel: level });
      },

      incrementTrustScore: (amount) => {
        const { trustScore, trustLevel } = get();
        const newScore = Math.min(100, Math.max(0, trustScore + amount));
        
        // Auto-upgrade trust level based on score
        let newLevel = trustLevel;
        if (newScore >= 90 && trustLevel !== 'executive') {
          newLevel = 'executive';
        } else if (newScore >= 75 && trustLevel === 'consultant') {
          newLevel = 'manager';
        } else if (newScore >= 50 && trustLevel === 'consultant') {
          newLevel = 'advisor';
        }
        
        set({ trustScore: newScore, trustLevel: newLevel });
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      setApiKey: (key, value) => {
        if (key === 'openai') {
          set({ openAiApiKey: value });
        } else {
          set({ groqApiKey: value });
        }
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true });
      },

      setHealthKitPermissions: (granted) => {
        set({ hasGrantedHealthKitPermissions: granted });
      },

      setMicrophonePermissions: (granted) => {
        set({ hasGrantedMicrophonePermissions: granted });
      },

      logout: () => {
        set(initialState);
      },
    }),
    {
      name: 'jarvis-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        userId: state.userId,
        email: state.email,
        fullName: state.fullName,
        trustLevel: state.trustLevel,
        trustScore: state.trustScore,
        settings: state.settings,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasGrantedHealthKitPermissions: state.hasGrantedHealthKitPermissions,
        hasGrantedMicrophonePermissions: state.hasGrantedMicrophonePermissions,
        // Note: API keys should be stored in SecureStore, not AsyncStorage
      }),
    }
  )
);
