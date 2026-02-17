// Calendar service stub after pivot — provides lightweight, dependency-free API
export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  location?: string;
  notes?: string;
  attendees?: any[];
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

class CalendarService {
  async requestPermissions(): Promise<boolean> {
    return false;
  }

  async checkPermissions(): Promise<boolean> {
    return false;
  }

  async getTodaySchedule(): Promise<{ events: CalendarEvent[] }> {
    return { events: [] };
  }

  async getActiveEventInfo(): Promise<ActiveEventInfo> {
    return {
      event: null,
      isActive: false,
      hasAttendees: false,
      attendeeCount: 0,
      minutesUntilEnd: 0,
      minutesUntilNext: 0,
      nextEvent: null,
    };
  }

  // Compatibility methods expected by useCalendar hook
  async fetchTodayEvents(forceRefresh = false): Promise<CalendarEvent[]> {
    return [];
  }

  async getActiveEvent(): Promise<ActiveEventInfo> {
    return await this.getActiveEventInfo();
  }

  async getFocusBlocks(): Promise<{ focusBlocks: CalendarEvent[]; currentFocusBlock: CalendarEvent | null; isInFocusTime: boolean; minutesUntilFocusEnds: number; }> {
    return { focusBlocks: [], currentFocusBlock: null, isInFocusTime: false, minutesUntilFocusEnds: 0 };
  }

  async getFreeBlocks(): Promise<{ freeBlocks: { start: Date; end: Date; durationMinutes: number }[]; totalFreeMinutes: number; longestFreeBlock: number }> {
    return { freeBlocks: [], totalFreeMinutes: 0, longestFreeBlock: 0 };
  }
}

export const calendarService = new CalendarService();
export default calendarService;
