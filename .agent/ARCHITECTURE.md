# JARVIS Architecture

JARVIS is a voice-first personal assistant made of an Expo React Native mobile app and a FastAPI backend. The mobile app owns the user interaction, recording, playback, local preferences, and navigation. The backend owns user data, conversation APIs, knowledge extraction, prompt/context building, and AI provider access so provider secrets never ship to the client.

## Runtime Shape

```text
Mobile app
  App.tsx
  ThemeProvider + ErrorBoundary
  Stack navigation
  JarvisVoiceScreen
    audioRecordingService -> backend voice/message APIs -> audioPlaybackService
  History / Knowledge / Settings / Profile screens

Backend
  FastAPI app
  REST + WebSocket routers
  PostgreSQL knowledge/conversation tables
  Redis working-memory cache
  Optional Pinecone semantic memory
  Provider services for STT, LLM, TTS, push, and local Kokoro TTS
```

## Mobile App

The entry point is [App.tsx](/home/obito/Projets/mobileapp/App.tsx). It wraps the app in `SafeAreaProvider`, `ThemeProvider`, and `ErrorBoundary`, then chooses onboarding or the authenticated stack. The main stack contains:

- `Home`: [JarvisVoiceScreen.tsx](/home/obito/Projets/mobileapp/src/components/JarvisVoiceScreen.tsx)
- `Profile`: [ProfileScreen.tsx](/home/obito/Projets/mobileapp/src/screens/ProfileScreen.tsx)
- `History`: [HistoryScreen.tsx](/home/obito/Projets/mobileapp/src/screens/HistoryScreen.tsx)
- `Knowledge`: [KnowledgeScreen.tsx](/home/obito/Projets/mobileapp/src/screens/KnowledgeScreen.tsx)
- `Settings`: [SettingsScreen.tsx](/home/obito/Projets/mobileapp/src/screens/SettingsScreen.tsx)

Core mobile services live under [src/services](/home/obito/Projets/mobileapp/src/services). Recording uses `expo-audio`; generated voice playback also uses `expo-audio`. Local settings are stored with Zustand persistence in [settingsStore.ts](/home/obito/Projets/mobileapp/src/store/settingsStore.ts). Lightweight local chat history lives in [useChatHistory.ts](/home/obito/Projets/mobileapp/src/hooks/useChatHistory.ts).

## Backend App

The backend entry point is [backend/app/main.py](/home/obito/Projets/mobileapp/backend/app/main.py). Routers under [backend/app/api](/home/obito/Projets/mobileapp/backend/app/api) expose auth, users, conversations, messages, memory, knowledge, notifications, onboarding, and voice endpoints.

Backend responsibilities:

- Keep provider credentials server-side.
- Build prompt context from durable knowledge, working memory, and conversation history.
- Persist conversations and extracted facts.
- Provide health/status checks for local development and CI.
- Support local TTS through Kokoro when configured.

## Data And Memory

The app uses a layered memory model:

- PostgreSQL stores durable entities such as users, conversations, messages, and knowledge facts.
- Redis stores short-lived working memory and runtime cache data.
- Pinecone support is isolated in `backend/app/db/pinecone_client.py` for semantic retrieval when configured.
- Async fact extraction runs under `backend/app/tasks`.

## Accessibility

Mobile screens should expose explicit labels, roles, selected/disabled state, and useful hints for VoiceOver and TalkBack. Touch targets should stay at least 44x44 points for primary controls. Dynamic status text, such as listening/thinking/speaking states, should use polite live-region announcements where React Native supports them.

## Testing And CI

Frontend tests use Jest and `@testing-library/react-native`. Run:

```sh
npm test
npm run test:coverage
npm run type-check
npm run lint
```

Backend tests use `pytest` from the `backend` directory. GitHub Actions run frontend lint/typecheck/coverage and backend tests. Coverage artifacts are uploaded from the frontend job.

## Design Constraints

- Do not add provider API keys or provider-specific secrets to the mobile app.
- Prefer existing hooks, stores, and services before adding new abstractions.
- Keep mobile screens accessible to screen readers and reachable through navigation.
- Treat local voice mode and backend voice mode as separate failure domains; the UI should continue to offer text input if voice recording fails.
