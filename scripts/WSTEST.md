# WebSocket Voice Test

Two small test scripts are provided to exercise the voice WebSocket endpoint and report the `context_built` latency sent by the server.

Prerequisites
- Backend running locally (default: `http://localhost:8000`).
- For Node: `npm install ws` (or `yarn add ws`).
- For Python: `pip install websockets`.

Node test
```
node scripts/ws_test_node.js
```
Or set a custom backend URL:
```
BACKEND_WS="ws://localhost:8000/api/v1/ws/voice/1" node scripts/ws_test_node.js
```

Python test
```
python3 scripts/ws_test_py.py
```
Or set custom backend URL:
```
BACKEND_WS="ws://localhost:8000/api/v1/ws/voice/1" python3 scripts/ws_test_py.py
```

What they do
- Connect to `/api/v1/ws/voice/{user_id}` WebSocket.
- Send a JSON control frame `{ "type": "final" }` to trigger the server pipeline.
- The server runs STT -> `build_context()` -> LLM (if configured) and emits a `context_built` JSON message, e.g.

```
{"type":"context_built","ms":123}
```

Notes
- If your backend is behind a proxy or running on a different port, set `BACKEND_WS` accordingly.
- To simulate audio, send JSON frames `{ "type": "audio_chunk", "data": "<base64>" }` prior to the `final` frame.
