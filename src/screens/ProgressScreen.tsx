import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ProgressScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Progress</Text>
        <Text className="text-gray-500 mt-1">Track your health trends</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4 gap-4">
          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-2">
              Weekly Overview
            </Text>
            <View className="h-48 items-center justify-center bg-gray-100 rounded-lg">
              <Text className="text-gray-500">Charts coming soon</Text>
              <Text className="text-xs text-gray-400 mt-2">
                Log health data to see trends
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 p-4 border border-gray-200 rounded-xl">
              <Text className="text-xs text-gray-500">Entries</Text>
              <Text className="text-3xl font-bold text-gray-900">0</Text>
            </View>
            <View className="flex-1 p-4 border border-gray-200 rounded-xl">
              <Text className="text-xs text-gray-500">Streak</Text>
              <Text className="text-3xl font-bold text-gray-900">0 days</Text>
            </View>
          </View>

          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-2">
              Health Insights
            </Text>
            <Text className="text-gray-500">
              Start logging your health data to receive personalized insights and
              recommendations.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
