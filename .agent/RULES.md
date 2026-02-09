# RULES.md - J.A.R.V.I.S. Development Standards

## Table of Contents
1. [Core Principles](#core-principles)
2. [TypeScript/React Native Rules](#typescriptreact-native-rules)
3. [Python/FastAPI Rules](#pythonfastapi-rules)
4. [API Design Standards](#api-design-standards)
5. [State Management Patterns](#state-management-patterns)
6. [Error Handling](#error-handling)
7. [Performance Requirements](#performance-requirements)
8. [Security Standards](#security-standards)
9. [Testing Requirements](#testing-requirements)
10. [Documentation Standards](#documentation-standards)

---

## Core Principles

### 1. Latency is Sacred
Every millisecond matters in real-time voice interaction.

**Enforcement:**
- All API calls must have timeout limits (<2s for critical paths)
- Log latency for every operation (p50, p95, p99)
- Reject PRs that add >100ms to hot paths without justification

### 2. Type Safety Everywhere
No `any` types in TypeScript, no untyped dicts in Python.

**Enforcement:**
- TypeScript: `strict: true`, no `@ts-ignore` without comment explaining why
- Python: `mypy` with `strict = true`, all functions must have type hints

### 3. Privacy by Default
Assume every piece of data is subject to GDPR/HIPAA audit.

**Enforcement:**
- All biometric data must have explicit user consent checks
- Log what data is sent to external services (audit trail)
- Encrypt all data at rest and in transit

### 4. Fail Gracefully
The app should never crash. Degrade functionality, don't explode.

**Enforcement:**
- All external API calls wrapped in try/catch with fallbacks
- State machine must handle invalid transitions (log warning, maintain current state)
- Voice pipeline has text fallback if audio fails

---

## TypeScript/React Native Rules

### File Structure & Naming

```
src/
├── components/           # Reusable UI components
│   ├── BiometricCard.tsx
│   └── VoiceButton.tsx
├── screens/              # Full-screen views
│   ├── HomeScreen.tsx
│   └── SettingsScreen.tsx
├── services/             # External integrations
│   ├── HealthKitService.ts
│   ├── WebSocketService.ts
│   └── ApiClient.ts
├── hooks/                # Custom React hooks
│   ├── useBiometrics.ts
│   └── useVoiceStream.ts
├── store/                # Zustand stores
│   ├── biometricStore.ts
│   └── conversationStore.ts
├── types/                # TypeScript interfaces
│   ├── biometrics.ts
│   └── api.ts
└── utils/                # Pure functions
    ├── dateHelpers.ts
    └── validators.ts
```

**Naming Conventions:**
- Components: PascalCase (`BiometricCard`)
- Files: Match export name (`BiometricCard.tsx`)
- Hooks: camelCase with `use` prefix (`useBiometrics`)
- Services: PascalCase + `Service` suffix (`HealthKitService`)
- Types: PascalCase, interfaces prefix with `I` (`IBiometricData`)

### Component Structure

**Functional Components Only (No Classes):**
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BiometricCardProps {
  hrv: number;
  bpm: number;
  onPress?: () => void;
}

export const BiometricCard: React.FC<BiometricCardProps> = ({ 
  hrv, 
  bpm, 
  onPress 
}) => {
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    // Side effects here
    if (hrv < 30) {
      setIsHighlighted(true);
    }
  }, [hrv]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>HRV: {hrv}ms</Text>
      <Text style={styles.label}>BPM: {bpm}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    color: '#333',
  },
});
```

**Rules:**
- Always export component as named export (not default)
- Props interface must be explicitly typed
- Optional props use `?` syntax
- Styles at bottom of file (colocated with component)

### Custom Hooks Pattern

```typescript
import { useState, useEffect } from 'react';
import { HealthKitService } from '@/services/HealthKitService';

interface BiometricData {
  hrv: number;
  bpm: number;
  timestamp: Date;
}

export const useBiometrics = (pollIntervalMs: number = 5000) => {
  const [data, setData] = useState<BiometricData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBiometrics = async () => {
      try {
        setIsLoading(true);
        const result = await HealthKitService.getLatestBiometrics();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBiometrics();
    const interval = setInterval(fetchBiometrics, pollIntervalMs);

    return () => clearInterval(interval); // Cleanup
  }, [pollIntervalMs]);

  return { data, error, isLoading };
};
```

**Rules:**
- Return object, not array (easier to extend)
- Always include `error` and `isLoading` states
- Clean up intervals/subscriptions in return function
- Accept configuration via parameters (testable)

### State Management with Zustand

```typescript
// store/biometricStore.ts
import { create } from 'zustand';

interface BiometricState {
  hrv: number;
  bpm: number;
  trend: 'rising' | 'falling' | 'stable';
  lastUpdated: Date;
  // Actions
  updateBiometrics: (hrv: number, bpm: number) => void;
  reset: () => void;
}

export const useBiometricStore = create<BiometricState>((set) => ({
  hrv: 0,
  bpm: 0,
  trend: 'stable',
  lastUpdated: new Date(),
  
  updateBiometrics: (hrv, bpm) => 
    set((state) => {
      const trend = hrv > state.hrv ? 'rising' : hrv < state.hrv ? 'falling' : 'stable';
      return { hrv, bpm, trend, lastUpdated: new Date() };
    }),
  
  reset: () => 
    set({ hrv: 0, bpm: 0, trend: 'stable', lastUpdated: new Date() }),
}));
```

**Rules:**
- One store per domain (biometrics, conversation, settings)
- State is read-only (update via actions)
- Actions are synchronous (async logic in services)
- No nested stores (flat structure)

### Service Layer Pattern

```typescript
// services/HealthKitService.ts
import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';

export class HealthKitService {
  private static isInitialized = false;

  private static readonly PERMISSIONS: HealthKitPermissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.HeartRate,
        AppleHealthKit.Constants.Permissions.HeartRateVariability,
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
      ],
      write: [], // We never write to HealthKit
    },
  };

  static async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      AppleHealthKit.initHealthKit(this.PERMISSIONS, (error) => {
        if (error) {
          console.error('[HealthKit] Initialization failed:', error);
          reject(new Error(`HealthKit init failed: ${error}`));
          return;
        }
        this.isInitialized = true;
        console.log('[HealthKit] Initialized successfully');
        resolve();
      });
    });
  }

  static async getLatestHRV(): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const options = {
        startDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Last 5min
      };

      AppleHealthKit.getHeartRateVariabilitySamples(options, (error, results) => {
        if (error) {
          reject(new Error(`HRV fetch failed: ${error}`));
          return;
        }
        
        if (!results || results.length === 0) {
          reject(new Error('No HRV data available'));
          return;
        }

        // Return most recent sample
        const latestSample = results[results.length - 1];
        resolve(latestSample.value);
      });
    });
  }

  // Similar methods for BPM, sleep, etc.
}
```

**Rules:**
- Services are static classes (no instantiation needed)
- Throw descriptive errors (include context)
- Log all operations for debugging
- Validate preconditions (e.g., `isInitialized` check)
- Use TypeScript enums for constants

### Error Handling Pattern

```typescript
// utils/errorHandler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: 'low' | 'medium' | 'high'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleServiceError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', 'medium');
  }

  return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR', 'high');
};

// Usage in component
try {
  await HealthKitService.getLatestHRV();
} catch (error) {
  const appError = handleServiceError(error);
  if (appError.severity === 'high') {
    Alert.alert('Critical Error', appError.message);
  } else {
    console.warn(appError.message);
  }
}
```

**Rules:**
- Never catch and ignore errors (always log or handle)
- Use custom error classes for app-specific errors
- Categorize errors by severity
- User-facing error messages must be actionable ("Grant HealthKit permissions")

---

## Python/FastAPI Rules

### Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── api/
│   │   ├── __init__.py
│   │   ├── websocket.py     # WebSocket endpoints
│   │   └── rest.py          # REST endpoints
│   ├── core/
│   │   ├── state_machine.py
│   │   ├── intervention_engine.py
│   │   └── config.py
│   ├── db/
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── redis_client.py
│   │   └── pinecone_client.py
│   ├── services/
│   │   ├── openai_service.py
│   │   ├── elevenlabs_service.py
│   │   └── deepgram_service.py
│   └── schemas/
│       ├── biometrics.py    # Pydantic models
│       └── conversation.py
├── tests/
│   ├── test_state_machine.py
│   └── test_intervention_engine.py
└── requirements.txt
```

### Naming Conventions
- Modules: snake_case (`state_machine.py`)
- Classes: PascalCase (`StateMachine`)
- Functions/variables: snake_case (`calculate_stress_score`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- Private methods: underscore prefix (`_internal_method`)

### Type Hints (Mandatory)

```python
from typing import Optional, List, Dict, Literal
from datetime import datetime
from pydantic import BaseModel

# Pydantic models for validation
class BiometricData(BaseModel):
    hrv_ms: float
    bpm: int
    timestamp: datetime
    source: Literal["apple_watch", "manual"]

# Function signatures with full type hints
async def calculate_stress_score(
    biometric: BiometricData,
    context: Dict[str, str],
    historical_data: Optional[List[BiometricData]] = None
) -> float:
    """
    Calculate stress score from 0.0 (calm) to 1.0 (extreme stress).
    
    Args:
        biometric: Current biometric readings
        context: Environmental context (location, calendar)
        historical_data: Past 24h of biometric data (optional)
    
    Returns:
        Stress score as float between 0.0 and 1.0
    
    Raises:
        ValueError: If biometric data is invalid
    """
    if biometric.hrv_ms <= 0:
        raise ValueError(f"Invalid HRV value: {biometric.hrv_ms}")
    
    # Implementation...
    return 0.7
```

**Rules:**
- All functions must have type hints (args + return)
- Use `Literal` for string enums
- Use `Optional[T]` for nullable values
- Docstrings must include Args, Returns, Raises

### Async/Await Patterns

```python
import asyncio
from typing import List

# ✅ CORRECT: Async for I/O operations
async def fetch_biometric_history(user_id: str) -> List[BiometricData]:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/api/biometrics/{user_id}")
        return [BiometricData(**item) for item in response.json()]

# ✅ CORRECT: Sync for CPU-bound operations
def calculate_hrv_trend(data: List[float]) -> str:
    avg = sum(data) / len(data)
    return "rising" if avg > 40 else "falling"

# ✅ CORRECT: Concurrent async calls
async def get_full_context(user_id: str) -> Dict:
    biometric_task = fetch_biometric_history(user_id)
    calendar_task = fetch_calendar_events(user_id)
    
    biometrics, calendar = await asyncio.gather(
        biometric_task, 
        calendar_task
    )
    
    return {"biometrics": biometrics, "calendar": calendar}

# ❌ WRONG: Blocking call in async function
async def bad_example():
    time.sleep(2)  # This blocks the entire event loop!
    
# ✅ CORRECT: Use asyncio.sleep instead
async def good_example():
    await asyncio.sleep(2)
```

**Rules:**
- Use `async/await` for all I/O (network, DB, file)
- Use sync functions for CPU-bound work (math, parsing)
- Never use `time.sleep()` in async functions (use `asyncio.sleep()`)
- Use `asyncio.gather()` for parallel async calls

### State Machine Implementation

```python
from enum import Enum
from typing import Optional
from datetime import datetime

class LifeState(Enum):
    SLEEPING = "sleeping"
    EXERCISING = "exercising"
    WORKING = "working"
    MEETING = "meeting"
    LEISURE = "leisure"
    STRESSED = "stressed"

class StateMachine:
    def __init__(self):
        self.current_state: LifeState = LifeState.LEISURE
        self.state_entered_at: datetime = datetime.now()
        self.transition_log: List[str] = []
    
    def transition(
        self, 
        new_state: LifeState, 
        reason: str
    ) -> bool:
        """
        Attempt state transition with validation.
        
        Returns:
            True if transition succeeded, False if invalid
        """
        if not self._is_valid_transition(self.current_state, new_state):
            self._log_warning(
                f"Invalid transition: {self.current_state} -> {new_state}"
            )
            return False
        
        old_state = self.current_state
        self.current_state = new_state
        self.state_entered_at = datetime.now()
        
        log_entry = f"{old_state.value} -> {new_state.value}: {reason}"
        self.transition_log.append(log_entry)
        
        print(f"[StateMachine] {log_entry}")
        return True
    
    def _is_valid_transition(
        self, 
        from_state: LifeState, 
        to_state: LifeState
    ) -> bool:
        """Define allowed transitions."""
        # Can't go directly from SLEEPING to MEETING
        if from_state == LifeState.SLEEPING and to_state == LifeState.MEETING:
            return False
        
        # Can always transition to STRESSED
        if to_state == LifeState.STRESSED:
            return True
        
        return True  # Allow all other transitions
    
    def _log_warning(self, message: str) -> None:
        """Log warnings without raising exceptions."""
        print(f"[StateMachine WARNING] {message}")
```

**Rules:**
- State machine must validate all transitions
- Invalid transitions log warning but don't crash
- All transitions must be logged (audit trail)
- Use enums for states (type-safe)

### FastAPI Endpoint Pattern

```python
from fastapi import APIRouter, WebSocket, HTTPException, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["biometrics"])

class BiometricRequest(BaseModel):
    user_id: str
    hrv_ms: float
    bpm: int

class BiometricResponse(BaseModel):
    stress_score: float
    state: str
    intervention_needed: bool

@router.post("/biometrics", response_model=BiometricResponse)
async def submit_biometrics(
    request: BiometricRequest
) -> BiometricResponse:
    """
    Submit biometric data and receive stress assessment.
    
    Raises:
        HTTPException(400): Invalid biometric data
        HTTPException(500): Internal processing error
    """
    try:
        # Validation is automatic via Pydantic
        stress_score = await calculate_stress_score(
            BiometricData(
                hrv_ms=request.hrv_ms,
                bpm=request.bpm,
                timestamp=datetime.now(),
                source="apple_watch"
            ),
            context={}
        )
        
        return BiometricResponse(
            stress_score=stress_score,
            state="working",
            intervention_needed=stress_score > 0.7
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Biometric processing failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
```

**Rules:**
- Use Pydantic models for request/response (auto-validation)
- Always specify `response_model` (enforces output schema)
- Catch specific exceptions, re-raise as HTTPException
- Log all 500 errors for debugging

### Database Patterns

**SQLAlchemy Models:**
```python
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class BiometricRecord(Base):
    __tablename__ = "biometric_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    hrv_ms = Column(Float, nullable=False)
    bpm = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes for common queries
    __table_args__ = (
        Index("ix_user_timestamp", "user_id", "timestamp"),
    )
```

**Redis Caching:**
```python
import redis.asyncio as redis
import json
from typing import Optional

class RedisClient:
    def __init__(self, url: str):
        self.client = redis.from_url(url)
    
    async def set_working_memory(
        self, 
        user_id: str, 
        data: Dict,
        ttl_seconds: int = 86400  # 24 hours
    ) -> None:
        key = f"working_memory:{user_id}"
        await self.client.setex(
            key, 
            ttl_seconds, 
            json.dumps(data)
        )
    
    async def get_working_memory(
        self, 
        user_id: str
    ) -> Optional[Dict]:
        key = f"working_memory:{user_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None
```

**Rules:**
- Use SQLAlchemy ORM (not raw SQL)
- Always add indexes for query columns
- Use UTC timestamps (never local time)
- Redis keys follow `resource:identifier` pattern
- Set TTL on all Redis keys (prevent memory leaks)

---

## API Design Standards

### RESTful Conventions

```
GET    /api/v1/users/{user_id}              # Fetch user
POST   /api/v1/users                        # Create user
PATCH  /api/v1/users/{user_id}              # Update user
DELETE /api/v1/users/{user_id}              # Delete user

GET    /api/v1/users/{user_id}/biometrics   # Fetch user's biometrics
POST   /api/v1/biometrics                   # Submit biometric data
```

**Rules:**
- Use nouns, not verbs (`/users`, not `/getUsers`)
- Use plural nouns (`/users`, not `/user`)
- Nest resources logically (`/users/{id}/biometrics`)
- Version API (`/api/v1/...`)
- Use standard HTTP methods (GET, POST, PATCH, DELETE)

### WebSocket Protocol

```python
# Client → Server: Submit biometric data
{
  "type": "biometric_update",
  "payload": {
    "hrv_ms": 35.2,
    "bpm": 82,
    "timestamp": "2025-02-09T14:30:00Z"
  }
}

# Server → Client: Intervention notification
{
  "type": "intervention",
  "payload": {
    "severity": "medium",
    "message": "Your HRV is dropping. Take a 2-minute break.",
    "actions": ["dismiss", "start_breathing_exercise"]
  }
}

# Client → Server: Voice audio stream (binary)
{
  "type": "audio_chunk",
  "payload": "<base64-encoded-audio>"
}

# Server → Client: Transcription result
{
  "type": "transcription",
  "payload": {
    "text": "How stressed am I right now?",
    "confidence": 0.95
  }
}
```

**Rules:**
- All messages must have `type` and `payload` fields
- Use ISO 8601 for timestamps
- Binary data (audio) sent as base64
- Client must handle unknown message types gracefully

---

## Performance Requirements

### Latency Budgets

| Operation | Target | Max |
|-----------|--------|-----|
| Voice transcription (STT) | <500ms | 1s |
| LLM response (first token) | <800ms | 1.5s |
| TTS audio generation | <400ms | 800ms |
| **Total voice round-trip** | **<1.7s** | **3s** |
| HealthKit data fetch | <200ms | 500ms |
| State machine transition | <50ms | 100ms |
| Memory retrieval (Pinecone) | <300ms | 600ms |

### Optimization Rules

**Frontend:**
- Use `React.memo()` for expensive components
- Lazy load screens (`React.lazy()`)
- Debounce user inputs (search, sliders)
- Cache API responses (React Query or SWR)

**Backend:**
- Use connection pooling (Redis, PostgreSQL)
- Stream LLM responses (don't wait for completion)
- Cache frequent queries (Redis with 5min TTL)
- Use `asyncio.gather()` for parallel calls

---

## Security Standards

### Authentication (Phase 2+)

```typescript
// Frontend: Store JWT in secure storage
import * as SecureStore from 'expo-secure-store';

const storeAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token);
};

const getAuthToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync('auth_token');
};
```

```python
# Backend: Verify JWT on protected endpoints
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    token = credentials.credentials
    try:
        # Validate JWT (use PyJWT library)
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/protected")
async def protected_route(user_id: str = Depends(verify_token)):
    return {"user_id": user_id}
```

### Data Encryption

**At Rest:**
```python
from cryptography.fernet import Fernet

class EncryptionService:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        return self.cipher.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        return self.cipher.decrypt(encrypted_data.encode()).decode()
```

**In Transit:**
- All API calls use HTTPS (TLS 1.3)
- WebSocket connections use WSS (WebSocket Secure)
- Pin SSL certificates in mobile app (prevent MITM)

---

## Testing Requirements

### Unit Tests (Backend)

```python
import pytest
from app.core.state_machine import StateMachine, LifeState

def test_valid_state_transition():
    sm = StateMachine()
    assert sm.current_state == LifeState.LEISURE
    
    result = sm.transition(LifeState.WORKING, "Calendar event started")
    assert result is True
    assert sm.current_state == LifeState.WORKING

def test_invalid_state_transition():
    sm = StateMachine()
    sm.current_state = LifeState.SLEEPING
    
    result = sm.transition(LifeState.MEETING, "Invalid")
    assert result is False
    assert sm.current_state == LifeState.SLEEPING  # State unchanged

@pytest.mark.asyncio
async def test_stress_calculation():
    biometric = BiometricData(
        hrv_ms=25.0,  # Low HRV
        bpm=95,       # Elevated BPM
        timestamp=datetime.now(),
        source="apple_watch"
    )
    
    stress_score = await calculate_stress_score(biometric, {})
    assert 0.7 <= stress_score <= 1.0  # High stress
```

### Integration Tests (Frontend)

```typescript
import { render, waitFor } from '@testing-library/react-native';
import { BiometricCard } from '@/components/BiometricCard';

describe('BiometricCard', () => {
  it('displays biometric data correctly', () => {
    const { getByText } = render(
      <BiometricCard hrv={45} bpm={72} />
    );
    
    expect(getByText('HRV: 45ms')).toBeTruthy();
    expect(getByText('BPM: 72')).toBeTruthy();
  });
  
  it('highlights when HRV is low', async () => {
    const { getByTestId } = render(
      <BiometricCard hrv={25} bpm={85} />
    );
    
    await waitFor(() => {
      const card = getByTestId('biometric-card');
      expect(card.props.style).toMatchObject({ 
        backgroundColor: '#ffcccc' // Red highlight
      });
    });
  });
});
```

### Coverage Targets
- Backend `core/`: >80% coverage (this is the brain)
- Backend `services/`: >70% coverage
- Frontend `services/` and `hooks/`: >70% coverage
- Frontend `components/`: >60% coverage

---

## Documentation Standards

### Code Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// HealthKit returns HRV in milliseconds but our backend expects seconds
const hrvInSeconds = hrvMs / 1000;

// ❌ BAD: Comment just repeats the code
// Divide HRV by 1000
const hrvInSeconds = hrvMs / 1000;

// ✅ GOOD: Explain non-obvious logic
// We must wait 5 seconds after app launch before requesting HealthKit data
// because iOS needs time to sync data from the Watch
await delay(5000);
await HealthKitService.initialize();

// ✅ GOOD: Mark TODOs with context
// TODO(Phase-2): Replace this with ML model for stress prediction
const isStressed = hrv < 30 && bpm > 90;
```

### README Structure

Every directory with >3 files needs a README:

```markdown
# Services Directory

## Overview
External API integrations for HealthKit, OpenAI, ElevenLabs, etc.

## Files
- `HealthKitService.ts`: Manages Apple HealthKit data retrieval
- `ApiClient.ts`: HTTP client for backend communication
- `WebSocketService.ts`: Real-time communication with backend

## Usage
\```typescript
import { HealthKitService } from '@/services/HealthKitService';

await HealthKitService.initialize();
const hrv = await HealthKitService.getLatestHRV();
\```

## Testing
\```bash
npm test services/
\```
```

---

## Pre-Commit Checklist

Before committing code:

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Python type checks pass (`mypy app/`)
- [ ] All tests pass (`npm test` / `pytest`)
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] Updated relevant README if adding new files
- [ ] Ran formatter (`npm run format` / `black .`)

---

## Critical Anti-Patterns to Avoid

### ❌ Don't: Mutate state directly
```typescript
// BAD
const biometricStore = useBiometricStore();
biometricStore.hrv = 50; // Direct mutation

// GOOD
biometricStore.updateBiometrics(50, 75);
```

### ❌ Don't: Use `any` type
```typescript
// BAD
const processData = (data: any) => { ... }

// GOOD
const processData = (data: BiometricData) => { ... }
```

### ❌ Don't: Ignore errors
```python
# BAD
try:
    result = await external_api_call()
except:
    pass  # Silent failure

# GOOD
try:
    result = await external_api_call()
except Exception as e:
    logger.error(f"API call failed: {e}")
    raise
```

### ❌ Don't: Block the event loop
```python
# BAD (in async function)
time.sleep(2)

# GOOD
await asyncio.sleep(2)
```

### ❌ Don't: Store sensitive data in logs
```python
# BAD
print(f"User biometrics: {user_data}")

# GOOD
print(f"Processing biometrics for user {user_id}")
```

---

## Final Rule: When in Doubt, Ask

If you're unsure whether a pattern is correct:
1. Check this document first
2. Look for similar code in the existing codebase
3. Write a test to validate your approach
4. Document your decision in a comment

**The goal is code that you can understand 6 months from now.**
