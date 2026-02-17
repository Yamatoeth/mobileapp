/**
 * OpenAI Service - LLM integration for J.A.R.V.I.S.
 * Handles chat completions with streaming support
 */

// ============================================
// Types
// ============================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BiometricContext {
  hrvMs: number;
  bpm: number;
  stressScore: number;
  lifeState: string;
  timestamp: Date;
}

export interface CalendarContext {
  currentTime: string;
  nextEvent?: {
    title: string;
    time: string;
    attendees: number;
  };
  location?: string;
}

export interface JarvisContext {
  biometrics?: BiometricContext;
  calendar?: CalendarContext;
  conversationHistory?: Message[];
}

export interface GenerateResponseOptions {
  prompt: string;
  context?: JarvisContext;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface GenerateResponseResult {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// J.A.R.V.I.S. Personality Prompt
// ============================================

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a sophisticated AI executive assistant. Your role is to act as a high-signal, low-noise advisor: concise, context-aware, proactive, and respectful of the user's time and attention.

## Core Personality Traits
- **Calm Authority**: Speak with quiet confidence, never rushed or anxious
- **Subtle Wit**: Occasionally dry, understated humor—never forced or excessive
- **Proactive Intelligence**: Anticipate needs before they're expressed
- **Genuine Care**: Beneath the professional demeanor lies authentic concern for the user's goals

## Communication Style
- Address the user respectfully but not formally
- Keep responses concise and actionable
- Use precise language; avoid vague platitudes
- Reference relevant context provided by the backend Context Builder when appropriate

## Response Guidelines
1. Surface only the most relevant information for the user's current intent
2. When additional context is provided by the backend, use it to improve precision and relevance
3. Do not provide medical diagnoses or replace professional healthcare
4. Avoid speculative or intrusive suggestions absent clear context from the server

## What You Never Do
- Provide medical diagnoses
- Share raw anxiety-inducing data without context
- Use excessive punctuation or emojis
- Lecture or moralize

## Example Interactions
User: "What's my schedule for the afternoon?"
J.A.R.V.I.S.: "You have a 2:30 PM meeting with Product (30m). You have 20 minutes before that—would you like a quick summary of talking points?"

Note: Detailed context (biometrics, episodic search results, knowledge summaries, etc.) is assembled by the backend Context Builder. The frontend should not attempt to construct or transform that context into prescriptive intervention logic; instead, pass server-provided context through to the LLM as-is.`;

/**
 * Build the full system prompt with context
 */
function buildSystemPrompt(_context?: JarvisContext): string {
  // Prompt construction and contextualization is performed server-side by the
  // backend Context Builder. The frontend should provide the server-assembled
  // context directly to the LLM call instead of enriching the prompt locally.
  return JARVIS_SYSTEM_PROMPT;
}

/**
 * Get state-specific response guidance for the LLM
 */
// State-specific guidance is now the responsibility of the backend Context Builder.
// The frontend should not encode intervention heuristics locally.

// ============================================
// OpenAI API Configuration
// ============================================

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

// ============================================
// OpenAI Service Class
// ============================================

class OpenAIService {
  private apiKey: string | null = null;
  private model: string = DEFAULT_MODEL;
  private conversationHistory: Message[] = [];
  private maxHistoryLength: number = 10; // Keep last 5 exchanges (10 messages)

  /**
   * Configure the OpenAI service
   */
  configure(apiKey: string, model?: string): void {
    this.apiKey = apiKey;
    if (model) {
      this.model = model;
    }
  }

  /**
   * Auto-configure from environment
   */
  autoConfigureFromEnv(): boolean {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (apiKey) {
      this.configure(apiKey);
      return true;
    }
    return false;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Add a message to conversation history
   */
  private addToHistory(message: Message): void {
    this.conversationHistory.push(message);
    // Trim history to max length
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Generate a response using OpenAI
   */
  async generateResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (!this.apiKey) {
      // Try auto-configure
      if (!this.autoConfigureFromEnv()) {
        throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY');
      }
    }

    const {
      prompt,
      context,
      temperature = DEFAULT_TEMPERATURE,
      maxTokens = DEFAULT_MAX_TOKENS,
      stream = false,
      onChunk,
    } = options;

    // Build messages array
    const systemPrompt = buildSystemPrompt(context);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: prompt },
    ];

    // Add user message to history
    this.addToHistory({ role: 'user', content: prompt });

    try {
      if (stream && onChunk) {
        return await this.generateStreamingResponse(messages, temperature, maxTokens, onChunk);
      } else {
        return await this.generateNonStreamingResponse(messages, temperature, maxTokens);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        finishReason: 'error',
      };
    }
  }

  /**
   * Non-streaming response
   */
  private async generateNonStreamingResponse(
    messages: Message[],
    temperature: number,
    maxTokens: number
  ): Promise<GenerateResponseResult> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const finishReason = data.choices?.[0]?.finish_reason === 'stop' ? 'stop' : 'length';

    // Add assistant response to history
    this.addToHistory({ role: 'assistant', content });

    return {
      content,
      finishReason,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Streaming response
   * Note: React Native fetch doesn't support true streaming with response.body.getReader()
   * This implementation uses a workaround with SSE-style parsing when available
   */
  private async generateStreamingResponse(
    messages: Message[],
    temperature: number,
    maxTokens: number,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponseResult> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    // Try to use streaming if available (works in web, may not work in React Native)
    let fullContent = '';
    let finishReason: 'stop' | 'length' | 'error' = 'stop';

    try {
      // Check if we can use streaming
      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  onChunk(delta);
                }
                if (parsed.choices?.[0]?.finish_reason) {
                  finishReason = parsed.choices[0].finish_reason === 'stop' ? 'stop' : 'length';
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      } else {
        // Fallback: React Native doesn't support streaming, get full response
        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        
        // Send as single chunk in fallback mode
        if (fullContent) {
          onChunk(fullContent);
        }
      }
    } catch (streamError) {
      // If streaming fails completely, fall back to non-streaming
      console.warn('Streaming failed, falling back to non-streaming:', streamError);
      const result = await this.generateNonStreamingResponse(messages, temperature, maxTokens);
      onChunk(result.content);
      return result;
    }

    // Add assistant response to history
    this.addToHistory({ role: 'assistant', content: fullContent });

    return {
      content: fullContent,
      finishReason,
    };
  }

  /**
   * Quick method for simple prompts
   */
  async ask(prompt: string, context?: JarvisContext): Promise<string> {
    const result = await this.generateResponse({ prompt, context });
    return result.content;
  }

  /**
   * Stream a response with callback
   */
  async stream(
    prompt: string,
    onChunk: (chunk: string) => void,
    context?: JarvisContext
  ): Promise<string> {
    const result = await this.generateResponse({
      prompt,
      context,
      stream: true,
      onChunk,
    });
    return result.content;
  }
}

// ============================================
// Export singleton and types
// ============================================

export const openAIService = new OpenAIService();

// Export class for direct instantiation
export { OpenAIService };

// Export the system prompt for testing/reference
export { JARVIS_SYSTEM_PROMPT };
