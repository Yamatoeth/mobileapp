import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4 gap-4">
          <View className="p-4 border border-gray-200 rounded-xl">
            <View className="flex-row items-center gap-4">
              <View className="w-14 h-14 rounded-full bg-primary items-center justify-center">
                <Text className="text-white text-xl font-bold">U</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900">User</Text>
                <Text className="text-gray-500">Tap to set up your profile</Text>
              </View>
            </View>
          </View>

          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Preferences
            </Text>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-base text-gray-900">Notifications</Text>
              <Switch />
            </View>
            <View className="h-px bg-gray-200 my-1" />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-base text-gray-900">Dark Mode</Text>
              <Switch />
            </View>
            <View className="h-px bg-gray-200 my-1" />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-base text-gray-900">Voice Input</Text>
              <Switch value={true} />
            </View>
          </View>

          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Health Profile
            </Text>
            <Text className="text-gray-500">
              Set up your health profile to get personalized recommendations.
            </Text>
            <TouchableOpacity className="bg-primary p-3 rounded-lg items-center mt-3 active:opacity-80">
              <Text className="text-white font-semibold">Complete Profile</Text>
            </TouchableOpacity>
          </View>

          <View className="p-4 border border-gray-200 rounded-xl">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Data & Privacy
            </Text>
            <TouchableOpacity className="border border-gray-300 p-3 rounded-lg items-center mt-2 active:bg-gray-50">
              <Text className="text-gray-900 font-medium">Export Health Data</Text>
            </TouchableOpacity>
            <TouchableOpacity className="border border-red-400 p-3 rounded-lg items-center mt-2 active:bg-red-50">
              <Text className="text-red-500 font-medium">Delete All Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
