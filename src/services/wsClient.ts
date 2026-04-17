/**
 * WebSocket client for voice hot-path
 * Connects to backend `/ws/voice/{userId}` and sends audio chunks (base64)
 * and receives streaming LLM/TTS messages.
 */
import { getBackendWsUrl } from './backendUrl'

/**
 * Discriminated union type for WebSocket messages from backend
 */
export type WsMessage =
  | { type: 'audio_chunk'; data: string }
  | { type: 'final' }
  | { type: 'llm_chunk'; data: string }
  | { type: 'llm_done'; content: string }
  | { type: 'tts_data'; data: string }
  | { type: 'tts_done' }
  | { type: 'error'; message: string }
  | { type: 'closed' }
  | { type: 'raw'; data: string }
  | { type: string; [key: string]: unknown }

/**
 * Type guard for message type checking
 */
export function isAudioChunkMessage(msg: WsMessage): msg is { type: 'audio_chunk'; data: string } {
  return msg.type === 'audio_chunk' && typeof (msg as Record<string, unknown>).data === 'string'
}

export function isLLMChunkMessage(msg: WsMessage): msg is { type: 'llm_chunk'; data: string } {
  return msg.type === 'llm_chunk' && typeof (msg as Record<string, unknown>).data === 'string'
}

export function isErrorMessage(msg: WsMessage): msg is { type: 'error'; message: string } {
  return msg.type === 'error' && typeof (msg as Record<string, unknown>).message === 'string'
}

type MessageHandler = (msg: WsMessage) => void

export class WSClient {
  private ws: WebSocket | null = null
  private url: string
  private handlers: MessageHandler[] = []
  private connectTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(baseUrl?: string) {
    this.url = getBackendWsUrl(baseUrl)
    try {
      console.log('[WSClient] init baseUrl=', this.url)
    } catch (e) {}
  }

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}/api/v1/ws/voice/${encodeURIComponent(userId)}`
      try {
        console.log('[WSClient] connecting to', wsUrl)
      } catch (e) {}
      this.ws = new WebSocket(wsUrl)
      let settled = false

      this.connectTimeout = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          this.ws?.close()
        } catch (e) {}
        reject(new Error('Voice backend connection timed out'))
      }, 5000)

      this.ws.onopen = () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout)
          this.connectTimeout = null
        }
        settled = true
        try {
          console.log('[WSClient] onopen -> connected to', wsUrl)
        } catch (e) {}
        resolve()
      }

      this.ws.onerror = (e) => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout)
          this.connectTimeout = null
        }
        try {
          console.error('[WSClient] onerror', e)
        } catch (err) {}
        if (!settled) {
          settled = true
          reject(new Error('Unable to connect to the voice backend'))
        }
      }

      this.ws.onmessage = (event) => {
        const msg = this.parseMessage(event.data)
        this.handlers.forEach((h) => h(msg))
      }

      this.ws.onclose = () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout)
          this.connectTimeout = null
        }
        try {
          console.log('[WSClient] onclose -> websocket closed')
        } catch (e) {}
        // notify handlers about close
        this.handlers.forEach((h) => h({ type: 'closed' }))
      }
    })
  }

  disconnect(): void {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private parseMessage(rawData: string): WsMessage {
    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>
      // Validate that parsed has a type field
      if (typeof parsed.type === 'string') {
        return parsed as WsMessage
      }
      return { type: 'raw', data: rawData }
    } catch (e) {
      // If not JSON, forward raw
      return { type: 'raw', data: rawData }
    }
  }

  sendJson(obj: WsMessage | Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    try {
      const txt = JSON.stringify(obj)
      this.ws.send(txt)
      try {
        const msgType = (obj as Record<string, unknown>).type || 'json'
        console.log('[WSClient] sendJson ->', msgType, 'len=', txt.length)
      } catch (e) {}
    } catch (err) {
      try {
        console.error('[WSClient] sendJson error', err)
      } catch (e) {}
      throw err
    }
  }

  sendAudioBase64(b64: string): void {
    // send as a JSON control frame
    try {
      this.sendJson({ type: 'audio_chunk', data: b64 })
      try {
        console.log('[WSClient] sendAudioBase64 sent, bytes=', b64.length)
      } catch (e) {}
    } catch (err) {
      try {
        console.warn('[WSClient] Failed sending audio chunk', err)
      } catch (e) {}
    }
  }

  sendFinal(): void {
    try {
      try {
        console.log('[WSClient] sendFinal -> sending final marker')
      } catch (e) {}
      this.sendJson({ type: 'final' })
    } catch (err) {
      try {
        console.error('[WSClient] sendFinal error', err)
      } catch (e) {}
    }
  }

  onMessage(handler: MessageHandler): () => void {
    const wrappedHandler: MessageHandler = (msg) => {
      try {
        const preview = JSON.stringify(msg).slice(0, 200)
        console.log('[PIPELINE] 📨 Message received from backend:', preview)
      } catch (err) {
        console.warn('[PIPELINE ERROR ❌] Failed at message receive', err)
      }
      handler(msg)
    }
    this.handlers.push(wrappedHandler)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== wrappedHandler)
    }
  }

  offMessage(handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler)
  }
}

export default WSClient
