import React from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../hooks/useTheme'

interface KnowledgeItem {
  id: string
  type: 'goal' | 'project' | 'preference' | 'fact'
  title: string
  description: string
  category: string
  dateAdded: Date
}

const mockKnowledge: KnowledgeItem[] = [
  {
    id: '1',
    type: 'goal',
    title: 'Learn Python',
    description: 'Planning to learn Python for backend development',
    category: 'skills',
    dateAdded: new Date('2026-04-20'),
  },
  {
    id: '2',
    type: 'project',
    title: 'JARVIS App',
    description: 'Building a voice assistant mobile application',
    category: 'work',
    dateAdded: new Date('2026-04-18'),
  },
  {
    id: '3',
    type: 'preference',
    title: 'Morning briefings',
    description: 'Prefers morning briefings at 8:00 AM',
    category: 'routine',
    dateAdded: new Date('2026-04-15'),
  },
  {
    id: '4',
    type: 'fact',
    title: 'Coffee preference',
    description: 'Strong preference for dark coffee',
    category: 'preferences',
    dateAdded: new Date('2026-04-10'),
  },
]

const typeColors = {
  goal: 'bg-blue-500',
  project: 'bg-green-500',
  preference: 'bg-purple-500',
  fact: 'bg-yellow-500',
}

type Props = {
  onNavigate?: () => void
}

export function KnowledgeScreen({ onNavigate }: Props) {
  const { isDark } = useTheme()

  const filterOptions = ['All', 'Goals', 'Projects', 'Preferences', 'Facts']
  const [selectedFilter, setSelectedFilter] = React.useState('All')

  const filteredKnowledge = React.useMemo(() => {
    if (selectedFilter === 'All') return mockKnowledge
    const filterMap = {
      Goals: 'goal',
      Projects: 'project',
      Preferences: 'preference',
      Facts: 'fact',
    }
    return mockKnowledge.filter(
      (item) => item.type === filterMap[selectedFilter as keyof typeof filterMap]
    )
  }, [selectedFilter])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString()
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
            Knowledge Base
          </Text>
          <View className="w-10" />
        </View>

        {/* Type Filter */}
        <View className="flex-row p-3 border-b border-gray-200 dark:border-gray-700">
          <FlatList
            horizontal
            data={filterOptions}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedFilter(item)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedFilter === item
                    ? 'bg-blue-600'
                    : isDark
                    ? 'bg-gray-700'
                    : 'bg-gray-200'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.toLowerCase()} knowledge items`}
                accessibilityState={{ selected: selectedFilter === item }}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedFilter === item
                      ? 'text-white'
                      : isDark
                      ? 'text-gray-300'
                      : 'text-gray-700'
                  }`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Knowledge List */}
        <FlatList
          data={filteredKnowledge}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          accessibilityLabel="Knowledge base list"
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`mb-3 p-4 rounded-lg shadow-sm ${
                isDark
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-white border border-gray-200'
              }`}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.type}. ${item.description}. Category ${item.category}.`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full ${typeColors[item.type]} mr-2`} />
                  <Text
                    className={`text-sm font-semibold uppercase tracking-wide ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {item.type}
                  </Text>
                </View>
                <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {formatDate(item.dateAdded)}
                </Text>
              </View>
              <Text className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {item.title}
              </Text>
              <View className="flex-row items-center">
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item.description}
                </Text>
                <View
                  className={`ml-auto px-2 py-1 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.category}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center p-8">
              <Ionicons name="book-outline" size={64} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No knowledge items yet
              </Text>
              <Text className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Talk to JARVIS and it will learn about you
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  )
}
