# J.A.R.V.I.S. — 12-Month Development Timeline

## Overview

Solo development, full-time commitment. Three phases, twelve months. The rule is simple: **build the current phase completely before touching the next one.**

---

## PHASE 1: Core Loop (Months 1–3)
**Goal:** JARVIS can hear you, knows who you are, and responds with genuine personal context.

### Month 1 — Voice Pipeline

**Week 1: Infrastructure**
- [x] Monorepo setup (mobile/, backend/, shared/)
- [x] FastAPI backend with health check endpoint
- [x] PostgreSQL + Redis via Docker Compose locally
- [x] React Native + Expo iOS app skeleton
- [x] Navigation structure (VoiceScreen, HistoryScreen, KnowledgeScreen, SettingsScreen)
- [x] Zustand stores initialised (voice, conversation, knowledge)
- [ ] GitHub repo with branch protection

**Week 2: Voice Recording**
- [x] `expo-av` audio recording at 16kHz WAV
- [x] Microphone permission request and handling
- [x] Hold-to-talk button with press/release states
- [x] Visual feedback during recording (waveform animation placeholder)
- [x] Audio file saved to temp storage before upload

**Week 3: STT + LLM**
- [x] Deepgram account + streaming transcription endpoint
- [x] WebSocket connection (iPhone ↔ backend) for audio streaming
- [x] GPT-4o integration with basic system prompt
- [x] Streaming LLM response back to client
- [x] Basic conversation displayed as text on screen

**Week 4: TTS + End-to-End**
- [x] ElevenLabs account + JARVIS voice configured
- [x] Streaming TTS audio back to iPhone
- [x] Audio playback via `expo-av`
- [ ] End-to-end latency test: target under 2 seconds
- [ ] Fix top 5 latency issues before moving on

**Validation — Month 1 complete when:**
- [ ] Speak a sentence → hear JARVIS respond within 2 seconds
- [ ] No crashes over 48-hour test
- [ ] WebSocket reconnects automatically on drop

---

### Month 2 — Knowledge Base & Onboarding

**Week 5: Knowledge Base Schema**
- [X] PostgreSQL tables: `users`, `knowledge_identity`, `knowledge_goals`, `knowledge_projects`, `knowledge_finances`, `knowledge_relationships`, `knowledge_patterns`
- [X] Each table: `user_id`, `field_name`, `field_value` (text), `confidence` (0–1), `last_updated`, `source` (onboarding/conversation/manual)
- [X] `knowledge_updates` table: change log with conversation reference
- [X] Alembic migrations for all tables

**Week 6: Onboarding Interview**
- [X] Onboarding flow screen (separate from main voice screen)
- [X] LLM-generated interview questions — adapts to user answers
- [X] Six domain sequence: Identity → Goals → Projects → Finances → Relationships → Patterns
- [X] Interview runs as a conversation, not a form
- [X] 45-minute target duration (test this yourself first)

**Week 7: Knowledge Base Population**
- [X] Parse onboarding conversation and extract structured facts via GPT-4o
- [X] Write extracted facts into all six Knowledge Base tables
- [X] Summary review screen — user sees what JARVIS learned and corrects it
- [X] Knowledge Dashboard screen showing all six domains
- [X] Edit any field manually from the dashboard

**Week 8: Context Builder v1**
- [ ] `ContextBuilder` class in backend
- [ ] Queries Knowledge Base on every voice call
- [ ] Injects user identity summary into system prompt Layer 2
- [ ] Verify: JARVIS responses now reference your goals and situation by default
- [ ] Latency test: context build under 300ms

**Validation — Month 2 complete when:**
- [ ] Onboarding interview completes without errors
- [ ] Knowledge Dashboard shows accurate information about you
- [ ] Ask JARVIS about your goals — it gives a specific answer without being told

---

### Month 3 — Memory System

**Week 9: Working Memory (Redis)**
- [x] Store every conversation summary in Redis after each session
- [x] 30-conversation sliding window (TTL: 30 days)
- [x] Load last 30 summaries into Layer 3 of prompt on every call
- [x] Verify: JARVIS references something from 3 days ago unprompted

**Week 10: Episodic Memory (Pinecone)**
- [x] Pinecone index: 1536 dimensions, cosine similarity
- [x] After each conversation: generate embedding of summary, store in Pinecone
- [x] Semantic search on every voice call: retrieve top 5 relevant past conversations
- [x] Inject into Layer 4 of prompt
- [ ] Test: ask about a topic from 2 weeks ago — JARVIS finds it


**Week 11: Fact Extraction Pipeline**
- [x] Celery worker runs after every conversation
- [x] Sends transcript to GPT-4o with structured extraction prompt
- [X] Receives JSON list of Knowledge Base updates
- [X] Conflict resolution: higher confidence + more recent wins
- [ ] All changes logged to `knowledge_updates` table
- [ ] Test: tell JARVIS you changed a goal → Knowledge Base updates automatically

**Week 12: Iron Man UI Polish**
- [X] Arc-reactor pulse animation on VoiceScreen (Reanimated)
- [X] Full colour system applied: `#0A0A0A` / `#00B4D8` / `#FFB703`
- [X] Voice state transitions: Idle → Recording → Processing → Speaking
- [X] Conversation history with JARVIS left (cyan) / user right (white)
- [X] App icon and splash screen

**Validation — Phase 1 complete when:**
- [ ] Voice latency under 2 seconds (p95)
- [ ] Knowledge Base accurate after onboarding
- [ ] Working memory + episodic memory both active
- [ ] Fact extraction updates Knowledge Base after conversation
- [ ] UI looks and feels like Iron Man, not a generic chatbot
- [ ] Zero crashes over 7-day continuous use

**Validation — Phase 1 complete when:**
- [ ] Voice latency under 2 seconds (p95)
- [ ] Knowledge Base accurate after onboarding
- [x] Working memory + episodic memory both active
- [ ] Fact extraction updates Knowledge Base after conversation
- [ ] UI looks and feels like Iron Man, not a generic chatbot
- [ ] Zero crashes over 7-day continuous use

_Updated: 2026-02-18 — items marked done reflect current repo status (backend memory, Pinecone index, Celery worker, Redis, basic frontend skeleton/navigation)._

---

## PHASE 2: Proactive Intelligence (Months 4–7)
**Goal:** JARVIS surfaces what matters without being asked.

### Month 4 — Pattern Recognition

**Week 13: Conversation Analysis**
- [ ] Weekly background job analyses last 30 days of conversations
- [ ] Identifies recurring topics, avoided topics, repeated concerns
- [ ] Stores patterns in `knowledge_patterns` table
- [ ] JARVIS begins referencing patterns in responses: "You have mentioned X three times this week"

**Week 14: Goal Tracking**
- [ ] JARVIS tracks progress against stated goals from Knowledge Base
- [ ] Detects when user has not mentioned a goal in 2+ weeks → flags it
- [ ] Detects when actions contradict stated goals → surfaces contradiction
- [ ] Weekly goal review prompt initiated by JARVIS (push notification)

**Week 15: Wake Word**
- [X] Wake word detection ("Hey JARVIS") using on-device model
- [X] App listens in background when enabled (user opt-in)
- [X] Immediate voice activation without touching phone

**Week 16: Notification System**
- [ ] Push notification infrastructure (expo-notifications)
- [ ] JARVIS-initiated check-ins: "You mentioned finishing X last week — update?"
- [ ] Morning briefing option: daily summary of active projects + goals
- [ ] Max 3 proactive notifications per day (configurable)

**Validation — Month 4–5 complete when:**
- [ ] JARVIS identifies at least 3 behavioural patterns from conversation history
- [ ] Morning briefing works and is accurate
- [ ] Proactive check-ins reference specific past conversations

---

### Month 5–7 — Opinion Engine

**Week 17–20: Deep Opinion Mode**
- [ ] "Challenge me" command — JARVIS reviews your current projects and goals and gives unsolicited honest feedback
- [ ] "Devil's advocate" mode — argues the opposite of your stated position
- [ ] Decision support: "Should I do X?" triggers structured analysis using Knowledge Base
- [ ] Weekly pattern report: what JARVIS has noticed about your behaviour this week

**Week 21–24: Conversation Quality**
- [ ] Improve context builder to prioritise most relevant memories
- [ ] Reduce prompt token count while increasing relevance (cost + latency)
- [ ] A/B test: different JARVIS character prompts, measure response quality
- [ ] User feedback loop: thumbs up/down on responses feeds into prompt tuning

**Validation — Phase 2 complete when:**
- [ ] Proactive suggestion acceptance rate over 70%
- [ ] Pattern recognition identifies at least 5 patterns per user
- [ ] "Challenge me" output is useful and specific (test yourself)
- [ ] Daily active use sustained for 30 days

---

## PHASE 3: Action Layer (Months 8–12)
**Goal:** JARVIS does things, not just says things.

### Month 8–9: Calendar Integration

- [ ] iOS Calendar read access (`expo-calendar`)
- [ ] JARVIS aware of your schedule in every response
- [ ] "What do I have today?" — full schedule summary
- [ ] Scheduling conflicts surfaced automatically
- [ ] Focus block suggestions based on projects + calendar gaps
- [ ] Calendar write access (with explicit user confirmation for every action)

### Month 10: Financial Monitoring

- [ ] Manual financial data entry via voice ("I spent €200 on X today")
- [ ] JARVIS tracks against your stated budget/goals from Knowledge Base
- [ ] Weekly financial summary: spending vs targets
- [ ] Plaid integration (read-only bank connection) — optional, user-initiated

### Month 11: Task & Project Management

- [ ] Voice-first task creation: "Add a task to X project: do Y by Friday"
- [ ] Project status tracking via voice: "Update project X — completed Y, blocked on Z"
- [ ] JARVIS weekly project review: what is stalled, what needs attention
- [ ] Integration with Notion or Linear (read/write via API)

### Month 12: Production & Launch

- [ ] App Store submission preparation
- [ ] Privacy policy and terms of service
- [ ] TestFlight beta: 10–20 users
- [ ] Performance audit: all latency targets met
- [ ] Security audit: encryption, data handling, API key management
- [ ] App Store review submission

---

## Weekly Rhythm

**Monday:** Plan week, review last week's progress, update this file  
**Tuesday–Thursday:** Deep work — code, test, commit daily  
**Friday:** Code review, write tests for the week, update documentation  
**Saturday:** Dogfooding — use JARVIS yourself for a full day, log everything  
**Sunday:** Rest  

**Non-negotiable rule:** Use JARVIS yourself every day from Month 1 Week 3 onwards. If you would not use it, do not ship it.

---

## Key Milestones Summary

| Milestone | Target Date | Definition of Done |
|-----------|-------------|-------------------|
| Voice loop works | End of Month 1 | Speak → hear JARVIS respond in under 2s |
| JARVIS knows you | End of Month 2 | Responses reference your goals without prompting |
| Full memory active | End of Month 3 | References conversations from weeks ago |
| Iron Man UI complete | End of Month 3 | Looks and feels like the product |
| Proactive intelligence | End of Month 7 | Morning briefings + pattern recognition working |
| Action layer | End of Month 11 | Calendar + tasks + financial tracking |
| App Store | Month 12 | Approved and live |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Voice latency over 2s | Medium | High | Stream everything; degrade to text if needed |
| Knowledge Base becomes inaccurate over time | Medium | High | Weekly user review prompt; easy manual correction |
| Fact extraction hallucinates wrong updates | Low | High | Confidence scoring; manual review for low-confidence updates |
| LLM costs exceed budget | Medium | Medium | Cache frequent queries; use GPT-4o-mini for extraction jobs |
| App Store rejection | Low | High | No medical claims; wellness framing; privacy policy clear |
| Feature creep delays Phase 1 | High | High | This file exists to prevent exactly this |

**The biggest risk is building Phase 3 features during Phase 1. Do not do it.**