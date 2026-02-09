import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useHealthLogs } from '../hooks/useHealthLogs'
import { LogForm } from '../components/LogForm'
import { HEALTH_CATEGORIES, type CategoryConfig, type HealthEntry, type HealthEntryData } from '../types/health'

function formatEntryPreview(entry: HealthEntry): string {
  const { data } = entry
  switch (data.category) {
    case 'symptoms':
      return `${data.symptom} (Severity: ${data.severity}/5)`
    case 'vitals':
      const parts = []
      if (data.heartRate) parts.push(`HR: ${data.heartRate}`)
      if (data.bloodPressureSystolic && data.bloodPressureDiastolic) 
        parts.push(`BP: ${data.bloodPressureSystolic}/${data.bloodPressureDiastolic}`)
      if (data.temperature) parts.push(`Temp: ${data.temperature}°F`)
      if (data.weight) parts.push(`Weight: ${data.weight} lbs`)
      return parts.join(' • ') || 'Vitals recorded'
    case 'sleep':
      return `${data.hours} hours (Quality: ${data.quality}/5)`
    case 'nutrition':
      return `${data.meal.charAt(0).toUpperCase() + data.meal.slice(1)}: ${data.description}`
    case 'exercise':
      return `${data.activity} - ${data.durationMinutes} min (${data.intensity})`
    case 'mood':
      const moods = ['😢', '😕', '😐', '🙂', '😄']
      return `Mood: ${moods[data.mood - 1]} • Energy: ${data.energy}/5`
    default:
      return 'Entry recorded'
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString()
}

function getCategoryConfig(categoryId: string): CategoryConfig | undefined {
  return HEALTH_CATEGORIES.find(c => c.id === categoryId)
}

export function LogScreen() {
  const { logs, addLog, removeLog, isLoading } = useHealthLogs()
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null)

  const handleCategoryPress = (category: CategoryConfig) => {
    setSelectedCategory(category)
  }

  const handleSave = async (data: HealthEntryData) => {
    await addLog(data)
    setSelectedCategory(null)
  }

  const handleCancel = () => {
    setSelectedCategory(null)
  }

  const recentLogs = logs.slice(0, 10)

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Health Log</Text>
        <Text className="text-gray-500 mt-1">Track your daily health data</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4 gap-4">
          <View className="flex-row flex-wrap gap-3 justify-between">
            {HEALTH_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => handleCategoryPress(category)}
                className="w-[47%] p-4 border border-gray-200 rounded-xl bg-white active:bg-gray-50"
              >
                <Ionicons name={category.icon} size={28} color={category.color} />
                <Text className="text-base font-semibold text-gray-900 mt-2">
                  {category.label}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">Tap to log</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-4">
            <Text className="text-lg font-semibold text-gray-900 mb-2">
              Recent Entries
            </Text>
            {isLoading ? (
              <View className="p-4 border border-gray-200 rounded-xl">
                <Text className="text-gray-500">Loading...</Text>
              </View>
            ) : recentLogs.length === 0 ? (
              <View className="p-4 border border-gray-200 rounded-xl">
                <Text className="text-gray-500">
                  No entries yet. Start logging your health data!
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {recentLogs.map((entry) => {
                  const config = getCategoryConfig(entry.data.category)
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      onLongPress={() => removeLog(entry.id)}
                      className="p-4 border border-gray-200 rounded-xl bg-white flex-row items-start gap-3"
                    >
                      <View 
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${config?.color}15` }}
                      >
                        <Ionicons 
                          name={config?.icon || 'document-outline'} 
                          size={20} 
                          color={config?.color || '#666'} 
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="font-medium text-gray-900">
                            {config?.label || 'Entry'}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            {formatTime(entry.timestamp)}
                          </Text>
                        </View>
                        <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={2}>
                          {formatEntryPreview(entry)}
                        </Text>
                        {entry.data.notes && (
                          <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>
                            {entry.data.notes}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
                <Text className="text-xs text-gray-400 text-center mt-2">
                  Long press an entry to delete
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Log Entry Modal */}
      <Modal
        visible={selectedCategory !== null}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-4" />
            {selectedCategory && (
              <>
                <View className="flex-row items-center gap-3 mb-6">
                  <View 
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${selectedCategory.color}15` }}
                  >
                    <Ionicons 
                      name={selectedCategory.icon} 
                      size={24} 
                      color={selectedCategory.color} 
                    />
                  </View>
                  <View>
                    <Text className="text-xl font-bold text-gray-900">
                      Log {selectedCategory.label}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>
                </View>
                <LogForm 
                  category={selectedCategory} 
                  onSave={handleSave} 
                  onCancel={handleCancel} 
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
