# JARVIS Voice Assistant

Cross-platform (Expo/React Native) client plus FastAPI backend that turns speech into contextual answers and speaks them back. The stack combines:

- **Groq** — streaming speech-to-text and Llama 3.3 chat generation
- **Kokoro ONNX** — fully offline, device-hosted text-to-speech
- **Deepgram** — optional fallback STT for PCM/WAV payloads
- **PostgreSQL + Redis** — working/episodic memory stores (optional for local dev)

Use this repo when you need a self-hosted voice assistant that can run without OpenAI or cloud TTS dependencies.

## System Overview
| Layer | Responsibilities |
| --- | --- |
| Expo mobile app | Microphone capture, push token registration, playback, offline text chat fallback |
| Voice pipeline service | WebSocket client, recorder, wake-word state, local buffering |
| FastAPI backend | `/api/v1/ws/voice/{userId}` streaming endpoint, `/ai/process` REST entrypoint |
| Services | STT (Groq/Deepgram), Context builder (Postgres/Redis/Pinecone optional), LLM (Groq), TTS (Kokoro) |
| Assets | Kokoro ONNX model + voices, optional Pinecone index, Postgres migrations |

```mermaid
graph LR
    UI[Expo App] -->|REST/WS| API(FastAPI)
    API --> STT[Groq / Deepgram]
    API --> CTX[Context Builder]
    CTX --> DB[(Postgres)]
    CTX --> Redis[(Redis)]
    API --> LLM[Groq Llama 3.3]
    API --> TTS[Kokoro ONNX]
    TTS --> Audio
```

## Feature Modes
| Mode | Requirements | Behavior |
| --- | --- | --- |
| Text-only fallback | No external keys | Sends chat prompts via REST and renders text responses |
| Full voice loop | `GROQ_API_KEY`, Kokoro assets, microphone permissions | Record, transcribe, generate LLM answer, synthesize speech, playback |
| Offline TTS | Kokoro files available locally | Backend continues to speak replies even if external TTS is unavailable |

## Supported Environments
- iOS Simulator (Apple Silicon) and Android Emulator (API 33+)
- Physical devices via Expo Dev Client (requires `expo run:<platform>`)
- Backend on macOS/Linux with Python 3.11+; Docker Compose for consolidated infra

## Prerequisites
### Tooling
- Node.js 20+, npm 10+, Expo CLI (`npx expo install --check`)
- Python 3.11+, uv or pip, virtualenv, Poetry optional
- (Optional) Docker + Docker Compose for Postgres/Redis

### Accounts & Keys
| Var | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Required for production voice flow (STT + LLM) |
| `EXPO_PUBLIC_API_URL` | Mobile app base URL (`http://10.0.2.2:8000` for Android emu, `http://127.0.0.1:8000` for iOS) |
| `KOKORO_MODEL_PATH`, `KOKORO_VOICES_PATH` | Absolute backend paths to the downloaded ONNX + voices files |
| `DEEPGRAM_API_KEY` | Optional fallback STT |
| `PINECONE_API_KEY` | Optional episodic memory |

## Environment Setup
1. **Frontend** — copy `.env.example` once it exists or mirror the snippet below into `.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
   EXPO_PUBLIC_GROQ_API_KEY=<optional for text-only>
   ```
   Sensitive keys (OpenAI, Groq) should be stored via Expo SecureStore at runtime; do **not** persist them in AsyncStorage.
2. **Backend** — create `backend/.env`:
   ```env
   app_env=development
   debug=true
   secret_key=replace-with-local-dev-secret
   database_url=postgresql+asyncpg://jarvis:jarvis_dev@localhost:5432/jarvis_db
   redis_url=redis://localhost:6379/0
   GROQ_API_KEY=<required for voice>
   KOKORO_MODEL_PATH=/absolute/path/to/backend/models/kokoro/kokoro-v1.0.int8.onnx
   KOKORO_VOICES_PATH=/absolute/path/to/backend/models/kokoro/voices-v1.0.bin
   KOKORO_DEFAULT_VOICE=af_sarah
   ```
3. **Kokoro Assets** — run `scripts/download_kokoro.sh` (coming soon) or manually place the ONNX + voices files under `backend/models/kokoro/`. These binaries should **not** be committed; use Git LFS or local download scripts.
4. **Optional infra** — run `docker-compose up -d postgres redis` to start dependencies locally.

## Running Locally
### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Mobile App
```bash
npm install
npm start # choose platform from Expo CLI
```
- `npx expo run:android` / `npx expo run:ios` builds Dev Client when you need native modules.
- Ensure the device can reach the backend URL in `.env` (use `http://10.0.2.2` for Android emulator).

### Docker Compose
The root `docker-compose.yml` launches backend + Postgres + Redis. Set the same env vars or mount `backend/.env`.

## Testing & QA
| Command | Purpose |
| --- | --- |
| `npm run lint` / `npm run type-check` | Frontend lint + TS safety |
| `npm test` | React Native unit tests |
| `cd backend && pytest` | Backend unit/integration tests |
| `node scripts/ws_test_node.js` or `python scripts/ws_test_py.py` | Manual WebSocket latency test (see `scripts/WSTEST.md`) |

Add a GitHub Actions workflow or local pre-push hook that runs all commands above.

## Troubleshooting
- **Text works, voice silent** — verify `GROQ_API_KEY` and Kokoro paths; backend logs should show `context_built` and `tts_generated` events.
- **Android cannot reach backend** — keep `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` and ensure emulator and FastAPI share the same host machine.
- **No speech output** — confirm `backend/models/kokoro` files are readable by the backend process.
- **WebSocket auth** — implement the token handshake described in `plans/project-improvements.md` before exposing the endpoint publicly.

## Roadmap & References
- **Improvements** — see [`plans/project-improvements.md`](./plans/project-improvements.md) for prioritized security, architecture, and testing work.
- **Deployment guidance** — [`backend/DEPLOYMENT_NOTES.md`](./backend/DEPLOYMENT_NOTES.md)
- **WebSocket testing** — [`scripts/WSTEST.md`](./scripts/WSTEST.md)

Have something to fix? File an issue referencing the roadmap item or open a PR with updated documentation + tests.
