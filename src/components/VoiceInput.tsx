/**
 * VoiceInput - Complete voice input component with recording and transcription
 * Integrates recording, STT, and displays real-time feedback
 */
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { HoldToTalkButton } from './HoldToTalkButton';
import { RecordingResult } from '../services/audioRecording';
import { speechToTextService, TranscriptionResult } from '../services/speechToText';

// ============================================
// Types
// ============================================

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showTranscript?: boolean;
}

// ============================================
// Component
// ============================================

export function VoiceInput({
  onTranscription,
  onError,
  placeholder = 'Tap and hold to speak',
  disabled = false,
  showTranscript = true,
}: VoiceInputProps) {
  const { isDark } = useTheme();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Animation for transcript appearance
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animate transcript in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: transcript || isTranscribing ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [transcript, isTranscribing, fadeAnim]);

  // Handle recording complete
  const handleRecordingComplete = useCallback(
    async (result: RecordingResult) => {
      setIsTranscribing(true);
      setError(null);
      setTranscript('');

      try {
        const transcriptionResult = await speechToTextService.transcribeAuto(result.uri);

        if (transcriptionResult.text) {
          setTranscript(transcriptionResult.text);
          onTranscription(transcriptionResult.text);
        } else {
          setError('No speech detected');
          onError?.('No speech detected');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscription, onError]
  );

  // Handle recording start
  const handleRecordingStart = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  // Handle recording cancel
  const handleRecordingCancel = useCallback(() => {
    // Recording was too short
  }, []);

  // Handle errors
  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError]
  );

  return (
    <View className="items-center">
      {/* Transcription Display */}
      {showTranscript && (
        <Animated.View
          style={{ opacity: fadeAnim }}
          className="w-full mb-6"
        >
          <View
            className={`p-4 rounded-2xl min-h-[60px] ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}
          >
            {isTranscribing ? (
              <View className="flex-row items-center gap-3">
                <ActivityIndicator
                  size="small"
                  color={isDark ? '#60a5fa' : '#3b82f6'}
                />
                <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  Transcribing...
                </Text>
              </View>
            ) : error ? (
              <View className="flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text className="text-red-500 flex-1">{error}</Text>
              </View>
            ) : transcript ? (
              <Text
                className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                {transcript}
              </Text>
            ) : (
              <Text className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                {placeholder}
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Hold to Talk Button */}
      <HoldToTalkButton
        onRecordingComplete={handleRecordingComplete}
        onRecordingStart={handleRecordingStart}
        onRecordingCancel={handleRecordingCancel}
        onError={handleError}
        disabled={disabled || isTranscribing}
      />

      {/* Status Indicator */}
      <View className="flex-row items-center mt-4 gap-2">
        <View
          className={`w-2 h-2 rounded-full ${
            isTranscribing
              ? 'bg-blue-500'
              : error
              ? 'bg-red-500'
              : transcript
              ? 'bg-green-500'
              : isDark
              ? 'bg-gray-600'
              : 'bg-gray-300'
          }`}
        />
        <Text
          className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {isTranscribing
            ? 'Processing speech'
            : error
            ? 'Error occurred'
            : transcript
            ? 'Ready'
            : 'Waiting for input'}
        </Text>
      </View>
    </View>
  );
}

/**
 * VoiceInputCompact - Minimal voice input for inline use
 */
interface VoiceInputCompactProps {
  onTranscription: (text: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export function VoiceInputCompact({
  onTranscription,
  onRecordingStateChange,
  disabled = false,
  size = 'medium',
}: VoiceInputCompactProps) {
  const { isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const buttonSize = size === 'small' ? 40 : 48;
  const iconSize = size === 'small' ? 18 : 22;

  const handleRecordingComplete = useCallback(
    async (result: RecordingResult) => {
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setIsTranscribing(true);

      try {
        const transcriptionResult = await speechToTextService.transcribeAuto(result.uri);
        if (transcriptionResult.text) {
          onTranscription(transcriptionResult.text);
        }
      } catch (error) {
        console.error('Transcription error:', error);
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscription, onRecordingStateChange]
  );

  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    onRecordingStateChange?.(true);
  }, [onRecordingStateChange]);

  return (
    <View
      style={{
        width: buttonSize,
        height: buttonSize,
        borderRadius: buttonSize / 2,
        backgroundColor: isRecording
          ? '#ef4444'
          : isTranscribing
          ? '#3b82f6'
          : isDark
          ? '#374151'
          : '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isTranscribing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <HoldToTalkButton
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingCancel={() => {
            setIsRecording(false);
            onRecordingStateChange?.(false);
          }}
          disabled={disabled}
        />
      )}
    </View>
  );
}
