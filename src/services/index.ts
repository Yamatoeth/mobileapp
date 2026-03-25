/**
 * Services Index
 * Central export for all service modules
 */

// API & Backend
export { default as apiClient, ApiError } from './apiClient';

// Audio
export {
  audioRecordingService,
  AudioRecordingService,
  type RecordingResult,
  type AudioLevel,
  type RecordingState,
} from './audioRecording';

// Health
// HealthKit removed in Phase 1 pivot — health service omitted

// Storage
export * from './storage';

// Playback
export {
  audioPlaybackService,
  AudioPlaybackService,
} from './textToSpeech';

// Voice Pipeline (backend-owned STT → LLM → TTS)
export {
  voicePipelineService,
  VoicePipelineService,
  ConversationHistory,
  type PipelineState,
  type PipelineResponse,
  type PipelineCallbacks,
  type PipelineOptions,
} from './voicePipeline';

// State Machine
// State machine removed — stateMachine service omitted

// Calendar service removed in Phase 1 pivot — frontend calendar hooks/types are feature-flagged

// Location
export {
  locationService,
  type LocationType,
  type Coordinates,
  type LocationInfo,
  type AddressInfo,
  type SavedLocation,
  type LocationChangeEvent,
} from './locationService';

// Context Aggregation (server-backed)
export { default as contextService, getServerContext } from './contextService';

// WebSocket client for backend voice transport
export { default as WSClient } from './wsClient';
