/**
 * HoldToTalkButton - Press and hold to record voice input
 * Features waveform animation and visual feedback
 */
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { audioRecordingService, AudioLevel, RecordingResult } from '../services/audioRecording';

// ============================================
// Types
// ============================================

interface HoldToTalkButtonProps {
  onRecordingComplete: (result: RecordingResult) => void;
  onRecordingStart?: () => void;
  onRecordingCancel?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

// ============================================
// Waveform Bar Component
// ============================================

interface WaveformBarProps {
  level: number;
  index: number;
  isDark: boolean;
  isActive: boolean;
}

function WaveformBar({ level, index, isDark, isActive }: WaveformBarProps) {
  const animatedHeight = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    if (isActive) {
      // Animate to new height based on level
      const targetHeight = 4 + level * 28; // 4-32px range
      Animated.spring(animatedHeight, {
        toValue: targetHeight,
        friction: 8,
        tension: 100,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animatedHeight, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [level, isActive, animatedHeight]);

  // Add slight delay for wave effect
  const delay = index * 50;

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        {
          height: animatedHeight,
          backgroundColor: isActive
            ? '#ef4444'
            : isDark
            ? '#374151'
            : '#d1d5db',
          transform: [{ translateY: delay > 0 ? delay / 100 : 0 }],
        },
      ]}
    />
  );
}

// ============================================
// Main Component
// ============================================

export function HoldToTalkButton({
  onRecordingComplete,
  onRecordingStart,
  onRecordingCancel,
  onError,
  disabled = false,
  minDurationMs = 500,
  maxDurationMs = 60000,
}: HoldToTalkButtonProps) {
  const { isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const [duration, setDuration] = useState(0);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (maxDurationTimeout.current) clearTimeout(maxDurationTimeout.current);
    };
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isRecording, pulseAnim]);

  // Handle audio level updates
  const handleLevelUpdate = useCallback((level: AudioLevel) => {
    setAudioLevels((prev) => {
      const newLevels = [...prev.slice(1), level.level];
      return newLevels;
    });
  }, []);

  // Start recording
  const handlePressIn = useCallback(async () => {
    if (disabled || isRecording) return;


    // Haptic feedback on press in
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPressing(true);

    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Start recording
    try {
      const success = await audioRecordingService.startRecording(handleLevelUpdate);
      if (success) {
        console.log('[PIPELINE 1/7] 🎙️ Recording started — expo-av capturing audio');
        setIsRecording(true);
        startTime.current = Date.now();
        onRecordingStart?.();

        // Start duration counter
        durationInterval.current = setInterval(() => {
          setDuration(Date.now() - startTime.current);
        }, 100);

        // Set max duration timeout
        maxDurationTimeout.current = setTimeout(() => {
          handlePressOut();
        }, maxDurationMs);
      } else {
        setIsPressing(false);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }).start();
        console.warn('[PIPELINE ERROR ❌] Failed at step 1 — Failed to start recording. Check microphone permissions.');
        onError?.('Failed to start recording. Check microphone permissions.');
      }
    } catch (err) {
      setIsPressing(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
      console.warn('[PIPELINE ERROR ❌] Failed at step 1', err);
      onError?.('Failed to start recording.');
    }
  }, [disabled, isRecording, handleLevelUpdate, onRecordingStart, onError, scaleAnim, maxDurationMs]);

  // Stop recording
  const handlePressOut = useCallback(async () => {
    if (!isRecording) {
      setIsPressing(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
      return;
    }

    setIsPressing(false);
    // Haptic feedback on release
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRecording(false);
    setAudioLevels([0, 0, 0, 0, 0]);

    // Clear timers
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (maxDurationTimeout.current) {
      clearTimeout(maxDurationTimeout.current);
      maxDurationTimeout.current = null;
    }

    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Check minimum duration
    const recordingDuration = Date.now() - startTime.current;
    if (recordingDuration < minDurationMs) {
      await audioRecordingService.cancelRecording();
      onRecordingCancel?.();
      setDuration(0);
      return;
    }

    // Stop and get result
    try {
      const result = await audioRecordingService.stopRecording();
      setDuration(0);
      console.log('[PIPELINE 2/7] 📡 Recording stopped — final audio sent to backend');
      if (result) {
        onRecordingComplete(result);
      } else {
        console.warn('[PIPELINE ERROR ❌] Failed at step 2 — Failed to save recording');
        onError?.('Failed to save recording');
      }
    } catch (err) {
      setDuration(0);
      console.warn('[PIPELINE ERROR ❌] Failed at step 2', err);
      onError?.('Failed to save recording');
    }
  }, [isRecording, minDurationMs, onRecordingComplete, onRecordingCancel, onError, scaleAnim]);

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate pulse opacity
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });

  return (
    <View className="items-center">
      {/* Duration display */}
      {isRecording && (
        <View className="mb-3">
          <Text
            className={`text-sm font-medium ${
              isDark ? 'text-red-400' : 'text-red-500'
            }`}
          >
            {formatDuration(duration)}
          </Text>
        </View>
      )}

      {/* Waveform */}
      <View className="flex-row items-center gap-1 h-10 mb-4">
        {audioLevels.map((level, index) => (
          <WaveformBar
            key={index}
            level={level}
            index={index}
            isDark={isDark}
            isActive={isRecording}
          />
        ))}
      </View>

      {/* Button */}
      <View className="relative">
        {/* Pulse ring */}
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                opacity: pulseOpacity,
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.5],
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          <Animated.View
            style={[
              styles.button,
              {
                backgroundColor: isRecording || isPressing ? '#ef4444' : isDark ? '#374151' : '#e5e7eb',
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={32}
              color={isRecording || isPressing ? '#fff' : isDark ? '#9ca3af' : '#6b7280'}
            />
          </Animated.View>
        </Pressable>
      </View>

      {/* Instructions */}
      <Text
        className={`mt-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {isRecording ? 'Release to stop' : 'Hold to talk'}
      </Text>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  waveformBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ef4444',
  },
});
