# J.A.R.V.I.S. — 12-Month Development Timeline

> **Read this file every Monday morning.** Update the Current State block every Friday.

---

## Notation Convention

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Code written, not yet tested / validated |
| `[X]` | Tested and validated against month criteria |
| `[!]` | Blocked — reason noted below |
| `[-]` | Deprioritised / deferred — reason noted |

**Absolute rule:** An item moves from `[~]` to `[X]` only when the validation test specified in the month's checklist passes. "Code exists" = `[~]`. "Works in real conditions" = `[X]`.

---

## 🔴 CURRENT STATE — Last updated: 2026-04-17

**Current phase:** Phase 1 — validation / stabilisation before Phase 2

**Where things actually stand:**

Solid backend infrastructure: FastAPI, PostgreSQL, Redis, Pinecone, Celery all operational. Frontend skeleton with navigation, Zustand stores, and Iron Man UI in place. The provider-backed real-device voice loop now works, but Phase 1 is not complete until latency, onboarding, memory, and stability validation are finished.

**What is actually working (tested end-to-end):**
- Physical iPhone hold-to-talk path: microphone recording → backend WebSocket → Deepgram STT → Groq provider response → response displayed in the app ✓
- Backend reachable from phone over LAN with `/health` and voice WebSocket smoke-tested ✓
- Provider secrets now load server-side from `backend/.env`; Groq is no longer exposed through `EXPO_PUBLIC_*` ✓
- ContextBuilder is wired into the voice and text hot paths before prompt construction ✓
- Redis working memory: storing and retrieving conversation summaries ✓
- Pinecone index: upserting and searching vectors ✓
- Celery fact extraction: job triggers, extracts facts ✓
- React Native navigation: 4 screens accessible ✓
- Arc-reactor and waveform animations ✓

**What exists but is not yet validated end-to-end:**
- Complete voice pipeline: one real-device low-latency smoke test passed; p95 over 20 tests not measured
- Fact extraction → KB update: tested with a real conversation? No
- Onboarding flow: complete 45-minute session without errors? No
- Personal context validation: ask about goals/situation without prompting? Not yet tested
- WebSocket reconnect behaviour on drop: not yet validated
- Crash-free soak: 48-hour / 7-day tests not yet run

**Current blockers:**
- End-to-end latency p95 < 2s not yet measured over 20 runs
- 45-minute onboarding session not yet validated
- Working memory / episodic memory recall tests still missing
- Fact extraction → `knowledge_updates` → KB update after a real conversation still missing
- WebSocket reconnect behaviour still missing

**Next focus this week:**
1. Measure real-device voice latency p50/p95 over 20 runs
2. Validate personal context: ask about goals/situation after KB is populated
3. Run a complete 45-minute onboarding session
4. Test fact extraction from a real conversation into `knowledge_updates`
5. Add / validate WebSocket reconnect on drop

---

## PHASE 1: Core Loop (Months 1–3)
**Goal:** JARVIS can hear you, knows who you are, and responds with genuine personal context.

---

### Month 1 — Voice Pipeline

**Week 1: Infrastructure**
- [X] Monorepo setup (mobile/, backend/, shared/)
- [X] FastAPI backend with health check endpoint
- [X] PostgreSQL + Redis via Docker Compose locally
- [X] React Native + Expo iOS app skeleton
- [X] Navigation (VoiceScreen, HistoryScreen, KnowledgeScreen, SettingsScreen)
- [X] Zustand stores initialised (voice, conversation, knowledge)
- [ ] GitHub repo with branch protection

**Week 2: Voice Recording**
- [~] `expo-audio` migration for recording/playback; current client still uses temporary `expo-av` compatibility
- [X] Microphone permission request and handling
- [X] Hold-to-talk button with press/release states
- [X] Visual feedback during recording (waveform animation)
- [X] Audio file saved to temp storage before upload

**Week 3: STT + LLM**
- [X] Deepgram streaming transcription endpoint
- [X] WebSocket connection (iPhone ↔ backend) for audio streaming
- [X] Groq LLM integration behind provider boundary
- [X] Streaming LLM response back to client
- [X] Conversation displayed as text on screen

**Week 4: TTS + End-to-End**
- [X] Deepgram Aura TTS configured behind provider boundary
- [X] Streaming TTS audio back to iPhone
- [X] Audio playback via `expo-av`
- [~] End-to-end latency test: target < 2 seconds (single real-device smoke test felt fast; p95 not measured)
- [ ] Fix top 5 latency issues

**✅ Month 1 validation — complete when:**
- [~] Speak → hear JARVIS respond within 2 seconds (single real-device provider-backed query succeeded; formal 20-run latency test pending)
- [ ] No crashes over a 48-hour test
- [ ] WebSocket reconnects automatically on drop

---

### Month 2 — Knowledge Base & Onboarding

**Week 5: Knowledge Base Schema**
- [X] PostgreSQL tables: `users`, `knowledge_identity`, `knowledge_goals`, `knowledge_projects`, `knowledge_finances`, `knowledge_relationships`, `knowledge_patterns`
- [X] Schema: `user_id`, `field_name`, `field_value`, `confidence`, `last_updated`, `source`
- [X] `knowledge_updates` table: change log with conversation reference
- [X] Alembic migrations for all tables

**Week 6: Onboarding Interview**
- [X] Onboarding screen (separate from the main VoiceScreen)
- [X] LLM-generated questions that adapt to user answers
- [X] 6-domain sequence: Identity → Goals → Projects → Finances → Relationships → Patterns
- [X] Interview runs as a conversation, not a form
- [ ] Tested in real conditions: 45 minutes without errors

**Week 7: KB Population**
- [X] Parse onboarding conversation and extract structured facts via provider-backed extractor
- [X] Write extracted facts into all 6 KB tables
- [X] Review screen: user sees what JARVIS learned and corrects it
- [X] Knowledge Dashboard showing all 6 domains
- [X] Manual editing of any field from the dashboard

**Week 8: Context Builder v1**
- [X] `ContextBuilder` class in the backend
- [X] Query KB on every voice call
- [X] Inject user identity summary into system prompt Layer 2
- [ ] **Critical validation:** JARVIS responses mention your goals and situation without being told
- [ ] Latency test: context build < 300ms

**✅ Month 2 validation — complete when:**
- [ ] Onboarding completes without errors (one full 45-minute session)
- [ ] Knowledge Dashboard shows accurate information about you
- [ ] Ask JARVIS about your goals → specific answer without additional prompting

---

### Month 3 — Memory System

**Week 9: Working Memory (Redis)**
- [X] Store every conversation summary in Redis after each session
- [X] 30-conversation sliding window (TTL: 30 days)
- [X] Load last 30 summaries into Layer 3 of prompt on every call
- [ ] **Validation:** JARVIS references something said 3 days ago without being reminded

**Week 10: Episodic Memory (Pinecone)**
- [X] Pinecone index: 1536 dimensions, cosine similarity
- [X] After each conversation: embedding of summary upserted to Pinecone
- [X] Semantic search on every voice call: top 5 results → Layer 4 of prompt
- [ ] **Validation:** ask about a topic from 2 weeks ago → JARVIS finds it

**Week 11: Fact Extraction Pipeline**
- [X] Celery worker runs after every conversation
- [X] Transcription sent to provider-backed extractor with structured extraction prompt
- [X] JSON of knowledge updates received and parsed
- [X] Conflict resolution: higher confidence + more recent wins
- [ ] All updates logged in `knowledge_updates`
- [ ] **Validation:** tell JARVIS you changed a goal → KB updates automatically

**Week 12: Iron Man UI Polish**
- [X] Arc-reactor pulse animation on VoiceScreen (Reanimated)
- [X] Full colour system: `#0A0A0A` / `#00B4D8` / `#FFB703`
- [X] Voice state transitions: Idle → Recording → Processing → Speaking
- [X] Conversation history: JARVIS left (cyan) / user right (white)
- [X] App icon and splash screen

**✅ Phase 1 validation — complete when:**
- [ ] Voice latency < 2 seconds (p95 over 20 tests)
- [ ] Knowledge Base accurate after onboarding
- [ ] Working memory + episodic memory both active and verified
- [ ] Fact extraction updates KB after a real conversation
- [ ] Iron Man UI: no resemblance to a generic chatbot
- [ ] Zero crashes over 7 days of continuous use

---

## PHASE 2: Proactive Intelligence (Months 4–7)
**Goal:** JARVIS surfaces what matters without being asked.

> ⚠️ Do not start Phase 2 until all 6 Phase 1 validation criteria are marked `[X]`.

### Month 4 — Pattern Recognition

**Week 13: Conversation Analysis**
- [ ] Weekly background job analyses the last 30 days of conversations
- [ ] Identifies recurring topics, avoided topics, repeated concerns
- [ ] Stores patterns in `knowledge_patterns`
- [ ] JARVIS references patterns in responses: "You've mentioned X three times this week"

**Week 14: Goal Tracking**
- [ ] JARVIS tracks progress against goals declared in the KB
- [ ] Detects when a goal hasn't been mentioned in 2+ weeks → flags it
- [ ] Detects when actions contradict stated goals → surfaces the contradiction
- [ ] Weekly goal review initiated by JARVIS (push notification)

**Week 15: Wake Word**
- [~] Wake word detection ("Hey JARVIS") via on-device model
- [~] App listens in background when enabled (user opt-in)
- [~] Immediate voice activation without touching the phone

**Week 16: Notification System**
- [X] Push notification infrastructure (expo-notifications)
- [X] JARVIS-initiated check-ins: "You said you'd finish X last week — update?"
- [X] Optional morning briefing: daily summary of active projects + goals
- [X] Maximum 3 proactive notifications per day (configurable)

**✅ Months 4–5 validation — complete when:**
- [ ] JARVIS identifies at least 3 behavioural patterns from conversation history
- [ ] Morning briefing works and is accurate
- [ ] Proactive check-ins reference specific past conversations

---

### Months 5–7 — Opinion Engine

**Weeks 17–20: Deep Opinion Mode**
- [ ] "Challenge me" command — JARVIS reviews current projects and goals, gives unsolicited honest feedback
- [ ] "Devil's advocate" mode — argues against the user's stated position
- [ ] Decision support: "Should I do X?" triggers structured analysis using the KB
- [ ] Weekly pattern report: what JARVIS has noticed about your behaviour this week

**Weeks 21–24: Conversation Quality**
- [ ] Context builder prioritises the most relevant memories (not just the most recent)
- [ ] Reduce prompt token count while increasing relevance (cost + latency)
- [ ] Feedback loop: thumbs up/down on responses feeds into prompt tuning
- [ ] A/B test: different JARVIS character prompts, measure response quality

**✅ Phase 2 validation — complete when:**
- [ ] Proactive suggestion acceptance rate > 70% (self-assessed)
- [ ] Pattern recognition identifies at least 5 patterns per user
- [ ] "Challenge me" output is useful and specific (self-tested)
- [ ] Daily active use sustained for 30 consecutive days

---

## PHASE 3: Action Layer (Months 8–12)
**Goal:** JARVIS does things, not just says things.

> ⚠️ Do not start Phase 3 until all 4 Phase 2 validation criteria are marked `[X]`.
Months 8-9: Reminders & Calendar (Light)

**Internal reminder system (high priority — universal)**
- [ ] JARVIS extracts dates/deadlines mentioned in conversation 
      and stores them in a `reminders` table (PostgreSQL)
- [ ] Celery beat job checks upcoming reminders every hour
- [ ] Push notification sent by JARVIS at the right time
- [ ] “Remind me about X in 3 days” → works without any 
      external calendar
- [ ] JARVIS proactively mentions deadlines in its responses
      (“You told me that Y was due on Friday”)

**Validation:** tell JARVIS "remind me to cancel Netflix in 
2 weeks" → you receive a notification at the right time, without having 
to touch your calendar.

---

**External calendar integration (low priority — opt-in)**
- [ ] Optional connection to Apple Calendar or Google Calendar
- [ ] Read-only — JARVIS consults but never modifies 
      without explicit confirmation
- [ ] Write on demand only: “put this in my calendar” 
      → JARVIS suggests, you confirm verbally
- [ ] If the user does not have a calendar → no degradation, 
      the internal reminder system covers the essentials

**Validation:** works identically whether the user has a 
full or empty calendar.

Translated with DeepL.com (free version)

### Month 10: Financial Monitoring
- [ ] Manual financial data entry by voice ("I spent €200 on X today")
- [ ] JARVIS tracks against stated budget/goals from KB
- [ ] Weekly financial summary: spending vs targets
- [ ] Plaid integration (read-only bank connection) — optional, user-initiated

### Month 11: Task & Project Management
- [ ] Voice-first task creation: "Add a task to Project X: do Y by Friday"
- [ ] Project status tracking by voice: "Update Project X — finished Y, blocked on Z"
- [ ] JARVIS weekly project review: what's stalled, what needs attention
- [ ] Notion or Linear integration (read/write via API)

### Month 12: Production & Launch
- [ ] App Store submission preparation
- [ ] Privacy policy and terms of service (see PRIVACY.md)
- [ ] TestFlight beta: 10–20 users
- [ ] Performance audit: all latency targets met
- [ ] Security audit: encryption, data handling, API key management
- [ ] App Store review submission

---

## Weekly Rhythm

**Monday:** Read this file. Update CURRENT STATE. Plan the week.
**Tuesday–Thursday:** Deep work — code, test, commit daily.
**Friday:** Code review, write tests, update documentation.
**Saturday:** Dogfooding — use JARVIS for a full day, log everything.
**Sunday:** Rest.

**Non-negotiable rule:** Use JARVIS yourself every day from Month 1 Week 3 onwards. If you wouldn't use it, don't ship it.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Voice latency > 2s | Medium | High | Stream everything; degrade to text if needed |
| KB becomes inaccurate over time | Medium | High | Weekly review prompt; easy manual correction |
| Fact extraction hallucinates wrong updates | Low | High | Confidence scoring; manual review for confidence < 0.6 |
| LLM costs exceed budget | Medium | Medium | Cache frequent queries; move simple extraction to cheaper Groq fallback |
| App Store rejection | Low | High | No medical claims; wellness framing; privacy policy clear |
| Feature creep delays Phase 1 | **High** | **High** | This file exists to prevent exactly this |
| Personal context may not surface naturally in answers | Medium | High | Hot path wiring is verified; next test is goal/situation recall after KB population |

---

## Key Milestones Summary

| Milestone | Target date | Definition of Done |
|-----------|------------|-------------------|
| Voice loop works | End of Month 1 | Speak → hear JARVIS in < 2s |
| JARVIS knows you | End of Month 2 | Responses reference your goals without prompting |
| Full memory active | End of Month 3 | References conversations from weeks ago |
| Iron Man UI complete | End of Month 3 | Looks and feels like the product |
| Proactive intelligence | End of Month 7 | Morning briefings + pattern recognition |
| Action layer | End of Month 11 | Calendar + tasks + financial tracking |
| App Store | Month 12 | Approved and live |
