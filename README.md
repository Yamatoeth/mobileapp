# JARVIS Voice Setup

This project is wired around one backend-owned voice stack:

- `Groq` for speech-to-text and chat generation
- `Kokoro ONNX` for fully local text-to-speech
- `Deepgram` as an optional fallback for PCM/WAV transcription
- Expo mobile app as the microphone + playback client

## What Works

- Text ask -> text answer with no provider keys, using local fallback mode
- Voice ask -> AI answer when `GROQ_API_KEY` is configured
- Spoken AI reply locally through Kokoro once the model files are present

## Required Environment

Frontend in [.env](/home/obito/Projets/jarvis/mobileapp/.env):

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

Backend in [backend/.env](/home/obito/Projets/jarvis/mobileapp/backend/.env):

```env
app_env=development
debug=true
secret_key=replace-with-local-dev-secret
database_url=postgresql+asyncpg://jarvis:jarvis_dev@localhost:5432/jarvis_db
redis_url=redis://localhost:6379/0

GROQ_API_KEY=your_groq_key
KOKORO_MODEL_PATH=/absolute/path/to/backend/models/kokoro/kokoro-v1.0.int8.onnx
KOKORO_VOICES_PATH=/absolute/path/to/backend/models/kokoro/voices-v1.0.bin
KOKORO_DEFAULT_VOICE=af_sarah
KOKORO_DEFAULT_LANGUAGE=en-us
KOKORO_DEFAULT_SPEED=1.0

# Optional
DEEPGRAM_API_KEY=
PINECONE_API_KEY=
```

Notes:

- Postgres and Redis are optional for basic local assistant use.
- If they are down, the backend now fails open for local chat/voice instead of blocking startup.
- `OPENAI_API_KEY` is not required for the active voice path.
- Kokoro runs locally and does not require external TTS auth.

## Run

Backend:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload
```

Frontend:

```bash
npm start
```

## End-to-End Flow

1. Open the app.
2. Type into the composer to verify backend ask/answer works.
3. Hold the orb to record.
4. Release to send audio to the backend.
5. Backend transcribes with Groq, generates the response, synthesizes with Kokoro locally, and returns audio for playback.

## Troubleshooting

- If text works but voice does not transcribe, check `GROQ_API_KEY`.
- If text works and voice transcribes but no spoken reply plays, check the Kokoro model paths and voice settings.
- Android emulator should usually use `http://10.0.2.2:8000` for `EXPO_PUBLIC_API_URL`.
- iOS simulator can usually use `http://127.0.0.1:8000`.
