/**
 * Voice Pipeline Service
 * Thin mobile client around the backend-owned voice pipeline.
 *
 * Client responsibilities:
 * - record microphone input
 * - stream recorded audio to backend over WebSocket
 * - play returned audio
 *
 * Backend responsibilities:
 * - STT
 * - context assembly
 * - LLM generation
 * - TTS synthesis
 */
import * as FileSystem from 'expo-file-system/legacy'
import { Buffer } from 'buffer'

import { audioRecordingService } from './audioRecording'
import { audioPlaybackService } from './textToSpeech'
import WSClient from './wsClient'
import apiClient from './apiClient'

export type PipelineState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error'

export interface PipelineResponse {
  userTranscript: string
  assistantResponse: string
  transcriptionTimeMs: number
  llmTimeMs: number
  ttsTimeMs: number
  totalTimeMs: number
}

export interface PipelineCallbacks {
  onStateChange?: (state: PipelineState) => void
  onTranscript?: (transcript: string) => void
  onResponse?: (response: string) => void
  onAudioLevel?: (level: number) => void
  onError?: (error: Error) => void
  onComplete?: (result: PipelineResponse) => void
  onStreamChunk?: (chunk: string) => void
}

export interface PipelineOptions {
  userId?: string
  streamLLM?: boolean
  playAudio?: boolean
  minRecordingMs?: number
  maxRecordingMs?: number
}

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export class ConversationHistory {
  private turns: ConversationTurn[] = []
  private maxTurns = 10

  add(role: 'user' | 'assistant', content: string): void {
    this.turns.push({ role, content, timestamp: new Date() })
    if (this.turns.length > this.maxTurns) {
      this.turns = this.turns.slice(-this.maxTurns)
    }
  }

  getHistory(): { role: 'user' | 'assistant'; content: string }[] {
    return this.turns.map(({ role, content }) => ({ role, content }))
  }

  clear(): void {
    this.turns = []
  }
}

type FinalizeContext = {
  startTime: number
  transcriptStartedAt: number | null
  llmStartedAt: number | null
}

function inferAudioMetadata(uri: string): { fileName: string; mimeType: string } {
  const fileName = uri.split('/').pop() || 'audio.m4a'
  const normalized = fileName.toLowerCase()

  if (normalized.endsWith('.wav')) {
    return { fileName, mimeType: 'audio/wav' }
  }
  if (normalized.endsWith('.caf')) {
    return { fileName, mimeType: 'audio/x-caf' }
  }
  if (normalized.endsWith('.mp3')) {
    return { fileName, mimeType: 'audio/mpeg' }
  }
  if (normalized.endsWith('.m4a')) {
    return { fileName, mimeType: 'audio/mp4' }
  }

  return { fileName, mimeType: 'application/octet-stream' }
}

async function writeAudioToCache(chunks: Buffer[]): Promise<string> {
  const output = `${FileSystem.cacheDirectory}jarvis_tts_${Date.now()}.wav`
  const bytes = Buffer.concat(chunks)
  await FileSystem.writeAsStringAsync(output, bytes.toString('base64'), {
    encoding: FileSystem.EncodingType.Base64,
  })
  return output
}

export class VoicePipelineService {
  private state: PipelineState = 'idle'
  private callbacks: PipelineCallbacks = {}
  private conversationHistory = new ConversationHistory()
  private isInitialized = false

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true

    try {
      await audioPlaybackService.initialize()

      const hasPermission = await audioRecordingService.requestPermissions()
      if (!hasPermission) {
        throw new Error('Microphone permission denied')
      }

      this.isInitialized = true
      return true
    } catch (error) {
      console.error('Failed to initialize voice pipeline:', error)
      return false
    }
  }

  setCallbacks(callbacks: PipelineCallbacks): void {
    this.callbacks = callbacks
  }

  setCallback<K extends keyof PipelineCallbacks>(
    key: K,
    callback: PipelineCallbacks[K]
  ): void {
    this.callbacks[key] = callback
  }

  getState(): PipelineState {
    return this.state
  }

  private setState(state: PipelineState): void {
    this.state = state
    this.callbacks.onStateChange?.(state)
  }

  async startListening(): Promise<void> {
    if (this.state !== 'idle') {
      console.warn('Pipeline is not idle, cannot start listening')
      return
    }

    const initialized = await this.initialize()
    if (!initialized) {
      this.setState('error')
      this.callbacks.onError?.(new Error('Voice pipeline failed to initialize'))
      return
    }

    this.setState('listening')
    const ok = await audioRecordingService.startRecording((level) => {
      this.callbacks.onAudioLevel?.(level.level)
    })

    if (!ok) {
      this.setState('error')
      this.callbacks.onError?.(new Error('Failed to start recording'))
    }
  }

  async stopListening(options: PipelineOptions = {}): Promise<PipelineResponse | null> {
    if (this.state !== 'listening') {
      console.warn('Pipeline is not listening')
      return null
    }

    try {
      const recording = await audioRecordingService.stopRecording()
      if (!recording) {
        throw new Error('No recording available')
      }

      const minMs = options.minRecordingMs ?? 500
      if (recording.durationMs < minMs) {
        this.setState('idle')
        return null
      }

      return await this.sendRecordingToBackend(recording.uri, options)
    } catch (error) {
      this.setState('error')
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  async processText(text: string, options: PipelineOptions = {}): Promise<PipelineResponse | null> {
    if (!options.userId) {
      const error = new Error('userId is required for backend-owned text processing')
      this.setState('error')
      this.callbacks.onError?.(error)
      return null
    }

    try {
      const startTime = Date.now()
      this.callbacks.onTranscript?.(text)
      this.setState('thinking')

      const result = await apiClient.processQuery(options.userId, text)
      const assistantResponse = result.response || ''
      let ttsTimeMs = 0

      this.callbacks.onResponse?.(assistantResponse)
      this.conversationHistory.add('user', text)
      this.conversationHistory.add('assistant', assistantResponse)

      if (options.playAudio !== false && assistantResponse) {
        this.setState('speaking')
        const playbackStartedAt = Date.now()
        const audioBuffer = await apiClient.synthesizeSpeech(assistantResponse)
        const audioPath = await writeAudioToCache([Buffer.from(audioBuffer)])
        await new Promise<void>((resolve, reject) => {
          audioPlaybackService.play(
            audioPath,
            () => resolve(),
            (error) => reject(error)
          )
        })
        ttsTimeMs = Date.now() - playbackStartedAt
      }

      const response: PipelineResponse = {
        userTranscript: text,
        assistantResponse,
        transcriptionTimeMs: 0,
        llmTimeMs: Date.now() - startTime - ttsTimeMs,
        ttsTimeMs,
        totalTimeMs: Date.now() - startTime,
      }

      this.setState('idle')
      this.callbacks.onComplete?.(response)
      return response
    } catch (error) {
      this.setState('error')
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  async cancel(): Promise<void> {
    await audioPlaybackService.stop()
    this.setState('idle')
  }

  clearHistory(): void {
    this.conversationHistory.clear()
  }

  private async sendRecordingToBackend(
    audioUri: string,
    options: PipelineOptions
  ): Promise<PipelineResponse> {
    const userId = options.userId
    if (!userId) {
      throw new Error('userId is required for backend-owned voice processing')
    }

    const ws = new WSClient()
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const metadata = inferAudioMetadata(audioUri)
    const audioChunks: Buffer[] = []
    let transcript = ''
    let assistantResponse = ''

    const ctx: FinalizeContext = {
      startTime: Date.now(),
      transcriptStartedAt: null,
      llmStartedAt: null,
    }

    return new Promise<PipelineResponse>(async (resolve, reject) => {
      const finalize = async (shouldPlayAudio: boolean) => {
        try {
          let ttsTimeMs = 0

          if (shouldPlayAudio && audioChunks.length > 0) {
            this.setState('speaking')
            const playbackStartedAt = Date.now()
            const audioPath = await writeAudioToCache(audioChunks)
            await new Promise<void>((playResolve, playReject) => {
              audioPlaybackService.play(
                audioPath,
                () => playResolve(),
                (error) => playReject(error)
              )
            })
            ttsTimeMs = Date.now() - playbackStartedAt
          }

          this.conversationHistory.add('user', transcript)
          this.conversationHistory.add('assistant', assistantResponse)

          const response: PipelineResponse = {
            userTranscript: transcript,
            assistantResponse,
            transcriptionTimeMs: ctx.transcriptStartedAt
              ? (ctx.llmStartedAt || Date.now()) - ctx.transcriptStartedAt
              : 0,
            llmTimeMs: ctx.llmStartedAt ? Date.now() - ctx.llmStartedAt - ttsTimeMs : 0,
            ttsTimeMs,
            totalTimeMs: Date.now() - ctx.startTime,
          }

          this.setState('idle')
          this.callbacks.onComplete?.(response)
          ws.disconnect()
          unsubscribe()
          resolve(response)
        } catch (error) {
          ws.disconnect()
          unsubscribe()
          reject(error)
        }
      }

      const fail = (error: Error) => {
        this.setState('error')
        this.callbacks.onError?.(error)
        ws.disconnect()
        unsubscribe()
        reject(error)
      }

      const unsubscribe = ws.onMessage((message) => {
        try {
          switch (message?.type) {
            case 'ready':
            case 'ack_audio':
            case 'ignored':
              break
            case 'stt_start':
              this.setState('transcribing')
              ctx.transcriptStartedAt = Date.now()
              break
            case 'stt_done':
              transcript = message.transcript || ''
              this.callbacks.onTranscript?.(transcript)
              this.setState('thinking')
              ctx.llmStartedAt = Date.now()
              break
            case 'context_built':
              this.setState('thinking')
              if (!ctx.llmStartedAt) {
                ctx.llmStartedAt = Date.now()
              }
              break
            case 'llm_chunk':
              this.setState('thinking')
              if (!ctx.llmStartedAt) {
                ctx.llmStartedAt = Date.now()
              }
              if (typeof message.data === 'string') {
                assistantResponse += message.data
                this.callbacks.onStreamChunk?.(message.data)
              }
              break
            case 'llm_done':
              if (typeof message.content === 'string') {
                assistantResponse = message.content
                this.callbacks.onResponse?.(assistantResponse)
              }
              break
            case 'tts_audio_chunk':
              if (typeof message.data === 'string') {
                audioChunks.push(Buffer.from(message.data, 'base64'))
              }
              break
            case 'tts_audio_base64':
              if (typeof message.data === 'string') {
                audioChunks.length = 0
                audioChunks.push(Buffer.from(message.data, 'base64'))
              }
              void finalize(options.playAudio !== false)
              break
            case 'tts_audio_done':
              void finalize(options.playAudio !== false)
              break
            case 'final_text':
              if (typeof message.text === 'string') {
                assistantResponse = message.text
                this.callbacks.onResponse?.(assistantResponse)
              }
              void finalize(false)
              break
            case 'error':
              fail(new Error(message.message || 'Voice backend error'))
              break
            case 'closed':
              if (this.state !== 'idle') {
                fail(new Error('Voice WebSocket closed before completion'))
              }
              break
            default:
              break
          }
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)))
        }
      })

      try {
        await ws.connect(userId)
        ws.sendJson({
          type: 'audio_chunk',
          data: base64Audio,
          file_name: metadata.fileName,
          mime_type: metadata.mimeType,
        })
        ws.sendJson({
          type: 'final',
          file_name: metadata.fileName,
          mime_type: metadata.mimeType,
        })
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}

export const voicePipelineService = new VoicePipelineService()

export default voicePipelineService
