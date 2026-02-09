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
} from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useApiKey } from '../hooks/useApiKey'
import { sendChatMessage, type Message as AIMessage } from '../services/ai'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function ChatScreen() {
  const { apiKey, setApiKey, isLoading: isLoadingApiKey } = useApiKey()
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
  const scrollViewRef = useRef<RNScrollView>(null)

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

    const response = await sendChatMessage(apiKey, aiMessages, input)

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
            <View
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.role === 'user' ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-base ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}
              >
                {message.content}
              </Text>
            </View>
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
