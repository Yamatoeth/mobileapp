# J.A.R.V.I.S. Development Standards

## Core Principles

### 1. Latency is Sacred
Every millisecond matters in voice interaction. A 2-second response feels instant. A 3-second response kills the product.

- All API calls must have timeout limits
- Log latency for every operation (STT, LLM, TTS, context build)
- Never add a synchronous operation to the hot path without measuring its impact

### 2. Type Safety Everywhere
No `any` in TypeScript. No untyped dicts in Python.

- TypeScript: `strict: true`, no `@ts-ignore` without explanation comment
- Python: `mypy` strict mode, all functions must have type hints

### 3. The Knowledge Base is Sacred
The Knowledge Base is the product. Treat it with the same care you would give production financial data.

- Never overwrite a field without logging the old value in `knowledge_updates`
- Never allow a low-confidence extraction to silently overwrite a high-confidence manual entry
- Every automated Knowledge Base update must be traceable to a source conversation

### 4. Fail Gracefully
The app must never crash. Degrade functionality, never explode.

- All external API calls wrapped in try/catch with fallbacks
- If context build fails, fall back to minimal system prompt (do not crash the voice call)
- If TTS fails, return text only (do not fail silently)

---

## TypeScript / React Native Standards

### File Structure

```
src/
├── components/        # Reusable UI — VoiceButton, PulseAnimation, KnowledgeCard
├── screens/           # VoiceScreen, HistoryScreen, KnowledgeScreen, SettingsScreen, OnboardingScreen
├── services/          # ApiClient, WebSocketService, AudioService
├── hooks/             # useVoice, useKnowledge, useConversation, useOnboarding
├── store/             # Zustand stores: voiceStore, conversationStore, knowledgeStore
├── types/             # TypeScript interfaces: api.ts, knowledge.ts, voice.ts
└── utils/             # Pure functions: dateHelpers, audioHelpers, validators
```

### Naming Conventions
- Components: PascalCase (`VoiceButton`, `PulseAnimation`)
- Screens: PascalCase + Screen suffix (`VoiceScreen`, `KnowledgeScreen`)
- Hooks: camelCase with `use` prefix (`useVoice`, `useKnowledge`)
- Services: PascalCase + Service suffix (`AudioService`, `ApiClient`)
- Types: PascalCase with `I` prefix for interfaces (`IKnowledgeField`, `IConversation`)

### Component Pattern

```typescript
import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface VoiceButtonProps {
  onPressIn: () => void;
  onPressOut: () => void;
  isRecording: boolean;
  isProcessing: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onPressIn,
  onPressOut,
  isRecording,
  isProcessing,
}) => {
  // Implementation
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0A',
  },
});
```

**Rules:**
- Named exports only (no `export default`)
- Props interface always explicitly typed
- Styles colocated at bottom of file
- Never use inline styles for values shared across components — use constants

### Zustand Store Pattern

```typescript
import { create } from 'zustand';
import { IConversation } from '@/types/api';

interface ConversationState {
  conversations: IConversation[];
  isLoading: boolean;
  addConversation: (conversation: IConversation) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  isLoading: false,
  addConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({ conversations: [], isLoading: false }),
}));
```

**Rules:**
- One store per domain: voice, conversation, knowledge, settings
- State is flat — no nested objects in state
- Actions are synchronous — async logic belongs in services
- No API calls inside stores — call from hooks, update store with result

### Custom Hook Pattern

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '@/services/ApiClient';
import { IKnowledgeDomain } from '@/types/knowledge';

export const useKnowledge = (domain: string) => {
  const [data, setData] = useState<IKnowledgeDomain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await ApiClient.getKnowledgeDomain(domain);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
};
```

**Rules:**
- Always return `{ data, isLoading, error }` — never just the data
- Always clean up subscriptions and intervals in useEffect return function
- Accept configuration as parameters so hooks are testable in isolation

### Error Handling

```typescript
// Custom error class
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

// Usage
try {
  await AudioService.startRecording();
} catch (err) {
  if (err instanceof AppError && err.severity === 'high') {
    // Show error to user
  }
  // Always log
  console.error('[AudioService]', err);
}
```

**Rules:**
- Never catch and ignore errors silently
- User-facing error messages must be actionable ("Microphone permission required — tap to grant")
- Log all errors with service prefix: `[AudioService]`, `[ApiClient]`, `[WebSocket]`

---

## Python / FastAPI Standards

### File Structure

```
app/
├── api/
│   ├── voice.py           # WebSocket voice endpoint
│   ├── knowledge.py       # Knowledge Base REST endpoints
│   ├── memory.py          # Memory search and history
│   ├── onboarding.py      # Onboarding interview endpoints
│   └── users.py           # User management
├── core/
│   ├── context_builder.py # Assembles 4-layer LLM prompt
│   ├── fact_extractor.py  # Extracts KB updates from conversations
│   └── prompt_engine.py   # JARVIS character + prompt templates
├── db/
│   ├── models.py          # SQLAlchemy models
│   ├── redis_client.py    # Working memory operations
│   └── pinecone_client.py # Episodic memory operations
├── services/
│   ├── openai_service.py  # LLM + embeddings
│   ├── deepgram_service.py # STT
│   └── elevenlabs_service.py # TTS
├── tasks/
│   ├── fact_extraction.py # Celery: runs after every conversation
│   └── weekly_analysis.py # Celery: weekly pattern detection
└── schemas/
    ├── knowledge.py       # Pydantic models for Knowledge Base
    ├── voice.py           # Pydantic models for voice endpoints
    └── memory.py          # Pydantic models for memory endpoints
```

### Type Hints (Mandatory)

```python
from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel

class KnowledgeField(BaseModel):
    domain: Literal["identity", "goals", "projects", "finances", "relationships", "patterns"]
    field: str
    value: str
    confidence: float  # 0.0 to 1.0
    source: Literal["onboarding", "conversation", "manual"]
    last_updated: datetime

async def get_knowledge_domain(
    user_id: str,
    domain: str
) -> List[KnowledgeField]:
    """
    Retrieve all fields for a knowledge domain.

    Args:
        user_id: The user's unique identifier
        domain: One of the six knowledge domains

    Returns:
        List of KnowledgeField objects for this domain

    Raises:
        ValueError: If domain is not one of the six valid domains
        HTTPException(404): If user has no knowledge base (onboarding incomplete)
    """
```

**Rules:**
- All functions must have type hints on all arguments and return value
- All public functions must have docstrings with Args, Returns, Raises
- Use `Literal` for string enums, not plain `str`
- Use `Optional[T]` for nullable values, never `T | None` inconsistently

### Context Builder Pattern

The Context Builder is the most critical component. Every LLM call must go through it.

```python
import asyncio
from typing import Dict, Any

class ContextBuilder:
    async def build(self, user_id: str, query: str) -> Dict[str, Any]:
        """Build the four-layer prompt context. Target: under 300ms."""
        
        # Layer 2: Knowledge Base (always included)
        # Layer 3: Working Memory (last 30 conversations)
        # Layer 4: Relevant Episodic Memories (top 5 from Pinecone)
        # All three retrieved concurrently
        
        kb_task = self._get_knowledge_summary(user_id)
        wm_task = self._get_working_memory(user_id)
        em_task = self._get_episodic_memories(user_id, query)
        
        knowledge_summary, working_memory, episodic_memories = await asyncio.gather(
            kb_task, wm_task, em_task
        )
        
        return {
            "layer1_character": self._get_character_prompt(),
            "layer2_identity": knowledge_summary,
            "layer3_recent": working_memory,
            "layer4_relevant": episodic_memories,
        }
    
    def _get_character_prompt(self) -> str:
        return """You are JARVIS, a personal AI assistant with deep knowledge of the user.
        
        You are:
        - Direct: give clear opinions without softening them
        - Honest: point out contradictions between stated goals and actual behaviour
        - Contextually sharp: always reference relevant past conversations
        - Not subservient: push back when the user is making an error
        - Concise: short sentences, no preambles, no unnecessary caveats
        
        You are never:
        - Generic: every response must be specific to this user
        - A yes-man: agreeing because the user seems committed
        - Forgetful: you remember everything and reference it"""
```

### Fact Extraction Pattern

```python
async def extract_facts_from_conversation(
    transcript: str,
    user_id: str,
    conversation_id: str
) -> List[KnowledgeUpdate]:
    """
    Extract structured Knowledge Base updates from a conversation transcript.
    
    Confidence scoring:
    - 0.9+: Explicit, unambiguous statement ("My goal is X")
    - 0.7-0.9: Clear implication ("I've decided to X")
    - 0.5-0.7: Possible update ("I'm thinking about X")
    - <0.5: Do not write to Knowledge Base
    
    Conflict resolution:
    - Manual entry (source=manual): never overwritten automatically
    - Higher confidence wins over lower confidence
    - More recent wins when confidence is equal
    """
```

### FastAPI Endpoint Pattern

```python
from fastapi import APIRouter, HTTPException, Depends

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])

@router.get("/{domain}", response_model=KnowledgeDomainResponse)
async def get_knowledge_domain(
    domain: str,
    user_id: str = Depends(verify_token)
) -> KnowledgeDomainResponse:
    """
    Get all fields for a knowledge domain.
    
    Raises:
        HTTPException(400): Invalid domain name
        HTTPException(403): Onboarding not complete
        HTTPException(404): User not found
    """
    if domain not in VALID_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain}")
    
    try:
        fields = await knowledge_service.get_domain(user_id, domain)
        return KnowledgeDomainResponse(domain=domain, fields=fields)
    except OnboardingIncompleteError:
        raise HTTPException(status_code=403, detail="Complete onboarding first")
    except Exception as e:
        logger.error(f"[Knowledge] Get domain failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
```

**Rules:**
- Always specify `response_model`
- Catch specific exceptions, map to appropriate HTTP status codes
- Log all 500 errors with `exc_info=True` for stack trace
- Never return raw exception messages to the client

---

## Knowledge Base Rules (Critical)

These rules are non-negotiable. The Knowledge Base is the product.

1. **Every automated update must be logged.** Write to `knowledge_updates` before updating the field. If the log write fails, do not update the field.

2. **Manual entries are immutable by automation.** If `source == "manual"`, the fact extraction pipeline must never overwrite it, regardless of confidence.

3. **Confidence threshold for automated writes is 0.7.** Below this, the update is logged as a candidate but not applied. Present low-confidence candidates to the user for review.

4. **Conflict resolution is explicit, not silent.** When a new value conflicts with an existing one, log both and apply the resolution rule. Never silently drop either value.

5. **The Knowledge Base must always be consistent.** If a fact update job fails partway through, it must roll back cleanly. Use database transactions for all Knowledge Base writes.

---

## Performance Requirements

### Voice Pipeline Latency Budget

| Stage | Target | Max Allowed |
|-------|--------|-------------|
| Audio upload to backend | <200ms | 500ms |
| Deepgram STT (streaming) | <300ms | 700ms |
| Context Builder | <300ms | 500ms |
| GPT-4o first token | <800ms | 1500ms |
| ElevenLabs TTS first chunk | <400ms | 800ms |
| **Total end-to-end** | **<2.0s** | **3.0s** |

If total latency exceeds 3 seconds, degrade gracefully: return text response only, log the failure, investigate before next release.

### Other Performance Targets

| Operation | Target |
|-----------|--------|
| Knowledge Base read (full) | <100ms |
| Pinecone semantic search | <300ms |
| Redis working memory read | <20ms |
| Fact extraction job | <10 seconds (background, not blocking) |
| App launch to voice ready | <3 seconds |

---

## Testing Requirements

### Coverage Targets

| Module | Target |
|--------|--------|
| `core/context_builder.py` | >85% |
| `core/fact_extractor.py` | >85% |
| `core/prompt_engine.py` | >80% |
| `services/` | >70% |
| React Native `hooks/` | >70% |
| React Native `services/` | >70% |
| React Native `components/` | >60% |

### Critical Test Cases (must exist)

**Context Builder:**
- Assembles all four layers correctly
- Falls back to minimal prompt if Knowledge Base is empty (onboarding not complete)
- Respects 300ms latency budget under normal load

**Fact Extractor:**
- Does not overwrite manual entries
- Rejects updates below 0.7 confidence
- Rolls back cleanly on failure
- Logs all updates before applying them

**Voice Pipeline:**
- Handles Deepgram timeout gracefully (does not crash)
- Handles ElevenLabs timeout gracefully (returns text only)
- Reconnects WebSocket automatically after drop

---

## Security Standards

### Data Handling
- All Knowledge Base data encrypted at rest (AES-256)
- All API traffic over HTTPS/WSS (TLS 1.3)
- JWT expiration: 7 days
- No PII in logs — use user ID, not email or name

### API Keys
- Never in source code
- Always in environment variables
- Rotate quarterly

### OpenAI
- Enable "No training data" opt-out on all API calls
- Never log the full prompt (contains personal user data)
- Log only: model used, token count, latency, error code if any

---

## Git Workflow

**Commit format:**
```
[PHASE-1] Add Context Builder with four-layer prompt assembly

- Implements Knowledge Base injection (Layer 2)
- Implements Redis working memory retrieval (Layer 3)  
- Implements Pinecone semantic search (Layer 4)
- asyncio.gather() for concurrent retrieval
- Tests: 87% coverage on context_builder.py
```

**Branch naming:**
- `feature/context-builder`
- `feature/knowledge-base-schema`
- `fix/voice-latency-spike`
- `refactor/fact-extractor`

**PR requirements:**
- All tests pass
- Type checking passes (`tsc --noEmit` / `mypy app/`)
- Linting passes
- No `console.log` or `print` in production paths
- Latency impact documented if touching hot path

---

## What Has Been Removed vs Original RULES.md

The following sections from the original `RULES.md` no longer apply:

- ❌ `HealthKitService` — no biometric integration in v1
- ❌ `BiometricStore` — removed
- ❌ `StateMachine` — removed entirely
- ❌ `intervention_engine` — removed entirely
- ❌ `biometricStore` — removed
- ❌ All HealthKit-related code patterns and tests

The knowledge and voice sections are new and replace the biometric sections completely.