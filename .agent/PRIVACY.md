# J.A.R.V.I.S. — Privacy & Data Security

> JARVIS stores the most personal information a person can share: goals, finances, relationships, behavioural patterns. This document defines exactly how that data is handled, protected, and deleted. It is also the foundation of the privacy policy required for the App Store.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Data Map](#2-data-map)
3. [Encryption & Technical Security](#3-encryption--technical-security)
4. [Third-Party Data Sharing](#4-third-party-data-sharing)
5. [User Rights](#5-user-rights)
6. [Retention & Deletion](#6-retention--deletion)
7. [Incident & Breach Protocol](#7-incident--breach-protocol)
8. [App Store Compliance](#8-app-store-compliance)
9. [GDPR Checklist](#9-gdpr-checklist)

---

## 1. Core Principles

**1. Audio never stored.** User audio is streamed to Deepgram, transcribed, and immediately destroyed. No audio file is persisted anywhere.

**2. Conversations stored as text only.** Transcriptions are summarised (not stored verbatim in production) and encrypted at rest.

**3. Financial data: high confidence threshold.** No financial data with confidence < 0.8 is persisted in the Knowledge Base.

**4. The user controls everything.** Full export in one click. Complete and irreversible deletion in one click. Per-domain opt-out.

**5. No training on your data.** OpenAI API used with `training_opt_out: true`. Your conversations do not train OpenAI's models.

**6. Minimal collection.** We only collect what is necessary for JARVIS to function. No behavioural tracking, no third-party usage metrics.

---

## 2. Data Map

### What is collected

| Data | Storage | Duration | Encrypted | Deletable |
|------|---------|----------|-----------|-----------|
| User audio | Never (stream only) | 0s | N/A | N/A |
| Raw transcription | RAM only | Session duration | N/A | Automatic |
| Conversation summary | PostgreSQL + Redis | See retention | AES-256 | Yes |
| Knowledge Base (6 domains) | PostgreSQL | Permanent until deletion | AES-256 | Yes |
| Episodic vectors | Pinecone | Permanent until deletion | Pinecone-managed | Yes |
| API access logs | Backend logs | 30 days | Transport (HTTPS) | No (technical) |
| JWT tokens | Client (secure storage) | 7 days | Expo SecureStore | Yes (logout) |

### What is never collected

- GPS location
- Phone contacts
- Health data (HealthKit removed)
- Photos / camera
- Advertising identifier (IDFA)
- Web browsing data
- Any third-party data (social networks, banks, etc.)

---

## 3. Encryption & Technical Security

### At rest

**PostgreSQL:**
```
- Encryption: AES-256 at column level for sensitive tables
- Tables covered: knowledge_*, conversations, users
- Encryption key: stored in environment variables, never in the database
- Implementation: SQLAlchemy + Python cryptography library
```

**Redis (working memory):**
```
- In-memory only by design
- 30-day TTL on all working_memory:* keys
- Redis AUTH enabled in production
- No Redis persistence to disk (SAVE "" in redis.conf)
```

**Pinecone:**
```
- Encryption managed by Pinecone (AES-256)
- Metadata stored with vectors: user_id, date, topic_tags only
- Never raw conversation content in Pinecone metadata
```

**Expo SecureStore (iOS):**
```
- JWT tokens and API keys stored via expo-secure-store
- Uses iOS Keychain natively (AES-256 hardware)
- Automatically cleared if the app is uninstalled
```

### In transit

```
- HTTPS mandatory for all REST endpoints
- WSS (WebSocket Secure) for the audio stream
- Certificate pinning: consider for Phase 3 before App Store submission
- TLS 1.3 minimum in production
```

### Secrets management

```bash
# In dev: local .env (never committed)
# In prod: Railway/Render environment variables
# Never in code, never in logs

# Key rotation: every 90 days for SECRET_KEY JWT
# Third-party API keys: rotated if compromise suspected
```

---

## 4. Third-Party Data Sharing

### What is shared and with whom

| Service | Data sent | Why | Opt-out possible |
|---------|----------|-----|-----------------|
| **OpenAI** | Transcription + KB context (anonymised) | LLM inference | No (core feature) |
| **Deepgram** | Audio stream | STT | No (core feature) |
| **ElevenLabs** | JARVIS response text | TTS | No (core feature) |
| **Pinecone** | Numerical vectors + minimal metadata | Episodic memory | Yes (disables long-term memory) |
| **Sentry** | Error stack traces (anonymised) | Error tracking | Yes (in settings) |

### What is never shared

- Raw financial data to any third party other than OpenAI (in LLM context)
- Conversation content to analytics services
- Knowledge Base to data brokers
- User data to advertising partners (JARVIS has no advertising)

### OpenAI — important detail

OpenAI calls include Knowledge Base context to personalise responses. By design, OpenAI receives summaries of your personal life. Mitigation:
- `training_opt_out` option enabled (data not used to train models)
- Content sent to OpenAI is the minimum necessary (context truncated if token budget exceeded)
- OpenAI zero-data retention policy applied

---

## 5. User Rights

### Full export (GDPR Article 20 — Portability)

**Endpoint:** `POST /data/export`

**Export contents:**
```json
{
  "export_date": "2026-02-19T10:00:00Z",
  "user": { "id": "...", "created_at": "..." },
  "knowledge_base": {
    "identity": [...],
    "goals": [...],
    "projects": [...],
    "finances": [...],
    "relationships": [...],
    "patterns": [...]
  },
  "conversations": [
    { "date": "...", "summary": "...", "exchange_count": 12 }
  ],
  "knowledge_updates_log": [...]
}
```

**Format:** Human-readable JSON, directly downloadable from the app.
**Delay:** Immediate for < 1,000 conversations. Async + notification for larger volumes.

### Complete deletion (GDPR Article 17 — Right to be forgotten)

**Endpoint:** `DELETE /data/all`
**Confirmation required:** Exact string `"DELETE_ALL_MY_DATA"` in the request body.

**What is deleted:**
- All rows in `knowledge_*` tables for this `user_id`
- All Redis keys matching `*:{user_id}*`
- All Pinecone vectors filtered by `user_id`
- The user account itself

**What is not deleted:**
- Technical infrastructure logs (without personal data)
- Database backups (deleted during the next backup cycle, max 30 days)

**Delay:** Immediate for PostgreSQL and Redis. Pinecone: confirmed within 24 hours.

### Per-domain opt-out

The user can disable collection and storage for each KB domain:

```
Settings > Privacy > Data Collected
☑ Identity
☑ Goals
☑ Projects  
☐ Financial data     ← disabled: JARVIS stores nothing about finances
☑ Relationships
☑ Patterns
```

When a domain is disabled:
- Fact extraction ignores that domain
- Existing fields are deleted
- Layer 2 (context injection) excludes that domain

---

## 6. Retention & Automatic Deletion

| Data | Retention | Automatic deletion |
|------|----------|--------------------|
| Conversation summaries (Redis) | 30-day rolling window | Automatic Redis TTL |
| Conversation summaries (PostgreSQL) | 1 year | Monthly cron — purges conversations > 1 year |
| Knowledge Base | Permanent | Never automatic, only on request |
| Pinecone vectors | Permanent | Never automatic |
| Application logs | 30 days | Automatic loguru rotation |
| Sentry error logs | 90 days | Sentry data retention policy |

### Purge cron

```python
# backend/app/tasks/data_retention.py
# Celery job — runs on the 1st of every month

async def purge_old_conversations():
    """Delete PostgreSQL conversations older than 1 year."""
    cutoff = datetime.now() - timedelta(days=365)
    await db.execute(
        "DELETE FROM conversations WHERE created_at < :cutoff",
        {"cutoff": cutoff}
    )
    logger.info(f"Purged conversations older than {cutoff}")
```

---

## 7. Incident & Breach Protocol

### Definition of an incident

- Unauthorised access to the database
- API key leak in logs or code
- Misconfiguration exposing user data
- Compromise of a service account (Railway, Supabase, etc.)

### Protocol in case of breach

**Immediate (< 1 hour):**
1. Cut access: change all secrets (SECRET_KEY, third-party API keys)
2. Identify scope: which data, which users, which time window
3. Lock the compromised account if applicable

**Within 24 hours:**
4. Notify affected users by email (GDPR Article 34)
5. If financial or sensitive data was exposed: notify within 72 hours maximum

**Within 72 hours:**
6. Written post-mortem: how it happened, what was done, how to prevent recurrence
7. If applicable: notify the supervisory authority (ICO in UK, CNIL in France — GDPR Article 33)

### Contact

In case of incident: sole decision and action by the lead developer. No escalation process (solo product).

---

## 8. App Store Compliance

### Apple App Store — Privacy Nutrition Label

For App Store submission, declare:

**Data Used to Track You:** None

**Data Linked to You:**
- Contact Info (email — for the account)
- User Content (conversations, knowledge base entries)

**Data Not Linked to You:**
- Diagnostics (crash reports via Sentry, anonymised)

### Phrasings to avoid

Never write in App Store descriptions:
- "Monitors your health" (implies medical data — immediate Apple flag)
- "Analyses your stress" (same)
- "Access to your medical data"

Correct phrasings:
- "Your personal assistant that learns who you are"
- "Remembers your goals and projects through conversation"
- "No access to your health, location, or contacts"

### Privacy Policy URL

Required for the App Store. Host at: `https://jarvis.app/privacy`

Minimum required content is a simplified version of this document + GDPR sections.

---

## 9. GDPR Checklist

Validate before any public launch (external TestFlight or App Store).

**Legal basis:**
- [ ] Explicit consent during onboarding (not a pre-ticked box)
- [ ] Purpose clearly explained before collection
- [ ] Ability to withdraw consent at any time

**User rights:**
- [ ] Data export functional and tested (`POST /data/export`)
- [ ] Complete deletion functional and tested (`DELETE /data/all`)
- [ ] Per-domain opt-out implemented and tested
- [ ] Response time < 30 days for any access request

**Technical security:**
- [ ] AES-256 encryption at rest for all personal data tables
- [ ] HTTPS/WSS mandatory in production
- [ ] Secrets not logged (grep check on production logs)
- [ ] Database access restricted (no direct public access)

**Third-party:**
- [ ] DPA (Data Processing Agreement) signed with OpenAI
- [ ] DPA signed with Deepgram
- [ ] DPA signed with ElevenLabs
- [ ] Training opt-out option enabled with OpenAI

**Documentation:**
- [ ] Privacy Policy published and accessible
- [ ] Legal notices complete
- [ ] DPO (Data Protection Officer) contact listed — even if that's you