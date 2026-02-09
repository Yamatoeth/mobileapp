# J.A.R.V.I.S. Quick Start Guide

**Goal:** Get the app running locally in under 15 minutes.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **macOS** (Ventura 13.0+ recommended)
- [ ] **Xcode 15+** installed from App Store
- [ ] **Node.js 18+** (`node --version`)
- [ ] **Python 3.11+** (`python3 --version`)
- [ ] **Docker Desktop** installed and running
- [ ] **Apple Watch** paired with your iPhone (for real data)

### Install Missing Tools

**Node.js (via nvm):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Python (via pyenv):**
```bash
brew install pyenv
pyenv install 3.11.7
pyenv global 3.11.7
```

**Docker Desktop:**
Download from https://www.docker.com/products/docker-desktop

---

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/jarvis.git
cd jarvis

# Create environment files from templates
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env

# Start local databases (PostgreSQL + Redis)
docker-compose up -d

# Verify databases are running
docker ps  # Should show postgres and redis containers
```

---

## Step 2: Backend Setup (5 minutes)

```bash
cd backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Verify installation
python -c "import fastapi; print(f'FastAPI version: {fastapi.__version__}')"
```

**Configure API Keys in backend/.env:**
```bash
# Open backend/.env and add your API keys:
OPENAI_API_KEY=sk-proj-...       # Get from platform.openai.com
DEEPGRAM_API_KEY=...             # Get from deepgram.com
ELEVENLABS_API_KEY=...           # Get from elevenlabs.io
PINECONE_API_KEY=...             # Get from pinecone.io

# Generate a secure secret key
SECRET_KEY=$(openssl rand -hex 32)
echo "SECRET_KEY=$SECRET_KEY" >> .env
```

**Start the backend server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Test it works:**
- Open http://localhost:8000/docs in your browser
- You should see the FastAPI interactive documentation

---

## Step 3: Frontend Setup (5 minutes)

**In a new terminal:**
```bash
cd mobile

# Install dependencies (this may take 2-3 minutes)
npm install

# Install iOS pods (required for native modules)
cd ios && pod install && cd ..

# Configure environment
# Edit mobile/.env and set:
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=ws://localhost:8000/ws
```

**Start the Expo development server:**
```bash
npm start
```

**Launch on iOS Simulator:**
- Press `i` in the Expo terminal to launch iOS simulator
- Or run: `npm run ios`

**OR Launch on Physical iPhone (recommended for HealthKit):**
- Install **Expo Go** app from App Store on your iPhone
- Scan the QR code shown in the terminal
- App will load on your phone

---

## Step 4: First Launch & Permissions (3 minutes)

**When the app launches:**

1. **HealthKit Permissions**
   - Tap "Grant Permissions"
   - Enable: Heart Rate, Heart Rate Variability, Sleep Analysis
   - Tap "Allow"

2. **Microphone Permission**
   - Tap "Allow" when prompted for microphone access

3. **Notification Permission** (optional for Phase 1)
   - Can be skipped for now

4. **Verify Data Flow**
   - You should see live HRV and BPM updating every 5 seconds
   - If no data appears:
     - Ensure Apple Watch is paired and unlocked
     - Open the Health app on iPhone and verify data is present
     - Try restarting the app

---

## Step 5: Test Voice Interaction (2 minutes)

**In the app:**

1. Tap and hold the **microphone button** (center of screen)
2. Say: "What's my heart rate right now?"
3. Release the button
4. You should see:
   - Your speech transcribed as text
   - J.A.R.V.I.S. responding with your current BPM
   - Audio playback of the response

**If voice doesn't work:**
- Check backend logs for errors: Look at the terminal where uvicorn is running
- Verify API keys are correct in `backend/.env`
- Test individual components:
  - Transcription: POST to `/api/v1/voice/transcribe` in API docs
  - LLM: POST to `/api/v1/voice/generate` in API docs

---

## Troubleshooting

### Backend won't start

**Error: "ModuleNotFoundError: No module named 'fastapi'"**
```bash
# Ensure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Error: "FATAL: database "jarvis_db" does not exist"**
```bash
# Recreate database
docker-compose down -v
docker-compose up -d
alembic upgrade head
```

### Frontend won't build

**Error: "Unable to resolve module @react-navigation/native"**
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
cd ios && pod install && cd ..
```

**Error: "HealthKit authorization failed"**
- Ensure you're running on a physical device or simulator with Health app
- iOS Simulator: Use iPhone 14 or newer (has HealthKit support)
- Physical device: Ensure Apple Watch is paired

### No biometric data showing

**Check these in order:**
1. Open Health app on iPhone → Browse → Heart → Verify data exists
2. In J.A.R.V.I.S. app → Settings → Permissions → Ensure HealthKit is enabled
3. Backend logs: Look for "[HealthKit] No data available" warnings
4. Try manually adding a workout in Health app to generate fresh data

### Voice transcription not working

**Verify API keys:**
```bash
# In backend directory
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
print('OpenAI:', 'sk-' in os.getenv('OPENAI_API_KEY', ''))
print('Deepgram:', len(os.getenv('DEEPGRAM_API_KEY', '')) > 0)
"
```

**Test Deepgram directly:**
```bash
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test_audio.wav
```

---

## Next Steps

Once everything is working:

1. **Read the documentation:**
   - [PROJECT.md](./PROJECT.md) - Understand the full vision
   - [RULES.md](./RULES.md) - Learn coding standards
   - [TIMELINE.md](./TIMELINE.md) - See the development roadmap

2. **Run tests:**
   ```bash
   # Backend tests
   cd backend && pytest
   
   # Frontend tests
   cd mobile && npm test
   ```

3. **Start developing:**
   - Check [TIMELINE.md](./TIMELINE.md) for current week's goals
   - Pick a task from the milestone checklist
   - Create a feature branch: `git checkout -b feature/your-feature`
   - Code following [RULES.md](./RULES.md)
   - Submit PR when tests pass

4. **Dogfood the app:**
   - Use it daily for at least a week
   - Log bugs and UX issues in GitHub Issues
   - Track what works and what doesn't

---

## Development Workflow

**Daily routine:**
```bash
# Morning: Pull latest changes
git pull origin main

# Start backend (Terminal 1)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Start frontend (Terminal 2)
cd mobile
npm start

# Code, test, commit
git add .
git commit -m "[PHASE-1] Your commit message"
git push

# End of day: Stop services
# Ctrl+C in both terminals
docker-compose stop  # Stop databases (optional)
```

**Weekly review:**
- Run full test suite
- Update TIMELINE.md with completed tasks
- Review next week's milestones
- Refactor and clean up technical debt

---

## Getting Help

**If you're stuck:**

1. Check the troubleshooting section above
2. Search GitHub Issues for similar problems
3. Review relevant documentation (PROJECT.md, STACK.md, API.md)
4. Ask in GitHub Discussions
5. Contact: your.email@example.com

**When asking for help, include:**
- Exact error message
- Steps to reproduce
- Your environment (macOS version, Node/Python versions)
- Relevant logs (backend terminal output)

---

## Success Criteria

**You're ready to develop when:**
- [ ] Backend API docs load at http://localhost:8000/docs
- [ ] Mobile app shows live HRV/BPM data
- [ ] Voice interaction completes end-to-end (speak → transcribe → respond → play audio)
- [ ] Tests pass: `pytest` (backend) and `npm test` (frontend)
- [ ] No errors in console logs

**Congratulations! You're ready to build J.A.R.V.I.S.** 🎉

---

**Estimated total setup time:** 15-20 minutes (excluding first-time npm/pip downloads)

If you completed this in <20 minutes, you're ahead of schedule. Now go read [PROJECT.md](./PROJECT.md) to understand what you're building and why it matters.
