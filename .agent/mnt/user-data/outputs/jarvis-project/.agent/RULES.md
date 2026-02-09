# AI Coding Assistant Rules for J.A.R.V.I.S. Project

## Context & Philosophy

You are assisting with the development of **J.A.R.V.I.S.** - a proactive AI executive assistant that monitors biometric data and intervenes to optimize human performance.

**Core Principles:**
1. **Latency is Sacred** - Every millisecond matters in real-time voice interaction
2. **Type Safety Everywhere** - No `any` in TypeScript, no untyped dicts in Python
3. **Privacy by Default** - Assume all data is subject to GDPR/HIPAA audit
4. **Fail Gracefully** - Degrade functionality, never crash

---

## Project Structure

```
jarvis/
├── mobile/              # React Native iOS app
├── backend/             # FastAPI Python server
├── docs/                # All documentation
├── .agent/              # This file (AI assistant rules)
└── docker-compose.yml   # Local development databases
```

**Always read these files before coding:**
1. `PROJECT.md` - Complete technical specification
2. `RULES.md` - Coding standards (TypeScript + Python)
3. `TIMELINE.md` - Current phase and weekly goals
4. `STACK.md` - Tech stack details
5. `API.md` - API contracts

---

## Code Generation Rules

### TypeScript/React Native

**Component Pattern:**
```typescript
// Always use functional components with TypeScript
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
  // Component implementation
};

const styles = StyleSheet.create({
  // Styles at bottom of file
});
```

**Key Rules:**
- ✅ Named exports (not default exports)
- ✅ Explicit prop types (no `any`)
- ✅ Functional components only (no classes)
- ✅ Hooks at top of component (before conditionals)
- ✅ Styles colocated with component (at bottom)
- ❌ Never use `@ts-ignore` without explanation comment
- ❌ No `console.log` in production code (use proper logging)

**Service Pattern:**
```typescript
export class HealthKitService {
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    // Implementation with proper error handling
  }

  static async getLatestHRV(): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized');
    }
    // Implementation
  }
}
```

---

### Python/FastAPI

**Endpoint Pattern:**
```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1", tags=["biometrics"])

class BiometricRequest(BaseModel):
    hrv_ms: float
    bpm: int
    timestamp: datetime

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
        # Implementation with type safety
        pass
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

**Key Rules:**
- ✅ All functions must have type hints (args + return)
- ✅ Use Pydantic models for validation
- ✅ Async/await for all I/O operations
- ✅ Docstrings with Args, Returns, Raises
- ✅ Use `Literal` for string enums
- ❌ Never use `time.sleep()` in async functions (use `asyncio.sleep()`)
- ❌ No bare `except:` blocks (catch specific exceptions)

---

## Common Tasks & Patterns

### Adding a New API Endpoint

**Steps:**
1. Define Pydantic request/response models
2. Add endpoint to router with proper HTTP method
3. Implement business logic with error handling
4. Write pytest tests (>80% coverage for core logic)
5. Update `API.md` with endpoint documentation
6. Add TypeScript type in `mobile/src/types/api.ts`
7. Create service method in frontend

**Example PR checklist:**
- [ ] Backend endpoint implemented with types
- [ ] Tests written and passing
- [ ] Frontend types match backend models
- [ ] API.md updated with examples
- [ ] Error handling tested (400, 500 cases)

### Adding a New React Native Screen

**Steps:**
1. Create screen component in `mobile/src/screens/`
2. Add navigation route in `App.tsx`
3. Create necessary hooks in `mobile/src/hooks/`
4. Add state management in Zustand store if needed
5. Write component tests (>60% coverage)
6. Add screen to navigation types

**Example:**
```typescript
// mobile/src/screens/BiometricHistoryScreen.tsx
import React from 'react';
import { useBiometricHistory } from '@/hooks/useBiometricHistory';

export const BiometricHistoryScreen: React.FC = () => {
  const { data, isLoading, error } = useBiometricHistory();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <View>
      {/* Screen implementation */}
    </View>
  );
};
```

### Implementing State Machine Transition

**Always validate transitions:**
```python
class StateMachine:
    def transition(self, new_state: LifeState, reason: str) -> bool:
        """Attempt state transition with validation."""
        if not self._is_valid_transition(self.current_state, new_state):
            self._log_warning(f"Invalid transition: {self.current_state} -> {new_state}")
            return False
        
        # Log transition
        log_entry = f"{self.current_state.value} -> {new_state.value}: {reason}"
        self.transition_log.append(log_entry)
        
        self.current_state = new_state
        return True
```

**Key principles:**
- Invalid transitions log warning but don't crash
- All transitions must be logged (audit trail)
- Use enums for states (type-safe)

---

## Testing Expectations

### Backend (pytest)

**Minimum requirements:**
```python
import pytest
from app.core.state_machine import StateMachine, LifeState

def test_valid_state_transition():
    sm = StateMachine()
    result = sm.transition(LifeState.WORKING, "Calendar event started")
    assert result is True
    assert sm.current_state == LifeState.WORKING

@pytest.mark.asyncio
async def test_stress_calculation():
    # Test with low HRV
    biometric = BiometricData(hrv_ms=25.0, bpm=95, timestamp=datetime.now())
    stress_score = await calculate_stress_score(biometric, {})
    assert 0.7 <= stress_score <= 1.0
```

**Coverage targets:**
- `core/`: >80%
- `services/`: >70%

### Frontend (Jest)

**Minimum requirements:**
```typescript
import { render, waitFor } from '@testing-library/react-native';
import { BiometricCard } from '@/components/BiometricCard';

describe('BiometricCard', () => {
  it('displays biometric data correctly', () => {
    const { getByText } = render(<BiometricCard hrv={45} bpm={72} />);
    expect(getByText('HRV: 45ms')).toBeTruthy();
  });
  
  it('highlights when HRV is low', async () => {
    const { getByTestId } = render(<BiometricCard hrv={25} bpm={85} />);
    await waitFor(() => {
      const card = getByTestId('biometric-card');
      expect(card.props.style).toMatchObject({ backgroundColor: '#ffcccc' });
    });
  });
});
```

**Coverage targets:**
- `services/` and `hooks/`: >70%
- `components/`: >60%

---

## Performance Requirements

**Voice Pipeline Latency Budget:**
| Stage | Target | Max |
|-------|--------|-----|
| Audio upload | <200ms | <500ms |
| STT processing | <500ms | <1s |
| LLM first token | <800ms | <1.5s |
| TTS generation | <400ms | <800ms |
| **Total** | **<1.9s** | **<3s** |

**Database Query Limits:**
- Simple queries (indexed): <50ms
- Complex aggregations: <200ms
- Vector search (Pinecone): <300ms

**When implementing features:**
1. Always add timeout limits to API calls
2. Log latency for every operation (p50, p95, p99)
3. Reject implementations that add >100ms to hot paths without strong justification

---

## Error Handling Patterns

### Backend
```python
try:
    result = await external_api_call()
except httpx.TimeoutException:
    logger.error("API timeout", extra={"url": url})
    raise HTTPException(status_code=504, detail="External service timeout")
except ValueError as e:
    logger.warning(f"Validation error: {e}")
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

### Frontend
```typescript
try {
  const data = await HealthKitService.getLatestHRV();
  setHrv(data);
} catch (error) {
  const appError = handleServiceError(error);
  if (appError.severity === 'high') {
    Alert.alert('Critical Error', appError.message);
  } else {
    console.warn('[HealthKit]', appError.message);
  }
}
```

**Rules:**
- Never catch and ignore errors silently
- Always log errors with context
- User-facing error messages must be actionable
- Categorize errors by severity (low/medium/high)

---

## Documentation Requirements

**Every new feature must include:**
1. Code comments explaining "why" (not "what")
2. Function docstrings with Args, Returns, Raises
3. Update to relevant .md file (API.md, STACK.md, etc.)
4. Update TIMELINE.md if milestone achieved

**Good comment example:**
```typescript
// We must wait 5 seconds after app launch before requesting HealthKit data
// because iOS needs time to sync data from the Watch
await delay(5000);
await HealthKitService.initialize();
```

**Bad comment example:**
```typescript
// Divide HRV by 1000
const hrvInSeconds = hrvMs / 1000;
```

---

## Security Checklist

**Before implementing any feature that handles user data:**
- [ ] Data encrypted at rest (if stored)
- [ ] Data encrypted in transit (HTTPS/WSS)
- [ ] User consent obtained (if new data type)
- [ ] No PII in logs
- [ ] API keys in environment variables (not code)
- [ ] Rate limiting implemented
- [ ] Input validation via Pydantic/TypeScript

**Biometric data is HIPAA-sensitive - treat it accordingly.**

---

## Git Workflow

**Commit Message Format:**
```
[PHASE-1] Add HealthKit HRV retrieval service

- Created HealthKitService class with 5-minute polling
- Added error handling for permission denials
- Implemented exponential backoff for API limits
- Tests: 85% coverage on HealthKitService
```

**Branch naming:**
- `feature/trust-system`
- `fix/voice-latency-spike`
- `refactor/state-machine-logic`

**PR requirements:**
- [ ] All tests pass
- [ ] Type checking passes (tsc/mypy)
- [ ] Linting passes (eslint/black)
- [ ] Documentation updated
- [ ] No `console.log` or print statements in production code

---

## When to Ask for Clarification

**Always ask before:**
- Making breaking changes to API contracts
- Adding new external dependencies (npm/pip packages)
- Changing database schema
- Modifying state machine transitions
- Implementing features not in current phase

**Example questions:**
- "This would require adding a new dependency (react-native-camera). Should I proceed?"
- "The current API contract uses `hrv_ms` but the frontend expects `hrvMs`. Which should I change?"
- "This feature is in Phase 3 but we're in Phase 1. Should I implement it now?"

---

## Current Phase Context

**You are currently in: Phase 1 - Foundation (Weeks 1-8)**

**Phase 1 Goals:**
- Build biometrically-aware voice assistant
- NO proactive interruptions (that's Phase 2+)
- Focus on reliability and latency optimization

**In scope for Phase 1:**
- HealthKit integration
- Voice pipeline (STT → LLM → TTS)
- State machine
- Basic memory (24h window)
- Calendar/location context

**Out of scope (Phase 2+):**
- Proactive notifications
- Trust level system
- Calendar modifications
- Intervention logic

**When implementing features, always check TIMELINE.md to ensure it's in the current phase.**

---

## Code Review Checklist

**Before submitting code for review:**
- [ ] Follows patterns in RULES.md
- [ ] Tests written and passing (coverage targets met)
- [ ] Type checking passes (no `any` in TypeScript)
- [ ] Error handling implemented (no bare try/catch)
- [ ] Documentation updated (docstrings, README, API.md)
- [ ] Performance targets met (latency <target)
- [ ] Security checklist completed (if handling user data)
- [ ] No console.log or debug print statements

---

## Common Gotchas & Solutions

### Problem: HealthKit returns no data
**Solution:**
```typescript
// Always check for empty results and provide helpful error
const results = await AppleHealthKit.getHeartRateVariabilitySamples(options);
if (!results || results.length === 0) {
  throw new Error('No HRV data available. Ensure Apple Watch is paired and has collected data.');
}
```

### Problem: WebSocket connection drops
**Solution:**
```python
# Implement reconnection logic with exponential backoff
async def connect_with_retry(max_attempts: int = 5):
    for attempt in range(max_attempts):
        try:
            return await websocket.connect()
        except Exception:
            wait = 2 ** attempt  # 1s, 2s, 4s, 8s, 16s
            await asyncio.sleep(wait)
    raise ConnectionError("Max reconnection attempts exceeded")
```

### Problem: LLM response too slow
**Solution:**
```python
# Use streaming to get first token ASAP
async def stream_llm_response(prompt: str):
    async for chunk in openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True  # Critical for low latency
    ):
        yield chunk
```

### Problem: React Native app crashes on background
**Solution:**
```typescript
// Implement proper cleanup in useEffect
useEffect(() => {
  const subscription = HealthKitService.subscribe((data) => {
    setHrv(data.hrv);
  });
  
  return () => {
    subscription.unsubscribe(); // Critical cleanup
  };
}, []);
```

---

## Resources & References

**Internal documentation:**
- [PROJECT.md](../PROJECT.md) - Technical specification
- [RULES.md](../RULES.md) - Coding standards
- [API.md](../API.md) - API reference
- [STACK.md](../STACK.md) - Tech stack
- [TIMELINE.md](../TIMELINE.md) - Development roadmap

**External documentation:**
- React Native: https://reactnative.dev/docs
- FastAPI: https://fastapi.tiangolo.com/
- OpenAI API: https://platform.openai.com/docs
- HealthKit: https://developer.apple.com/documentation/healthkit

---

## Final Reminders

1. **Read PROJECT.md first** - Understand the vision before coding
2. **Follow RULES.md strictly** - Consistency matters more than cleverness
3. **Check TIMELINE.md** - Ensure feature is in current phase
4. **Write tests first** - TDD prevents rework
5. **Optimize for latency** - Every millisecond matters
6. **Privacy is non-negotiable** - Biometric data is HIPAA-sensitive
7. **Ask before assuming** - Clarification prevents wasted work

**The goal is shipping a working MVP in 6 months, not building the perfect architecture.**

---

You are assisting with an ambitious but achievable project. Focus on pragmatic solutions that ship, not perfect solutions that never launch.

**Now go build J.A.R.V.I.S.** 🚀
