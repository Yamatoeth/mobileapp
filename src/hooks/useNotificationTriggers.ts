import { useEffect, useRef, useState } from 'react';
import { useHealthKit, HRVHistoryItem } from './useHealthKit';
import { useLocation } from './useLocation';
import { useCalendar } from './useCalendar';
import { useLocalNotification } from './useLocalNotification';
import { logTriggerToBackend } from '@/services/triggerLogger';
import { useMeetingState } from './useMeetingState';
// Helper: check Do Not Disturb mode (iOS only, stub for now)
async function isDoNotDisturbEnabled(): Promise<boolean> {
  // TODO: Integrate with native module or expo-dnd if available
  return false;
}

// Helper: returns true if HRV < 30 for >15min
function detectProlongedStress(hrvHistory: HRVHistoryItem[]): boolean {
  const now = Date.now();
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const lowHrv = hrvHistory.filter(h => h.timestamp >= fifteenMinAgo && h.value < 30);
  return lowHrv.length > 0 && lowHrv.every(h => h.value < 30);
}

// Helper: returns true if no movement for >90min
function detectSedentary(lastMovement: number): boolean {
  const now = Date.now();
  return now - lastMovement > 90 * 60 * 1000;
}

// Helper: returns true if no breaks during 3+ hour focus block
function detectDehydrationRisk(events: any[]): boolean {
  const now = Date.now();
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  const focusBlocks = events.filter(e => e.start <= now && e.end >= threeHoursAgo && e.type === 'focus');
  if (!focusBlocks.length) return false;
  // No breaks: no event with type 'break' in last 3 hours
  const breaks = events.filter(e => e.type === 'break' && e.start >= threeHoursAgo);
  return breaks.length === 0;
}

const NOTIF_RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

export function useNotificationTriggers() {
  const healthKit = useHealthKit();
  const hrvHistory = healthKit.hrvHistory ?? [];
  // Adjust this line to match the actual property returned by useLocation.
  // For example, if useLocation returns 'location' and 'timestamp', use:
    const locationData = useLocation();
    // Replace 'lastMovementTimestamp' with the actual property name from UseLocationReturn that represents the last movement time.
    let lastMovement = locationData.location?.timestamp ?? 0;
    if (lastMovement instanceof Date) {
      lastMovement = lastMovement.getTime();
    }
  const { events } = useCalendar();
  const { schedule } = useLocalNotification();
  const triggered = useRef({ stress: false, sedentary: false, dehydration: false });
  const lastNotificationTime = useRef(0);
  const isInMeeting = useMeetingState();

  useEffect(() => {
    async function maybeNotify(type: 'stress' | 'sedentary' | 'dehydration', title: string, body: string, data: any) {
      // Never notify during MEETING state
      if (isInMeeting) return;
      // Rate limit: max 1 per 30 min
      const now = Date.now();
      if (now - lastNotificationTime.current < NOTIF_RATE_LIMIT_MS) return;
      // Respect Do Not Disturb
      if (await isDoNotDisturbEnabled()) return;
      schedule(title, body, data);
      logTriggerToBackend(type, data);
      lastNotificationTime.current = now;
      triggered.current[type] = true;
    }

    if (detectProlongedStress(hrvHistory) && !triggered.current.stress) {
      maybeNotify('stress', 'Stress Alert', 'Your HRV has been low for 15 minutes. Take a break or try breathing exercises.', { trigger: 'stress', hrvHistory });
    }
    if (detectSedentary(lastMovement) && !triggered.current.sedentary) {
      maybeNotify('sedentary', 'Sedentary Alert', 'You haven’t moved for 90 minutes. Time for a walk or stretch!', { trigger: 'sedentary', lastMovement });
    }
    if (detectDehydrationRisk(events) && !triggered.current.dehydration) {
      maybeNotify('dehydration', 'Hydration Reminder', 'No breaks detected in your focus block. Drink some water!', { trigger: 'dehydration', events });
    }
  }, [hrvHistory, lastMovement, events, schedule, isInMeeting]);
}
