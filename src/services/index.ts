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

// Location/calendar/health surfaces are intentionally absent from Phase 1.

// Context Aggregation (server-backed)
export { default as contextService, getServerContext } from './contextService';

// WebSocket client for backend voice transport
export { default as WSClient } from './wsClient';
