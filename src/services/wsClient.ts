/**
 * WebSocket client for voice hot-path
 * Connects to backend `/ws/voice/{userId}` and sends audio chunks (base64)
 * and receives streaming LLM/TTS messages.
 */

type MessageHandler = (msg: any) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: MessageHandler[] = [];

  constructor(baseUrl?: string) {
    this.url = baseUrl || (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000');
  }

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.url.replace(/^http/, 'ws') + `/ws/voice/${encodeURIComponent(userId)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (e) => {
        reject(e);
      };

      this.ws.onmessage = (event) => {
        let data: any = null;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          // If not JSON, forward raw
          data = { type: 'raw', data: event.data };
        }
        this.handlers.forEach((h) => h(data));
      };

      this.ws.onclose = () => {
        // notify handlers about close
        this.handlers.forEach((h) => h({ type: 'closed' }));
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendJson(obj: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(obj));
  }

  sendAudioBase64(b64: string): void {
    // send as a JSON control frame
    this.sendJson({ type: 'audio_chunk', data: b64 });
  }

  sendFinal(): void {
    this.sendJson({ type: 'final' });
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  offMessage(handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
}

export default WSClient;
