/**
 * Context Aggregation Service
 *
 * Combines biometrics, calendar, and location into a unified JarvisContext
 * for use in the voice pipeline and LLM prompt.
 */

import { healthKitService } from './healthKit';
import { calendarService } from './calendarService';
import { locationService } from './locationService';
import type { JarvisContext, BiometricContext, CalendarContext } from './openaiService';

/**
 * Fetches the latest biometrics (HRV, BPM, stress, state)
 */
async function getBiometricContext(): Promise<BiometricContext | undefined> {
  try {
    // Example: Fetch latest HRV, BPM, and state from HealthKitService
    const [hrv, bpm] = await Promise.all([
      healthKitService.getLatestHRV?.(),
      healthKitService.getLatestBPM?.(),
    ]);
    // TODO: Replace with real state/stress logic
    const stressScore = hrv && hrv.value ? Math.max(0, 100 - hrv.value) : 50;
    const lifeState = 'working'; // TODO: Replace with real state detection
    if (hrv && bpm) {
      return {
        hrvMs: hrv.value,
        bpm: bpm.value,
        stressScore,
        lifeState,
        timestamp: new Date(hrv.endDate || Date.now()),
      };
    }
  } catch (e) {
    console.warn('[contextService] Failed to get biometrics:', e);
  }
  return undefined;
}

/**
 * Fetches the latest calendar context (current time, next event, location)
 */
async function getCalendarContext(locationType?: string): Promise<CalendarContext> {
  const full = await calendarService.getFullContext();
  return {
    currentTime: full.currentTime,
    nextEvent: full.nextEvent
      ? {
          title: full.nextEvent,
          time: full.minutesToNextEvent > 0 ? `${full.minutesToNextEvent} min` : 'now',
          attendees: full.meetingAttendees,
        }
      : undefined,
    location: locationType,
  };
}

/**
 * Fetches the latest location context (type, name, address)
 */
async function getLocationType(): Promise<string> {
  try {
    const loc = await locationService.getCurrentLocation();
    return loc?.locationType || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Aggregates all context for the LLM
 */
export async function getJarvisContext(): Promise<JarvisContext> {
  const [biometrics, locationType] = await Promise.all([
    getBiometricContext(),
    getLocationType(),
  ]);
  const calendar = await getCalendarContext(locationType);
  return {
    biometrics,
    calendar,
  };
}

export default {
  getJarvisContext,
};
