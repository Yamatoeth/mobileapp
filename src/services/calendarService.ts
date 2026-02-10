/**
 * Calendar Service
 * 
 * Integrates with iOS Calendar via expo-calendar to:
 * - Request calendar permissions
 * - Fetch today's events
 * - Detect active meetings (events with attendees)
 * - Provide calendar context for state detection
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  location?: string;
  notes?: string;
  attendees: Attendee[];
  calendarId: string;
  organizer?: string;
}

export interface Attendee {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: 'accepted' | 'declined' | 'tentative' | 'pending' | 'unknown';
  isCurrentUser?: boolean;
}

export interface ActiveEventInfo {
  event: CalendarEvent | null;
  isActive: boolean;
  hasAttendees: boolean;
  attendeeCount: number;
  minutesUntilEnd: number;
  minutesUntilNext: number;
  nextEvent: CalendarEvent | null;
}

export interface TodaySchedule {
  events: CalendarEvent[];
  hasEvents: boolean;
  busyMinutes: number;
  freeBlocks: { start: Date; end: Date; durationMinutes: number }[];
  nextEvent: CalendarEvent | null;
  minutesUntilNextEvent: number;
}

// ============================================================================
// Calendar Service
// ============================================================================

class CalendarService {
  private hasPermission: boolean = false;
  private calendars: Calendar.Calendar[] = [];
  private cachedEvents: CalendarEvent[] = [];
  private lastFetchTime: Date | null = null;
  private cacheValidityMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('[CalendarService] Initialized');
  }

  // --------------------------------------------------------------------------
  // Permissions
  // --------------------------------------------------------------------------

  /**
   * Request calendar permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      this.hasPermission = status === 'granted';
      
      if (this.hasPermission) {
        console.log('[CalendarService] Permission granted');
        await this.loadCalendars();
      } else {
        console.log('[CalendarService] Permission denied');
      }
      
      return this.hasPermission;
    } catch (error) {
      console.error('[CalendarService] Permission request error:', error);
      return false;
    }
  }

  /**
   * Check if we have calendar permissions
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('[CalendarService] Permission check error:', error);
      return false;
    }
  }

  /**
   * Get permission status
   */
  getPermissionStatus(): boolean {
    return this.hasPermission;
  }

  // --------------------------------------------------------------------------
  // Calendar Management
  // --------------------------------------------------------------------------

  /**
   * Load available calendars
   */
  async loadCalendars(): Promise<Calendar.Calendar[]> {
    if (!this.hasPermission) {
      console.warn('[CalendarService] No permission to load calendars');
      return [];
    }

    try {
      this.calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      console.log(`[CalendarService] Loaded ${this.calendars.length} calendars`);
      return this.calendars;
    } catch (error) {
      console.error('[CalendarService] Load calendars error:', error);
      return [];
    }
  }

  /**
   * Get list of calendars
   */
  getCalendars(): Calendar.Calendar[] {
    return this.calendars;
  }

  /**
   * Get primary calendar (iOS) or first available
   */
  getPrimaryCalendar(): Calendar.Calendar | undefined {
    if (Platform.OS === 'ios') {
      // On iOS, look for the default calendar
      return this.calendars.find(
        (cal) => cal.source.type === 'local' || cal.isPrimary
      ) ?? this.calendars[0];
    }
    return this.calendars[0];
  }

  // --------------------------------------------------------------------------
  // Event Fetching
  // --------------------------------------------------------------------------

  /**
   * Fetch events for today
   */
  async fetchTodayEvents(forceRefresh: boolean = false): Promise<CalendarEvent[]> {
    if (!this.hasPermission) {
      const granted = await this.checkPermissions();
      if (!granted) {
        console.warn('[CalendarService] No permission to fetch events');
        return [];
      }
    }

    // Check cache validity
    if (
      !forceRefresh &&
      this.lastFetchTime &&
      Date.now() - this.lastFetchTime.getTime() < this.cacheValidityMs
    ) {
      return this.cachedEvents;
    }

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Get calendar IDs to fetch from
      const calendarIds = this.calendars.map((cal) => cal.id);

      if (calendarIds.length === 0) {
        await this.loadCalendars();
        if (this.calendars.length === 0) {
          return [];
        }
      }

      const rawEvents = await Calendar.getEventsAsync(
        this.calendars.map((cal) => cal.id),
        startOfDay,
        endOfDay
      );

      // Transform to our CalendarEvent format
      this.cachedEvents = rawEvents.map((event) => this.transformEvent(event));
      this.lastFetchTime = new Date();

      // Sort by start time
      this.cachedEvents.sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
      );

      console.log(`[CalendarService] Fetched ${this.cachedEvents.length} events for today`);
      return this.cachedEvents;
    } catch (error) {
      console.error('[CalendarService] Fetch events error:', error);
      return [];
    }
  }

  /**
   * Fetch events for a date range
   */
  async fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    if (!this.hasPermission) {
      const granted = await this.checkPermissions();
      if (!granted) return [];
    }

    try {
      if (this.calendars.length === 0) {
        await this.loadCalendars();
      }

      const rawEvents = await Calendar.getEventsAsync(
        this.calendars.map((cal) => cal.id),
        startDate,
        endDate
      );

      const events = rawEvents.map((event) => this.transformEvent(event));
      events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      return events;
    } catch (error) {
      console.error('[CalendarService] Fetch events error:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Active Event Detection
  // --------------------------------------------------------------------------

  /**
   * Get currently active event (if any)
   */
  async getActiveEvent(): Promise<ActiveEventInfo> {
    const events = await this.fetchTodayEvents();
    const now = new Date();

    // Find active event
    const activeEvent = events.find(
      (event) =>
        !event.isAllDay &&
        event.startDate <= now &&
        event.endDate > now
    );

    // Find next event
    const upcomingEvents = events.filter(
      (event) => !event.isAllDay && event.startDate > now
    );
    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

    if (activeEvent) {
      const minutesUntilEnd = Math.round(
        (activeEvent.endDate.getTime() - now.getTime()) / 60000
      );
      const minutesUntilNext = nextEvent
        ? Math.round((nextEvent.startDate.getTime() - now.getTime()) / 60000)
        : -1;

      return {
        event: activeEvent,
        isActive: true,
        hasAttendees: activeEvent.attendees.length > 0,
        attendeeCount: activeEvent.attendees.length,
        minutesUntilEnd,
        minutesUntilNext,
        nextEvent,
      };
    }

    return {
      event: null,
      isActive: false,
      hasAttendees: false,
      attendeeCount: 0,
      minutesUntilEnd: -1,
      minutesUntilNext: nextEvent
        ? Math.round((nextEvent.startDate.getTime() - now.getTime()) / 60000)
        : -1,
      nextEvent,
    };
  }

  /**
   * Check if currently in a meeting (event with attendees)
   */
  async isInMeeting(): Promise<boolean> {
    const activeInfo = await this.getActiveEvent();
    return activeInfo.isActive && activeInfo.hasAttendees;
  }

  /**
   * Get meeting detection result for state machine
   */
  async getMeetingDetection(): Promise<{
    hasActiveEvent: boolean;
    hasAttendees: boolean;
    eventTitle?: string;
    minutesRemaining?: number;
  }> {
    const activeInfo = await this.getActiveEvent();
    
    return {
      hasActiveEvent: activeInfo.isActive,
      hasAttendees: activeInfo.hasAttendees,
      eventTitle: activeInfo.event?.title,
      minutesRemaining: activeInfo.minutesUntilEnd > 0 ? activeInfo.minutesUntilEnd : undefined,
    };
  }

  // --------------------------------------------------------------------------
  // Schedule Analysis
  // --------------------------------------------------------------------------

  /**
   * Get today's schedule summary
   */
  async getTodaySchedule(): Promise<TodaySchedule> {
    const events = await this.fetchTodayEvents();
    const now = new Date();

    // Filter non-all-day events
    const timedEvents = events.filter((e) => !e.isAllDay);

    // Calculate busy minutes
    let busyMinutes = 0;
    timedEvents.forEach((event) => {
      const duration = (event.endDate.getTime() - event.startDate.getTime()) / 60000;
      busyMinutes += duration;
    });

    // Find free blocks (simplified: gaps between events during work hours)
    const freeBlocks: TodaySchedule['freeBlocks'] = [];
    const workStart = new Date(now);
    workStart.setHours(9, 0, 0, 0);
    const workEnd = new Date(now);
    workEnd.setHours(18, 0, 0, 0);

    // Find next event
    const upcomingEvents = timedEvents.filter((e) => e.startDate > now);
    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

    return {
      events,
      hasEvents: events.length > 0,
      busyMinutes,
      freeBlocks,
      nextEvent,
      minutesUntilNextEvent: nextEvent
        ? Math.round((nextEvent.startDate.getTime() - now.getTime()) / 60000)
        : -1,
    };
  }

  /**
   * Get formatted context for LLM
   */
  async getContextForLLM(): Promise<{
    currentTime: string;
    nextEvent: string | null;
    minutesToNextEvent: number;
    isInMeeting: boolean;
    meetingTitle: string | null;
    todayEventCount: number;
  }> {
    const schedule = await this.getTodaySchedule();
    const activeInfo = await this.getActiveEvent();
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      currentTime: timeString,
      nextEvent: schedule.nextEvent?.title ?? null,
      minutesToNextEvent: schedule.minutesUntilNextEvent,
      isInMeeting: activeInfo.isActive && activeInfo.hasAttendees,
      meetingTitle: activeInfo.event?.title ?? null,
      todayEventCount: schedule.events.length,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private transformEvent(rawEvent: Calendar.Event): CalendarEvent {
    // Cast to access attendees since expo-calendar types may vary by version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventWithAttendees = rawEvent as any;
    const rawAttendees = eventWithAttendees.attendees ?? [];
    
    // Transform attendees
    const attendees: Attendee[] = rawAttendees.map((att: Calendar.Attendee) => ({
      id: att.id,
      name: att.name,
      email: att.email,
      role: att.role,
      status: this.mapAttendeeStatus(att.status),
      isCurrentUser: att.isCurrentUser,
    }));

    return {
      id: rawEvent.id,
      title: rawEvent.title,
      startDate: new Date(rawEvent.startDate),
      endDate: new Date(rawEvent.endDate),
      isAllDay: rawEvent.allDay ?? false,
      location: rawEvent.location ?? undefined,
      notes: rawEvent.notes ?? undefined,
      attendees,
      calendarId: rawEvent.calendarId,
      organizer: eventWithAttendees.organizerEmail ?? undefined,
    };
  }

  private mapAttendeeStatus(
    status?: Calendar.AttendeeStatus
  ): Attendee['status'] {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      case 'pending':
        return 'pending';
      default:
        return 'unknown';
    }
  }

  /**
   * Clear cached events
   */
  clearCache(): void {
    this.cachedEvents = [];
    this.lastFetchTime = null;
    console.log('[CalendarService] Cache cleared');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const calendarService = new CalendarService();

export default calendarService;
