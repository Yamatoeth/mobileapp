/**
 * Hooks Index
 * Central export for all React hooks
 */

// App state
export { useApiKey } from './useApiKey';
export { useChatHistory } from './useChatHistory';
export { useOnboarding } from './useOnboarding';
export { useTheme } from './useTheme';

// Health
// `useHealthKit` removed during pivot; keep storage-backed health logs
export { useHealthLogs } from './useHealthLogs';

// Voice & Speech
export { useSpeechRecognition } from './useSpeechRecognition';
export {
  useVoiceAssistant,
  type UseVoiceAssistantResult,
  type UseVoiceAssistantOptions,
} from './useVoiceAssistant';

// Voice streaming
export { default as useVoiceStream } from './useVoiceStream';

// State Machine
// state machine hook removed in pivot

// Calendar
// Calendar hook removed in Phase 1 pivot. Provide placeholders to surface
// informative runtime errors for codepaths that still call the hook.
export function useCalendar(): never {
  throw new Error('useCalendar has been removed in this pivot. Enable the Calendar feature or restore the hook in src/hooks/useCalendar.ts');
}
export type CalendarPermissionStatus = any;
export type FocusBlockInfo = any;
export type FreeBlockInfo = any;
export type UseCalendarOptions = any;
export type UseCalendarReturn = any;

// Location
export {
  useLocation,
  type LocationPermissionStatus,
  type UseLocationOptions,
  type UseLocationReturn,
} from './useLocation';
