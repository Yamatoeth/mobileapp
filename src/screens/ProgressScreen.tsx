import { View, Text, ScrollView, Dimensions, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LineChart, BarChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'
import { useHealthLogs } from '../hooks/useHealthLogs'
import { useTheme } from '../hooks/useTheme'
import { useMemo, useState, useCallback } from 'react'
import type { HealthEntry, MoodEntry, SleepEntry, ExerciseEntry } from '../types/health'

const screenWidth = Dimensions.get('window').width - 64

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
  const { isDark } = useTheme()
  const { logs, isLoading, refreshLogs } = useHealthLogs()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshLogs()
    setRefreshing(false)
  }, [refreshLogs])

  const chartConfig = useMemo(() => ({
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    backgroundGradientFrom: isDark ? '#1f2937' : '#ffffff',
    backgroundGradientTo: isDark ? '#1f2937' : '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 102, 255, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(102, 102, 102, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#0066ff',
    },
  }), [isDark])

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
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`} edges={['top']}>
      <View className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</Text>
        <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Track your health trends</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#9ca3af' : '#666'}
          />
        }
      >
        <View className="p-4 gap-4">
          {/* Stats Row */}
          <View className="flex-row gap-3">
            <View className={`flex-1 p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Entries</Text>
              <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.totalEntries}</Text>
            </View>
            <View className={`flex-1 p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Streak</Text>
              <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-3">
            <View className={`flex-1 p-3 rounded-xl ${isDark ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="moon-outline" size={18} color="#8b5cf6" />
                <Text className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Avg Sleep</Text>
              </View>
              <Text className={`text-xl font-bold mt-1 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                {stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}h` : '--'}
              </Text>
            </View>
            <View className={`flex-1 p-3 rounded-xl ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="happy-outline" size={18} color="#eab308" />
                <Text className={`text-xs ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>Avg Mood</Text>
              </View>
              <Text className={`text-xl font-bold mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                {stats.avgMood > 0 ? `${stats.avgMood.toFixed(1)}/5` : '--'}
              </Text>
            </View>
            <View className={`flex-1 p-3 rounded-xl ${isDark ? 'bg-orange-900/30' : 'bg-orange-50'}`}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="fitness-outline" size={18} color="#f97316" />
                <Text className={`text-xs ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>Exercise</Text>
              </View>
              <Text className={`text-xl font-bold mt-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                {stats.totalExercise > 0 ? `${stats.totalExercise}m` : '--'}
              </Text>
            </View>
          </View>

          {/* Mood Chart */}
          <View className={`p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
              <View className={`h-40 items-center justify-center rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <Ionicons name="happy-outline" size={32} color={isDark ? '#4b5563' : '#ccc'} />
                <Text className={`mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No mood data yet</Text>
                <Text className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Log your mood to see trends</Text>
              </View>
            )}
          </View>

          {/* Sleep Chart */}
          <View className={`p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
              <View className={`h-40 items-center justify-center rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <Ionicons name="moon-outline" size={32} color={isDark ? '#4b5563' : '#ccc'} />
                <Text className={`mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No sleep data yet</Text>
                <Text className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Log your sleep to see patterns</Text>
              </View>
            )}
          </View>

          {/* Exercise Chart */}
          <View className={`p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
              <View className={`h-40 items-center justify-center rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <Ionicons name="fitness-outline" size={32} color={isDark ? '#4b5563' : '#ccc'} />
                <Text className={`mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No exercise data yet</Text>
                <Text className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Log workouts to track progress</Text>
              </View>
            )}
          </View>

          {/* Insights */}
          <View className={`p-4 border rounded-xl ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Health Insights
            </Text>
            {stats.totalEntries > 5 ? (
              <View className="gap-3">
                {stats.avgSleep > 0 && stats.avgSleep < 7 && (
                  <View className={`flex-row items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
                    <Ionicons name="moon" size={20} color="#8b5cf6" />
                    <View className="flex-1">
                      <Text className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Sleep could improve</Text>
                      <Text className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                        You're averaging {stats.avgSleep.toFixed(1)} hours. Try for 7-9 hours.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.avgSleep >= 7 && (
                  <View className={`flex-row items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <View className="flex-1">
                      <Text className={`font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>Great sleep habits!</Text>
                      <Text className={`text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        Averaging {stats.avgSleep.toFixed(1)} hours is excellent.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.avgMood > 0 && stats.avgMood < 3 && (
                  <View className={`flex-row items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
                    <Ionicons name="heart" size={20} color="#eab308" />
                    <View className="flex-1">
                      <Text className={`font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>Take care of yourself</Text>
                      <Text className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        Your mood has been low. Consider talking to someone.
                      </Text>
                    </View>
                  </View>
                )}
                {stats.streak >= 7 && (
                  <View className={`flex-row items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <Ionicons name="flame" size={20} color="#0066ff" />
                    <View className="flex-1">
                      <Text className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Amazing streak!</Text>
                      <Text className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        {stats.streak} days of consistent logging. Keep it up!
                      </Text>
                    </View>
                  </View>
                )}
                {stats.totalEntries > 5 && stats.avgMood === 0 && stats.avgSleep === 0 && (
                  <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    Log mood and sleep data for personalized insights.
                  </Text>
                )}
              </View>
            ) : (
              <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
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
