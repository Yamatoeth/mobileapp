import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

type CategoryIcon = 'thermometer-outline' | 'heart-outline' | 'moon-outline' | 'leaf-outline' | 'fitness-outline' | 'happy-outline'

const healthCategories: { id: string; label: string; icon: CategoryIcon }[] = [
  { id: 'symptoms', label: 'Symptoms', icon: 'thermometer-outline' },
  { id: 'vitals', label: 'Vitals', icon: 'heart-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'nutrition', label: 'Nutrition', icon: 'leaf-outline' },
  { id: 'exercise', label: 'Exercise', icon: 'fitness-outline' },
  { id: 'mood', label: 'Mood', icon: 'happy-outline' },
]

export function LogScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Health Log</Text>
        <Text className="text-gray-500 mt-1">Track your daily health data</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4 gap-4">
          <View className="flex-row flex-wrap gap-3 justify-between">
            {healthCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                className="w-[47%] p-4 border border-gray-200 rounded-xl bg-white active:bg-gray-50"
              >
                <Ionicons name={category.icon} size={28} color="#0066ff" />
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
            <View className="p-4 border border-gray-200 rounded-xl">
              <Text className="text-gray-500">
                No entries yet. Start logging your health data!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
