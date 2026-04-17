# JARVIS Improvement Plan (Living Backlog)

Purpose: keep a concise view of what still blocks production readiness and who/what each item touches. Update this file whenever work lands so the README can simply link here.

## Priority Board
| Priority | Theme | Item | Status |
| --- | --- | --- | --- |
| P0 | Security | Authenticate `/ws/voice` (token handshake/JWT) | Open |
| P0 | Security | Move API keys to SecureStore, remove from AsyncStorage | Open |
| P0 | Security | Stop committing `google-services.json`, rotate keys | Open |
| P0 | Security | Enforce non-default `secret_key` in production | Open |
| P1 | Correctness | Import `pinecone_client` in `app/main.py` | Open |
| P1 | Correctness | Remove async-constructor anti-pattern in `voicePipeline` | Open |
| P1 | Correctness | Replace `datetime.utcnow()` with timezone-aware calls | Planned |
| P1 | UX/Brand | Align naming: README/UI/App config (Medicus vs JARVIS) | Planned |
| P2 | Architecture | Split `backend/app/api/voice.py` into routers + services | Open |
| P2 | Architecture | Break up `JarvisVoiceScreen.tsx` into focused components/hooks | Open |
| P2 | DX | Consolidate ESLint configs into `eslint.config.cjs` | Planned |
| P2 | DX | Strongly type `WSClient` payloads | Open |
| P3 | Testing | Add backend WebSocket + context builder integration tests | Open |
| P3 | Testing | Add React Native component + hook tests (`JarvisVoiceScreen`, `useVoiceAssistant`) | Open |
| P3 | Testing | Add automated WS regression (Playwright/Detox) | Planned |
| P4 | Operations | Store Kokoro binaries outside git (LFS or download script) | Planned |
| P4 | Operations | Add CI pipeline (lint, type-check, tests, backend pytest, docker build) | Open |
| P4 | Operations | Improve Dockerfile + add `.dockerignore`, run as non-root | Open |
| P4 | Operations | Add structured logging + request IDs | Planned |
| P5 | Polish | Replace hardcoded push user ID, make error dismissal configurable, cleanup Redis guard logic | Planned |

## Theme Details
### 1. Security
- Implement signed token or JWT query parameter validation for the voice WebSocket before accepting audio.
- Persist user-supplied provider keys via Expo SecureStore; rehydrate at runtime rather than persisting to AsyncStorage.
- Treat `google-services.json` as a secret (env injection in CI, gitignored locally).
- Raise on startup if `app_env=production` and the default FastAPI secret key is still set.
- Introduce a lightweight rate-limit middleware (e.g., `slowapi`) for REST + WS handshake endpoints.

### 2. Correctness & Reliability
- Fix missing imports/anti-patterns called out in the board.
- Standardize `datetime.now(datetime.UTC)` across backend services.
- Pick a single product name and update App.json, onboarding copy, README, prompts.

### 3. Architecture & Code Health
- Extract STT, LLM, and TTS orchestration into dedicated service modules; keep routers lean.
- Split `JarvisVoiceScreen.tsx` into smaller components (`ConversationPanel`, `useBackendHealth`, etc.).
- Collapse duplicate ESLint configs; ensure React Native and backend share consistent lint rules.
- Introduce discriminated union types for WS messages to remove `any`.
- Remove dead/shared types in `shared/types.ts` or mark them deprecated.
- Consider merging the Knowledge* tables into a single `KnowledgeFact` table keyed by domain.

### 4. Testing Strategy
- Backend: async pytest fixtures for Postgres/Redis, voice WS integration test, context builder coverage, knowledge API tests, push service unit tests.
- Frontend: `@testing-library/react-native` coverage for the main screen + hooks, settings store serialization tests.
- E2E: WebSocket regression harness (Playwright/Detox) plus CI gate.

### 5. Operations & DX
- Remove large binaries from git; supply a download script and/or Git LFS pointers.
- Introduce CI (GitHub Actions) running lint, tests, backend pytest, docker build.
- Improve backend Dockerfile: multi-stage, `.dockerignore`, non-root user.
- Add structured logging with correlation IDs.
- Maintain a persistent WebSocket connection between app and backend to avoid reconnect costs.

### 6. Polish & Hardening
- Replace hardcoded user IDs (push registration) with settings store values.
- Make error auto-dismiss configurable or manual.
- Centralize Redis connection management (`redis_client.is_connected`).
- Wire `locationService`/`calendarService` data into context builder or remove unused code.
- Document Kokoro asset download + storage instructions (see README) and keep `scripts/WSTEST.md` as the validation guide.

## How to Use This Backlog
1. Reference the Priority Board when triaging issues or planning sprints.
2. When you start work, add an owner or issue link next to the item and update `Status` (Planned → In Progress → Done).
3. Keep detailed implementation notes in PRs or dedicated ADRs; this file stays concise and scope-focused.
