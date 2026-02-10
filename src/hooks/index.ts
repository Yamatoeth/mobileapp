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
export { useHealthKit } from './useHealthKit';
export { useHealthLogs } from './useHealthLogs';

// Voice & Speech
export { useSpeechRecognition } from './useSpeechRecognition';
export {
  useVoiceAssistant,
  type UseVoiceAssistantResult,
  type UseVoiceAssistantOptions,
} from './useVoiceAssistant';

// State Machine
export {
  useStateMachine,
  type UseStateMachineOptions,
  type UseStateMachineReturn,
} from './useStateMachine';

// Calendar
export {
  useCalendar,
  type CalendarPermissionStatus,
  type FocusBlockInfo,
  type FreeBlockInfo,
  type UseCalendarOptions,
  type UseCalendarReturn,
} from './useCalendar';
