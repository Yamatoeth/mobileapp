import { useEffect, useRef, useState } from 'react';
import WSClient from '../services/wsClient';
import { audioRecordingService } from '../services/audioRecording';

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
    onError,
    onMemoryUpdate,
    chunkSize = 64 * 1024,
  } = opts;

  const wsRef = useRef<WSClient | null>(null);
  const [state, setState] = useState<VoiceState>('idle');
  const [level, setLevel] = useState<number>(0);

  useEffect(() => {
    // subscribe to memory updates (SSE) if provided
    let unsub: (() => void) | null = null;
    try {
      // lazy import to avoid adding dependency at top
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
          // eslint-disable-next-line @typescript-eslint/no-var-requires
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
        onTTS && onTTS(msg.data);
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
      for (let i = 0; i < b64.length; i += chunkSize) {
        const chunk = b64.slice(i, i + chunkSize);
        try {
          wsRef.current?.sendAudioBase64(chunk);
          // small pause to avoid flooding
          await new Promise((r) => setTimeout(r, 50));
        } catch (err) {
          console.warn('Failed sending audio chunk', err);
        }
      }

      // signal final
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
