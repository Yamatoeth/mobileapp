/**
 * useSpeechRecognition - Hook for voice input with STT
 * Handles recording, transcription, and state management
 */
import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { audioRecordingService, RecordingResult, AudioLevel } from '../services/audioRecording';
import { speechToTextService, TranscriptionResult } from '../services/speechToText';

// ============================================
// Types
// ============================================

export interface UseSpeechRecognitionResult {
  // State
  isListening: boolean;
  isTranscribing: boolean;
  isAvailable: boolean;
  error: string | null;
  
  // Data
  transcript: string;
  confidence: number;
  audioLevel: number;
  duration: number;
  
  // Actions
  startListening: () => Promise<void>;
  stopListening: () => Promise<TranscriptionResult | null>;
  cancelListening: () => Promise<void>;
  resetTranscript: () => void;
}

export interface SpeechRecognitionOptions {
  onTranscriptionStart?: () => void;
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onTranscriptionError?: (error: string) => void;
  onAudioLevel?: (level: number) => void;
  autoTranscribe?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

// ============================================
// Hook Implementation
// ============================================

export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionResult {
  const {
    onTranscriptionStart,
    onTranscriptionComplete,
    onTranscriptionError,
    onAudioLevel,
    autoTranscribe = true,
    minDurationMs = 500,
    maxDurationMs = 60000,
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs
  const startTime = useRef<number>(0);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordingUri = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (maxTimeout.current) {
      clearTimeout(maxTimeout.current);
      maxTimeout.current = null;
    }
    setAudioLevel(0);
    setDuration(0);
  }, []);

  // Handle audio level updates
  const handleAudioLevel = useCallback(
    (level: AudioLevel) => {
      setAudioLevel(level.level);
      onAudioLevel?.(level.level);
    },
    [onAudioLevel]
  );

  // Start listening
  const startListening = useCallback(async (): Promise<void> => {
    if (isListening || isTranscribing) {
      return;
    }

    setError(null);
    setTranscript('');
    setConfidence(0);

    // Check/request permissions
    const hasPermission = await audioRecordingService.hasPermissions();
    if (!hasPermission) {
      const granted = await audioRecordingService.requestPermissions();
      if (!granted) {
        const permError = 'Microphone permission denied';
        setError(permError);
        onTranscriptionError?.(permError);
        return;
      }
    }

    // Start recording
    const success = await audioRecordingService.startRecording(handleAudioLevel);

    if (!success) {
      const startError = 'Failed to start recording';
      setError(startError);
      onTranscriptionError?.(startError);
      return;
    }

    setIsListening(true);
    startTime.current = Date.now();

    // Start duration counter
    durationInterval.current = setInterval(() => {
      setDuration(Date.now() - startTime.current);
    }, 100);

    // Set max duration timeout
    maxTimeout.current = setTimeout(async () => {
      await stopListening();
    }, maxDurationMs);
  }, [isListening, isTranscribing, handleAudioLevel, maxDurationMs, onTranscriptionError]);

  // Stop listening and transcribe
  const stopListening = useCallback(async (): Promise<TranscriptionResult | null> => {
    if (!isListening) {
      return null;
    }

    cleanup();
    setIsListening(false);

    // Check minimum duration
    const recordingDuration = Date.now() - startTime.current;
    if (recordingDuration < minDurationMs) {
      await audioRecordingService.cancelRecording();
      return null;
    }

    // Stop recording
    const result = await audioRecordingService.stopRecording();

    if (!result) {
      const stopError = 'Failed to stop recording';
      setError(stopError);
      onTranscriptionError?.(stopError);
      return null;
    }

    lastRecordingUri.current = result.uri;

    // Auto-transcribe if enabled
    if (autoTranscribe) {
      setIsTranscribing(true);
      onTranscriptionStart?.();

      try {
        const transcriptionResult = await speechToTextService.transcribeAuto(result.uri);
        
        setTranscript(transcriptionResult.text);
        setConfidence(transcriptionResult.confidence);
        setIsTranscribing(false);
        
        onTranscriptionComplete?.(transcriptionResult);
        
        // Clean up audio file
        await audioRecordingService.deleteRecording(result.uri);
        
        return transcriptionResult;
      } catch (err) {
        const transcribeError = err instanceof Error ? err.message : 'Transcription failed';
        setError(transcribeError);
        setIsTranscribing(false);
        onTranscriptionError?.(transcribeError);
        return null;
      }
    }

    return null;
  }, [isListening, cleanup, minDurationMs, autoTranscribe, onTranscriptionStart, onTranscriptionComplete, onTranscriptionError]);

  // Cancel listening without transcription
  const cancelListening = useCallback(async (): Promise<void> => {
    cleanup();
    setIsListening(false);
    setIsTranscribing(false);
    await audioRecordingService.cancelRecording();
  }, [cleanup]);

  // Reset transcript
  const resetTranscript = useCallback((): void => {
    setTranscript('');
    setConfidence(0);
    setError(null);
  }, []);

  return {
    // State
    isListening,
    isTranscribing,
    isAvailable: Platform.OS === 'ios' || Platform.OS === 'android',
    error,
    
    // Data
    transcript,
    confidence,
    audioLevel,
    duration,
    
    // Actions
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
  };
}

