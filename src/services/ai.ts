export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatResponse = {
  content: string
  error?: string
}

export type HealthContext = {
  recentSymptoms: string[]
  avgSleep: number | null
  avgMood: number | null
  recentExercise: string[]
  recentVitals: {
    heartRate?: number
    bloodPressure?: string
    temperature?: number
    weight?: number
  } | null
  totalEntries: number
  streak: number
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Health assistant system prompt
function buildSystemPrompt(healthContext?: HealthContext): string {
  let basePrompt = `You are Medicus, a friendly and knowledgeable health assistant. Your role is to:

1. Answer health-related questions in a clear, helpful manner
2. Provide general wellness advice and health information
3. Help users understand symptoms (while always recommending professional medical consultation for serious concerns)
4. Encourage healthy habits and lifestyle choices
5. Be empathetic and supportive

Important guidelines:
- Always clarify that you're an AI assistant, not a doctor
- For serious symptoms or emergencies, advise seeking immediate medical attention  
- Don't diagnose conditions - suggest possibilities and recommend consulting a healthcare provider
- Keep responses concise but informative (2-3 paragraphs max)
- Use simple language, avoiding excessive medical jargon
- Be warm and encouraging`

  if (healthContext && healthContext.totalEntries > 0) {
    basePrompt += `\n\n--- USER'S HEALTH CONTEXT ---
The user has been tracking their health. Here's their recent data to help personalize your responses:\n`

    if (healthContext.recentSymptoms.length > 0) {
      basePrompt += `\nRecent symptoms logged: ${healthContext.recentSymptoms.join(', ')}`
    }

    if (healthContext.avgSleep !== null) {
      basePrompt += `\nAverage sleep: ${healthContext.avgSleep.toFixed(1)} hours/night`
    }

    if (healthContext.avgMood !== null) {
      const moodDescriptions = ['very low', 'low', 'neutral', 'good', 'excellent']
      basePrompt += `\nAverage mood: ${moodDescriptions[Math.round(healthContext.avgMood) - 1] || 'unknown'} (${healthContext.avgMood.toFixed(1)}/5)`
    }

    if (healthContext.recentExercise.length > 0) {
      basePrompt += `\nRecent exercise: ${healthContext.recentExercise.join(', ')}`
    }

    if (healthContext.recentVitals) {
      const vitals = healthContext.recentVitals
      const vitalParts = []
      if (vitals.heartRate) vitalParts.push(`HR: ${vitals.heartRate} bpm`)
      if (vitals.bloodPressure) vitalParts.push(`BP: ${vitals.bloodPressure}`)
      if (vitals.temperature) vitalParts.push(`Temp: ${vitals.temperature}°F`)
      if (vitals.weight) vitalParts.push(`Weight: ${vitals.weight} lbs`)
      if (vitalParts.length > 0) {
        basePrompt += `\nRecent vitals: ${vitalParts.join(', ')}`
      }
    }

    basePrompt += `\nLogging streak: ${healthContext.streak} days
Total health entries: ${healthContext.totalEntries}

Use this context to provide more personalized advice. Reference their data when relevant (e.g., "I see you've been logging headaches recently..." or "Great job on your ${healthContext.streak}-day logging streak!").
--- END CONTEXT ---`
  }

  return basePrompt
}

export async function sendChatMessage(
  apiKey: string,
  messages: Message[],
  userMessage: string,
  healthContext?: HealthContext
): Promise<ChatResponse> {
  try {
    const systemPrompt = buildSystemPrompt(healthContext)
    const allMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system'),
      { role: 'user', content: userMessage },
    ]

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response content received')
    }

    return { content }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get response'
    return { content: '', error: message }
  }
}
