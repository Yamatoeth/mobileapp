// ============================================
// Trigger Logging
// ============================================

/**
 * Log trigger event to backend
 */
export async function logTrigger(payload: Record<string, unknown>): Promise<void> {
  return request<void>('/trigger', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
/**
 * J.A.R.V.I.S. API Client
 * Handles communication with the FastAPI backend
 */

import type {
  User,
  BiometricReading,
  Conversation,
  Message,
  Intervention,
  TrustLevel,
  LifeState,
} from '../../shared/types'

// Default to localhost for development
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 10000

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Health check response type
 */
type HealthResponse = {
  status: string
  version: string
  debug: boolean
}

/**
 * Generic API response wrapper
 */
type ApiResponse<T> = {
  data: T
  error?: string
}

/**
 * Biometric submission payload
 */
type BiometricPayload = {
  userId: string
  heartRate?: number
  hrv?: number
  lifeState?: LifeState
  contextualFactors?: Record<string, unknown>
}

/**
 * Message submission payload
 */
type MessagePayload = {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  audioUrl?: string
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Make an API request with error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }

  try {
    const response = await fetchWithTimeout(url, config)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        errorBody.detail || `Request failed with status ${response.status}`,
        errorBody
      )
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out')
    }
    throw new ApiError(0, 'Network error', error)
  }
}

// ============================================
// Health Check
// ============================================

/**
 * Check if the backend is healthy
 */
export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

/**
 * Get detailed backend status
 */
export async function getStatus(): Promise<{
  environment: string
  redis: string
  pinecone: string
}> {
  return request('/status')
}

// ============================================
// User Management
// ============================================

/**
 * Get or create a user
 */
export async function getOrCreateUser(userId: string): Promise<User> {
  return request<User>(`/api/v1/users/${userId}`, {
    method: 'PUT',
  })
}

/**
 * Update user trust level
 */
export async function updateTrustLevel(
  userId: string,
  trustLevel: TrustLevel
): Promise<User> {
  return request<User>(`/api/v1/users/${userId}/trust`, {
    method: 'PATCH',
    body: JSON.stringify({ trust_level: trustLevel }),
  })
}

// ============================================
// Biometric Data
// ============================================

/**
 * Submit biometric reading
 */
export async function submitBiometrics(
  payload: BiometricPayload
): Promise<BiometricReading> {
  return request<BiometricReading>('/api/v1/biometrics', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Get recent biometric readings for a user
 */
export async function getBiometrics(
  userId: string,
  limit: number = 100
): Promise<BiometricReading[]> {
  return request<BiometricReading[]>(
    `/api/v1/biometrics/${userId}?limit=${limit}`
  )
}

/**
 * Get current life state for a user
 */
export async function getLifeState(userId: string): Promise<{
  lifeState: LifeState
  since: string
}> {
  return request(`/api/v1/biometrics/${userId}/life-state`)
}

// ============================================
// Conversations
// ============================================

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string
): Promise<Conversation> {
  return request<Conversation>('/api/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string
): Promise<Conversation> {
  return request<Conversation>(`/api/v1/conversations/${conversationId}`)
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  return request<Conversation[]>(`/api/v1/conversations?user_id=${userId}`)
}

/**
 * Add message to conversation
 */
export async function sendMessage(payload: MessagePayload): Promise<Message> {
  return request<Message>('/api/v1/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  return request<Message[]>(
    `/api/v1/conversations/${conversationId}/messages`
  )
}

// ============================================
// Interventions
// ============================================

/**
 * Get pending interventions for a user
 */
export async function getPendingInterventions(
  userId: string
): Promise<Intervention[]> {
  return request<Intervention[]>(
    `/api/v1/interventions?user_id=${userId}&status=pending`
  )
}

/**
 * Accept or dismiss an intervention
 */
export async function respondToIntervention(
  interventionId: string,
  accepted: boolean
): Promise<Intervention> {
  return request<Intervention>(`/api/v1/interventions/${interventionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: accepted ? 'accepted' : 'dismissed',
      responded_at: new Date().toISOString(),
    }),
  })
}

// ============================================
// Memory & Context
// ============================================

/**
 * Search episodic memory (Pinecone)
 */
export async function searchMemory(
  userId: string,
  query: string,
  limit: number = 5
): Promise<{ id: string; score: number; metadata: Record<string, unknown> }[]> {
  return request('/api/v1/memory/search', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, query, limit }),
  })
}

/**
 * Get working memory state (Redis)
 */
export async function getWorkingMemory(
  userId: string
): Promise<Record<string, unknown>> {
  return request(`/api/v1/memory/working/${userId}`)
}

// ============================================
// Voice Processing
// ============================================

/**
 * Transcribe audio using Deepgram
 */
export async function transcribeAudio(
  audioBase64: string
): Promise<{ text: string; confidence: number }> {
  return request('/api/v1/voice/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audio: audioBase64 }),
  })
}

/**
 * Synthesize speech using ElevenLabs
 */
export async function synthesizeSpeech(
  text: string,
  voiceId?: string
): Promise<{ audioUrl: string }> {
  return request('/api/v1/voice/synthesize', {
    method: 'POST',
    body: JSON.stringify({ text, voice_id: voiceId }),
  })
}

// ============================================
// AI Processing
// ============================================

/**
 * Process a user query through the AI pipeline
 */
export async function processQuery(
  userId: string,
  query: string,
  context?: Record<string, unknown>
): Promise<{
  response: string
  interventions?: Intervention[]
  memoryUpdated: boolean
}> {
  return request('/api/v1/ai/process', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, query, context }),
  })
}

// Default export for convenience
export default {
  // Health
  checkHealth,
  getStatus,
  // Users
  getOrCreateUser,
  updateTrustLevel,
  // Biometrics
  submitBiometrics,
  getBiometrics,
  getLifeState,
  // Conversations
  createConversation,
  getConversation,
  getConversations,
  sendMessage,
  getMessages,
  // Interventions
  getPendingInterventions,
  respondToIntervention,
  // Memory
  searchMemory,
  getWorkingMemory,
  // Voice
  transcribeAudio,
  synthesizeSpeech,
  // AI
  processQuery,
}
