import { Platform } from 'react-native';
import { logTrigger } from './apiClient';

// Logs trigger events to backend
export async function logTriggerToBackend(
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await logTrigger({
      type,
      payload,
      platform: Platform.OS,
      timestamp: Date.now(),
    });
  } catch (err) {
    // Log error for debugging
    console.error('Failed to log trigger:', err);
  }
}
