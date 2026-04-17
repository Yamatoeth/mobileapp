# WebSocket Voice Test Guide

Use these lightweight scripts to verify the `/api/v1/ws/voice/{userId}` pipeline end to end and capture the `context_built` latency metric emitted by the server.

## Prerequisites
- FastAPI backend running locally (`uvicorn app.main:app --reload --port 8000`).
- Valid `GROQ_API_KEY` (voice mode) and Kokoro files configured so the backend can complete the pipeline.
- Optional auth token if your deployment secures the WebSocket: export `VOICE_JWT=<token>` and append `?token=$VOICE_JWT` to the URL.
- Node.js 20+ (for the JS test) or Python 3.11+ (for the Python test).
- Install dependencies:
  ```bash
  npm install ws # Node script
  pip install websockets # Python script
  ```

## Default Endpoint
```
BACKEND_WS=ws://localhost:8000/api/v1/ws/voice/1
```
Override it per environment:
```bash
BACKEND_WS="ws://10.0.2.2:8000/api/v1/ws/voice/<userId>?token=$VOICE_JWT"
```

## Run the Tests
### Node
```bash
BACKEND_WS=<ws-url> node scripts/ws_test_node.js
```

### Python
```bash
BACKEND_WS=<ws-url> python3 scripts/ws_test_py.py
```

Both scripts:
1. Open a WebSocket connection to `/api/v1/ws/voice/{userId}`.
2. (Optional) Send fake audio chunks via `{ "type": "audio_chunk", "data": "<base64>" }`.
3. Send `{ "type": "final" }` to trigger STT → context builder → LLM → TTS.
4. Log the server messages, highlighting `{"type":"context_built","ms":123}` and `{"type":"tts_ready",...}` events.

## Expected Output
- `context_built` event with `ms` field under ~1000ms for cached context.
- `tts_generated` or `audio_ready` event containing a base64 audio payload if Kokoro succeeds.
- Graceful close from the server when playback data is fully streamed.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| Connection refused | Ensure backend listens on the host/port and that firewalls allow WS traffic |
| No `context_built` message | Check `GROQ_API_KEY` validity and backend logs for STT failures |
| `tts_generated` missing | Verify Kokoro model paths and file permissions |
| 401/403 on connect | Include the auth token query parameter or header expected by your deployment |

## Automating the Check
Add the Node script to CI or a pre-release checklist:
```bash
BACKEND_WS=$WS_URL node scripts/ws_test_node.js | tee artifacts/ws-log.txt
```
Fail the build if `context_built` latency exceeds your target threshold or if no `tts_generated` message appears.
