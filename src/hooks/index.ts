/**
 * Hooks Index
 * Central export for all React hooks
 */

// App state
export { useChatHistory } from './useChatHistory';
export { useOnboarding } from './useOnboarding';
export { useTheme } from './useTheme';

// Voice
export {
  useVoiceAssistant,
  type UseVoiceAssistantResult,
  type UseVoiceAssistantOptions,
} from './useVoiceAssistant';

// State Machine
// state machine hook removed in pivot

// Location, calendar, and health-log hooks are intentionally outside Phase 1.
