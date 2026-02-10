/**
 * useCalendar Hook
 * 
 * Provides reactive access to iOS Calendar with:
 * - Permission management
 * - Today's events
 * - Active meeting detection
 * - Focus block detection
 * - Free time analysis
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  calendarService,
  CalendarEvent,
  ActiveEventInfo,
} from '../services/calendarService';

// ============================================================================
// Types
// ============================================================================

export type CalendarPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'checking';

export interface FocusBlockInfo {
  focusBlocks: CalendarEvent[];
  currentFocusBlock: CalendarEvent | null;
  isInFocusTime: boolean;
  minutesUntilFocusEnds: number;
}

export interface FreeBlockInfo {
  freeBlocks: { start: Date; end: Date; durationMinutes: number }[];
  totalFreeMinutes: number;
  longestFreeBlock: number;
}

export interface UseCalendarOptions {
  /** Auto-refresh interval in ms (default: 60000 = 1 minute) */
  refreshIntervalMs?: number;
  /** Whether to auto-refresh on app becoming active */
  refreshOnFocus?: boolean;
  /** Whether to auto-request permissions on mount */
  autoRequestPermissions?: boolean;
}

export interface UseCalendarReturn {
  // Permission state
  permissionStatus: CalendarPermissionStatus;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  
  // Events
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  
  // Active event
  activeEvent: ActiveEventInfo | null;
  isInMeeting: boolean;
  
  // Focus detection
  focusInfo: FocusBlockInfo | null;
  isInFocusTime: boolean;
  
  // Free time
  freeBlockInfo: FreeBlockInfo | null;
  
  // Helpers
  refresh: () => Promise<void>;
  getEventById: (id: string) => CalendarEvent | undefined;
  getUpcomingEvents: (count?: number) => CalendarEvent[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCalendar(options: UseCalendarOptions = {}): UseCalendarReturn {
  const {
    refreshIntervalMs = 60000,
    refreshOnFocus = true,
    autoRequestPermissions = false,
  } = options;

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<CalendarPermissionStatus>('checking');
  
  // Data state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<ActiveEventInfo | null>(null);
  const [focusInfo, setFocusInfo] = useState<FocusBlockInfo | null>(null);
  const [freeBlockInfo, setFreeBlockInfo] = useState<FreeBlockInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Permission handling
  // --------------------------------------------------------------------------

  const checkPermission = useCallback(async () => {
    setPermissionStatus('checking');
    try {
      const hasPermission = await calendarService.checkPermissions();
      setPermissionStatus(hasPermission ? 'granted' : 'undetermined');
      return hasPermission;
    } catch (err) {
      console.error('[useCalendar] Permission check failed:', err);
      setPermissionStatus('undetermined');
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await calendarService.requestPermissions();
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (granted) {
        // Fetch events after permission granted
        await refreshData();
      }
      
      return granted;
    } catch (err) {
      console.error('[useCalendar] Permission request failed:', err);
      setPermissionStatus('denied');
      setError('Failed to request calendar permission');
      return false;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------------

  const refreshData = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [todayEvents, activeInfo, focus, freeBlocks] = await Promise.all([
        calendarService.fetchTodayEvents(true), // Force refresh
        calendarService.getActiveEvent(),
        calendarService.getFocusBlocks(),
        calendarService.getFreeBlocks(),
      ]);

      setEvents(todayEvents);
      setActiveEvent(activeInfo);
      setFocusInfo(focus);
      setFreeBlockInfo(freeBlocks);
    } catch (err) {
      console.error('[useCalendar] Data fetch failed:', err);
      setError('Failed to fetch calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [permissionStatus]);

  // --------------------------------------------------------------------------
  // Initial load and auto-refresh
  // --------------------------------------------------------------------------

  // Check permissions on mount
  useEffect(() => {
    const init = async () => {
      const hasPermission = await checkPermission();
      
      if (!hasPermission && autoRequestPermissions) {
        await requestPermission();
      } else if (hasPermission) {
        await refreshData();
      } else {
        setIsLoading(false);
      }
    };

    init();
  }, [checkPermission, requestPermission, autoRequestPermissions]);

  // Fetch data when permission changes to granted
  useEffect(() => {
    if (permissionStatus === 'granted') {
      refreshData();
    }
  }, [permissionStatus, refreshData]);

  // Auto-refresh interval
  useEffect(() => {
    if (permissionStatus !== 'granted' || refreshIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      refreshData();
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [permissionStatus, refreshIntervalMs, refreshData]);

  // Refresh on app focus
  useEffect(() => {
    if (!refreshOnFocus || permissionStatus !== 'granted') {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshOnFocus, permissionStatus, refreshData]);

  // --------------------------------------------------------------------------
  // Helper functions
  // --------------------------------------------------------------------------

  const getEventById = useCallback(
    (id: string): CalendarEvent | undefined => {
      return events.find(event => event.id === id);
    },
    [events]
  );

  const getUpcomingEvents = useCallback(
    (count: number = 5): CalendarEvent[] => {
      const now = new Date();
      return events
        .filter(event => !event.isAllDay && event.startDate > now)
        .slice(0, count);
    },
    [events]
  );

  // --------------------------------------------------------------------------
  // Return value
  // --------------------------------------------------------------------------

  return {
    // Permission state
    permissionStatus,
    hasPermission: permissionStatus === 'granted',
    requestPermission,

    // Events
    events,
    isLoading,
    error,

    // Active event
    activeEvent,
    isInMeeting: activeEvent?.isActive && activeEvent?.hasAttendees || false,

    // Focus detection
    focusInfo,
    isInFocusTime: focusInfo?.isInFocusTime ?? false,

    // Free time
    freeBlockInfo,

    // Helpers
    refresh: refreshData,
    getEventById,
    getUpcomingEvents,
  };
}

export default useCalendar;
