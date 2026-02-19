# J.A.R.V.I.S. — Coding & Prompt Standards

> These rules apply to every line of code and every prompt written in this project. Consistency > individual creativity. Read this file before writing any code.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [TypeScript / React Native](#2-typescript--react-native)
3. [Python / FastAPI](#3-python--fastapi)
4. [Prompt Engineering Rules](#4-prompt-engineering-rules)
5. [Testing](#5-testing)
6. [Git & Versioning](#6-git--versioning)
7. [Performance Rules](#7-performance-rules)
8. [Common Problems & Solutions](#8-common-problems--solutions)

---

## 1. Core Principles

**Latency is Sacred.** Every millisecond counts in a real-time voice interaction. Never block the hot path.

**Type Safety Everywhere.** No `any` in TypeScript. No untyped dicts in Python. If you can't type something, it's a signal the architecture isn't clear.

**Privacy by Default.** Every piece of data is potentially GDPR-sensitive. Treat it that way by default.

**Fail Gracefully.** Degrade functionally, never crash. A JARVIS without episodic memory (Pinecone down) is better than a crash.

**Ship Phase 1 first.** If the feature isn't in the current phase of TIMELINE.md, it's not in the sprint. No exceptions.

---

## 2. TypeScript / React Native

### Component pattern

```typescript
// Always functional components with strict TypeScript
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

interface VoiceButtonProps {
  onPressIn: () => void;
  onPressOut: () => void;
  isRecording: boolean;
  isDisabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onPressIn,
  onPressOut,
  isRecording,
  isDisabled = false,
}) => {
  const handlePressIn = useCallback(() => {
    if (!isDisabled) onPressIn();
  }, [isDisabled, onPressIn]);

  return (
    <View style={styles.container}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
      >
        <Text style={styles.label}>
          {isRecording ? 'Listening...' : 'Hold to speak'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#00B4D8',
    fontSize: 14,
    fontFamily: 'Rajdhani_500Medium',
  },
});
```

### Zustand stores — rules

```typescript
// One store = one domain. No catch-all global store.
// Flat state only — no deeply nested objects.
// Always type the store interface explicitly.

interface VoiceState {
  status: 'idle' | 'recording' | 'processing' | 'speaking';
  transcript: string;
  error: string | null;
}

interface VoiceActions {
  setStatus: (status: VoiceState['status']) => void;
  setTranscript: (text: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: VoiceState = {
  status: 'idle',
  transcript: '',
  error: null,
};

export const useVoiceStore = create<VoiceState & VoiceActions>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
```

### Strict TypeScript rules

```typescript
// ✅ Always
const response: ApiResponse<KnowledgeDomain> = await fetchDomain('goals');

// ❌ Never
const response: any = await fetchDomain('goals');
const data = response.data; // untyped chain
```

```typescript
// ✅ Explicit union types for states
type VoiceStatus = 'idle' | 'recording' | 'processing' | 'speaking';

// ❌ Generic string
type VoiceStatus = string;
```

```typescript
// ✅ Optional chaining + nullish coalescing
const goal = user?.knowledgeBase?.goals?.[0] ?? 'No goals set';

// ❌ Direct access without guard
const goal = user.knowledgeBase.goals[0];
```

### Naming conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `VoiceButton`, `KnowledgeDomainCard` |
| Hooks | camelCase with `use` | `useVoiceStore`, `useKnowledgeBase` |
| Stores | camelCase | `voiceStore`, `conversationStore` |
| Constants | SCREAMING_SNAKE | `MAX_RECORDING_DURATION` |
| Types/Interfaces | PascalCase | `KnowledgeDomain`, `ApiResponse<T>` |
| Component files | PascalCase | `VoiceButton.tsx` |
| Utils/hooks files | camelCase | `useAudioRecorder.ts` |

### Colour palette — use only these values

```typescript
// Never hardcode a colour elsewhere. Always import from theme.ts
export const COLORS = {
  background: '#0A0A0A',
  surface1: '#141414',
  surface2: '#1E1E1E',
  accent: '#00B4D8',       // Cyan — JARVIS voice, interactive elements
  gold: '#FFB703',          // Gold — status, labels
  textPrimary: '#F0F4F8',
  textSecondary: '#8892A4',
  success: '#4CAF50',
  error: '#EF5350',
} as const;
```

---

## 3. Python / FastAPI

### Endpoint pattern

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])

class KnowledgeDomainResponse(BaseModel):
    domain: str
    fields: dict[str, str]
    completeness: float
    last_updated: Optional[str] = None

@router.get("/{domain}", response_model=KnowledgeDomainResponse)
async def get_knowledge_domain(
    domain: str,
    user_id: str = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeDomainResponse:
    """
    Get all fields for a knowledge domain.
    
    Args:
        domain: One of identity, goals, projects, finances, relationships, patterns
        user_id: From JWT token
    
    Returns:
        KnowledgeDomainResponse with all fields and completeness score
    
    Raises:
        404: Domain not found
        422: Invalid domain name
    """
    valid_domains = {"identity", "goals", "projects", "finances", "relationships", "patterns"}
    if domain not in valid_domains:
        raise HTTPException(status_code=422, detail=f"Invalid domain: {domain}")
    
    try:
        result = await knowledge_service.get_domain(db, user_id, domain)
        if not result:
            raise HTTPException(status_code=404, detail=f"No knowledge found for domain: {domain}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get knowledge domain {domain} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### ContextBuilder — mandatory pattern

```python
# backend/app/core/context_builder.py
# This pattern is non-negotiable. Every LLM call goes through it.

import asyncio
from typing import Dict, Any, Optional

class ContextBuilder:
    async def build_context(
        self, 
        user_id: str, 
        query: Optional[str] = None,
        timeout: float = 0.3  # 300ms max
    ) -> Dict[str, Any]:
        """
        Build the 4-layer prompt context. Target: under 300ms.
        
        Fails gracefully: if any layer fails, returns empty dict for that layer.
        Never raises — always returns something.
        """
        kb_task = asyncio.create_task(self._fetch_knowledge_summary(user_id))
        wm_task = asyncio.create_task(self._fetch_working_memory(user_id))
        em_task = asyncio.create_task(self._fetch_episodic(user_id, query))
        
        try:
            results = await asyncio.wait_for(
                asyncio.gather(kb_task, wm_task, em_task, return_exceptions=True),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.warning(f"Context build timeout for user {user_id}, using partial context")
            results = [{}, {}, []]
        
        knowledge_summary = results[0] if not isinstance(results[0], Exception) else {}
        working_memory = results[1] if not isinstance(results[1], Exception) else {}
        episodic = results[2] if not isinstance(results[2], Exception) else []
        
        return {
            "knowledge_summary": knowledge_summary,
            "working_memory": working_memory,
            "episodic": episodic,
        }
```

### Fact Extractor — confidence rules

```python
# Confidence scoring — strict rules

CONFIDENCE_THRESHOLDS = {
    "write_to_kb": 0.6,      # Minimum to write to KB
    "overwrite_manual": 1.1,  # Never (> 1.0 = impossible) — manual entries are never automatically overwritten
    "financial_data": 0.8,    # Higher threshold for financial data
}

# Scoring guide
# 0.9+  : Explicit, unambiguous statement ("My goal is X")
# 0.7-0.9: Clear implication ("I've decided to X")
# 0.5-0.7: Possible update ("I'm thinking about X")
# < 0.5 : Do not write to KB
# source="manual" : NEVER automatically overwritten
```

### Async — absolute rules

```python
# ✅ Always async for I/O operations
async def get_user_goals(user_id: str, db: AsyncSession) -> list[Goal]:
    result = await db.execute(select(Goal).where(Goal.user_id == user_id))
    return result.scalars().all()

# ❌ Never block inside an async handler
def get_user_goals_WRONG(user_id: str):
    time.sleep(0.1)  # Blocks the entire event loop
    return db.query(Goal).filter(Goal.user_id == user_id).all()
```

```python
# ✅ asyncio.gather() for parallel operations
kb, memory, episodic = await asyncio.gather(
    get_knowledge(user_id),
    get_working_memory(user_id),
    get_episodic(user_id, query),
)

# ❌ Sequential when parallel is possible
kb = await get_knowledge(user_id)           # 100ms
memory = await get_working_memory(user_id)  # 20ms
episodic = await get_episodic(user_id, query)  # 300ms
# Total: 420ms instead of 300ms
```

### Python naming conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | snake_case | `context_builder.py`, `fact_extractor.py` |
| Classes | PascalCase | `ContextBuilder`, `FactExtractor` |
| Functions/methods | snake_case | `build_context()`, `extract_facts()` |
| Constants | SCREAMING_SNAKE | `CONFIDENCE_THRESHOLDS`, `MAX_RETRIES` |
| Variables | snake_case | `user_id`, `knowledge_summary` |
| Pydantic models | PascalCase | `KnowledgeDomainUpdate`, `ConversationSummary` |

### Logging — always structured

```python
# ✅ Structured with context
logger.info("Context built", user_id=user_id, duration_ms=elapsed, layers_loaded=3)
logger.error("Pinecone search failed", user_id=user_id, error=str(e), query=query[:50])

# ❌ Print or string formatting
print(f"Context built for {user_id}")
logger.error(f"Error: {e}")
```

---

## 4. Prompt Engineering Rules

> See `PROMPT.md` for the full specification. These rules are the operational summary.

### Core rules

**1. No hardcoded prompts outside `prompt_engine.py`.** All templates live in that file. Zero exceptions.

**2. Always version.** Every prompt modification = version bump in `PROMPT_VERSION`. See PROMPT.md section 9.

**3. Test before merging.** Every Layer 1 change must pass the 10 golden examples in PROMPT.md section 7. Minimum score: 10/10.

**4. Never hardcode prompts in tests.** Tests call `build_system_prompt()`, they do not reconstruct the prompt manually.

**5. Log the version on every LLM call.**

```python
logger.info("LLM call", 
    prompt_version=PROMPT_VERSION,
    user_id=user_id,
    layers_loaded=layers_present,
    estimated_tokens=token_estimate
)
```

### Verification before every LLM call

```python
def validate_before_llm_call(system_prompt: str, user_message: str) -> bool:
    """Guard to call before every GPT-4o invocation."""
    
    # Token budget
    estimated = (len(system_prompt) + len(user_message)) // 4
    if estimated > 3000:
        logger.warning(f"Prompt budget exceeded: ~{estimated} tokens")
        # Truncate Layer 3 (working memory) first
        return False
    
    # Layer 1 always present
    if "You are JARVIS" not in system_prompt:
        logger.error("Layer 1 character missing from system prompt!")
        return False
    
    return True
```

### What the JARVIS character prompt must NEVER output

```python
FORBIDDEN_PATTERNS = [
    "As an AI",
    "I'm happy to",
    "Of course!",
    "Certainly!",
    "That's a great question",
    "It's important to note",
    "Here are some things to consider",
    "Feel free to",
    "I'd be happy to help",
]
# These patterns in production = character regression. Alert immediately.
```

---

## 5. Testing

### Minimum coverage

| Module | Target coverage |
|--------|---------------|
| `context_builder.py` | 90% |
| `fact_extractor.py` | 85% |
| `prompt_engine.py` | 95% |
| API endpoints | 80% |
| React components | 70% |

### Python test pattern

```python
# tests/test_context_builder.py
import pytest
from unittest.mock import AsyncMock, patch
from app.core.context_builder import ContextBuilder

@pytest.mark.asyncio
async def test_context_builder_injects_knowledge_base():
    """ContextBuilder must always return a knowledge_summary."""
    builder = ContextBuilder()
    
    with patch.object(builder, '_fetch_knowledge_summary', new_callable=AsyncMock) as mock_kb:
        mock_kb.return_value = {"goals": [{"description": "€8,000/month"}]}
        
        context = await builder.build_context("user_123", query="priorities")
        
        assert "knowledge_summary" in context
        assert len(context["knowledge_summary"].get("goals", [])) > 0

@pytest.mark.asyncio
async def test_context_builder_graceful_degradation():
    """If Pinecone fails, the context builder must not crash."""
    builder = ContextBuilder()
    
    with patch.object(builder, '_fetch_episodic', side_effect=Exception("Pinecone down")):
        # Must not raise
        context = await builder.build_context("user_123")
        
        # Episodic empty, but the rest is present
        assert context["episodic"] == []
        assert "knowledge_summary" in context

@pytest.mark.asyncio
async def test_context_builder_timeout():
    """The context builder must respect the 300ms timeout."""
    import asyncio
    builder = ContextBuilder()
    
    async def slow_pinecone(*args, **kwargs):
        await asyncio.sleep(1.0)  # Simulate slow Pinecone
        return []
    
    with patch.object(builder, '_fetch_episodic', side_effect=slow_pinecone):
        import time
        start = time.monotonic()
        context = await builder.build_context("user_123", timeout=0.3)
        elapsed = time.monotonic() - start
        
        assert elapsed < 0.5  # Generous buffer
        assert context["episodic"] == []  # Graceful empty
```

### Critical integration test — Context Injection

```python
# tests/integration/test_context_injection.py

@pytest.mark.asyncio
async def test_jarvis_response_references_knowledge_base():
    """
    Most important test in the project.
    Verifies that JARVIS responses actually use the KB.
    
    This test must pass before checking off Week 8 in TIMELINE.md.
    """
    # Setup: KB with a specific goal
    mock_kb = {
        "goals": [{"description": "Reach €8,000/month by December"}],
        "projects": [{"name": "ProjectX", "status": "blocked"}]
    }
    
    # Call prompt engine with this context
    system_prompt = build_system_prompt({"knowledge_summary": mock_kb})
    
    # Verify the goal is in the prompt
    assert "€8,000" in system_prompt or "8,000" in system_prompt
    assert "ProjectX" in system_prompt
    
    # If using a real LLM call in testing, verify the response mentions it
    # (with mocked OpenAI in CI, or real call in local testing)
```

### React Native test pattern

```typescript
// __tests__/components/VoiceButton.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceButton } from '../src/components/VoiceButton';

describe('VoiceButton', () => {
  it('calls onPressIn when pressed', () => {
    const mockPressIn = jest.fn();
    const mockPressOut = jest.fn();
    
    const { getByTestId } = render(
      <VoiceButton
        onPressIn={mockPressIn}
        onPressOut={mockPressOut}
        isRecording={false}
      />
    );
    
    fireEvent(getByTestId('voice-button'), 'pressIn');
    expect(mockPressIn).toHaveBeenCalledTimes(1);
  });

  it('does not call onPressIn when disabled', () => {
    const mockPressIn = jest.fn();
    
    const { getByTestId } = render(
      <VoiceButton
        onPressIn={mockPressIn}
        onPressOut={jest.fn()}
        isRecording={false}
        isDisabled={true}
      />
    );
    
    fireEvent(getByTestId('voice-button'), 'pressIn');
    expect(mockPressIn).not.toHaveBeenCalled();
  });
});
```

---

## 6. Git & Versioning

### Branch naming

```
main          — stable production only
dev           — continuous integration
feature/      — new features (feature/context-builder-v2)
fix/          — bug fixes (fix/websocket-reconnect)
prompt/       — prompt changes (prompt/v1.1-character-update)
infra/        — infrastructure (infra/redis-config)
```

### Commit convention

```
type(scope): short description

Types: feat, fix, refactor, test, docs, prompt, infra, chore
Scope: voice, kb, memory, ui, api, prompt

Examples:
feat(kb): add confidence threshold validation for financial data
fix(voice): resolve WebSocket reconnection on iOS background
prompt(v1.1): tighten character enforcement, add pushback examples
test(context): add integration test for KB injection in voice handler
docs(rules): remove deprecated HealthKit references
```

### Merge rules

- Never push directly to `main`
- PR minimum: 1 reviewer (yourself after 24 hours of distance if solo)
- All tests pass before merge
- For prompt changes: golden examples validated (see PROMPT.md)

---

## 7. Performance Rules

### Latency budget — non-negotiable

| Stage | Target | Hard limit | Action if exceeded |
|-------|--------|-----------|-------------------|
| Audio → backend (WS) | <200ms | 400ms | Check audio compression |
| Deepgram STT (streaming) | <300ms | 700ms | Check Deepgram tier |
| Context Builder (3 tiers) | <300ms | 500ms | Verify asyncio.gather() |
| GPT-4o first token | <800ms | 1500ms | Verify streaming enabled |
| ElevenLabs first audio chunk | <400ms | 800ms | Verify streaming enabled |
| **Total end-to-end** | **<2.0s** | **3.0s** | **Degrade to text only** |

### Graceful degradation order

```python
# Degradation order when latency exceeds targets:
# 1. Skip Layer 4 (Pinecone) → context without episodic
# 2. Truncate Layer 3 to 10 conversations instead of 30
# 3. Minimal Layer 2 summary (3 fields instead of full)
# 4. Text-only fallback (no ElevenLabs TTS) if latency > 3s
# 5. NEVER: response without Layer 1 (character definition)
```

### Performance prohibitions

```python
# ❌ Never in the voice hot path
time.sleep()           # Blocking
requests.get()         # Blocking HTTP
db.execute() sync      # Blocking DB

# ❌ Never without cache
def build_kb_summary():  # Called on every message without cache
    return db.query(...)  # 100ms every time → use Redis cache 5min
```

---

## 8. Common Problems & Solutions

### Problem: WebSocket disconnects in iOS background

**Cause:** iOS suspends network connections when the app goes to the background.

**Solution:**
```typescript
// mobile/src/hooks/useWebSocket.ts
import { AppState, AppStateStatus } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      // App returns to foreground — reconnect
      reconnectWebSocket();
    }
  });
  return () => subscription.remove();
}, []);

// With exponential backoff
const reconnectWithBackoff = async (attempt: number = 0) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  await new Promise(resolve => setTimeout(resolve, delay));
  try {
    await connect();
  } catch {
    if (attempt < 5) reconnectWithBackoff(attempt + 1);
  }
};
```

### Problem: LLM response too slow (> 800ms to first token)

**Possible causes:**
1. Streaming not enabled → verify `stream=True` in the OpenAI call
2. Prompt too long → verify `validate_prompt_budget()` before the call
3. Layer 4 (Pinecone) blocking → verify the timeout in `build_context()`

**Solution:**
```python
# Always stream
async def stream_llm_response(messages: list, user_id: str):
    async with openai_client.chat.completions.stream(
        model="gpt-4o",
        messages=messages,
        max_tokens=500,  # Limit for voice — keep responses short
        stream=True,
    ) as stream:
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

### Problem: Fact extraction writes wrong information to the KB

**Cause:** Confidence too low accepted, or conflict resolution misconfigured.

**Solution:**
```python
# Always validate before writing
def should_write_to_kb(update: KnowledgeUpdate, existing: Optional[KnowledgeEntry]) -> bool:
    # Rule 1: manual entry = untouchable
    if existing and existing.source == "manual":
        return False
    
    # Rule 2: minimum confidence
    if update.confidence < CONFIDENCE_THRESHOLDS["write_to_kb"]:
        return False
    
    # Rule 3: financial data = higher threshold
    if update.domain == "finances" and update.confidence < CONFIDENCE_THRESHOLDS["financial_data"]:
        return False
    
    # Rule 4: don't lower existing confidence
    if existing and existing.confidence > update.confidence:
        return False
    
    return True
```

### Problem: JARVIS character degrades over time (generic responses)

**Cause:** Layer 1 too short, or context taking up too much space and drowning the character.

**Solution:**
1. Check `PROMPT_VERSION` in logs — look for a recent modification that shortened Layer 1
2. Test the golden examples from PROMPT.md
3. Ensure Layer 1 is **always first** in the system prompt, before any context
4. Verify the system prompt doesn't exceed 2000 tokens (budget)

### Problem: ContextBuilder returns empty context

**Possible cause:** Onboarding not completed, or `ContextBuilder` not wired into the WebSocket handler.

**Diagnosis:**
```python
# Add this temporary log in the voice WebSocket handler
context = await context_builder.build_context(user_id, query=transcript)
logger.debug("Context built", 
    has_kb=bool(context.get("knowledge_summary")),
    has_memory=bool(context.get("working_memory")),
    has_episodic=len(context.get("episodic", [])),
    user_id=user_id
)
# If has_kb=False → verify the WebSocket handler actually calls build_context()
# If has_kb=True but KB is empty → onboarding not done
```

---

## Final Reminders

1. **Read PROJECT.md before coding** — understand the vision before implementing
2. **Consult PROMPT.md before any prompt change** — don't improvise
3. **Check TIMELINE.md** — is the feature in the current phase?
4. **Test first** — TDD prevents rework
5. **Optimise latency** — every millisecond counts in the voice hot path
6. **Privacy non-negotiable** — see PRIVACY.md for every data decision

**The goal is to ship a working Phase 1 MVP, not a perfect architecture that never ships.**