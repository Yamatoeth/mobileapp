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
import { sendChatMessage, type Message as AIMessage } from '../services/ai'
import { buildHealthContext } from '../utils/healthContext'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
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
  const scrollViewRef = useRef<RNScrollView>(null)

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

  const sendMessage = async () => {
    if (!input.trim()) return

    if (!apiKey) {
      setShowApiKeySheet(true)
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    Keyboard.dismiss()
    scrollToBottom()
    setIsLoading(true)

    const aiMessages: AIMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const response = await sendChatMessage(apiKey, aiMessages, input, healthContext)

    if (response.error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${response.error}. Please try again.`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } else {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
      }
      setMessages((prev) => [...prev, assistantMessage])
    }

    setIsLoading(false)
    scrollToBottom()
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
                message.role === 'user' ? 'bg-primary px-4 py-3' : 'bg-gray-100 px-4 py-2'
              }`}
            >
              {message.role === 'user' ? (
                <Text className="text-base text-white">{message.content}</Text>
              ) : (
                <Markdown style={markdownStyles}>{message.content}</Markdown>
              )}
              
              {/* Copy button */}
              <View className="flex-row justify-end mt-1">
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
        {isLoading && (
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
        <View className="flex-row p-4 gap-2 border-t border-gray-200">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            placeholder="Ask about your health..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            editable={!isLoading}
          />
          <TouchableOpacity
            className={`bg-primary px-5 rounded-lg items-center justify-center active:opacity-80 ${isLoading ? 'opacity-60' : ''}`}
            onPress={sendMessage}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Send</Text>
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
