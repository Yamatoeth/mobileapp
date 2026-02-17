# Project J.A.R.V.I.S. — Complete Technical Specification

## Executive Summary

**J.A.R.V.I.S.** (Just A Rather Very Intelligent System) is a voice-first personal AI assistant that knows your entire life — your goals, projects, finances, relationships, personality, and daily patterns — and grows smarter about you with every conversation.

This is not a health app. This is not a chatbot. This is a **persistent thinking partner** that lives in your iPhone, speaks to you in a distinct voice, and gives you direct, personalised opinions based on deep knowledge of who you are and what you are trying to build.

**Timeline:** 12-month solo development  
**Platform:** iOS (React Native + Expo), iPhone only  
**UI Aesthetic:** Futuristic dark — Iron Man inspired  
**Core Innovation:** Persistent personal knowledge graph + continuous learning from every conversation

---

## 1. Core Philosophy

### The Problem

Every AI assistant today is stateless and generic. Each conversation starts from zero. It does not know your goals, your projects, your financial situation, your relationships, or your patterns. It answers your question and forgets you existed.

### The Solution: Know You, Not Just Answer You

JARVIS is built around a single principle: **a great assistant does not need to be told who you are every time.**

JARVIS knows you because it learns from every conversation, stores everything that matters in a structured personal knowledge base, and injects that context into every response. Over time, it becomes the single most knowledgeable entity about your life — more than any individual advisor, coach, or friend.

**The Iron Man analogy is architectural, not aesthetic.** JARVIS works in Iron Man because Tony Stark never has to re-explain himself. The system already knows. That is the product being built here.

---

## 2. The Three Pillars

Everything JARVIS does rests on three pillars. Build them in order. Never skip ahead.

### Pillar 1: The Knowledge Base

A structured, living model of who you are. Six domains stored in PostgreSQL, continuously updated from conversations.

```
KNOWLEDGE BASE
├── Identity
│   ├── Who you are, how you see yourself
│   ├── How you make decisions
│   └── What you respond well to, what you avoid
├── Goals & Ambitions
│   ├── Financial targets with timelines
│   ├── Career and business direction
│   └── Personal development objectives
├── Active Projects
│   ├── What you are building (name, description, status)
│   ├── Current blockers and next actions
│   └── Deadlines and key people involved
├── Financial Situation
│   ├── Income, expenses, savings rate
│   ├── Investments and debts
│   └── Financial goals and risk tolerance
├── Relationships
│   ├── Key people in your life
│   └── Context about each person
└── Patterns & Habits
    ├── Where you consistently underperform
    ├── Procrastination triggers
    └── What energises and depletes you
```

**How it is populated:** A 45-minute structured onboarding interview on first launch, then continuously updated by a background fact extraction job after every conversation.

### Pillar 2: The Memory System

Three tiers working together to give JARVIS both speed and depth.

| Tier | Storage | Contents | TTL |
|------|---------|----------|-----|
| Working Memory | Redis | Last 30 conversations verbatim | 30 days |
| Episodic Memory | Pinecone | Full history as vector embeddings | Forever |
| Knowledge Graph | PostgreSQL | Structured facts about you | Forever |

Every LLM call assembles context from all three tiers simultaneously via `asyncio.gather()`. Target context build time: under 300ms.

### Pillar 3: The Intelligence Engine

GPT-4o configured with a strict four-layer prompt:

1. **Character definition** — who JARVIS is, how it speaks
2. **User identity** — full Knowledge Base summary injected
3. **Recent context** — last 30 conversation summaries from Redis
4. **Relevant memories** — top 5 Pinecone results for current topic

This four-layer construction is what makes JARVIS feel like it knows you rather than merely answering your question.

---

## 3. The JARVIS Character

Character design is as important as database schema. JARVIS has a specific personality that must be enforced in every system prompt.

**Core traits:**
- **Direct** — gives clear opinions without softening them
- **Honest** — points out contradictions between stated goals and actual behaviour
- **Contextually sharp** — references past conversations, decisions, and patterns by default
- **Not subservient** — pushes back when you are making an error
- **Concise** — short sentences, no preambles, no disclaimers
- **Consistent** — always the same voice regardless of topic

JARVIS is never a yes-man. It agrees when you are right and disagrees when you are not.

---

## 4. The Onboarding Interview

First launch is a 45-minute structured conversation, not a setup wizard. JARVIS interviews you across all six knowledge domains using LLM-generated questions that adapt based on your answers.

**Interview sequence:**
1. Identity & mindset — how you see yourself, how you make decisions
2. Goals & ambitions — what success looks like in 1, 3, and 10 years
3. Active projects — everything you are working on right now
4. Financial situation — current picture and where you want it to be
5. Relationships — key people and their context
6. Patterns & habits — where you consistently underperform

At the end, JARVIS presents a structured summary of everything it has learned. You review and correct it. That becomes your initial Knowledge Base. This is the moment JARVIS becomes yours.

---

## 5. Continuous Learning

After every conversation, a background Celery job runs fact extraction:

1. Sends full conversation transcript to GPT-4o with a structured extraction prompt
2. Model returns JSON list of knowledge updates — each with domain, field, new value, and confidence
3. Updates merged into Knowledge Base with conflict resolution (higher confidence and more recent wins)
4. All changes logged in `knowledge_updates` table with source conversation reference

The user never manually updates their profile. JARVIS learns by paying attention.

---

## 6. Voice Interaction

**Interface:** Hold-to-talk button on main screen. Wake word support in Phase 2.

**Pipeline:**
```
User speaks → expo-av captures audio → WebSocket streams to backend
→ Deepgram STT (streaming, <300ms) → Context Builder assembles 4-layer prompt
→ GPT-4o generates response (streaming) → ElevenLabs TTS (streaming)
→ Audio streamed back to iPhone → Played immediately
```

**Target latency:** Under 2 seconds end-to-end (speech end to audio start).

The voice pipeline is non-negotiable. If latency exceeds 2 seconds consistently, users stop using it. Stream everything — audio in, LLM out, audio out. Never wait for a complete response before starting the next stage.

---

## 7. UI Design Language

**Aesthetic:** Iron Man — dark, structured, purposeful. Nothing soft or decorative.

**Colour system:**
- Background: `#0A0A0A` (near black)
- Surfaces: `#141414` / `#1E1E1E`
- Primary accent: `#00B4D8` (cyan — JARVIS voice, interactive elements)
- Secondary accent: `#FFB703` (gold — status, labels)
- Text: `#F0F4F8` (primary) / `#8892A4` (secondary)

**Core screens:**
- **Main Voice Screen** — full dark background, arc-reactor pulse animation when JARVIS speaks, waveform during recording, minimal text overlay
- **Conversation History** — scrollable log, JARVIS left in cyan, user right in white
- **Knowledge Dashboard** — six domain panels, tap to view/edit, shows last updated timestamp
- **Settings** — voice selection, wake word toggle, memory controls, data export

**Voice states:** Idle (dim pulse) → Recording (gold waveform) → Processing (rotating cyan arc) → Speaking (full cyan pulse animation)

---

## 8. Privacy & Security

**Principle:** You are storing the most personal information a person can share. Default to paranoia.

**Audio:** Deleted immediately after transcription. Never stored.
**Conversations:** Stored as text summaries, not recordings. Encrypted at rest (AES-256).
**Knowledge Base:** Stored encrypted in PostgreSQL. Never sent to third parties beyond the LLM call.
**LLM calls:** Use OpenAI API with no training data opt-out enabled.

**User controls:**
- One-click data export (full Knowledge Base + conversation history as JSON)
- Complete data deletion — wipes all server data, keeps local app
- Per-domain opt-out (can exclude financial data from storage, for example)

---

## 9. Project Structure

```
jarvis/
├── mobile/                     # React Native iOS app
│   ├── src/
│   │   ├── components/         # UI components (VoiceButton, PulseAnimation, etc.)
│   │   ├── screens/            # Screens (VoiceScreen, HistoryScreen, KnowledgeScreen)
│   │   ├── services/           # ApiClient, WebSocketService, AudioService
│   │   ├── hooks/              # useVoice, useKnowledge, useConversation
│   │   ├── store/              # Zustand stores (voice, conversation, knowledge)
│   │   └── types/              # TypeScript interfaces
│   ├── app.json
│   └── package.json
├── backend/                    # FastAPI server
│   ├── app/
│   │   ├── api/                # REST + WebSocket endpoints
│   │   ├── core/               # Context builder, fact extractor, prompt engine
│   │   ├── db/                 # SQLAlchemy models, Redis client, Pinecone client
│   │   ├── services/           # OpenAI, ElevenLabs, Deepgram integrations
│   │   ├── tasks/              # Celery background jobs (fact extraction, summaries)
│   │   └── schemas/            # Pydantic models
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
└── docs/
    ├── API.md
    ├── DEPLOYMENT.md
    └── PROJECT.md
```

---

## 10. Success Definition

**After 30 days of daily use:**
- JARVIS references past conversations without being prompted
- JARVIS gives opinions that are specific to your situation, not generic advice
- You find yourself speaking to it before making decisions rather than after

**After 90 days:**
- JARVIS knows you well enough that its opinion on a decision genuinely surprises you sometimes
- You would describe it as "the only AI that actually knows me"
- The Knowledge Base feels accurate — you recognise yourself in it

**The product works when you would rather have JARVIS's input than not have it, on any meaningful decision, every time.**

---

## 11. What This Is Not

To stay focused, be explicit about what JARVIS does not do in v1:

- ❌ Biometric monitoring (future Phase 4+)
- ❌ Proactive interruptions (future Phase 2)
- ❌ Calendar modifications (future Phase 3)
- ❌ Sending messages or emails autonomously (future Phase 3)
- ❌ Financial account connections (future Phase 3)
- ❌ Android support (future after iOS is stable)

v1 is a voice assistant that knows you deeply and gets smarter over time. That is enough. Build that first.