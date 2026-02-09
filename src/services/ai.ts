export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatResponse = {
  content: string
  error?: string
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Health assistant system prompt
const SYSTEM_PROMPT = `You are Medicus, a friendly and knowledgeable health assistant. Your role is to:

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

export async function sendChatMessage(
  apiKey: string,
  messages: Message[],
  userMessage: string
): Promise<ChatResponse> {
  try {
    const allMessages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
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
