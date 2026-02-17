/**
 * Settings Store - User preferences and app configuration
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  
  
  // Settings
  settings: UserSettings;
  
  // API keys (stored securely)
  openAiApiKey: string | null;
  groqApiKey: string | null;
  
  // Onboarding
  hasCompletedOnboarding: boolean;
  hasGrantedMicrophonePermissions: boolean;
  
  // Actions
  setUser: (userId: string, email: string, fullName: string) => void;
  // Trust system removed — no-op placeholders may be added server-side
  updateSettings: (settings: Partial<UserSettings>) => void;
  setApiKey: (key: 'openai' | 'groq', value: string) => void;
  completeOnboarding: () => void;
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
  settings: defaultSettings,
  openAiApiKey: null,
  groqApiKey: null,
  hasCompletedOnboarding: false,
  hasGrantedMicrophonePermissions: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (userId, email, fullName) => {
        set({ userId, email, fullName });
      },

      // Trust system removed — no local trust scoring or auto-upgrades

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

      // HealthKit permissions removed from front-end settings

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
        settings: state.settings,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasGrantedMicrophonePermissions: state.hasGrantedMicrophonePermissions,
        // Note: API keys should be stored in SecureStore, not AsyncStorage
      }),
    }
  )
);
