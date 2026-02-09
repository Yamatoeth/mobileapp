# Project J.A.R.V.I.S. - Detailed Technical Specification

## Executive Summary

**J.A.R.V.I.S.** (Just A Rather Very Intelligent System) is a proactive AI executive assistant that monitors your biological state, environmental context, and behavioral patterns in real-time to optimize human performance. Unlike reactive chatbots, J.A.R.V.I.S. functions as a digital Chief of Staff with escalating authority—learning when to suggest, when to intervene, and when to override.

**Timeline:** 6-month solo development (aggressive but achievable with focused execution)  
**Target Platform:** iOS (React Native) with future Android support  
**Core Innovation:** Biometric + contextual fusion engine for proactive behavioral correction

---

## 1. Core Philosophy

### The Problem We're Solving

Most AI assistants are **reactive and stateless**. They:
- Wait for prompts instead of anticipating needs
- Cannot distinguish "elevated heart rate from exercise" vs "elevated heart rate from stress"
- Have no authority to challenge poor decisions
- Forget context between sessions

### Our Solution: The Digital Twin + Super-Ego Model

**Digital Twin:** Real-time representation of your current state  
- Physiological (HRV, BPM, sleep quality, movement)
- Environmental (location, calendar, ambient noise)
- Behavioral (focus patterns, procrastination triggers)

**Super-Ego:** Goal-aligned intervention system  
- Knows your long-term objectives (launch business, run marathon, maintain relationships)
- Detects when short-term actions contradict these goals
- Intervenes with appropriate authority level based on earned trust

---

## 2. Three-Phase Development Roadmap

### Phase 1: Foundation (Months 1-2)
**Goal:** Build a biometrically-aware voice assistant that NEVER interrupts

**Deliverables:**
1. React Native app with HealthKit integration (BPM, HRV, sleep)
2. Streaming voice pipeline (Whisper → GPT-4 → ElevenLabs, <2s latency)
3. Context engine (calendar + location awareness)
4. Basic conversational memory (Pinecone vector DB)
5. State machine (Sleeping/Exercising/Working/Meeting/Leisure/Stressed)

**Success Metric:** User can say "How am I doing?" and receive accurate biometric context

**Technical Debt Allowed:**
- Simple prompt-based responses (no proactive intervention)
- Cloud-only processing (no local inference)
- Manual state machine tuning

---

### Phase 2: Intelligence Layer (Months 3-4)
**Goal:** Add proactive awareness without intervention authority

**Deliverables:**
1. Gentle notification system ("Nudge Mode")
   - Detects stress patterns from biometric + calendar fusion
   - Suggests breaks when focus declines
   - Reminds about hydration/movement during sedentary periods
2. Hierarchical memory system
   - Working memory (24h in-context window)
   - Episodic memory (30-day vector search)
   - Semantic patterns (lifetime statistical model)
3. Explanation logging (every suggestion includes trigger data)
4. User feedback loop (accept/dismiss/snooze tracking)

**Success Metric:** System makes 10+ proactive suggestions per day with >70% acceptance rate

**Technical Debt Allowed:**
- Notifications only (no voice interruptions)
- Rule-based triggers (no ML optimization)
- Cloud-dependent decision making

---

### Phase 3: Autonomy & Authority (Months 5-6)
**Goal:** Earn intervention rights through demonstrated value

**Deliverables:**
1. Trust level system
   - **Consultant** (Week 1-2): Only suggests when asked
   - **Advisor** (Week 3-4): Sends proactive notifications
   - **Manager** (Month 2+): Can reschedule low-priority calendar items
   - **Executive** (Month 3+): Voice interruptions during health emergencies
2. Voice intervention system
   - Barge-in capability (WebRTC full-duplex)
   - Context-aware timing (never interrupt flow states)
   - Escalation protocol (notification → voice → aggressive)
3. Task execution (Function Calling)
   - Calendar management (reschedule, create blocks)
   - Communication drafting (emails, messages)
   - Health interventions (trigger meditation, order healthy food)
4. Confidence thresholding
   - Only intervene when biometric + context signals >85% certain
   - Learn from dismissals to adjust model

**Success Metric:** System performs ≥3 autonomous actions per week that user retrospectively endorses

**No Technical Debt:** This is production-ready

---

## 3. Technical Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│              (React Native Mobile App)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Voice Interface   │  Biometric Display  │ Settings│  │
│  │  (Full Duplex)     │  (Live HRV/BPM)     │         │  │
│  └───────────────────────────────────────────────────┘  │
│                          ▲ ▼                             │
│                    WebSocket + REST                      │
└─────────────────────────────────────────────────────────┘
                              ▲
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Agentic Reasoning Engine               │   │
│  │  • State Machine (6 life states)                 │   │
│  │  • Intervention Decision Logic                   │   │
│  │  • Trust Level Manager                           │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Memory Hierarchy                     │   │
│  │  • Working (Redis) • Episodic (Pinecone)         │   │
│  │  • Semantic (PostgreSQL time-series)             │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │         External Integrations                     │   │
│  │  • OpenAI/Gemini (LLM)  • ElevenLabs (TTS)       │   │
│  │  • Deepgram (STT)       • Calendar API           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow: A Single Interaction

**User asks:** "How stressed am I right now?"

1. **Frontend** (React Native)
   - Captures audio via microphone
   - Streams to backend via WebSocket
   - Simultaneously pulls latest HealthKit data (HRV, BPM from last 5min)
   - Queries calendar for current/next event

2. **Backend** (FastAPI)
   - **STT Service** (Deepgram) transcribes audio → text
   - **Context Builder** creates state payload:
     ```json
     {
       "query": "How stressed am I right now?",
       "biometrics": {"hrv_ms": 32, "bpm": 88, "trend": "rising"},
       "context": {"activity": "Meeting", "location": "Office", "time": "14:30"},
       "state": "Working"
     }
     ```
   - **Memory Retrieval** (Pinecone) finds similar past moments:
     - "Last time HRV was this low during a meeting, you needed a break"
   - **LLM Router** sends enriched prompt to GPT-4:
     ```
     You are J.A.R.V.I.S. User's HRV is 32ms (low), BPM 88 (elevated), 
     currently in a meeting. Historical data shows this pattern precedes 
     stress-induced headaches. Respond as their executive assistant.
     ```
   - **TTS Service** (ElevenLabs) converts response to audio
   - **Response Streamer** sends audio chunks back to frontend

3. **Frontend** plays audio while displaying biometric visualizations

**Total latency target:** <1.5 seconds (perception threshold for natural conversation)

---

### 3.3 Stack Decisions & Rationale

#### Frontend: React Native + Expo
**Why:**
- Single codebase for iOS (immediate) + Android (later)
- Expo provides HealthKit wrapper and managed workflows
- TypeScript for type safety across 100+ components

**Alternatives Considered:**
- Native Swift: Better performance, but 2x development time
- Flutter: No mature HealthKit bindings

**Key Libraries:**
- `expo-health` (HealthKit/Google Fit)
- `expo-av` (audio recording/playback)
- `@react-native-voice/voice` (backup STT)
- `react-native-reanimated` (60fps biometric charts)
- `zustand` (lightweight state management)

---

#### Backend: FastAPI (Python 3.11+)
**Why:**
- Async/await for WebSocket connections
- Type hints match React Native TypeScript
- Rich ML/AI ecosystem (Pinecone, OpenAI, LangChain)
- 10x faster than Flask for I/O-bound tasks

**Alternatives Considered:**
- Node.js: Good for real-time, but Python ML tools are superior
- Django: Too heavy, REST-focused

**Key Libraries:**
- `fastapi[all]` (web framework)
- `websockets` (full-duplex audio)
- `openai` / `google-generativeai` (LLM clients)
- `pinecone-client` (vector DB)
- `sqlalchemy` (PostgreSQL ORM)
- `redis-py` (working memory cache)
- `pydantic` (data validation)

---

#### LLM: GPT-4o (Primary) + Gemini 1.5 Pro (Fallback)
**Why GPT-4o:**
- Function calling (tool use) is production-ready
- Streaming responses reduce latency
- 128k context window fits 24h of memory

**Why Gemini 1.5 Pro (fallback):**
- 2M token context (fits weeks of data)
- Cheaper for long-context tasks
- Native multimodal (future: image analysis of posture)

**Usage Pattern:**
- GPT-4o for real-time responses (<2s)
- Gemini for nightly analysis ("What patterns emerged today?")

---

#### Memory: Three-Tier System

**1. Working Memory (Redis)**
- Last 24 hours of interactions
- Embedded directly in LLM context window
- TTL: 24 hours (auto-expire)

**2. Episodic Memory (Pinecone)**
- Vector embeddings of daily summaries
- Searchable: "Find times I was stressed before important presentations"
- Retention: 90 days (configurable)

**3. Semantic Memory (PostgreSQL + TimescaleDB)**
- Statistical patterns: "Mondays at 2pm = stress spike"
- Health trends: "HRV improving 5% month-over-month"
- Retention: Lifetime (aggregated, not raw data)

**Why this hierarchy:**
- Redis: Fast retrieval, no search needed
- Pinecone: Semantic search across time ("similar situations")
- PostgreSQL: Structured queries ("average BPM during meetings")

---

#### Voice Pipeline: Deepgram (STT) + ElevenLabs (TTS)
**Why Deepgram:**
- 300ms latency (vs 1-2s for Whisper API)
- Streaming transcription (start processing before sentence ends)
- Custom vocabulary ("HRV" not "aycharvee")

**Why ElevenLabs:**
- Lowest-latency voice cloning
- Emotional inflection (concerned vs calm tone)
- Streaming output (TTS starts before LLM finishes)

**Future optimization:**
- Phase 3: On-device Whisper for privacy
- Phase 3: FunAudioLLM for end-to-end latency <200ms

---

### 3.4 State Machine: The Core Intelligence

J.A.R.V.I.S. models your life as 6 discrete states. All decisions flow from state + biometrics.

```python
class LifeState(Enum):
    SLEEPING = "sleeping"      # 23:00-07:00, low movement
    EXERCISING = "exercising"  # Elevated BPM + GPS movement
    WORKING = "working"        # Calendar event OR 09:00-18:00 weekdays
    MEETING = "meeting"        # Calendar event with attendees
    LEISURE = "leisure"        # Weekend/evening, normal BPM
    STRESSED = "stressed"      # Low HRV + high BPM + NOT exercising
```

**State Transitions:**
```
SLEEPING → (movement detected) → EXERCISING/WORKING
WORKING → (calendar event) → MEETING
WORKING → (HRV <35ms + BPM >90) → STRESSED
STRESSED → (HRV normalizes) → WORKING/LEISURE
ANY → (23:00-07:00) → SLEEPING
```

**State-Aware Responses:**
```python
# Example: High BPM interpretation
if state == EXERCISING:
    response = "Great cardio session! BPM at 145."
elif state == MEETING:
    response = "Your heart rate is elevated. This meeting is stressing you."
elif state == SLEEPING:
    response = "Possible sleep disturbance detected. BPM should be <60."
```

**Why a state machine:**
- Prevents false positives (exercise vs stress)
- Enables context-specific interventions
- Simplifies decision logic (no complex ML needed in Phase 1)

---

## 4. Privacy & Security Architecture

**Principle:** Biometric data is the most sensitive data on Earth. Default to paranoia.

### Data Classification

**Tier 1 (Never leaves device):**
- Raw heart rate waveforms
- Sleep stage details
- Audio recordings (deleted after transcription)

**Tier 2 (Encrypted in transit, aggregated at rest):**
- HRV/BPM summaries (5-minute averages)
- Location (city-level, not GPS coordinates)
- Calendar metadata (event titles hashed)

**Tier 3 (Stored as-is for functionality):**
- Conversation transcripts (needed for memory)
- User goals (needed for intervention logic)
- Intervention feedback (needed for trust model)

### Privacy Measures

1. **End-to-End Encryption:**
   - All WebSocket traffic uses TLS 1.3
   - Backend stores data encrypted at rest (AES-256)

2. **Data Minimization:**
   - Only send deltas to backend (not raw HealthKit streams)
   - Backend stores derived features (HRV trend), not raw values

3. **Local-First Processing (Phase 3):**
   - On-device Whisper for transcription
   - On-device health score calculation
   - Only send text + metadata to cloud

4. **User Controls:**
   - Explicit opt-in for each data type
   - One-click data export (GDPR compliance)
   - Nuclear option: Delete all server data, keep local only

---

## 5. Development Workflow & Best Practices

### 5.1 Monorepo Structure
```
jarvis/
├── mobile/                 # React Native app
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── screens/        # Screen-level views
│   │   ├── services/       # API clients, HealthKit wrappers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand state
│   │   └── types/          # TypeScript interfaces
│   ├── app.json
│   └── package.json
├── backend/                # FastAPI server
│   ├── app/
│   │   ├── api/            # REST/WebSocket endpoints
│   │   ├── core/           # State machine, decision engine
│   │   ├── db/             # Database models
│   │   ├── services/       # External integrations (OpenAI, Pinecone)
│   │   └── schemas/        # Pydantic models
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
├── shared/                 # Shared types (TypeScript + Python)
│   └── types.ts / types.py
└── docs/
    ├── API.md
    ├── ARCHITECTURE.md
    └── DEPLOYMENT.md
```

### 5.2 Git Workflow
- **main:** Production-ready (always deployable)
- **develop:** Integration branch
- **feature/\*:** Individual features (e.g., `feature/trust-system`)

**Commit Message Format:**
```
[PHASE-1] Add HealthKit HRV retrieval service

- Created HealthKitService class with 5-minute polling
- Added error handling for permission denials
- Implemented exponential backoff for API limits
```

### 5.3 Testing Strategy

**Frontend (React Native):**
- Jest + React Native Testing Library
- Focus: Component rendering, state updates, API integration
- Coverage target: >70% for `services/` and `hooks/`

**Backend (FastAPI):**
- pytest + pytest-asyncio
- Focus: State machine transitions, intervention logic, memory retrieval
- Coverage target: >80% for `core/` (this is the brain)

**Integration Tests:**
- Playwright for end-to-end voice flows
- Mock HealthKit data, real LLM calls (budget permitting)

**Manual Testing:**
- Weekly "dogfooding" sessions (use the app yourself)
- Track false positives/negatives in a spreadsheet

---

## 6. Key Performance Indicators (KPIs)

### Phase 1 (Foundation)
- [ ] Voice response latency <2s (p95)
- [ ] HealthKit data retrieval every 5min (no gaps)
- [ ] State machine accuracy >90% (manual validation)
- [ ] Zero app crashes over 7-day period

### Phase 2 (Intelligence)
- [ ] Proactive suggestion acceptance rate >70%
- [ ] Memory retrieval relevance score >0.8 (user rating)
- [ ] False positive intervention rate <5%
- [ ] User retention: 80% of testers use daily after 2 weeks

### Phase 3 (Autonomy)
- [ ] Autonomous actions endorsed by user >90%
- [ ] Trust level "Executive" reached within 60 days
- [ ] Voice interruption dismissed <10% of time
- [ ] Net Promoter Score (NPS) >50

---

## 7. Risk Mitigation

### Technical Risks

**Risk:** HealthKit API rate limits cause data gaps  
**Mitigation:** Local caching + exponential backoff. If >5 min gap, notify user.

**Risk:** LLM hallucinations during health emergencies  
**Mitigation:** Rule-based fallback for critical interventions (e.g., "BPM >180 → call 911" bypasses LLM).

**Risk:** Voice latency >2s kills conversational feel  
**Mitigation:** Stream everything (audio in/out, LLM responses). If latency spikes, degrade to text.

### Product Risks

**Risk:** Users find proactive interruptions annoying  
**Mitigation:** Start with notifications (Phase 2). Earn voice interruption rights through value (Phase 3).

**Risk:** Privacy concerns block adoption  
**Mitigation:** Radical transparency. Show exactly what data is sent. Local-first by Phase 3.

**Risk:** "Creepy" factor from constant monitoring  
**Mitigation:** Frame as "digital twin for self-improvement," not surveillance. User controls on/off states.

---

## 8. Success Definition

**The MVP is successful if:**
1. After 30 days, you rely on it for daily decisions (proof of value)
2. It correctly identifies ≥3 stress events per week before you consciously notice
3. You feel accountable to it (it has earned "Chief of Staff" authority)

**The product is successful if:**
1. 100 beta users show >80% weekly active rate after 60 days
2. Quantifiable performance improvements (e.g., 20% fewer stress spikes, 15% better sleep)
3. Users describe it as "my external prefrontal cortex"

---

## 9. Post-Launch Vision (12-18 months)

- **Computer Vision Integration:** Posture analysis via front camera (permission-gated)
- **Wearable Ecosystem:** Direct integration with Oura Ring, Whoop, continuous glucose monitors
- **Team Sync:** Multi-user dashboards for couples/teams ("Our collective stress is rising")
- **Predictive Models:** "Based on your calendar, you'll be stressed Tuesday 3pm. Block recovery time now."
- **Open Source Core:** Release state machine + decision logic as OSS. Monetize via hosted service.

---

## 10. Why This Will Work

1. **You're solving your own problem** (best founder validation)
2. **The tech exists today** (no research breakthroughs needed)
3. **Clear differentiation** (no competitor combines biometrics + proactive AI)
4. **Aggressive but realistic timeline** (6 months for MVP, not perfection)
5. **Privacy-first architecture** (defensible moat as regulations tighten)

**The hardest part isn't the code—it's the discipline to ship Phase 1 before adding Phase 3 features.**

Build the foundation, earn trust, then add autonomy. That's how J.A.R.V.I.S. becomes real.
