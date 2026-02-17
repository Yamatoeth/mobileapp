# J.A.R.V.I.S. — Complete Development Package

## What You Have

Eight documents. Everything needed to build JARVIS from a blank directory to an App Store submission, alone, in 12 months.

| File | Purpose | Read when |
|------|---------|-----------|
| **README.md** | Project overview, architecture, what this is and is not | First |
| **QUICKSTART.md** | Get running locally in 20 minutes | Before first commit |
| **PROJECT.md** | Complete technical specification — the definitive reference | Before Phase 1 |
| **TIMELINE.md** | 12-month week-by-week roadmap with checklists | Every Monday morning |
| **RULES.md** | Coding standards for TypeScript and Python | Before writing code |
| **STACK.md** | Tech stack, infrastructure, environment setup | When setting up tools |
| **API.md** | REST and WebSocket API specification | When adding endpoints |
| **SUMMARY.md** | This file | When you need to re-orient |

---

## The Pivoted Vision in One Paragraph

The original JARVIS was a biometric monitoring app. It watched your body and reacted to physiological stress. That vision has been completely replaced.

The new JARVIS knows you. It knows your goals, your projects, your finances, your relationships, your personality, and your patterns. It learns everything through a structured onboarding interview and then gets smarter with every conversation. You speak to it by voice. It responds in a distinct, opinionated character that references your specific situation — not generic advice. This is not a health app. It is a persistent thinking partner built to give you a second opinion on any decision, hold you accountable to your goals, and surface what matters before you ask.

---

## What Changed from the Old Docs

### Architecture: Completely Replaced

| Old Architecture | New Architecture |
|-----------------|-----------------|
| HealthKit biometric sensors | Knowledge Base (6-domain PostgreSQL schema) |
| State machine (6 life states) | Context Builder (4-layer prompt assembly) |
| Intervention engine | Fact extraction pipeline (Celery background job) |
| Trust level system | Onboarding completeness + conversation depth |
| Biometric → LLM → intervention | Voice → Context → LLM → voice response |

### Tech Stack: Mostly Preserved, Different Purpose

Kept: FastAPI, React Native, Expo, TypeScript, GPT-4o, Deepgram, ElevenLabs, Pinecone, Redis, PostgreSQL, Zustand, Celery.

Removed: `react-native-health`, `expo-calendar`, `expo-location`, TimescaleDB, Gemini fallback, all biometric models, intervention logic, trust scoring.

Added new: `ContextBuilder` class (critical new component), `FactExtractor` class (runs after every conversation), `OnboardingService` (45-minute structured interview), Knowledge Base schema (6 domain tables + change log).

### Timeline: Rewritten Completely

Old: 6 months (too aggressive for biometric scope, wrong product anyway)
New: 12 months (correct scope for knowledge-first voice assistant)

---

## The Three Pillars — Memorise These

Every decision in JARVIS flows from one of these three.

**Pillar 1: The Knowledge Base**
JARVIS is only as good as what it knows about you. Build this first. Six PostgreSQL tables. Populated via a 45-minute onboarding interview. Updated automatically after every conversation.

**Pillar 2: The Memory System**
Three tiers: Redis (last 30 conversations, fast), Pinecone (full history, semantic), PostgreSQL (structured facts, always fresh). All three queried concurrently on every LLM call via `asyncio.gather()`. Context build target: under 300ms.

**Pillar 3: The Intelligence Engine**
GPT-4o with a strict 4-layer prompt: character definition, user identity injection, recent context, relevant memories. The character layer is non-negotiable — JARVIS must be direct, honest, and specific. No hedging, no generic advice.

---

## The 30-Day Immediate Plan

Do not start anywhere except here.

| Week | Build | Done when |
|------|-------|-----------|
| Week 1 | Voice pipeline v0 | Speak → hear GPT-4o respond via ElevenLabs. No context. Just the pipe. |
| Week 2 | Knowledge Base schema + onboarding | Six domain tables created. You complete your own onboarding interview. |
| Week 3 | Context injection | Every voice call uses your Knowledge Base. JARVIS references who you are. |
| Week 4 | Memory integration | Redis working memory + Pinecone episodic memory connected. JARVIS remembers last month. |

Nothing else. No Iron Man UI polish. No pattern detection. No morning briefings. Build the pipe, build the knowledge layer, connect them.

---

## The Biggest Mistakes to Avoid

**Mistake 1: Starting with the UI**
The Iron Man aesthetic is important but it comes last. A beautiful app that knows nothing about you is worthless. Build the Knowledge Base and Context Builder first. The UI takes a week. The knowledge layer takes a month.

**Mistake 2: Building Phase 3 features during Phase 1**
Calendar integration, task tracking, financial monitoring — none of it before the core loop is solid. The TIMELINE.md explicitly marks what is in scope each month. Read it. Follow it.

**Mistake 3: Not using it yourself every single day**
JARVIS is a personal product. The feedback loop is you. If you stop using it, you lose the most important signal. From Month 1 Week 3 onwards, use JARVIS daily. Log what feels broken. Fix it.

**Mistake 4: Treating the onboarding interview as optional**
The onboarding is where the product starts to exist. An empty Knowledge Base means JARVIS sounds like every other generic AI. Do your own full 45-minute onboarding before any other testing.

**Mistake 5: Treating the character prompt as boilerplate**
The four-layer prompt construction is what makes JARVIS feel real. The character layer specifically — the direct, honest, non-subservient personality — must be enforced carefully. Test it constantly. If JARVIS starts hedging or giving generic answers, the prompt has degraded.

---

## How to Use These Docs with an AI Coding Assistant

When working with Cursor, GitHub Copilot, or any AI assistant on this codebase:

1. Point it at `.agent/RULES.md` as the primary context file
2. Reference `API.md` when adding or modifying endpoints
3. Reference `STACK.md` when adding dependencies or infrastructure
4. Reference `PROJECT.md` for architecture decisions
5. Always ask: "Is this feature in Phase 1/2/3?" before building it

The `.agent/RULES.md` file contains the compressed version of all standards — the coding assistant should read it first before any code generation.

---

## Success at Each Phase

### Phase 1 Complete (Month 3)
You ask JARVIS: *"What should I focus on today?"*
It responds with something that references your specific active projects and goals. It does not say "I'd be happy to help you think about priorities." It says what you should actually focus on, citing a specific project from your Knowledge Base.

### Phase 2 Complete (Month 7)
JARVIS initiates a conversation: *"You haven't mentioned the client proposal in 9 days. You said it was due this Friday."*
You did not ask. It noticed.

### Phase 3 Complete (Month 12)
JARVIS is on the App Store. You use it before every major decision. You have described it to someone else as "the only AI that actually knows me."

---

## The Single Most Important Insight

The original JARVIS tried to make an AI that **watches** you.  
The new JARVIS is an AI that **knows** you.

Watching requires sensors — HealthKit, Apple Watch, biometric pipelines. Complex, fragile, and not immediately useful.

Knowing requires memory and conversation — a structured knowledge graph, an extraction pipeline, a smart prompt. Buildable alone, right now, with existing APIs.

**Build the knowledge layer. The rest follows.**

---

## Getting Started Right Now

1. Open **QUICKSTART.md** — get everything running (20 minutes)
2. Open **PROJECT.md** — read the complete vision (30 minutes)
3. Open **TIMELINE.md** — find Week 1 tasks (5 minutes)
4. Do your own onboarding interview — let JARVIS get to know you (45 minutes)
5. Build Week 1

By this time tomorrow you should have a working voice pipeline. By end of Month 1, you should have JARVIS responding with context from your Knowledge Base. By end of Month 3, you should be using it daily and not wanting to stop.

**Now go build J.A.R.V.I.S.**