/**
 * Calendar UI Components
 * 
 * - CalendarPermissionCard: Request/display permission status
 * - EventCard: Display a single calendar event
 * - TodaySchedule: Display today's events with meetings and focus blocks
 * - UpcomingEvent: Compact upcoming event display
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarEvent, Attendee } from '../services/calendarService';
import { CalendarPermissionStatus } from '../hooks/useCalendar';

// ============================================================================
// Calendar Permission Card
// ============================================================================

export interface CalendarPermissionCardProps {
  status: CalendarPermissionStatus;
  onRequestPermission: () => void;
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const CalendarPermissionCard: React.FC<CalendarPermissionCardProps> = ({
  status,
  onRequestPermission,
  onOpenSettings,
  compact = false,
}) => {
  if (status === 'granted') {
    return null; // Don't show if already granted
  }

  if (status === 'checking') {
    return (
      <View style={[styles.permissionCard, compact && styles.permissionCardCompact]}>
        <ActivityIndicator color="#3b82f6" />
        <Text style={styles.permissionText}>Checking calendar access...</Text>
      </View>
    );
  }

  const isDenied = status === 'denied';

  return (
    <View style={[styles.permissionCard, compact && styles.permissionCardCompact]}>
      <View style={styles.permissionHeader}>
        <Ionicons
          name="calendar-outline"
          size={compact ? 24 : 32}
          color="#3b82f6"
        />
        {!compact && (
          <Text style={styles.permissionTitle}>Calendar Access</Text>
        )}
      </View>

      <Text style={[styles.permissionDescription, compact && styles.permissionDescriptionCompact]}>
        {isDenied
          ? 'Calendar access was denied. Enable it in Settings to see your schedule.'
          : 'J.A.R.V.I.S. can detect meetings and focus blocks to provide better context-aware assistance.'}
      </Text>

      <TouchableOpacity
        style={[styles.permissionButton, isDenied && styles.permissionButtonSecondary]}
        onPress={isDenied ? onOpenSettings : onRequestPermission}
        activeOpacity={0.7}
      >
        <Text style={[styles.permissionButtonText, isDenied && styles.permissionButtonTextSecondary]}>
          {isDenied ? 'Open Settings' : 'Enable Calendar Access'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// Event Card
// ============================================================================

export interface EventCardProps {
  event: CalendarEvent;
  isActive?: boolean;
  isFocusBlock?: boolean;
  showAttendees?: boolean;
  onPress?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isActive = false,
  isFocusBlock = false,
  showAttendees = true,
  onPress,
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = () => {
    const durationMs = event.endDate.getTime() - event.startDate.getTime();
    const minutes = Math.round(durationMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const attendeeCount = event.attendees.filter(a => !a.isCurrentUser).length;
  const isMeeting = attendeeCount > 0;

  const cardStyle = [
    styles.eventCard,
    isActive && styles.eventCardActive,
    isFocusBlock && styles.eventCardFocus,
  ];

  const content = (
    <View style={cardStyle}>
      <View style={styles.eventTimeColumn}>
        <Text style={styles.eventTime}>{formatTime(event.startDate)}</Text>
        <Text style={styles.eventDuration}>{getDuration()}</Text>
      </View>

      <View style={styles.eventDivider} />

      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          {isActive && (
            <View style={styles.activeIndicator}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Now</Text>
            </View>
          )}
        </View>

        {event.location && (
          <View style={styles.eventLocation}>
            <Ionicons name="location-outline" size={12} color="#888" />
            <Text style={styles.eventLocationText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        )}

        {showAttendees && attendeeCount > 0 && (
          <View style={styles.eventAttendees}>
            <Ionicons name="people-outline" size={12} color="#888" />
            <Text style={styles.eventAttendeesText}>
              {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
            </Text>
          </View>
        )}

        {isFocusBlock && !isMeeting && (
          <View style={styles.focusIndicator}>
            <Ionicons name="flash-outline" size={12} color="#8b5cf6" />
            <Text style={styles.focusIndicatorText}>Focus Time</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// ============================================================================
// Today Schedule
// ============================================================================

export interface TodayScheduleProps {
  events: CalendarEvent[];
  focusBlockIds?: string[];
  activeEventId?: string;
  isLoading?: boolean;
  onEventPress?: (event: CalendarEvent) => void;
}

export const TodaySchedule: React.FC<TodayScheduleProps> = ({
  events,
  focusBlockIds = [],
  activeEventId,
  isLoading = false,
  onEventPress,
}) => {
  const now = new Date();

  // Filter to timed events (not all-day) and sort by start time
  const timedEvents = events
    .filter(e => !e.isAllDay)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Separate past and upcoming events
  const pastEvents = timedEvents.filter(e => e.endDate < now);
  const currentAndUpcoming = timedEvents.filter(e => e.endDate >= now);

  if (isLoading) {
    return (
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleHeader}>
          <Text style={styles.scheduleTitle}>Today's Schedule</Text>
        </View>
        <View style={styles.scheduleLoading}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (timedEvents.length === 0) {
    return (
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleHeader}>
          <Text style={styles.scheduleTitle}>Today's Schedule</Text>
        </View>
        <View style={styles.scheduleEmpty}>
          <Ionicons name="calendar-outline" size={40} color="#ccc" />
          <Text style={styles.scheduleEmptyText}>No events scheduled</Text>
          <Text style={styles.scheduleEmptySubtext}>
            Enjoy your open schedule!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scheduleContainer}>
      <View style={styles.scheduleHeader}>
        <Text style={styles.scheduleTitle}>Today's Schedule</Text>
        <Text style={styles.scheduleCount}>
          {timedEvents.length} {timedEvents.length === 1 ? 'event' : 'events'}
        </Text>
      </View>

      {/* Show past events collapsed if any */}
      {pastEvents.length > 0 && (
        <View style={styles.pastEventsSection}>
          <Text style={styles.pastEventsLabel}>
            {pastEvents.length} past {pastEvents.length === 1 ? 'event' : 'events'}
          </Text>
        </View>
      )}

      {/* Current and upcoming events */}
      {currentAndUpcoming.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          isActive={event.id === activeEventId}
          isFocusBlock={focusBlockIds.includes(event.id)}
          onPress={onEventPress ? () => onEventPress(event) : undefined}
        />
      ))}
    </View>
  );
};

// ============================================================================
// Upcoming Event (Compact)
// ============================================================================

export interface UpcomingEventProps {
  event: CalendarEvent | null;
  minutesUntil: number;
}

export const UpcomingEvent: React.FC<UpcomingEventProps> = ({
  event,
  minutesUntil,
}) => {
  if (!event) {
    return (
      <View style={styles.upcomingContainer}>
        <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
        <Text style={styles.upcomingClear}>No more events today</Text>
      </View>
    );
  }

  const formatTimeUntil = (minutes: number): string => {
    if (minutes < 1) return 'Starting now';
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `in ${hours}h`;
    return `in ${hours}h ${remainingMinutes}m`;
  };

  const attendeeCount = event.attendees.filter(a => !a.isCurrentUser).length;
  const isSoon = minutesUntil <= 15;

  return (
    <View style={[styles.upcomingContainer, isSoon && styles.upcomingContainerSoon]}>
      <View style={styles.upcomingIcon}>
        <Ionicons
          name={attendeeCount > 0 ? 'people-outline' : 'calendar-outline'}
          size={18}
          color={isSoon ? '#f59e0b' : '#3b82f6'}
        />
      </View>
      <View style={styles.upcomingContent}>
        <Text style={styles.upcomingTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.upcomingTime, isSoon && styles.upcomingTimeSoon]}>
          {formatTimeUntil(minutesUntil)}
          {attendeeCount > 0 && ` · ${attendeeCount} attendees`}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// Attendee List (for event details)
// ============================================================================

export interface AttendeeListProps {
  attendees: Attendee[];
  maxDisplay?: number;
}

export const AttendeeList: React.FC<AttendeeListProps> = ({
  attendees,
  maxDisplay = 5,
}) => {
  const displayAttendees = attendees.slice(0, maxDisplay);
  const remainingCount = attendees.length - maxDisplay;

  const getStatusColor = (status?: Attendee['status']): string => {
    switch (status) {
      case 'accepted':
        return '#22c55e';
      case 'declined':
        return '#ef4444';
      case 'tentative':
        return '#f59e0b';
      default:
        return '#999';
    }
  };

  if (attendees.length === 0) {
    return (
      <Text style={styles.noAttendees}>No other attendees</Text>
    );
  }

  return (
    <View style={styles.attendeeList}>
      {displayAttendees.map((attendee, index) => (
        <View key={attendee.id || index} style={styles.attendeeItem}>
          <View
            style={[
              styles.attendeeStatus,
              { backgroundColor: getStatusColor(attendee.status) },
            ]}
          />
          <Text style={styles.attendeeName} numberOfLines={1}>
            {attendee.name || attendee.email || 'Unknown'}
          </Text>
          {attendee.isCurrentUser && (
            <Text style={styles.attendeeYou}>(you)</Text>
          )}
        </View>
      ))}
      {remainingCount > 0 && (
        <Text style={styles.attendeeMore}>
          +{remainingCount} more
        </Text>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Permission Card
  permissionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    margin: 16,
  },
  permissionCardCompact: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  permissionHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#64748b',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionDescriptionCompact: {
    flex: 1,
    textAlign: 'left',
    marginBottom: 0,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionButtonTextSecondary: {
    color: '#475569',
  },

  // Event Card
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  eventCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
  },
  eventCardFocus: {
    borderColor: '#8b5cf6',
    backgroundColor: '#faf5ff',
  },
  eventTimeColumn: {
    width: 60,
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  eventDuration: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  eventDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  activeText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventLocationText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  eventAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  eventAttendeesText: {
    fontSize: 12,
    color: '#64748b',
  },
  focusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  focusIndicatorText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '500',
  },

  // Today Schedule
  scheduleContainer: {
    padding: 16,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  scheduleCount: {
    fontSize: 13,
    color: '#64748b',
  },
  scheduleLoading: {
    padding: 40,
    alignItems: 'center',
  },
  scheduleEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  scheduleEmptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  scheduleEmptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  pastEventsSection: {
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pastEventsLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Upcoming Event
  upcomingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  upcomingContainerSoon: {
    backgroundColor: '#fef3c7',
  },
  upcomingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  upcomingTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  upcomingTimeSoon: {
    color: '#d97706',
    fontWeight: '500',
  },
  upcomingClear: {
    fontSize: 14,
    color: '#22c55e',
  },

  // Attendee List
  attendeeList: {
    marginTop: 8,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  attendeeStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attendeeName: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  attendeeYou: {
    fontSize: 12,
    color: '#94a3b8',
  },
  attendeeMore: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  noAttendees: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

export default {
  CalendarPermissionCard,
  EventCard,
  TodaySchedule,
  UpcomingEvent,
  AttendeeList,
};
