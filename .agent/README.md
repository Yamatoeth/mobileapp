# J.A.R.V.I.S. - Your AI Executive Assistant

> **Just A Rather Very Intelligent System**

A proactive AI assistant that monitors your biological state, environmental context, and behavioral patterns in real-time to optimize human performance.

[![Phase](https://img.shields.io/badge/Phase-1%20Foundation-blue)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()
[![iOS](https://img.shields.io/badge/Platform-iOS%2014%2B-black)]()

---

## 🎯 What is J.A.R.V.I.S.?

Unlike traditional AI chatbots that wait for prompts, J.A.R.V.I.S. functions as a **digital Chief of Staff** that:

✅ **Monitors your biology** - Real-time HRV, heart rate, sleep quality via Apple Watch  
✅ **Understands context** - Calendar events, location, ambient conditions  
✅ **Intervenes proactively** - Suggests breaks before burnout, not after  
✅ **Earns authority** - Progresses from Consultant → Advisor → Manager → Executive  
✅ **Remembers everything** - Semantic memory of patterns across weeks/months  

**Think:** JARVIS from Iron Man, but for your health and productivity.

---

## 🚀 Quick Start

### Prerequisites
- **macOS** (for iOS development)
- **Node.js 18+** and **Python 3.11+**
- **Docker** (for local databases)
- **Xcode 15+** (with iOS Simulator)
- **Apple Watch** (for real biometric data)

### Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/jarvis.git
cd jarvis

# 2. Start databases
docker-compose up -d

# 3. Setup backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 4. Setup frontend (new terminal)
cd mobile
npm install
npm run ios
```

**First Launch:**
1. Grant HealthKit permissions when prompted
2. Pair your Apple Watch if not already paired
3. Say "Hello JARVIS" to test voice pipeline

---

## 📚 Documentation

**Core Documents:**
- **[PROJECT.md](./PROJECT.md)** - Complete technical specification and philosophy
- **[RULES.md](./RULES.md)** - Coding standards and best practices
- **[TIMELINE.md](./TIMELINE.md)** - 6-month development roadmap with weekly milestones
- **[STACK.md](./STACK.md)** - Detailed tech stack and infrastructure
- **[API.md](./API.md)** - REST and WebSocket API specification

**Getting Started:**
1. Read [PROJECT.md](./PROJECT.md) to understand the vision
2. Review [RULES.md](./RULES.md) before writing code
3. Follow [TIMELINE.md](./TIMELINE.md) for weekly goals
4. Reference [STACK.md](./STACK.md) for setup instructions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 MOBILE APP (React Native)                │
│  Voice Interface • Biometric Display • Real-time Charts │
└─────────────────────────────────────────────────────────┘
                         ▲ ▼ WebSocket + REST
┌─────────────────────────────────────────────────────────┐
│                BACKEND (FastAPI + Python)                │
│  State Machine • Decision Engine • Memory Hierarchy     │
└─────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    PostgreSQL            Pinecone               Redis
  (Structured Data)    (Vector Search)      (Working Memory)
```

**Key Components:**
- **State Machine** - 6 life states (Sleeping, Exercising, Working, Meeting, Leisure, Stressed)
- **Intervention Engine** - Confidence-based decision logic (>85% threshold)
- **Memory Hierarchy** - Working (24h) → Episodic (30d) → Semantic (lifetime)
- **Trust System** - 4 levels with escalating permissions

---

## 🎨 Features by Phase

### Phase 1: Foundation (Weeks 1-8) ✅
- [x] HealthKit integration (HRV, BPM, Sleep)
- [x] Voice pipeline (Deepgram STT → GPT-4 → ElevenLabs TTS)
- [x] State machine with context awareness
- [x] Calendar and location integration
- [x] Basic conversational memory (24h window)
- **Target:** <2s voice latency, 90% state accuracy

### Phase 2: Intelligence Layer (Weeks 9-16) 🚧
- [ ] Proactive notification system
- [ ] Pattern detection (recurring stress moments)
- [ ] Hierarchical memory (episodic + semantic)
- [ ] Intervention decision logic (confidence scoring)
- [ ] Explanation logging and transparency
- **Target:** 70% intervention acceptance, <5% false positives

### Phase 3: Autonomy (Weeks 17-24) 📅
- [ ] Trust level system (Consultant → Executive)
- [ ] Voice interruption capability
- [ ] Calendar management (reschedule meetings)
- [ ] Communication drafting (emails, messages)
- [ ] Health intervention execution (breathing, movement)
- **Target:** 90% autonomous action endorsement

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest --cov=app tests/
mypy app/
```

**Coverage targets:**
- `core/`: >80% (state machine, decision logic)
- `services/`: >70% (external integrations)

### Frontend Tests
```bash
cd mobile
npm test
npm run type-check
```

**Coverage targets:**
- `services/` and `hooks/`: >70%
- `components/`: >60%

### Manual Testing
```bash
# Weekly dogfooding checklist
- [ ] Voice interaction works end-to-end
- [ ] Biometric data updates every 5 minutes
- [ ] State machine correctly identifies all 6 states
- [ ] No crashes over 24-hour continuous run
```

---

## 📊 Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Voice round-trip latency | <2s (p95) | TBD |
| HealthKit data fetch | <500ms | TBD |
| State machine transition | <50ms | TBD |
| Memory retrieval (Pinecone) | <300ms | TBD |
| App launch time | <2s | TBD |

---

## 🔐 Privacy & Security

**Data Classification:**
- **Never leaves device:** Raw heart rate waveforms, audio recordings
- **Encrypted in transit:** HRV/BPM summaries, location (city-level)
- **Stored encrypted:** Conversation transcripts, user goals

**User Controls:**
- Explicit opt-in for each data type
- One-click data export (GDPR compliance)
- Nuclear option: Delete all server data

**Security Measures:**
- TLS 1.3 for all API communication
- AES-256 encryption at rest
- JWT authentication with 7-day expiration
- Rate limiting (100 req/min per user)

---

## 🛠️ Tech Stack

**Frontend:**
- React Native 0.73 + Expo SDK 50
- TypeScript 5.3 (strict mode)
- Zustand (state management)
- React Query (server state)

**Backend:**
- FastAPI 0.109 + Python 3.11
- PostgreSQL 16 + TimescaleDB
- Redis 7.2 (working memory)
- Pinecone (vector search)

**External Services:**
- OpenAI GPT-4o (LLM)
- Deepgram (speech-to-text)
- ElevenLabs (text-to-speech)
- Sentry (error tracking)

See [STACK.md](./STACK.md) for complete details.

---

## 🤝 Contributing

This is currently a **solo project** focused on rapid MVP development. Contributions will be accepted after Phase 3 launch.

**If you want to help now:**
1. Test the app and report bugs (GitHub Issues)
2. Suggest features (GitHub Discussions)
3. Share usage patterns (what works, what doesn't)

**Code contributions:**
- All PRs must pass tests and type checking
- Follow [RULES.md](./RULES.md) coding standards
- Include tests for new features
- Update documentation

---

## 📈 Roadmap

**Q1 2025:** Phase 1 - Foundation ✅  
**Q2 2025:** Phase 2 - Intelligence Layer  
**Q3 2025:** Phase 3 - Autonomy  
**Q4 2025:** Public Beta Launch

**2026 Vision:**
- Android support
- Computer vision integration (posture analysis)
- Multi-wearable support (Oura, Whoop, CGM)
- Team sync features (collective stress monitoring)

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

**Disclaimer:** J.A.R.V.I.S. is a wellness tool, not a medical device. Always consult healthcare professionals for medical advice.

---

## 🙏 Acknowledgments

**Inspiration:**
- Iron Man (JARVIS character)
- Andrew Huberman (neuroscience of performance)
- Peter Attia (quantified health)

**Technologies:**
- Anthropic Claude (this documentation was co-written with Claude)
- OpenAI (LLM infrastructure)
- React Native community

---

## 📫 Contact

**Developer:** [Your Name]  
**Email:** your.email@example.com  
**Twitter:** @yourhandle  
**Website:** https://jarvis.app

---

<div align="center">

**"The best way to predict the future is to build it."**

Made with ❤️ and biometric data

</div>
