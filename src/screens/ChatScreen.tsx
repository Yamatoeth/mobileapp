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
import { useChatHistory } from '../hooks/useChatHistory'
import { useTheme } from '../hooks/useTheme'
import { sendChatMessageStreaming, type Message as AIMessage } from '../services/ai'
// Backend context is fetched via `contextService.getServerContext` when needed.

// Suggested prompts for quick actions
const SUGGESTED_PROMPTS = [
  { icon: 'bed-outline' as const, label: 'Check my sleep', prompt: 'How has my sleep been lately? Any suggestions to improve it?' },
  { icon: 'fitness-outline' as const, label: 'Exercise tips', prompt: 'Based on my activity, what exercises would you recommend?' },
  { icon: 'medical-outline' as const, label: 'Analyze symptoms', prompt: 'Can you analyze my recent symptoms and provide some insights?' },
  { icon: 'happy-outline' as const, label: 'Mood patterns', prompt: 'What patterns do you see in my mood data?' },
  { icon: 'nutrition-outline' as const, label: 'Nutrition advice', prompt: 'Any nutrition tips based on my health logs?' },
  { icon: 'heart-outline' as const, label: 'Health summary', prompt: 'Give me a summary of my overall health based on my logged data.' },
]

export function ChatScreen() {
  const { isDark } = useTheme()
  const { apiKey, setApiKey, isLoading: isLoadingApiKey } = useApiKey()
  const { logs } = useHealthLogs()
  const { 
    messages, 
    addMessage, 
    updateMessage, 
    clearHistory,
    isLoading: isLoadingHistory 
  } = useChatHistory()
  

  
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
    body: { color: isDark ? '#e5e7eb' : '#111827', fontSize: 15, lineHeight: 22 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, color: isDark ? '#f9fafb' : '#111827' },
    heading2: { fontSize: 18, fontWeight: '600' as const, marginBottom: 6, color: isDark ? '#f9fafb' : '#111827' },
    heading3: { fontSize: 16, fontWeight: '600' as const, marginBottom: 4, color: isDark ? '#f9fafb' : '#111827' },
    strong: { fontWeight: '600' as const },
    em: { fontStyle: 'italic' as const },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    code_inline: { 
      backgroundColor: isDark ? '#374151' : '#e5e7eb', 
      paddingHorizontal: 4, 
      paddingVertical: 2, 
      borderRadius: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      color: isDark ? '#e5e7eb' : '#111827',
    },
    fence: { 
      backgroundColor: isDark ? '#111827' : '#1f2937', 
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
      backgroundColor: isDark ? '#1f2937' : '#f3f4f6',
      borderLeftWidth: 4,
      borderLeftColor: isDark ? '#4b5563' : '#9ca3af',
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 8,
    },
    link: { color: '#3b82f6' },
    hr: { backgroundColor: isDark ? '#374151' : '#d1d5db', height: 1, marginVertical: 12 },
  }), [isDark])

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

    // If retrying, we need to handle differently
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: messageContent,
    }

    // Only add user message if not retrying
    if (!retryMessageId) {
      addMessage(userMessage)
    }
    
    setInput('')
    Keyboard.dismiss()
    scrollToBottom()
    setIsLoading(true)

    // Create placeholder for response
    const assistantMessageId = (Date.now() + 1).toString()
    setStreamingMessageId(assistantMessageId)
    
    addMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    })

    const aiMessages: AIMessage[] = messages
      .filter(m => !m.error)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    let fullContent = ''
    

    // Full server-assembled context is not fetched here in this simplified client.
    const jarvisContext = undefined;

    // Map JarvisContext to HealthContext (add missing properties as needed)
    // Adjust this block to use the correct property from HealthEntry, or add a fallback if symptoms is not present
    const recentSymptoms = Array.isArray(logs)
      ? logs
          .filter((entry: any) => entry.symptoms && Array.isArray(entry.symptoms) && entry.symptoms.length > 0)
          .flatMap((entry: any) => entry.symptoms)
      : [];

    // Calculate averages from logs array
    const avgSleep =
      Array.isArray(logs) && logs.length > 0
        ? logs
            .map((entry: any) => entry.sleep ?? 0)
            .reduce((sum: number, val: number) => sum + val, 0) / logs.length
        : 0;

    const avgMood =
      Array.isArray(logs) && logs.length > 0
        ? logs
            .map((entry: any) => entry.mood ?? 0)
            .reduce((sum: number, val: number) => sum + val, 0) / logs.length
        : 0;

    const recentExercise =
      Array.isArray(logs)
        ? logs
            .filter((entry: any) => entry.exercise)
            .map((entry: any) => entry.exercise)
        : [];

    const avgSteps =
      Array.isArray(logs) && logs.length > 0
        ? logs
            .map((entry: any) => entry.steps ?? 0)
            .reduce((sum: number, val: number) => sum + val, 0) / logs.length
        : 0;

    const nutritionSummary =
      Array.isArray(logs) && logs.length > 0
        ? logs
            .map((entry: any) => entry.nutritionSummary ?? '')
            .filter((summary: string) => summary)
            .join('; ')
        : '';

    // Calculate recentVitals, totalEntries, and streak for HealthContext
    // Use the most recent vitals entry (or undefined if none)
    const recentVitals =
      Array.isArray(logs)
        ? (() => {
            const lastEntryWithVitals = [...logs]
              .reverse()
              .find((entry: any) => entry.vitals && typeof entry.vitals === 'object');
            if (lastEntryWithVitals && lastEntryWithVitals.data.category === 'vitals') {
              const { heartRate, bloodPressureDiastolic, temperature, weight } = lastEntryWithVitals.data;
              return {
                heartRate: typeof heartRate === 'number' ? heartRate : undefined,
                bloodPressure: typeof bloodPressureDiastolic === 'string' ? bloodPressureDiastolic : undefined,
                temperature: typeof temperature === 'number' ? temperature : undefined,
                weight: typeof weight === 'number' ? weight : undefined,
              };
            }
            return {};
          })()
        : {};

    const totalEntries = Array.isArray(logs) ? logs.length : 0;

    // Example streak calculation: number of consecutive days with entries
    let streak = 0;
    if (Array.isArray(logs) && logs.length > 0) {
      // Replace 'date' with the correct property, e.g., 'createdAt' or 'timestamp'.
      // If your HealthEntry type uses 'createdAt' for the date, use that property instead.
      // Example below assumes 'createdAt' is the correct property. Change as needed.
            const sortedLogs = [...logs].sort((a: any, b: any) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
            let currentDate = new Date(sortedLogs[0]?.timestamp ?? 0);
            streak = 1;
            for (let i = 1; i < sortedLogs.length; i++) {
              const nextDate = new Date(sortedLogs[i]?.timestamp ?? 0);
              const diff = (currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24);
              if (diff === 1) {
                streak++;
                currentDate = nextDate;
              } else {
                break;
              }
            }
    }

    const healthContext = {
      ...(jarvisContext ?? {}),
      recentSymptoms,
      avgSleep,
      avgMood,
      recentExercise,
      avgSteps,
      nutritionSummary,
      recentVitals, // now an object, not an array
      totalEntries,
      streak,
    };

    const response = await sendChatMessageStreaming(
      apiKey, 
      aiMessages, 
      messageContent,
      (chunk) => {
        fullContent += chunk
        updateMessage(assistantMessageId, { content: fullContent })
        scrollToBottom()
      },
      healthContext
    )

    if (response.error) {
      updateMessage(assistantMessageId, {
        content: `Sorry, I encountered an error: ${response.error}`,
        error: true,
        originalInput: messageContent,
      })
    }

    setStreamingMessageId(null)
    setIsLoading(false)
    scrollToBottom()
  }

  const sendMessage = async () => {
    await sendMessageWithContent(input)
  }

  const retryMessage = async (messageId: string, originalInput: string) => {
    updateMessage(messageId, { content: '', error: false })
    await sendMessageWithContent(originalInput, messageId)
  }

  const handleSaveApiKey = async () => {
    if (tempApiKey.trim()) {
      await setApiKey(tempApiKey.trim())
      setTempApiKey('')
      setShowApiKeySheet(false)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessageWithContent(prompt)
  }

  // Show nothing while loading chat history
  if (isLoadingHistory) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <ActivityIndicator size="large" color="#0066ff" />
      </SafeAreaView>
    )
  }

  const showSuggestedPrompts = messages.length <= 1 && !isLoading

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`} edges={['top']}>
      {/* Header */}
      <View className={`flex-row p-4 border-b items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Medicus</Text>
        <View className="flex-row gap-2">
          {messages.length > 1 && (
            <TouchableOpacity
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 active:bg-gray-700' : 'border border-gray-300 active:bg-gray-50'}`}
              onPress={clearHistory}
            >
              <Ionicons name="trash-outline" size={20} color={isDark ? '#9ca3af' : '#666'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 active:bg-gray-700' : 'border border-gray-300 active:bg-gray-50'}`}
            onPress={() => setShowApiKeySheet(true)}
          >
            <Ionicons name="settings-outline" size={20} color={isDark ? '#9ca3af' : '#666'} />
          </TouchableOpacity>
        </View>
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
                    ? `${isDark ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border px-4 py-2`
                    : `${isDark ? 'bg-gray-800' : 'bg-gray-100'} px-4 py-2`
              }`}
            >
              {message.role === 'user' ? (
                <Text className="text-base text-white">{message.content}</Text>
              ) : message.id === streamingMessageId && message.content === '' ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color={isDark ? '#9ca3af' : '#666'} />
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Thinking...</Text>
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
                    className={`flex-row items-center gap-1 py-1 px-2 rounded-lg ${isDark ? 'bg-red-900/50' : 'bg-red-100'}`}
                    disabled={isLoading}
                  >
                    <Ionicons name="refresh" size={14} color="#dc2626" />
                    <Text className="text-xs text-red-500 font-medium">Retry</Text>
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
                    color={message.role === 'user' ? 'rgba(255,255,255,0.7)' : isDark ? '#6b7280' : '#9ca3af'} 
                  />
                  <Text 
                    className={`text-xs ${
                      message.role === 'user' ? 'text-white/70' : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {copiedId === message.id ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        ))}

        {/* Suggested prompts - show when conversation is new */}
        {showSuggestedPrompts && (
          <View className="mt-4">
            <Text className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Suggested questions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSuggestedPrompt(item.prompt)}
                  className={`flex-row items-center gap-2 px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-800 active:bg-gray-700' : 'bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  <Ionicons name={item.icon} size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {isLoading && !streamingMessageId && (
          <View className="flex-row justify-start">
            <View className={`px-4 py-3 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <ActivityIndicator size="small" color={isDark ? '#9ca3af' : '#666'} />
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
          <View className={`flex-row items-center justify-center py-2 border-t ${isDark ? 'bg-red-900/30 border-red-900' : 'bg-red-50 border-red-100'}`}>
            <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
            <Text className="text-red-500 text-sm font-medium">Listening...</Text>
          </View>
        )}
        
        <View className={`flex-row p-4 gap-2 border-t items-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* Voice input button */}
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              isListening ? 'bg-red-500' : isDark ? 'bg-gray-800' : isVoiceAvailable ? 'bg-gray-100' : 'bg-gray-50'
            }`}
            onPress={isListening ? stopListening : startListening}
            disabled={isLoading}
          >
            <Ionicons 
              name={isListening ? 'stop' : 'mic'} 
              size={20} 
              color={isListening ? '#fff' : isDark ? '#9ca3af' : isVoiceAvailable ? '#666' : '#ccc'} 
            />
          </TouchableOpacity>
          
          <TextInput
            className={`flex-1 border rounded-lg px-3 py-2.5 text-base ${
              isDark 
                ? 'border-gray-600 bg-gray-800 text-white' 
                : 'border-gray-300 bg-white text-gray-900'
            }`}
            placeholder="Ask about your health..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
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

      {/* API Key Modal */}
      <Modal
        visible={showApiKeySheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowApiKeySheet(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`rounded-t-3xl p-6 gap-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className={`w-10 h-1 rounded-full self-center mb-2 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Set up Groq API Key
            </Text>
            <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              Get your free API key at{' '}
              <Text className="text-primary">console.groq.com</Text>
            </Text>
            <TextInput
              className={`border rounded-lg px-3 py-2.5 text-base ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-white' 
                  : 'border-gray-300 bg-white text-gray-900'
              }`}
              placeholder="gsk_..."
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              secureTextEntry
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className={`flex-1 p-3 rounded-lg items-center ${
                  isDark 
                    ? 'bg-gray-700 active:bg-gray-600' 
                    : 'border border-gray-300 active:bg-gray-50'
                }`}
                onPress={() => setShowApiKeySheet(false)}
              >
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>Cancel</Text>
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
