/**
 * Audio Recording Service - Handles microphone recording for voice input
 * Uses expo-av for recording and file management
 */
// Import `Audio` from `expo-av` at runtime to avoid type/export mismatches across SDKs
const { Audio }: any = require('expo-av')
// Expo types may vary across SDK versions; use flexible aliases here
type ExpoRecordingOptions = any
type ExpoRecording = any
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================
// Types
// ============================================

export interface RecordingResult {
  uri: string;
  durationMs: number;
  fileSize: number;
}

export interface AudioLevel {
  level: number; // 0-1 normalized
  timestamp: number;
}

export type RecordingState = 'idle' | 'preparing' | 'recording' | 'stopping';

// ============================================
// Recording Options
// ============================================

// Capture in the mobile-native container so Groq STT receives a valid file.
const RECORDING_OPTIONS: ExpoRecordingOptions = {
  isMeteringEnabled: true,
  android: Audio?.RECORDING_OPTIONS_PRESET_HIGH_QUALITY?.android || {
    extension: '.m4a',
    outputFormat: Audio?.AndroidOutputFormat?.MPEG_4 ?? 2,
    audioEncoder: Audio?.AndroidAudioEncoder?.AAC ?? 3,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: Audio?.RECORDING_OPTIONS_PRESET_HIGH_QUALITY?.ios || {
    extension: '.m4a',
    outputFormat: Audio?.IOSOutputFormat?.MPEG4AAC ?? 'aac ',
    audioQuality: Audio?.IOSAudioQuality?.HIGH ?? 96,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

// ============================================
// Audio Recording Service Class
// ============================================

class AudioRecordingService {
  private recording: ExpoRecording | null = null;
  private state: RecordingState = 'idle';
  private starting: boolean = false;
  private startTime: number = 0;
  private levelUpdateCallback: ((level: AudioLevel) => void) | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;

  getLastError(): string | null {
    return this.lastError;
  }

  private async cleanupRecordingInstance(recording: ExpoRecording | null): Promise<void> {
    if (!recording) return;

    try {
      recording.setOnRecordingStatusUpdate?.(null);
    } catch (error) {
      // Best effort: some Expo AV states do not allow clearing the callback.
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch (error) {
      // Best effort: startAsync may have failed before recording actually started.
    }
  }

  private async resetAudioMode(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    }).catch(() => undefined);
  }

  private async createStartedRecording(
    onLevelUpdate?: (level: AudioLevel) => void,
    traceId: string = 'no-trace'
  ): Promise<ExpoRecording> {
    if (typeof Audio.Recording?.createAsync === 'function') {
      console.log('[audioRecording] Recording.createAsync start', { traceId });
      const created = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        onLevelUpdate
          ? (status: { isRecording?: boolean; metering?: number }) => {
              if (status.isRecording && status.metering !== undefined) {
                onLevelUpdate({
                  level: Math.max(0, Math.min(1, (status.metering + 60) / 60)),
                  timestamp: Date.now(),
                });
              }
            }
          : undefined,
        100
      );
      console.log('[audioRecording] Recording.createAsync done', { traceId });
      return created.recording;
    }

    const recording = new Audio.Recording();
    try {
      console.log('[audioRecording] prepareToRecordAsync start', { traceId });
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      console.log('[audioRecording] prepareToRecordAsync done', { traceId });

      console.log('[audioRecording] startAsync start', { traceId });
      await recording.startAsync();
      console.log('[audioRecording] startAsync done', { traceId });
      return recording;
    } catch (error) {
      await this.cleanupRecordingInstance(recording);
      throw error;
    }
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('[audioRecording] requestPermissions: requesting');
      const { status } = await Audio.requestPermissionsAsync();
      console.log('[audioRecording] requestPermissions: status=', status);
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request audio permissions:', error);
      return false;
    }
  }

  /**
   * Check if microphone permission is granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      console.log('[audioRecording] hasPermissions:', status);
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check audio permissions:', error);
      return false;
    }
  }

  /**
   * Configure audio mode for recording
   */
  private async configureAudioMode(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.InterruptionModeIOS?.DO_NOT_MIX ?? 1,
      interruptionModeAndroid: Audio.InterruptionModeAndroid?.DO_NOT_MIX ?? 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    })
  }

  /**
   * Start recording audio
   */
  async startRecording(
    onLevelUpdate?: (level: AudioLevel) => void,
    options?: { traceId?: string }
  ): Promise<boolean> {
    const traceId = options?.traceId || 'no-trace'
    let recording: ExpoRecording | null = null;
    this.lastError = null;

    if (Platform?.OS === 'ios' && Constants.isDevice === false) {
      this.lastError = 'iOS Simulator does not support microphone recording. Use the text input here, or test voice on a physical iPhone.';
      console.warn('[audioRecording] iOS Simulator microphone recording is not supported', { traceId });
      return false;
    }

    // Prevent concurrent starts
    if (this.starting) {
      console.warn('[audioRecording] startRecording already in progress (starting)', { traceId });
      // Treat repeated start requests during preparation as successful/no-op
      return true;
    }

    // If already recording, treat as idempotent success
    if (this.state === 'recording') {
      console.log('[audioRecording] startRecording called but already recording');
      return true;
    }

    // If there's a leftover recording instance, ensure it's stopped/unloaded first
    if (this.recording) {
      try {
        console.log('[audioRecording] stop/unload leftover recording before starting new one');
        await this.cleanupRecordingInstance(this.recording);
      } catch (err) {
        console.warn('[audioRecording] Error stopping leftover recording', err);
      } finally {
        this.recording = null;
        this.state = 'idle';
      }
    }

    // Check permissions
    const hasPermission = await this.hasPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        this.lastError = 'Microphone permission denied.';
        console.error('Microphone permission denied');
        return false;
      }
    }

    try {
      this.starting = true;
      this.state = 'preparing';
      this.levelUpdateCallback = onLevelUpdate || null;
      console.log('[audioRecording] startRecording prepare', { traceId });

      // Configure audio mode
      console.log('[audioRecording] configuring audio mode');
      await this.configureAudioMode();

      try {
        recording = await this.createStartedRecording(onLevelUpdate, traceId);
      } catch (startError) {
        console.warn('[audioRecording] first start attempt failed, retrying once', startError);
        await this.cleanupRecordingInstance(recording);
        recording = null;
        await this.resetAudioMode();
        await new Promise((resolve) => setTimeout(resolve, 250));
        await this.configureAudioMode();
        recording = await this.createStartedRecording(onLevelUpdate, traceId);
      }

      this.recording = recording;
      this.state = 'recording';
      this.startTime = Date.now();
      this.starting = false;

      // Start level monitoring if callback provided
      if (onLevelUpdate) {
        this.startLevelMonitoring();
      }

      console.log('[audioRecording] Recording started', { traceId });
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.lastError = error instanceof Error ? error.message : 'Failed to start recording.';
      this.stopLevelMonitoring();
      await this.cleanupRecordingInstance(recording);
      await this.resetAudioMode();
      this.state = 'idle';
      this.recording = null;
      this.starting = false;
      return false;
    }
  }

  /**
   * Start monitoring audio levels
   */
  private startLevelMonitoring(): void {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
    }

    this.levelInterval = setInterval(async () => {
      if (this.recording && this.state === 'recording' && this.levelUpdateCallback) {
        try {
          const status = await this.recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // Convert dB to 0-1 range (metering is typically -160 to 0 dB)
            const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            this.levelUpdateCallback({
              level: normalizedLevel,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Ignore errors during level monitoring
        }
      }
    }, 100); // Update every 100ms
  }

  /**
   * Stop level monitoring
   */
  private stopLevelMonitoring(): void {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    this.levelUpdateCallback = null;
  }

  /**
   * Stop recording and return the result
   */
  async stopRecording(): Promise<RecordingResult | null> {
    if (this.state !== 'recording' || !this.recording) {
      console.warn('No recording in progress');
      return null;
    }

    try {
      this.state = 'stopping';
      this.stopLevelMonitoring();

      // Stop and unload recording
      await this.recording.stopAndUnloadAsync();

      // Get recording info
      const uri = this.recording.getURI();
      const durationMs = Date.now() - this.startTime;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists ? (fileInfo.size || 0) : 0;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      this.recording = null;
      this.state = 'idle';

      console.log(`[audioRecording] Recording stopped: ${durationMs}ms, ${fileSize} bytes, uri=${uri}`);

      return {
        uri,
        durationMs,
        fileSize,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = null;
      this.state = 'idle';
      return null;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    if (!this.recording) {
      return;
    }

    try {
      this.stopLevelMonitoring();
      await this.recording.stopAndUnloadAsync();

      // Delete the recording file
      const uri = this.recording.getURI();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    } finally {
      this.recording = null;
      this.state = 'idle';
    }
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  /**
   * Get current recording duration in milliseconds
   */
  getCurrentDuration(): number {
    if (this.state !== 'recording') {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Read recording file as base64
   */
  async getRecordingAsBase64(uri: string): Promise<string | null> {
    try {
      console.log('[audioRecording] Reading recording as base64 from', uri);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      console.log('[audioRecording] Read base64 length=', base64?.length || 0);
      return base64;
    } catch (error) {
      console.error('Failed to read recording as base64:', error);
      return null;
    }
  }

  /**
   * Delete a recording file
   */
  async deleteRecording(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  }
}

// Export singleton instance
export const audioRecordingService = new AudioRecordingService();

// Export class for testing
export { AudioRecordingService };
