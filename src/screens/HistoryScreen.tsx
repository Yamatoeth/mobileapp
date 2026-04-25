import React from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../hooks/useTheme'

interface ConversationHistoryItem {
  id: string
  timestamp: Date
  preview: string
  duration: number
}

const mockHistory: ConversationHistoryItem[] = [
  {
    id: '1',
    timestamp: new Date('2026-04-25T10:30:00'),
    preview: 'Set a reminder for tomorrow at 9 AM',
    duration: 32,
  },
  {
    id: '2',
    timestamp: new Date('2026-04-24T15:45:00'),
    preview: 'What did I learn about the new project?',
    duration: 45,
  },
  {
    id: '3',
    timestamp: new Date('2026-04-23T09:15:00'),
    preview: 'Tell me about the weekend weather forecast',
    duration: 28,
  },
]

type Props = {
  onNavigate?: () => void
}

export function HistoryScreen({ onNavigate }: Props) {
  const { isDark } = useTheme()

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}
    >
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <TouchableOpacity
            onPress={onNavigate}
            className="p-2 min-h-11 min-w-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back to assistant"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Conversation History
          </Text>
          <View className="w-10" />
        </View>

        {/* History List */}
        <FlatList
          data={mockHistory}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          accessibilityLabel="Conversation history list"
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`mb-3 p-4 rounded-lg shadow-sm ${
                isDark
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-white border border-gray-200'
              }`}
              accessibilityRole="button"
              accessibilityLabel={`${item.preview}. ${formatDate(item.timestamp)} at ${formatTime(item.timestamp)}. Duration ${formatDuration(item.duration)}.`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {formatDate(item.timestamp)}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {formatTime(item.timestamp)} • {formatDuration(item.duration)}
                </Text>
              </View>
              <Text className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={2}>
                {item.preview}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center p-8">
              <Ionicons name="time-outline" size={64} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No conversation history
              </Text>
              <Text className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Start talking to JARVIS to see your history here
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  )
}
