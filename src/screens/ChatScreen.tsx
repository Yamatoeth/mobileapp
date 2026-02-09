import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Keyboard,
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import Markdown from 'react-native-markdown-display'
import { useApiKey } from '../hooks/useApiKey'
import { useHealthLogs } from '../hooks/useHealthLogs'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { sendChatMessageStreaming, type Message as AIMessage } from '../services/ai'
import { buildHealthContext } from '../utils/healthContext'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  originalInput?: string // For retry functionality
}

export function ChatScreen() {
  const { apiKey, setApiKey, isLoading: isLoadingApiKey } = useApiKey()
  const { logs } = useHealthLogs()
  
  // Build health context for AI personalization
  const healthContext = useMemo(() => buildHealthContext(logs), [logs])
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Medicus, your health assistant. How can I help you today?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showApiKeySheet, setShowApiKeySheet] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const scrollViewRef = useRef<RNScrollView>(null)

  // Voice recognition hook (safe for Expo Go)
  const { 
    isListening, 
    isAvailable: isVoiceAvailable, 
    startListening, 
    stopListening, 
    transcript,
    resetTranscript 
  } = useSpeechRecognition()

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(prev => prev + transcript)
      resetTranscript()
    }
  }, [transcript, resetTranscript])

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await Clipboard.setStringAsync(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // Markdown styles for assistant messages
  const markdownStyles = useMemo(() => ({
    body: { color: '#111827', fontSize: 15, lineHeight: 22 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, color: '#111827' },
    heading2: { fontSize: 18, fontWeight: '600' as const, marginBottom: 6, color: '#111827' },
    heading3: { fontSize: 16, fontWeight: '600' as const, marginBottom: 4, color: '#111827' },
    strong: { fontWeight: '600' as const },
    em: { fontStyle: 'italic' as const },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    code_inline: { 
      backgroundColor: '#e5e7eb', 
      paddingHorizontal: 4, 
      paddingVertical: 2, 
      borderRadius: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
    },
    fence: { 
      backgroundColor: '#1f2937', 
      padding: 12, 
      borderRadius: 8, 
      marginVertical: 8,
    },
    code_block: {
      color: '#e5e7eb',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
    },
    blockquote: {
      backgroundColor: '#f3f4f6',
      borderLeftWidth: 4,
      borderLeftColor: '#9ca3af',
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 8,
    },
    link: { color: '#2563eb' },
    hr: { backgroundColor: '#d1d5db', height: 1, marginVertical: 12 },
  }), [])

  useEffect(() => {
    if (!isLoadingApiKey && !apiKey) {
      setShowApiKeySheet(true)
    }
  }, [isLoadingApiKey, apiKey])

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  const sendMessageWithContent = async (messageContent: string, retryMessageId?: string) => {
    if (!messageContent.trim()) return

    if (!apiKey) {
      setShowApiKeySheet(true)
      return
    }

    // If retrying, remove the old error message first
    if (retryMessageId) {
      setMessages((prev) => prev.filter(m => m.id !== retryMessageId))
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
    }

    // Only add user message if not retrying (retry already has user message)
    if (!retryMessageId) {
      setMessages((prev) => [...prev, userMessage])
    }
    
    setInput('')
    Keyboard.dismiss()
    scrollToBottom()
    setIsLoading(true)

    // Create placeholder for streaming response
    const assistantMessageId = (Date.now() + 1).toString()
    setStreamingMessageId(assistantMessageId)
    
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    const aiMessages: AIMessage[] = messages
      .filter(m => !m.error) // Don't include error messages in context
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    const response = await sendChatMessageStreaming(
      apiKey, 
      aiMessages, 
      messageContent,
      (chunk) => {
        // Update message with new chunk
        setMessages((prev) => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: m.content + chunk }
              : m
          )
        )
        scrollToBottom()
      },
      healthContext
    )

    if (response.error) {
      // Replace streaming message with error message
      setMessages((prev) => 
        prev.map(m => 
          m.id === assistantMessageId 
            ? { 
                ...m, 
                content: `Sorry, I encountered an error: ${response.error}`,
                error: true,
                originalInput: messageContent,
              }
            : m
        )
      )
    }

    setStreamingMessageId(null)
    setIsLoading(false)
    scrollToBottom()
  }

  const sendMessage = async () => {
    await sendMessageWithContent(input)
  }

  const retryMessage = async (messageId: string, originalInput: string) => {
    await sendMessageWithContent(originalInput, messageId)
  }

  const handleSaveApiKey = async () => {
    if (tempApiKey.trim()) {
      await setApiKey(tempApiKey.trim())
      setTempApiKey('')
      setShowApiKeySheet(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row p-4 border-b border-gray-200 items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Medicus</Text>
        <TouchableOpacity
          className="p-2 border border-gray-300 rounded-lg active:bg-gray-50"
          onPress={() => setShowApiKeySheet(true)}
        >
          <Ionicons name="settings-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-3"
        ref={scrollViewRef}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            className={`flex-row ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Pressable
              onLongPress={() => copyToClipboard(message.content, message.id)}
              className={`max-w-[85%] rounded-2xl ${
                message.role === 'user' 
                  ? 'bg-primary px-4 py-3' 
                  : message.error 
                    ? 'bg-red-50 border border-red-200 px-4 py-2'
                    : 'bg-gray-100 px-4 py-2'
              }`}
            >
              {message.role === 'user' ? (
                <Text className="text-base text-white">{message.content}</Text>
              ) : message.id === streamingMessageId && message.content === '' ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#666" />
                  <Text className="text-gray-500 text-sm">Thinking...</Text>
                </View>
              ) : (
                <Markdown style={markdownStyles}>{message.content}</Markdown>
              )}
              
              {/* Action buttons row */}
              <View className="flex-row justify-between items-center mt-1">
                {/* Retry button for error messages */}
                {message.error && message.originalInput && (
                  <TouchableOpacity
                    onPress={() => retryMessage(message.id, message.originalInput!)}
                    className="flex-row items-center gap-1 py-1 px-2 bg-red-100 rounded-lg"
                    disabled={isLoading}
                  >
                    <Ionicons name="refresh" size={14} color="#dc2626" />
                    <Text className="text-xs text-red-600 font-medium">Retry</Text>
                  </TouchableOpacity>
                )}
                
                {/* Spacer when no retry button */}
                {!message.error && <View />}
                
                {/* Copy button */}
                <TouchableOpacity
                  onPress={() => copyToClipboard(message.content, message.id)}
                  className="flex-row items-center gap-1 py-1"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={copiedId === message.id ? 'checkmark' : 'copy-outline'} 
                    size={14} 
                    color={message.role === 'user' ? 'rgba(255,255,255,0.7)' : '#9ca3af'} 
                  />
                  <Text 
                    className={`text-xs ${
                      message.role === 'user' ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    {copiedId === message.id ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        ))}
        {isLoading && !streamingMessageId && (
          <View className="flex-row justify-start">
            <View className="px-4 py-3 rounded-2xl bg-gray-100">
              <ActivityIndicator size="small" color="#666" />
            </View>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Voice recording indicator */}
        {isListening && (
          <View className="flex-row items-center justify-center py-2 bg-red-50 border-t border-red-100">
            <View className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
            <Text className="text-red-600 text-sm font-medium">Listening...</Text>
          </View>
        )}
        
        <View className="flex-row p-4 gap-2 border-t border-gray-200 items-center">
          {/* Voice input button */}
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              isListening ? 'bg-red-500' : isVoiceAvailable ? 'bg-gray-100' : 'bg-gray-50'
            }`}
            onPress={isListening ? stopListening : startListening}
            disabled={isLoading}
          >
            <Ionicons 
              name={isListening ? 'stop' : 'mic'} 
              size={20} 
              color={isListening ? '#fff' : isVoiceAvailable ? '#666' : '#ccc'} 
            />
          </TouchableOpacity>
          
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            placeholder="Ask about your health..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            editable={!isLoading}
            multiline
          />
          <TouchableOpacity
            className={`bg-primary w-10 h-10 rounded-lg items-center justify-center active:opacity-80 ${isLoading || !input.trim() ? 'opacity-60' : ''}`}
            onPress={sendMessage}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showApiKeySheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowApiKeySheet(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 gap-4">
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-2" />
            <Text className="text-lg font-semibold text-gray-900">
              Set up Groq API Key
            </Text>
            <Text className="text-gray-500">
              Get your free API key at{' '}
              <Text className="text-primary">console.groq.com</Text>
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              placeholder="gsk_..."
              value={tempApiKey}
              onChangeText={setTempApiKey}
              secureTextEntry
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 p-3 rounded-lg items-center border border-gray-300 active:bg-gray-50"
                onPress={() => setShowApiKeySheet(false)}
              >
                <Text className="text-gray-900 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-3 rounded-lg items-center bg-primary active:opacity-80"
                onPress={handleSaveApiKey}
              >
                <Text className="text-white font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
            {apiKey && (
              <View className="flex-row items-center justify-center gap-1">
                <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                <Text className="text-green-500 text-xs">API key is configured</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
