import { useEffect, useRef, useState } from 'react';
import WSClient from '../services/wsClient';
import { audioRecordingService } from '../services/audioRecording';
import * as FileSystem from 'expo-file-system/legacy';
import { audioPlaybackService } from '../services/textToSpeech';

type VoiceState = 'idle' | 'connecting' | 'connected' | 'recording' | 'sending' | 'error';

interface UseVoiceStreamOptions {
  userId: string;
  apiBaseUrl?: string;
  onReady?: () => void;
  onAck?: () => void;
  onSTT?: (transcript: string | null) => void;
  onContextBuilt?: () => void;
  onLLMChunk?: (chunk: string) => void;
  onLLMDone?: (full: string) => void;
  onTTS?: (base64Audio: string) => void;
  onTTSComplete?: () => void;
  onError?: (err: any) => void;
  onMemoryUpdate?: (data: any) => void;
  chunkSize?: number; // base64 chunk size
}

export default function useVoiceStream(opts: UseVoiceStreamOptions) {
  const {
    userId,
    apiBaseUrl,
    onReady,
    onAck,
    onSTT,
    onContextBuilt,
    onLLMChunk,
    onLLMDone,
    onTTS,
    onTTSComplete,
    onError,
    onMemoryUpdate,
    chunkSize = 64 * 1024,
  } = opts;

  const wsRef = useRef<WSClient | null>(null);
  const ttsChunksRef = useRef<string[]>([]);
  const [state, setState] = useState<VoiceState>('idle');
  const [level, setLevel] = useState<number>(0);

  useEffect(() => {
    // subscribe to memory updates (SSE) if provided
    let unsub: (() => void) | null = null;
    try {
      // lazy import to avoid adding dependency at top
      const useMemory = require('./useMemory').default;
      const mem = useMemory(apiBaseUrl);
      if (onMemoryUpdate) {
        unsub = mem.subscribe(userId, (data: any) => onMemoryUpdate && onMemoryUpdate(data));
      }
    } catch (e) {
      // ignore if SSE not supported
    }

    return () => {
      // cleanup on unmount
      wsRef.current?.disconnect();
      wsRef.current = null;
      if (unsub) unsub();
    };
  }, []);

  async function connect() {
    if (wsRef.current) return;
    setState('connecting');
    try {
      const client = new WSClient(apiBaseUrl);
      await client.connect(userId);
      client.onMessage((msg) => {
        handleMessage(msg);
      });
      wsRef.current = client;
      setState('connected');
      onReady && onReady();
    } catch (err) {
      setState('error');
      onError && onError(err);
    }
  }

  function disconnect() {
    wsRef.current?.disconnect();
    wsRef.current = null;
    setState('idle');
  }

  function handleMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    try {
      console.debug('[useVoiceStream] handleMessage', msg.type || msg);
    } catch (e) {}
    const t = msg.type;
    switch (t) {
      case 'ready':
        onReady && onReady();
        break;
      case 'ack_audio':
        onAck && onAck();
        break;
      case 'stt_start':
        // optionally indicate STT in progress
        break;
      case 'stt_done':
        onSTT && onSTT(msg.transcript ?? null);
        // persist transcript to memory backend
        try {
          // lazy import useMemory to avoid SSR issues
          const useMemory = require('./useMemory').default;
          const mem = useMemory(apiBaseUrl);
          if (msg.transcript) {
            mem.upsert(userId, [{ content: msg.transcript, title: 'transcript' }]).catch((err: any) => {
              console.warn('memory upsert failed', err);
            });
          }
        } catch (e) {
          // ignore
        }
        break;
      case 'context_built':
        onContextBuilt && onContextBuilt();
        break;
      case 'llm_chunk':
        onLLMChunk && onLLMChunk(msg.data);
        break;
      case 'llm_done':
        onLLMDone && onLLMDone(msg.content || '');
        break;
      case 'tts_audio_base64':
        // Play received base64-encoded audio (mp3) via expo-av playback
        (async () => {
          try {
            const b64 = msg.data as string;
            onTTS && onTTS(b64);
            // Write to cache and play
            const fileName = `tts_${Date.now()}.mp3`;
            const uri = `${FileSystem.cacheDirectory}${fileName}`;
            console.log('[useVoiceStream] Writing TTS base64 to', uri, 'size=', b64.length);
            await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
            console.log('[useVoiceStream] Written TTS file, initializing playback');
            await audioPlaybackService.initialize();
            console.log('[useVoiceStream] Playing TTS file', uri);
            await audioPlaybackService.play(
              uri,
              () => {
                console.log('[useVoiceStream] TTS playback complete', uri);
                try {
                  onTTSComplete && onTTSComplete();
                } catch (e) {}
                // cleanup after playback
                try {
                  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                } catch (e) {}
              },
              (err) => {
                console.warn('TTS playback error', err);
                try {
                  onTTSComplete && onTTSComplete();
                } catch (e) {}
              }
            );
          } catch (e) {
            console.warn('Failed to play TTS audio from websocket', e);
          }
        })();
        break;
      case 'tts_audio_chunk':
        try {
          const chunk = msg.data as string;
          // collect chunks in memory until done
          ttsChunksRef.current.push(chunk);
          console.debug('[useVoiceStream] Collected tts chunk, total_chunks=', ttsChunksRef.current.length, 'chunk_len=', chunk.length);
        } catch (e) {
          console.warn('Failed to collect tts chunk', e);
        }
        break;
      case 'tts_audio_done':
        // assemble collected chunks and play as a single mp3 file
        (async () => {
          try {
            const all = ttsChunksRef.current.join('');
            const count = ttsChunksRef.current.length;
            ttsChunksRef.current = [];
            console.log('[useVoiceStream] Assembling TTS stream, chunks=', count, 'total_len=', all.length);
            if (!all) {
              onTTSComplete && onTTSComplete();
              return;
            }
            onTTS && onTTS(all);
            const fileName = `tts_${Date.now()}.mp3`;
            const uri = `${FileSystem.cacheDirectory}${fileName}`;
            console.log('[useVoiceStream] Writing assembled TTS to', uri);
            await FileSystem.writeAsStringAsync(uri, all, { encoding: FileSystem.EncodingType.Base64 });
            console.log('[useVoiceStream] Written assembled TTS, initializing playback');
            await audioPlaybackService.initialize();
            console.log('[useVoiceStream] Playing assembled TTS file', uri);
            await audioPlaybackService.play(
              uri,
              () => {
                console.log('[useVoiceStream] Assembled TTS playback complete', uri);
                try {
                  onTTSComplete && onTTSComplete();
                } catch (e) {}
                try {
                  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                } catch (e) {}
              },
              (err) => {
                console.warn('TTS playback error', err);
                try {
                  onTTSComplete && onTTSComplete();
                } catch (e) {}
              }
            );
          } catch (e) {
            console.warn('Failed to assemble/play TTS stream', e);
            try {
              onTTSComplete && onTTSComplete();
            } catch (ee) {}
          }
        })();
        break;
      case 'final_text':
        onLLMDone && onLLMDone(msg.text || '');
        break;
      case 'error':
        onError && onError(msg.message || msg);
        setState('error');
        break;
      default:
        // ignore other message types
        break;
    }
  }

  async function startRecording() {
    if (!wsRef.current) {
      await connect();
    }
    try { console.log('[useVoiceStream] startRecording -> invoking audioRecordingService.startRecording'); } catch (e) {}
    const started = await audioRecordingService.startRecording((lvl) => {
      setLevel(lvl.level);
    });
    if (started) setState('recording');
    return started;
  }

  async function stopRecording({ deleteAfterSend = true } = {}) {
    if (state !== 'recording') return;
    setState('sending');
    try {
      const result = await audioRecordingService.stopRecording();
      if (!result || !result.uri) {
        setState('connected');
        return;
      }

      const b64 = await audioRecordingService.getRecordingAsBase64(result.uri);
      if (!b64) {
        setState('connected');
        return;
      }

      // split into chunks to avoid huge frames
      let idx = 0;
      for (let i = 0; i < b64.length; i += chunkSize) {
        const chunk = b64.slice(i, i + chunkSize);
        try {
          try { console.log('[useVoiceStream] sending chunk', idx, 'len=', chunk.length); } catch (e) {}
          wsRef.current?.sendAudioBase64(chunk);
          // small pause to avoid flooding
          await new Promise((r) => setTimeout(r, 50));
        } catch (err) {
          try { console.warn('[useVoiceStream] Failed sending audio chunk', err); } catch (e) {}
        }
        idx += 1;
      }

      // signal final
      try { console.log('[useVoiceStream] sending final marker'); } catch (e) {}
      wsRef.current?.sendFinal();

      if (deleteAfterSend) {
        await audioRecordingService.deleteRecording(result.uri);
      }

      setState('connected');
    } catch (err) {
      setState('error');
      onError && onError(err);
    }
  }

  async function cancelRecording() {
    await audioRecordingService.cancelRecording();
    setState('connected');
  }

  return {
    state,
    level,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
