# J.A.R.V.I.S. — Decision Log

> This file documents important architecture decisions, why they were made, and what was learned. When you come back after two weeks away or question a past decision, read this file before changing anything.

**Format:** `[DATE] DECISION — Context — Rejected alternatives — Reason for choice — Known consequences`

---

## Architecture

---

### [2026-01] Pivot: biometric → knowledge-first

**Decision:** Completely abandon the biometric architecture (HealthKit, sensors, intervention engine) in favour of a conversational Knowledge Base model.

**Context:** The original architecture depended on Apple Watch, HealthKit, and a 6-state machine to trigger interventions based on heart rate variability and physiological stress. Complex to build solo, fragile (hardware-dependent), and — most importantly — the use case was less compelling than an assistant that *knows who you are*.

**Rejected alternatives:**
- Keep biometrics in parallel: two systems to maintain, doubled complexity
- Biometrics as optional Layer 5: deferred to Phase 3+ if ever

**Reason for choice:** "JARVIS works because Tony Stark never has to re-explain himself." Knowledge > physiological reactivity. Faster to validate, more differentiating.

**Consequences:**
- Timeline extended from 6 months to 12 months (larger scope, but more solid)
- Lighter tech stack (removed HealthKit, TimescaleDB, Gemini fallback)
- 45-minute onboarding becomes the most critical feature in the product

---

### [2026-01] PostgreSQL for the Knowledge Base, not a graph DB

**Decision:** Store the KB in PostgreSQL (schema: `field_name / field_value` per domain), not Neo4j or another graph database.

**Rejected alternatives:**
- **Neo4j:** More natural for relational data, but excessive operational complexity for a solo developer. No simple managed hosting.
- **MongoDB:** Flexible schema interesting for unstructured data, but loses ACID guarantees and Alembic migration ease.
- **Plain JSON in Redis:** Too fragile for permanent data.

**Reason for choice:** PostgreSQL is well-known, reliable, compatible with Supabase for production, and the schema `(user_id, domain, field_name, field_value, confidence, last_updated, source)` covers 95% of needs without over-engineering.

**Consequences:**
- Complex relationships (e.g. "this project involves this person from Relationships") are handled by field naming conventions, not true cross-domain foreign keys.
- If graph needs become critical in Phase 3, migration is possible but costly.

---

### [2026-01] Pinecone for episodic memory, not pgvector

**Decision:** Use Pinecone (managed service) rather than pgvector (PostgreSQL extension) for episodic memory.

**Rejected alternatives:**
- **pgvector:** Same database, fewer services to manage, but semantic search is 3-5x slower at scale and requires manual index tuning.
- **Weaviate / Qdrant:** Good products, but less mature in 2025 and higher deployment overhead.

**Reason for choice:** Pinecone free tier (100k vectors) is sufficient for Phase 1-2 solo. Guaranteed < 100ms latency. Zero infrastructure to maintain.

**Reconsider if:** Pinecone costs > $50/month (threshold to evaluate pgvector migration).

---

### [2026-01] Celery for fact extraction, not asyncio background task

**Decision:** Use Celery (with Redis as broker) for the post-conversation fact extraction job, rather than `asyncio.create_task()` or APScheduler.

**Rejected alternatives:**
- **`asyncio.create_task()`:** Quick to implement, but loses the job if the server restarts. No retry, no monitoring.
- **APScheduler:** Good for periodic jobs, not for event-triggered jobs with retry.
- **FastAPI BackgroundTasks:** Same problem as asyncio — no durability.

**Reason for choice:** Celery + Redis provides durability, automatic retry, and monitoring (Flower). Fact extraction takes up to 10s (GPT-4o call) — if the server restarts, we don't want to lose that job.

**Consequences:**
- One extra service to start in dev (see QUICKSTART.md)
- Celery unavailable → synchronous fallback implemented in `fact_extraction.py`

---

### [2026-01] GPT-4o only, no Gemini fallback

**Decision:** GPT-4o as the sole LLM, with no Gemini fallback.

**Rejected alternatives:**
- **Gemini fallback:** Two-provider resilience is appealing, but prompts differ between providers, character degrades, and the complexity of maintaining two integrations isn't justified solo.
- **GPT-4o-mini for some calls:** Considered for fact extraction jobs (cheaper), but extraction quality drops significantly.

**Reason for choice:** JARVIS is a quality product. Character consistency > theoretical resilience. If OpenAI is down, JARVIS is down — acceptable for a solo product in Phase 1.

**Reconsider:** GPT-4o-mini for fact extraction only (not in the voice hot path), if API costs > $50/month.

---

### [2026-02] expo-av rather than expo-audio for recording

**Decision:** Use `expo-av` for audio recording despite the availability of `expo-audio` (newer).

**Context:** `expo-audio` is the new Expo audio API, but it was still in beta at development time with incomplete documentation for WebSocket streaming.

**Reason for choice:** `expo-av` is stable, well-documented, used in production. `expo-audio` will be preferred when stable (Expo SDK 51+).

**Consequences:** Both packages are in `package.json` — remove `expo-audio` if unused.

---

## Prompt Engineering

---

### [2026-02] Layer 1 character prompt in English, not the user's language

**Decision:** The character system prompt (Layer 1) is written in English even if the user speaks another language.

**Reason:** GPT-4o performs slightly better at following complex instructions in English. JARVIS's final response can be in the user's language (it detects it) — only the system prompt is in English.

**Validated by:** Informal A/B test over 20 exchanges — character enforcement ~15% more consistent in English.

---

### [2026-02] Context build via asyncio.gather(), not sequential

**Decision:** The 3 memory tiers (PostgreSQL KB, Redis working memory, Pinecone episodic) are queried in parallel via `asyncio.gather()`.

**Reason:** Sequential = 100ms + 20ms + 300ms = ~420ms. Parallel = max(300ms) = ~300ms. On a total latency budget of < 2s, 120ms saved makes a difference.

**Consequences:** If one of the 3 queries fails, it silently returns an empty result. JARVIS degrades without crashing. ✓

---

## Lessons Learned

---

### [2026-02] Never check a timeline item before testing it

**What happened:** Several TIMELINE.md items marked `[X]` (Celery worker, Pinecone index) represented "the code exists" but not "the feature works end-to-end."

**Rule established:** A timeline item is checked only when the validation test specified in the month's checklist passes. "Code exists" → `[~]`. "Tested and validated" → `[X]`.

**Convention to follow:**
- `[ ]` — not started
- `[~]` — code written, not yet validated
- `[X]` — tested and validated against month criteria

---

### [2026-02] ContextBuilder was not wired into the hot path

**What happened:** `context_builder.py` existed and worked in isolation, but the voice WebSocket handler was still using a static prompt with no context injection. JARVIS was responding without knowing the user.

**Fix:** Add an explicit check in end-to-end integration tests: "Does JARVIS mention something from the KB in this response?"

**Regression test added:** `test_context_injection.py` — verifies that the JARVIS response contains at least one element from the mocked KB.

---

### [2026-02] Two conflicting audio packages in package.json

**What happened:** Both `expo-av` and `expo-audio` installed. On some iOS builds, peer conflict arose.

**Temporary fix:** `expo-audio` left installed but not imported. Remove if unused in Phase 2.

---

### [2026-01] RULES.md contained HealthKit references from the old architecture

**What happened:** The biometric → knowledge pivot was well documented in SUMMARY.md but RULES.md still had Apple Watch troubleshooting examples (section "Common Issues").

**Fix:** Clean up RULES.md. See the `## What Was Removed` section in STACK.md for the full list.

**Lesson:** When pivoting architecture, grep all `.md` files for terms from the old architecture (`HealthKit`, `biometric`, `Apple Watch`, `trust_level`, `intervention`) and remove or mark them `[DEPRECATED]`.

---

## Pending Decisions

| Decision | Target date | Context |
|----------|------------|---------|
| GPT-4o-mini for fact extraction | End of Phase 1 | Test quality vs cost. If output > 80% of GPT-4o quality at 10x cheaper → switch. |
| pgvector vs Pinecone long-term | Month 6 | If Pinecone > $30/month and still solo, evaluate pgvector migration. |
| Android support | Month 8 | iOS-first is correct for Phase 1-2. Android in Phase 3 if TestFlight demand justifies it. |
| Multi-user | Month 10 | Architecture already supports it (user_id everywhere). Decide if App Store = multi-user or personal app first. |
| On-device wake word model | Month 4 | Marked `[X]` in TIMELINE but exact model not fixed. Whisper on-device vs third-party solution. |