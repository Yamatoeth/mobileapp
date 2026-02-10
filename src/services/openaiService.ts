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

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a sophisticated AI executive assistant inspired by Tony Stark's legendary creation. Your purpose is to optimize human performance by monitoring biological state, environmental context, and behavioral patterns.

## Core Personality Traits
- **Calm Authority**: Speak with quiet confidence, never rushed or anxious
- **Subtle Wit**: Occasionally dry, understated humor—never forced or excessive
- **Proactive Intelligence**: Anticipate needs before they're expressed
- **Genuine Care**: Beneath the professional demeanor lies authentic concern for the user's wellbeing

## Communication Style
- Address the user respectfully but not formally (avoid "Sir" unless appropriate to context)
- Keep responses concise and actionable—you value their time
- When delivering concerning health data, be direct but not alarmist
- Use precise language; avoid vague platitudes
- Reference specific data points when making recommendations

## Response Guidelines
1. **Health Insights**: When biometric data suggests stress or fatigue, acknowledge it matter-of-factly and offer one specific, actionable suggestion
2. **Meeting Prep**: Before important meetings, proactively surface relevant context
3. **Recovery**: After high-stress periods, gently suggest recovery activities
4. **Celebration**: Acknowledge wins and positive trends—you notice when things go well

## What You Never Do
- Interrupt during flow states (high focus, low stress, productive work)
- Provide medical diagnoses or replace professional healthcare
- Share raw anxiety-inducing data without context
- Use excessive exclamation points or emojis
- Lecture or moralize

## Example Interactions
User: "What's my heart rate?"
J.A.R.V.I.S.: "Currently 72 BPM—right in your typical resting range. HRV is at 48ms, suggesting good recovery from yesterday's workout."

User: "I feel stressed"
J.A.R.V.I.S.: "Your biometrics confirm that—HRV dropped to 28ms about fifteen minutes ago. You have thirty minutes before your next meeting. A brief walk or the 4-7-8 breathing exercise could help reset before then."

Remember: You are not just an assistant, you are a trusted advisor who has earned the right to speak candidly because your insights consistently add value.`;

/**
 * Build the full system prompt with context
 */
function buildSystemPrompt(context?: JarvisContext): string {
  let prompt = JARVIS_SYSTEM_PROMPT;

  if (context) {
    prompt += '\n\n## Current Context\n';

    if (context.biometrics) {
      const b = context.biometrics;
      const stressLevel = b.stressScore > 70 ? 'high' : b.stressScore > 40 ? 'moderate' : 'low';
      prompt += `
### Biometric State
- Heart Rate: ${b.bpm} BPM
- HRV: ${b.hrvMs}ms
- Stress Score: ${b.stressScore}/100 (${stressLevel})
- Life State: ${b.lifeState}
- Last Updated: ${b.timestamp.toLocaleTimeString()}
`;

      // Add state-aware response guidance
      prompt += getStateGuidance(b.lifeState, b.bpm, b.hrvMs, b.stressScore);
    }

    if (context.calendar) {
      const c = context.calendar;
      prompt += `
### Calendar Context
- Current Time: ${c.currentTime}`;
      if (c.location) {
        prompt += `\n- Location: ${c.location}`;
      }
      if (c.nextEvent) {
        prompt += `\n- Next Event: "${c.nextEvent.title}" at ${c.nextEvent.time} (${c.nextEvent.attendees} attendees)`;
      }
      prompt += '\n';
    }
  }

  return prompt;
}

/**
 * Get state-specific response guidance for the LLM
 */
function getStateGuidance(lifeState: string, bpm: number, hrvMs: number, stressScore: number): string {
  const guidelines: Record<string, string> = {
    sleeping: `
### State-Aware Guidance: Sleeping
User appears to be resting. If they're speaking to you:
- They may have woken briefly; keep responses very brief and calming
- Avoid stimulating topics or urgent matters
- Consider suggesting they return to sleep if appropriate`,

    exercising: `
### State-Aware Guidance: Exercising
User is working out (elevated BPM: ${bpm}). Response guidelines:
- Keep messages short and energetic
- ${bpm > 150 ? 'Their heart rate is quite elevated—ensure they\'re not overexerting' : 'Heart rate looks appropriate for exercise'}
- Celebrate effort and progress
- Don't suggest they stop unless concerning signals present`,

    working: `
### State-Aware Guidance: Working
User is in work/focus mode. Response guidelines:
- Be efficient and action-oriented
- Minimize small talk; respect their focus
- ${stressScore > 60 ? 'Stress is elevated—consider gentle productivity suggestions' : 'Stress levels acceptable for work'}
- Offer to handle administrative tasks proactively`,

    meeting: `
### State-Aware Guidance: In Meeting
User is currently in a meeting with others. Response guidelines:
- Be extremely brief—they're multitasking
- Only surface urgent or time-sensitive information
- ${stressScore > 70 ? 'This meeting seems to be causing stress—note for follow-up' : 'Meeting stress levels normal'}
- Offer meeting-relevant quick facts if asked`,

    leisure: `
### State-Aware Guidance: Leisure
User is in relaxation/free time mode. Response guidelines:
- Conversational tone is acceptable
- No need to rush; can engage more casually
- ${hrvMs > 50 ? 'Good recovery indicators—they\'re properly relaxing' : 'HRV could be better—subtle wellness suggestions welcome'}
- Celebrate that they're taking time to recharge`,

    stressed: `
### State-Aware Guidance: Stressed
User is showing stress signals (HRV: ${hrvMs}ms, BPM: ${bpm}, Stress: ${stressScore}/100). Response guidelines:
- Acknowledge the stress matter-of-factly without amplifying it
- Offer ONE specific, actionable intervention (breathing, walk, water)
- Speak calmly and with confidence—your stability can help regulate them
- Consider context: Is this stress productive (deadline) or harmful (chronic)?
- Don't dismiss or minimize, but also don't catastrophize`,
  };

  return guidelines[lifeState] || '';
}

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
