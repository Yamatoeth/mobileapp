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
    try {
      console.log('[WSClient] init baseUrl=', this.url);
    } catch (e) {}
  }

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.url.replace(/^http/, 'ws') + `/ws/voice/${encodeURIComponent(userId)}`;
      try {
        console.log('[WSClient] connecting to', wsUrl);
      } catch (e) {}
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        try { console.log('[WSClient] onopen -> connected to', wsUrl); } catch (e) {}
        resolve();
      };

      this.ws.onerror = (e) => {
        try { console.error('[WSClient] onerror', e); } catch (err) {}
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
        try { console.log('[WSClient] onclose -> websocket closed'); } catch (e) {}
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
    try {
      const txt = JSON.stringify(obj);
      this.ws.send(txt);
      try { console.log('[WSClient] sendJson ->', obj.type || 'json', 'len=', txt.length); } catch (e) {}
    } catch (err) {
      try { console.error('[WSClient] sendJson error', err); } catch (e) {}
      throw err;
    }
  }

  sendAudioBase64(b64: string): void {
    // send as a JSON control frame
    try {
      this.sendJson({ type: 'audio_chunk', data: b64 });
      try { console.log('[WSClient] sendAudioBase64 sent, bytes=', b64.length); } catch (e) {}
    } catch (err) {
      try { console.warn('[WSClient] Failed sending audio chunk', err); } catch (e) {}
    }
  }

  sendFinal(): void {
    try {
      try { console.log('[WSClient] sendFinal -> sending final marker'); } catch (e) {}
      this.sendJson({ type: 'final' });
    } catch (err) {
      try { console.error('[WSClient] sendFinal error', err); } catch (e) {}
    }
  }

  onMessage(handler: MessageHandler): void {
    const wrappedHandler: MessageHandler = (msg) => {
      try {
        console.log('[PIPELINE] 📨 Message received from backend:', JSON.stringify(msg).slice(0, 200));
      } catch (err) {
        console.warn('[PIPELINE ERROR ❌] Failed at message receive', err);
      }
      handler(msg);
    };
    this.handlers.push(wrappedHandler);
  }

  offMessage(handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
}

export default WSClient;
