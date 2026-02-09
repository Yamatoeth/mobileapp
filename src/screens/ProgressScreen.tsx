import { View, Text, ScrollView, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LineChart, BarChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'
import { useHealthLogs } from '../hooks/useHealthLogs'
import { useMemo } from 'react'
import type { HealthEntry, MoodEntry, SleepEntry, ExerciseEntry } from '../types/health'

const screenWidth = Dimensions.get('window').width - 64

const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 102, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#0066ff',
  },
}

function getLast7Days(): string[] {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date.toLocaleDateString('en-US', { weekday: 'short' }))
  }
  return days
}

function getLogsForDay(logs: HealthEntry[], daysAgo: number): HealthEntry[] {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - daysAgo)
  const targetDateStr = targetDate.toDateString()
  
  return logs.filter(log => {
    const logDate = new Date(log.timestamp).toDateString()
    return logDate === targetDateStr
  })
}

function calculateStreak(logs: HealthEntry[]): number {
  if (logs.length === 0) return 0
  
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateStr = checkDate.toDateString()
    
    const hasEntry = logs.some(log => 
      new Date(log.timestamp).toDateString() === dateStr
    )
    
    if (hasEntry) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  
  return streak
}

export function ProgressScreen() {
  const { logs, isLoading } = useHealthLogs()

  const stats = useMemo(() => {
    const last7Days = getLast7Days()
    
    // Mood data for the week
    const moodData = last7Days.map((_, i) => {
      const dayLogs = getLogsForDay(logs, 6 - i)
      const moodLogs = dayLogs.filter(l => l.data.category === 'mood') as Array<HealthEntry & { data: MoodEntry }>
      if (moodLogs.length === 0) return 0
      const avg = moodLogs.reduce((sum, l) => sum + l.data.mood, 0) / moodLogs.length
      return avg
    })

    // Sleep data for the week
    const sleepData = last7Days.map((_, i) => {
      const dayLogs = getLogsForDay(logs, 6 - i)
      const sleepLogs = dayLogs.filter(l => l.data.category === 'sleep') as Array<HealthEntry & { data: SleepEntry }>
      if (sleepLogs.length === 0) return 0
      return sleepLogs.reduce((sum, l) => sum + l.data.hours, 0)
    })

    // Exercise minutes for the week
    const exerciseData = last7Days.map((_, i) => {
      const dayLogs = getLogsForDay(logs, 6 - i)
      const exerciseLogs = dayLogs.filter(l => l.data.category === 'exercise') as Array<HealthEntry & { data: ExerciseEntry }>
      return exerciseLogs.reduce((sum, l) => sum + l.data.durationMinutes, 0)
    })

    // Category breakdown
    const categoryBreakdown = {
      symptoms: logs.filter(l => l.data.category === 'symptoms').length,
      vitals: logs.filter(l => l.data.category === 'vitals').length,
      sleep: logs.filter(l => l.data.category === 'sleep').length,
      nutrition: logs.filter(l => l.data.category === 'nutrition').length,
      exercise: logs.filter(l => l.data.category === 'exercise').length,
      mood: logs.filter(l => l.data.category === 'mood').length,
    }

    const streak = calculateStreak(logs)
    const avgMood = moodData.filter(m => m > 0).length > 0 
      ? moodData.filter(m => m > 0).reduce((a, b) => a + b, 0) / moodData.filter(m => m > 0).length 
      : 0
    const avgSleep = sleepData.filter(s => s > 0).length > 0
      ? sleepData.filter(s => s > 0).reduce((a, b) => a + b, 0) / sleepData.filter(s => s > 0).length
      : 0
    const totalExercise = exerciseData.reduce((a, b) => a + b, 0)

    return {
      labels: last7Days,
      moodData: moodData.map(m => m || 0),
      sleepData: sleepData.map(s => s || 0),
      exerciseData,
      categoryBreakdown,
      streak,
      avgMood,
      avgSleep,
      totalExercise,
      totalEntries: logs.length,
    }
  }, [logs])

  const hasMoodData = stats.moodData.some(m => m > 0)
  const hasSleepData = stats.sleepData.some(s => s > 0)
  const hasExerciseData = stats.exerciseData.some(e => e > 0)

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Progress</Text>
        <Text className="text-gray-500 mt-1">Track your health trends</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-4">
          {/* Stats Row */}
          <View className="flex-row gap-3">
            <View className="flex-1 p-4 border border-gray-200 rounded-xl">
              <Text className="text-xs text-gray-500">Total Entries</Text>
              <Text className="text-3xl font-bold text-gray-900">{stats.totalEntries}</Text>
            </View>
            <View className="flex-1 p-4 border border-gray-200 rounded-xl">
              <Text className="text-xs text-gray-500">Streak</Text>
              <Text className="text-3xl font-bold text-gray-900">{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 p-3 bg-purple-50 rounded-xl">
              <View className="flex-row items-center gap-2">
                <Ionicons name="moon-outline" size={18} color="#8b5cf6" />
                <Text className="text-xs text-purple-600">Avg Sleep</Text>
              </View>
              <Text className="text-xl font-bold text-purple-700 mt-1">
                {stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}h` : '--'}
              </Text>
            </View>
            <View className="flex-1 p-3 bg-yellow-50 rounded-xl">
              <View className="flex-row items-center gap-2">
                <Ionicons name="happy-outline" size={18} color="#eab308" />
                <Text className="text-xs text-yellow-600">Avg Mood</Text>
              </View>
              <Text className="text-xl font-bold text-yellow-700 mt-1">
                {stats.avgMood > 0 ? `${stats.avgMood.toFixed(1)}/5` : '--'}
              </Text>
            </View>
            <View className="flex-1 p-3 bg-orange-50 rounded-xl">
              <View className="flex-row items-center gap-2">
                <Ionicons name="fitness-outline" size={18} color="#f97316" />
                <Text className="text-xs text-orange-600">Exercise</Text>
              </View>
              <Text className="text-xl font-bold text-orange-700 mt-1">
                {stats.totalExercise > 0 ? `${stats.totalExercise}m` : '--'}
              </Text>
            </View>
          </View>

          {/* Mood Chart */}
          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Mood This Week
            </Text>
            {hasMoodData ? (
              <LineChart
                data={{
                  labels: stats.labels,
                  datasets: [{ data: stats.moodData.map(m => m || 0.1) }],
                }}
                width={screenWidth}
                height={160}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(234, 179, 8, ${opacity})`,
                }}
                bezier
                style={{ marginLeft: -16, borderRadius: 8 }}
                fromZero
                yAxisSuffix=""
                yAxisInterval={1}
              />
            ) : (
              <View className="h-40 items-center justify-center bg-gray-50 rounded-lg">
                <Ionicons name="happy-outline" size={32} color="#ccc" />
                <Text className="text-gray-400 mt-2">No mood data yet</Text>
                <Text className="text-xs text-gray-400">Log your mood to see trends</Text>
              </View>
            )}
          </View>

          {/* Sleep Chart */}
          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Sleep This Week
            </Text>
            {hasSleepData ? (
              <BarChart
                data={{
                  labels: stats.labels,
                  datasets: [{ data: stats.sleepData }],
                }}
                width={screenWidth}
                height={160}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                }}
                style={{ marginLeft: -16, borderRadius: 8 }}
                fromZero
                showValuesOnTopOfBars
                yAxisLabel=""
                yAxisSuffix="h"
              />
            ) : (
              <View className="h-40 items-center justify-center bg-gray-50 rounded-lg">
                <Ionicons name="moon-outline" size={32} color="#ccc" />
                <Text className="text-gray-400 mt-2">No sleep data yet</Text>
                <Text className="text-xs text-gray-400">Log your sleep to see patterns</Text>
              </View>
            )}
          </View>

          {/* Exercise Chart */}
          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Exercise This Week
            </Text>
            {hasExerciseData ? (
              <BarChart
                data={{
                  labels: stats.labels,
                  datasets: [{ data: stats.exerciseData }],
                }}
                width={screenWidth}
                height={160}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
                }}
                style={{ marginLeft: -16, borderRadius: 8 }}
                fromZero
                showValuesOnTopOfBars
                yAxisLabel=""
                yAxisSuffix="m"
              />
            ) : (
              <View className="h-40 items-center justify-center bg-gray-50 rounded-lg">
                <Ionicons name="fitness-outline" size={32} color="#ccc" />
                <Text className="text-gray-400 mt-2">No exercise data yet</Text>
                <Text className="text-xs text-gray-400">Log workouts to track progress</Text>
              </View>
            )}
          </View>

          {/* Insights */}
          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Health Insights
            </Text>
            {stats.totalEntries > 5 ? (
              <View className="gap-3">
                {stats.avgSleep > 0 && stats.avgSleep < 7 && (
                  <View className="flex-row items-start gap-3 p-3 bg-purple-50 rounded-lg">
                    <Ionicons name="moon" size={20} color="#8b5cf6" />
                    <View className="flex-1">
                      <Text className="font-medium text-purple-700">Sleep could improve</Text>
                      <Text className="text-sm text-purple-600">
                        You're averaging {stats.avgSleep.toFixed(1)} hours. Try for 7-9 hours.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.avgSleep >= 7 && (
                  <View className="flex-row items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <View className="flex-1">
                      <Text className="font-medium text-green-700">Great sleep habits!</Text>
                      <Text className="text-sm text-green-600">
                        Averaging {stats.avgSleep.toFixed(1)} hours is excellent.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.avgMood > 0 && stats.avgMood < 3 && (
                  <View className="flex-row items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <Ionicons name="heart" size={20} color="#eab308" />
                    <View className="flex-1">
                      <Text className="font-medium text-yellow-700">Take care of yourself</Text>
                      <Text className="text-sm text-yellow-600">
                        Your mood has been low. Consider talking to someone.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.streak >= 7 && (
                  <View className="flex-row items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <Ionicons name="flame" size={20} color="#0066ff" />
                    <View className="flex-1">
                      <Text className="font-medium text-blue-700">Amazing streak!</Text>
                      <Text className="text-sm text-blue-600">
                        {stats.streak} days of consistent logging. Keep it up!
                      </Text>
                    </View>
                  </View>
                )}
                {stats.totalEntries > 5 && stats.avgMood === 0 && stats.avgSleep === 0 && (
                  <Text className="text-gray-500">
                    Log mood and sleep data for personalized insights.
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-gray-500">
                Keep logging your health data to receive personalized insights.
                You need at least 5 entries for insights.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
