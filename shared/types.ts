/**
 * J.A.R.V.I.S. Shared Type Definitions
 * These types are shared between frontend (React Native) and backend (FastAPI)
 */

// ============================================
// User & Authentication
// ============================================

export interface User {
  id: string;
  email: string;
  fullName: string;
  trustLevel: TrustLevel;
  trustScore: number;
  createdAt: string;
}

export type TrustLevel = 'consultant' | 'advisor' | 'manager' | 'executive';

// ============================================
// Biometric Data
// ============================================

export interface BiometricData {
  hrvMs: number;
  bpm: number;
  timestamp: string;
  source: 'apple_watch' | 'manual';
}

export interface BiometricReading extends BiometricData {
  id: string;
  stressScore: number;
  state: LifeState;
  interventionNeeded: boolean;
  createdAt: string;
}

// ============================================
// Life States
// ============================================

export type LifeState =
  | 'sleeping'
  | 'exercising'
  | 'working'
  | 'meeting'
  | 'leisure'
  | 'stressed';

export interface CurrentState {
  state: LifeState;
  hrvMs: number;
  bpm: number;
  stressScore: number;
  lastUpdated: string;
  context: ContextPayload;
}

// ============================================
// Context
// ============================================

export interface ContextPayload {
  location?: string;
  nextEvent?: string;
  nextEventTime?: string;
  calendarEvents?: CalendarEvent[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: number;
  isFocusTime: boolean;
}

// ============================================
// Conversations & Memory
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  biometricSnapshot?: BiometricData;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Interventions
// ============================================

export type InterventionType =
  | 'breathing_exercise'
  | 'movement_break'
  | 'hydration_reminder'
  | 'energy_management';

export type InterventionPriority = 'critical' | 'important' | 'nice_to_have';

export interface Intervention {
  id: string;
  type: InterventionType;
  priority: InterventionPriority;
  message: string;
  confidence: number;
  triggerReason: string;
  biometricValues: BiometricData;
  createdAt: string;
  userResponse?: 'accepted' | 'dismissed' | 'snoozed';
}

// ============================================
// API Responses
// ============================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// Voice Pipeline
// ============================================

export interface TranscriptionResult {
  text: string;
  confidence: number;
  durationMs: number;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  biometricContext?: BiometricData;
}
