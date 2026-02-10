# J.A.R.V.I.S. Deployment Guide

This guide covers deploying J.A.R.V.I.S. from local development to production.

---

## Table of Contents
1. [Production Architecture](#production-architecture)
2. [Backend Deployment](#backend-deployment)
3. [Database Setup](#database-setup)
4. [iOS App Deployment](#ios-app-deployment)
5. [Environment Variables](#environment-variables)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Logging](#monitoring--logging)
8. [Disaster Recovery](#disaster-recovery)

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   iOS App (TestFlight/App Store)         │
│                   expo.jarvis.app (OTA Updates)          │
└─────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS/WSS
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Backend (Railway/Render/Fly.io)           │
│              api.jarvis.app (FastAPI + Uvicorn)          │
└─────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   PostgreSQL   │  │    Pinecone    │  │     Redis      │
│  (Supabase)    │  │   (Cloud)      │  │   (Upstash)    │
└────────────────┘  └────────────────┘  └────────────────┘
```

**Hosting Recommendations:**
- **Backend:** Railway (easiest), Render (reliable), or Fly.io (cheapest)
- **Database:** Supabase (PostgreSQL), AWS RDS, or DigitalOcean
- **Redis:** Upstash (serverless), AWS ElastiCache, or Redis Cloud
- **Vector DB:** Pinecone (managed)
- **Mobile:** TestFlight → App Store

---

## Backend Deployment

### Option 1: Railway (Recommended - Easiest)

**Why Railway:**
- Zero-config deployment from GitHub
- Automatic HTTPS
- Built-in PostgreSQL and Redis
- $5/month starter plan

**Setup (5 minutes):**

1. **Create Railway Account**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   ```

2. **Initialize Project**
   ```bash
   cd backend
   railway init
   # Select: "Create new project"
   # Name: jarvis-backend
   ```

3. **Add Services**
   ```bash
   # Add PostgreSQL
   railway add postgresql
   
   # Add Redis
   railway add redis
   ```

4. **Configure Deployment**
   
   Create `railway.json` in `backend/`:
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
       "healthcheckPath": "/health",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```

5. **Set Environment Variables**
   ```bash
   # Railway auto-provides DATABASE_URL and REDIS_URL
   
   # Add your API keys
   railway variables set OPENAI_API_KEY=sk-...
   railway variables set DEEPGRAM_API_KEY=...
   railway variables set ELEVENLABS_API_KEY=...
   railway variables set PINECONE_API_KEY=...
   railway variables set PINECONE_ENVIRONMENT=us-east-1-aws
   railway variables set SECRET_KEY=$(openssl rand -hex 32)
   ```

6. **Deploy**
   ```bash
   railway up
   ```

7. **Get Production URL**
   ```bash
   railway domain
   # Example: jarvis-backend-production.up.railway.app
   ```

8. **Run Migrations**
   ```bash
   railway run alembic upgrade head
   ```

**Custom Domain (Optional):**
```bash
# Add custom domain in Railway dashboard
# Settings → Domains → Add Custom Domain
# Point DNS: api.jarvis.app → railway domain
```

---

### Option 2: Render

**Why Render:**
- Free tier available
- Auto-deploy from GitHub
- Built-in SSL

**Setup:**

1. **Create account** at https://render.com

2. **Create Web Service**
   - New → Web Service
   - Connect GitHub repo
   - Name: `jarvis-backend`
   - Environment: `Python 3.11`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. **Add PostgreSQL**
   - New → PostgreSQL
   - Name: `jarvis-db`
   - Copy `Internal Database URL`

4. **Add Redis**
   - Use Upstash (Render doesn't provide Redis)
   - Create free account: https://upstash.com
   - Copy `Redis URL`

5. **Environment Variables**
   - Settings → Environment → Add variables
   - Paste all API keys + DATABASE_URL + REDIS_URL

6. **Deploy**
   - Auto-deploys on git push to main

---

### Option 3: Fly.io (Cheapest)

**Why Fly.io:**
- $0/month for small apps (free tier)
- Global edge deployment
- Excellent performance

**Setup:**

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth signup
   ```

2. **Initialize App**
   ```bash
   cd backend
   fly launch
   # App name: jarvis-backend
   # Region: Choose closest to you
   # PostgreSQL: Yes
   # Redis: Yes
   ```

3. **Configure `fly.toml`**
   ```toml
   app = "jarvis-backend"
   primary_region = "sjc"

   [build]
     builder = "paketobuildpacks/builder:base"

   [env]
     PORT = "8000"

   [[services]]
     internal_port = 8000
     protocol = "tcp"

     [[services.ports]]
       handlers = ["http"]
       port = 80
       force_https = true

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443

   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
   ```

4. **Set Secrets**
   ```bash
   fly secrets set OPENAI_API_KEY=sk-...
   fly secrets set DEEPGRAM_API_KEY=...
   fly secrets set ELEVENLABS_API_KEY=...
   fly secrets set SECRET_KEY=$(openssl rand -hex 32)
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

6. **Run Migrations**
   ```bash
   fly ssh console
   alembic upgrade head
   exit
   ```

---

## Database Setup

### PostgreSQL (Supabase - Recommended)

**Why Supabase:**
- Free tier: 500MB database
- Auto-backups
- Built-in auth (future use)
- Real-time subscriptions

**Setup:**

1. **Create Project**
   - Go to https://supabase.com
   - New Project → Name: `jarvis-db`
   - Region: Choose closest to backend

2. **Get Connection String**
   - Settings → Database → Connection String
   - Copy `URI` format

3. **Configure Backend**
   ```bash
   # In Railway/Render/Fly
   DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres
   ```

4. **Install TimescaleDB Extension**
   ```sql
   -- In Supabase SQL Editor
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
   ```

5. **Run Migrations**
   ```bash
   # From local machine
   export DATABASE_URL=postgresql://...
   alembic upgrade head
   ```

---

### Redis (Upstash - Recommended)

**Why Upstash:**
- Serverless (pay per request)
- Free tier: 10k commands/day
- Global edge network

**Setup:**

1. **Create Database**
   - Go to https://upstash.com
   - Create Database → Name: `jarvis-redis`
   - Region: Same as backend

2. **Get Connection String**
   - Copy `UPSTASH_REDIS_REST_URL`

3. **Configure Backend**
   ```bash
   REDIS_URL=rediss://default:[password]@[region].upstash.io:6379
   ```

---

### Pinecone (Vector Database)

**Setup:**

1. **Create Account**
   - Go to https://pinecone.io
   - Free tier: 1 index, 100k vectors

2. **Create Index**
   - Name: `jarvis-memory`
   - Dimensions: `1536` (OpenAI embedding size)
   - Metric: `cosine`
   - Environment: Choose closest region

3. **Get API Key**
   - API Keys → Create New Key
   - Copy key

4. **Configure Backend**
   ```bash
   PINECONE_API_KEY=your-api-key
   PINECONE_ENVIRONMENT=us-east-1-aws
   PINECONE_INDEX_NAME=jarvis-memory
   ```

---

## iOS App Deployment

### TestFlight (Beta Testing)

**Prerequisites:**
- Apple Developer Account ($99/year)
- App signed with production certificate

**Setup:**

1. **Configure App in Xcode**
   ```bash
   cd mobile
   npx expo prebuild  # Generate native iOS project
   ```

2. **Update app.json**
   ```json
   {
     "expo": {
       "name": "JARVIS",
       "slug": "jarvis",
       "version": "1.0.0",
       "ios": {
         "bundleIdentifier": "com.yourcompany.jarvis",
         "buildNumber": "1",
         "supportsTablet": false,
         "infoPlist": {
           "NSHealthShareUsageDescription": "JARVIS monitors your biometric data to provide personalized health insights.",
           "NSHealthUpdateUsageDescription": "JARVIS needs to read your health data to function."
         }
       }
     }
   }
   ```

3. **Build for TestFlight**
   ```bash
   eas build --platform ios --profile production
   # This uploads to App Store Connect automatically
   ```

4. **Configure in App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - My Apps → JARVIS → TestFlight
   - Add beta testers (email addresses)
   - Submit for beta review

5. **Invite Testers**
   - TestFlight → External Testing
   - Add up to 10,000 testers (free)

---

### App Store (Production Release)

**Prerequisites:**
- Beta testing completed
- Privacy policy URL
- Screenshots (6.7", 6.5", 5.5")
- App icon (1024x1024)

**Setup:**

1. **Prepare Assets**
   ```bash
   # Generate screenshots
   # Use iPhone 14 Pro Max simulator
   # Capture screenshots of:
   # - Biometric dashboard
   # - Voice interaction
   # - Settings screen
   ```

2. **Create App Listing**
   - App Store Connect → My Apps → JARVIS
   - App Information:
     - Name: "JARVIS - AI Executive Assistant"
     - Subtitle: "Biometric Performance Optimization"
     - Category: Health & Fitness
     - Privacy Policy URL: https://jarvis.app/privacy

3. **Add Version**
   - Version: 1.0.0
   - Description:
     ```
     JARVIS is your AI executive assistant that monitors your 
     biometric data in real-time to optimize your performance.
     
     Features:
     • Real-time heart rate variability (HRV) monitoring
     • Stress detection and intervention
     • Voice-based interaction
     • Proactive health recommendations
     
     Requires Apple Watch for full functionality.
     ```

4. **Upload Build**
   ```bash
   eas build --platform ios --profile production
   # Select the build in App Store Connect
   ```

5. **Submit for Review**
   - App Store Connect → Submit for Review
   - Answer review questions:
     - Uses HealthKit: Yes
     - Is a medical app: No (wellness tool)
     - Export compliance: No (no encryption beyond standard)

6. **Wait for Approval** (typically 24-48 hours)

---

## Environment Variables

### Backend Production Variables

**Required:**
```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# LLM & Voice APIs
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=jarvis-memory

# Security
SECRET_KEY=<64-char-hex-string>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
```

**Optional:**
```bash
# Rate Limiting
RATE_LIMIT_PER_MINUTE=100

# CORS
ALLOWED_ORIGINS=https://jarvis.app,https://www.jarvis.app

# Email (if using SendGrid)
SENDGRID_API_KEY=...
FROM_EMAIL=noreply@jarvis.app
```

---

### Frontend Production Variables

**Configure in `eas.json`:**
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.jarvis.app",
        "EXPO_PUBLIC_WS_URL": "wss://api.jarvis.app/ws",
        "EXPO_PUBLIC_ENV": "production"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging-api.jarvis.app",
        "EXPO_PUBLIC_WS_URL": "wss://staging-api.jarvis.app/ws",
        "EXPO_PUBLIC_ENV": "staging"
      }
    }
  }
}
```

---

## CI/CD Pipeline

### GitHub Actions (Automated Deployment)

**Create `.github/workflows/backend-deploy.yml`:**
```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway link ${{ secrets.RAILWAY_PROJECT_ID }}
          railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Run Migrations
        run: |
          railway run alembic upgrade head
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

**Create `.github/workflows/mobile-build.yml`:**
```yaml
name: Build iOS App

on:
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: |
          cd mobile
          npm ci
      
      - name: Run tests
        run: |
          cd mobile
          npm test
      
      - name: Build iOS (TestFlight)
        if: github.ref == 'refs/heads/main'
        run: |
          cd mobile
          eas build --platform ios --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Monitoring & Logging

### Sentry (Error Tracking)

**Backend Setup:**
```python
# app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("ENVIRONMENT", "production"),
    traces_sample_rate=1.0,
    integrations=[FastApiIntegration()]
)
```

**Frontend Setup:**
```typescript
// App.tsx
import * as Sentry from 'sentry-expo';

Sentry.init({
  dsn: 'https://...@sentry.io/...',
  enableInExpoDevelopment: false,
  environment: process.env.EXPO_PUBLIC_ENV,
});
```

---

### Logging (Structured Logs)

**Backend:**
```python
# app/core/logger.py
from loguru import logger
import sys

logger.remove()
logger.add(
    sys.stdout,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
    level="INFO" if os.getenv("ENVIRONMENT") == "production" else "DEBUG"
)
```

**Usage:**
```python
logger.info("User logged in", user_id=user.id)
logger.error("API call failed", error=str(e), url=url)
```

---

### Uptime Monitoring (UptimeRobot)

**Setup:**
1. Go to https://uptimerobot.com (free)
2. Add Monitor:
   - Type: HTTP(s)
   - URL: `https://api.jarvis.app/health`
   - Interval: 5 minutes
   - Alert: Email when down

---

## Disaster Recovery

### Database Backups

**Automated Backups (Supabase):**
- Daily automatic backups (retained 7 days)
- Manual backup before major releases:
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
  ```

**Restore from Backup:**
```bash
# Download backup from Supabase dashboard
psql $DATABASE_URL < backup_20250209.sql
```

---

### Secrets Management

**Store secrets in:**
- Railway: Built-in secrets manager
- GitHub: Repository secrets (for CI/CD)
- Local: `.env` file (never commit!)

**Rotate secrets quarterly:**
```bash
# Generate new SECRET_KEY
openssl rand -hex 32

# Update in Railway
railway variables set SECRET_KEY=new-key

# Update in GitHub Secrets
# Settings → Secrets → Update SECRET_KEY
```

---

### Rollback Strategy

**Backend Rollback:**
```bash
# Railway
railway rollback

# Or deploy specific commit
git revert HEAD
git push origin main
```

**Frontend Rollback:**
```bash
# Expo OTA update rollback
eas update --branch production --message "Rollback to previous version"

# Or submit new build with previous code
git revert HEAD
eas build --platform ios --profile production
```

---

## Pre-Launch Checklist

**Backend:**
- [ ] All environment variables set in production
- [ ] Database migrations run successfully
- [ ] Health check endpoint returns 200
- [ ] API documentation accessible at /docs
- [ ] Rate limiting configured
- [ ] CORS configured correctly
- [ ] Sentry error tracking active
- [ ] SSL certificate valid (automatic with Railway/Render)

**Frontend:**
- [ ] Production API URL configured
- [ ] HealthKit permissions tested
- [ ] Voice pipeline tested end-to-end
- [ ] App icon and splash screen set
- [ ] Privacy policy URL accessible
- [ ] TestFlight beta completed (10+ testers)
- [ ] No console.log statements in production build

**Infrastructure:**
- [ ] Database backups automated
- [ ] Uptime monitoring configured
- [ ] Alert emails configured
- [ ] Custom domain DNS configured (if using)
- [ ] CDN configured for static assets (if needed)

---

## Post-Launch Monitoring

**First 24 Hours:**
- [ ] Monitor Sentry for crashes
- [ ] Check API response times (Railway dashboard)
- [ ] Monitor database CPU/memory usage
- [ ] Track user signups and errors

**First Week:**
- [ ] Review user feedback in TestFlight
- [ ] Analyze most-used features (add analytics)
- [ ] Fix critical bugs immediately
- [ ] Monitor LLM API costs (OpenAI dashboard)

**Monthly:**
- [ ] Review server costs (optimize if >$100/month)
- [ ] Rotate secrets (SECRET_KEY, API keys)
- [ ] Database cleanup (old sessions, expired tokens)
- [ ] Update dependencies (security patches)

---

## Scaling Considerations

**When to scale (>1000 users):**

1. **Backend:**
   - Upgrade Railway plan ($20/month for 8GB RAM)
   - Add caching layer (Redis query cache)
   - Optimize slow database queries

2. **Database:**
   - Upgrade PostgreSQL (Supabase Pro: $25/month)
   - Add read replicas for heavy queries
   - Implement connection pooling (PgBouncer)

3. **Vector DB:**
   - Upgrade Pinecone ($70/month for production)
   - Optimize embedding generation (batch processing)

4. **Monitoring:**
   - Upgrade Sentry (for more events)
   - Add performance monitoring (Datadog/New Relic)

---

## Cost Breakdown (Production)

**Free Tier (0-100 users):**
- Backend: Railway free tier ($0)
- Database: Supabase free tier ($0)
- Redis: Upstash free tier ($0)
- Pinecone: Free tier ($0)
- **Total: $0/month + API usage**

**Paid Tier (100-1000 users):**
- Backend: Railway Starter ($5-20/month)
- Database: Supabase Pro ($25/month)
- Redis: Upstash Pay-as-you-go (~$5/month)
- Pinecone: Standard ($70/month)
- LLM APIs: ~$200/month (variable)
- **Total: ~$305-325/month**

**Scale Tier (1000+ users):**
- Infrastructure: ~$400/month
- LLM APIs: ~$2000/month
- **Total: ~$2400/month**

---

This deployment guide will get you from localhost to production in under 2 hours. Start with Railway (easiest), then optimize for cost/performance as you scale.

**Questions? Check the troubleshooting section or open a GitHub Issue.**