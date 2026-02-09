import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CHAT_HISTORY_KEY = 'chat_history'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  originalInput?: string
  timestamp?: number
}

const DEFAULT_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "Hi! I'm Medicus, your health assistant. How can I help you today?",
  timestamp: Date.now(),
}

export function useChatHistory() {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE])
  const [isLoading, setIsLoading] = useState(true)

  // Load chat history on mount
  useEffect(() => {
    AsyncStorage.getItem(CHAT_HISTORY_KEY)
      .then((value) => {
        if (value) {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed)
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  // Save messages whenever they change
  const saveMessages = useCallback(async (newMessages: Message[]) => {
    setMessages(newMessages)
    try {
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(newMessages))
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }, [])

  const addMessage = useCallback((message: Omit<Message, 'timestamp'>) => {
    const newMessage = { ...message, timestamp: Date.now() }
    setMessages((prev) => {
      const updated = [...prev, newMessage]
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== id)
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  const clearHistory = useCallback(async () => {
    setMessages([DEFAULT_MESSAGE])
    try {
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify([DEFAULT_MESSAGE]))
    } catch (error) {
      console.error('Failed to clear chat history:', error)
    }
  }, [])

  return {
    messages,
    isLoading,
    addMessage,
    updateMessage,
    removeMessage,
    clearHistory,
    setMessages: saveMessages,
  }
}
