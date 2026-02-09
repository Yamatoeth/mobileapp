/**
 * Services Index
 * Central export for all service modules
 */

// API & Backend
export { default as apiClient, ApiError } from './apiClient';

// Audio & Voice
export {
  audioRecordingService,
  AudioRecordingService,
  type RecordingResult,
  type AudioLevel,
  type RecordingState,
} from './audioRecording';

export {
  speechToTextService,
  DeepgramService,
  WhisperService,
  SpeechToTextService,
  type TranscriptionResult,
  type TranscriptionWord,
  type STTProvider,
} from './speechToText';

// Health
export {
  healthKitService,
  HealthKitService,
  type BiometricReading,
  type HRVReading,
  type HeartRateReading,
  type SleepSample,
  type HealthKitStatus,
} from './healthKit';

// Storage & AI
export * from './storage';
export * from './ai';
