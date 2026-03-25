/**
 * useVoiceAssistant - Hook for end-to-end voice interaction with J.A.R.V.I.S.
 * Integrates STT → LLM → TTS pipeline with biometric context
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import {
  voicePipelineService,
  PipelineState,
  PipelineResponse,
  PipelineOptions,
} from '../services/voicePipeline';

// ============================================
// Types
// ============================================

export interface UseVoiceAssistantResult {
  // State
  state: PipelineState;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isReady: boolean;
  error: string | null;

  // Data
  transcript: string;
  response: string;
  streamingResponse: string;
  audioLevel: number;
  lastLatency: number | null;

  // Actions
  startListening: () => Promise<void>;
  stopListening: () => Promise<PipelineResponse | null>;
  cancel: () => Promise<void>;
  sendText: (text: string) => Promise<PipelineResponse | null>;
  clearHistory: () => void;
  initialize: () => Promise<boolean>;
}

export interface UseVoiceAssistantOptions {
  streamLLM?: boolean;
  playAudio?: boolean;
  includeContext?: boolean;
  onTranscript?: (transcript: string) => void;
  onResponse?: (response: string) => void;
  onComplete?: (result: PipelineResponse) => void;
  onError?: (error: Error) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useVoiceAssistant(
  options: UseVoiceAssistantOptions = {}
): UseVoiceAssistantResult {
  const {
    streamLLM = false,
    playAudio = true,
    onTranscript,
    onResponse,
    onComplete,
    onError,
  } = options;

  // State
  const [state, setState] = useState<PipelineState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // User id from settings (used to request server context)
  const userId = useSettingsStore((s) => s.userId);

  // Refs for callbacks to avoid stale closures
  const onTranscriptRef = useRef(onTranscript);
  const onResponseRef = useRef(onResponse);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onResponseRef.current = onResponse;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onTranscript, onResponse, onComplete, onError]);

  // Initialize
  const initialize = useCallback(async (): Promise<boolean> => {
    if (isInitialized) return true;

    const success = await voicePipelineService.initialize();
    setIsInitialized(success);
    return success;
  }, [isInitialized]);

  // Set up callbacks on mount
  useEffect(() => {
    voicePipelineService.setCallbacks({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'idle') {
          setStreamingResponse('');
        }
        if (newState === 'error') {
          // Error state will be set by onError callback
        }
      },
      onTranscript: (text) => {
        setTranscript(text);
        onTranscriptRef.current?.(text);
      },
      onResponse: (text) => {
        setResponse(text);
        setStreamingResponse('');
        onResponseRef.current?.(text);
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onError: (err) => {
        setError(err.message);
        onErrorRef.current?.(err);
        // Clear error after delay
        setTimeout(() => setError(null), 5000);
      },
      onComplete: (result) => {
        setLastLatency(result.totalTimeMs);
        onCompleteRef.current?.(result);
      },
      onStreamChunk: (chunk) => {
        setStreamingResponse((prev) => prev + chunk);
      },
    });

    // Initialize on mount
    initialize();

    return () => {
      // Cleanup
      voicePipelineService.setCallbacks({});
    };
  }, [initialize]);

  // Start listening
  const startListening = useCallback(async (): Promise<void> => {
    setError(null);
    setTranscript('');
    setResponse('');
    setStreamingResponse('');
    await voicePipelineService.startListening();
  }, []);

  // Stop listening and process
  const stopListening = useCallback(async (): Promise<PipelineResponse | null> => {
    const pipelineOptions: PipelineOptions = {
      userId: userId ?? undefined,
      streamLLM,
      playAudio,
    };

    return await voicePipelineService.stopListening(pipelineOptions);
  }, [userId, streamLLM, playAudio]);

  // Cancel
  const cancel = useCallback(async (): Promise<void> => {
    await voicePipelineService.cancel();
    setStreamingResponse('');
  }, []);

  // Send text directly
  const sendText = useCallback(
    async (text: string): Promise<PipelineResponse | null> => {
      setError(null);
      setTranscript(text);
      setResponse('');
      setStreamingResponse('');

      const pipelineOptions: PipelineOptions = {
        userId: userId ?? undefined,
        streamLLM,
        playAudio,
      };

      return await voicePipelineService.processText(text, pipelineOptions);
    },
    [userId, streamLLM, playAudio]
  );

  // Clear history
  const clearHistory = useCallback((): void => {
    voicePipelineService.clearHistory();
  }, []);

  // Derived state
  const isListening = state === 'listening';
  const isProcessing = state === 'transcribing' || state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isReady = isInitialized && state === 'idle';

  return {
    // State
    state,
    isListening,
    isProcessing,
    isSpeaking,
    isReady,
    error,

    // Data
    transcript,
    response,
    streamingResponse,
    audioLevel,
    lastLatency,

    // Actions
    startListening,
    stopListening,
    cancel,
    sendText,
    clearHistory,
    initialize,
  };
}

export default useVoiceAssistant;
