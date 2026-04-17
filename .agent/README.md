# J.A.R.V.I.S.
### Just A Rather Very Intelligent System

> A voice-first personal AI that knows your entire life and gets smarter about you with every conversation.

[![Phase](https://img.shields.io/badge/Phase-1%20Core%20Loop-blue)]()
[![Platform](https://img.shields.io/badge/Platform-iOS%20only-black)]()
[![Timeline](https://img.shields.io/badge/Timeline-12%20months-gold)]()

---

## What is J.A.R.V.I.S.?

JARVIS is a persistent, voice-first personal AI that knows who you are and gives you direct, specific, personalised opinions — not generic advice.

**This is not a health app. This is not a chatbot.**

It is a thinking partner that lives in your iPhone, speaks to you in a distinct voice, and remembers everything you have ever told it. Over time, it becomes the single most knowledgeable entity about your life — more than any individual advisor, coach, or friend.

The Iron Man reference is architectural, not aesthetic. JARVIS works because Tony Stark never has to re-explain himself. **The system already knows.**

---

## The Core Difference

| Every Other AI Assistant | J.A.R.V.I.S. |
|--------------------------|---------------|
| Stateless — forgets you exist | Persistent — remembers everything |
| Generic advice for anyone | Specific opinions about your situation |
| Waits for you to explain context | Already knows your goals, projects, finances |
| Agrees with whatever you say | Pushes back when you are wrong |
| Useful for individual questions | Useful for your entire life |

---

## How It Works

**Hold the button. Speak. Hear JARVIS respond.**

Behind that simplicity:

1. Your voice is transcribed by Deepgram (streaming, under 300ms)
2. The Context Builder assembles everything JARVIS knows about you — your goals, your active projects, your recent conversations, your patterns
3. Groq generates a response through the backend LLM provider boundary
4. Deepgram Aura voices the response and streams it back to your iPhone
5. Everything said is processed by a background job that extracts new facts and updates the Knowledge Base

**Total time from speech end to audio start: under 2 seconds.**

---

## The Knowledge Base

The first time you launch JARVIS, it interviews you for 45 minutes. Six domains:

- **Identity** — how you think, how you make decisions, what you respond to
- **Goals & Ambitions** — what you are trying to build in 1, 3, and 10 years
- **Active Projects** — everything you are working on right now
- **Financial Situation** — current picture, targets, gaps
- **Key Relationships** — the important people and their context
- **Patterns & Habits** — where you consistently underperform

After that interview, JARVIS knows you. Every conversation adds to that knowledge. You never have to update your profile manually — JARVIS learns by paying attention.

---

## Quick Start

```bash
# Clone
git clone https://github.com/yourusername/jarvis.git
cd <repo-directory>

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add your API keys
cd ..
docker compose up -d postgres redis
cd backend
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd <repo-directory>
npm install
npm start   # Press i for iOS simulator
```

Full setup instructions: **[QUICKSTART.md](./QUICKSTART.md)**

---

## Documentation

| File | What It Contains |
|------|-----------------|
| File | What It Contains |
|------|-----------------|
| **[SUMMARY.md](./SUMMARY.md)** | Orientation map for the `.agent` documentation set |
| **[PROJECT.md](./PROJECT.md)** | Product and architecture vision |
| **[TIMELINE.md](./TIMELINE.md)** | Current state, validation gaps, and roadmap |
| **[QUICKSTART.md](./QUICKSTART.md)** | Local setup commands for the current repo layout |
| **[ENV_VARS.md](./ENV_VARS.md)** | Backend environment variable reference |
| **[API.md](./API.md)** | Implemented REST and WebSocket endpoints |
| **[TESTS.md](./TESTS.md)** | Local test and smoke-test runbook |
| **[STACK.md](./STACK.md)** | Technical stack and target infrastructure |
| **[RULES.md](./RULES.md)** | Coding and prompt standards |
| **[PROMPT.md](./PROMPT.md)** | Prompt architecture and golden examples |
| **[PRIVACY.md](./PRIVACY.md)** | Current and target privacy/security posture |
| **[DECISIONS.md](./DECISIONS.md)** | Decision log and superseded choices |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Production deployment guide |
| **[DEV_SETUP.md](./DEV_SETUP.md)** | Local Postgres/Redis helper notes |
| **[DEV_CLIENT_SETUP.md](./DEV_CLIENT_SETUP.md)** | Expo dev-client and native module notes |
| **[WakeWORD.md](./WakeWORD.md)** | Optional wake-word integration guide |

---

## Architecture

```
iPhone App (React Native + Expo)
      │
      │  Hold-to-talk → WebSocket audio stream
      ▼
FastAPI Backend
      │
      ├── Deepgram STT (streaming transcription)
      │
      ├── Context Builder
      │       ├── PostgreSQL  ← Knowledge Base (6 domains)
      │       ├── Redis       ← Last 30 conversations
      │       └── Pinecone    ← Semantic memory (full history)
      │
      ├── Groq LLM provider (4-layer prompt: character + identity + recent + relevant)
      │
      └── Deepgram Aura TTS (streaming audio back to iPhone)
            │
            ▼
      Background: Celery fact-extraction job
            └── Updates Knowledge Base from conversation
```

---

## The JARVIS Character

JARVIS has a specific character enforced at the prompt level.

**Direct.** Gives clear opinions without softening them. When asked what to do, says what to do.

**Honest.** Points out contradictions between your stated goals and your actual behaviour. Does not validate poor decisions.

**Contextually sharp.** References past conversations, decisions, and patterns by default. Never acts as if it does not remember what you said last week.

**Not subservient.** Pushes back when you are making an error. Agrees when you are right.

**Concise.** Short sentences. No preambles, no disclaimers.

---

## UI Design

**Aesthetic:** Iron Man — dark, structured, purposeful.

- Background `#0A0A0A` — near black
- Primary accent `#00B4D8` — cyan (JARVIS voice, interactive elements)
- Secondary accent `#FFB703` — gold (status, labels)
- Text `#F0F4F8` / `#8892A4`

**Main screen:** Full dark background. Arc-reactor pulse animation when JARVIS is speaking. Waveform during your speech. Nothing else.

---

## Tech Stack

**iPhone app:** React Native + Expo, TypeScript, Zustand  
**Backend:** FastAPI + Python 3.12, async throughout  
**STT:** Deepgram (streaming)  
**LLM:** Groq (`openai/gpt-oss-120b` by default)  
**TTS:** Deepgram Aura  
**Working memory:** Redis (last 30 conversations, 30-day TTL)  
**Episodic memory:** Pinecone (semantic search over full history)  
**Knowledge Base:** PostgreSQL (structured personal knowledge graph)  
**Background jobs:** Celery (fact extraction after every conversation)  
**Deployment:** Railway / Fly.io  

Full stack details: **[STACK.md](./STACK.md)**

---

## Development Roadmap

**Phase 1 — Months 1–3:** Voice loop + Knowledge Base + Memory. JARVIS hears you and knows you.

**Phase 2 — Months 4–7:** Continuous learning + pattern recognition + proactive intelligence. JARVIS gets smarter every day.

**Phase 3 — Months 8–12:** Action layer. Calendar integration, task tracking, financial monitoring. App Store.

Full roadmap: **[TIMELINE.md](./TIMELINE.md)**

---

## Privacy

**What is stored:** Conversation text summaries (not audio), your Knowledge Base (encrypted), structured facts extracted from conversations.

**What is never stored:** Raw audio (deleted immediately after transcription). Ever.

**User controls:** Full data export as JSON. One-click complete deletion. Per-domain opt-out (you can exclude financial data from storage, for example).

Production target: personal data encrypted at rest, all traffic over HTTPS/WSS, and OpenAI used only for embeddings in Phase 1. See **[PRIVACY.md](./PRIVACY.md)** for what is implemented today versus required before public launch.

---

## What This Is Not

To stay focused:

- ❌ Not a biometric monitoring app
- ❌ Not a health tracker
- ❌ Not a productivity suite
- ❌ Not an Android app (Phase 1)
- ❌ Not a multi-user product

v1 is a voice assistant that knows you deeply and gets smarter over time. **Build that first.**

---

## Success Criteria

**After 30 days:** JARVIS references past conversations without prompting. Responses are specific to your situation. You speak to it before making decisions.

**After 90 days:** JARVIS knows you well enough that its opinion on a decision genuinely surprises you sometimes. You would describe it as "the only AI that actually knows me."

**The product works when you would rather have JARVIS's input than not have it, on any meaningful decision, every time.**

---

*Solo build. 12-month roadmap. Current source of truth: TIMELINE.md.*
