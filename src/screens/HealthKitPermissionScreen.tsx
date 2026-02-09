/**
 * HealthKitPermissionScreen - Onboarding flow for HealthKit permissions
 */
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useHealthKit } from '../hooks/useHealthKit';

interface PermissionItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    icon: 'pulse',
    title: 'Heart Rate Variability',
    description: 'Measure your stress levels and recovery state in real-time',
    color: '#8b5cf6',
  },
  {
    icon: 'heart',
    title: 'Heart Rate',
    description: 'Track your cardiovascular health and activity intensity',
    color: '#ef4444',
  },
  {
    icon: 'moon',
    title: 'Sleep Analysis',
    description: 'Understand your sleep quality and recovery patterns',
    color: '#6366f1',
  },
  {
    icon: 'footsteps',
    title: 'Activity Data',
    description: 'Monitor your daily movement and exercise',
    color: '#10b981',
  },
];

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

export function HealthKitPermissionScreen({ onComplete, onSkip }: Props) {
  const { isDark } = useTheme();
  const { initialize, isInitializing, error, isAvailable } = useHealthKit();
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const handleRequestPermission = async () => {
    setPermissionState('requesting');

    try {
      const success = await initialize();
      setPermissionState(success ? 'granted' : 'denied');

      if (success) {
        // Brief delay to show success state
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    } catch {
      setPermissionState('denied');
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  // Show different UI for non-iOS platforms
  if (!isAvailable) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <View className="flex-1 items-center justify-center p-6">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: '#f5920520' }}
          >
            <Ionicons name="phone-portrait" size={40} color="#f59205" />
          </View>
          <Text
            className={`text-2xl font-bold text-center mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            iOS Required
          </Text>
          <Text
            className={`text-center mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            HealthKit integration is only available on iOS devices with Apple Watch.
          </Text>
          <TouchableOpacity
            onPress={handleSkip}
            className="py-3 px-8 rounded-full bg-blue-500"
          >
            <Text className="text-white font-semibold">Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <ScrollView className="flex-1" contentContainerClassName="p-6">
        {/* Header */}
        <View className="items-center mb-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: '#ef444420' }}
          >
            <Ionicons name="fitness" size={40} color="#ef4444" />
          </View>
          <Text
            className={`text-2xl font-bold text-center mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Connect Apple Health
          </Text>
          <Text
            className={`text-center px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            J.A.R.V.I.S. uses your biometric data to provide proactive health insights and optimize your performance.
          </Text>
        </View>

        {/* Permission Items */}
        <View className="mb-8">
          {PERMISSION_ITEMS.map((item, index) => (
            <View
              key={index}
              className={`flex-row items-center p-4 mb-3 rounded-xl ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              }`}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-semibold mb-0.5 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {item.title}
                </Text>
                <Text
                  className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  {item.description}
                </Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={permissionState === 'granted' ? '#10b981' : isDark ? '#374151' : '#d1d5db'}
              />
            </View>
          ))}
        </View>

        {/* Privacy Note */}
        <View
          className={`flex-row items-start p-4 rounded-xl mb-8 ${
            isDark ? 'bg-gray-800/50' : 'bg-blue-50'
          }`}
        >
          <Ionicons
            name="shield-checkmark"
            size={20}
            color={isDark ? '#60a5fa' : '#3b82f6'}
            style={{ marginTop: 2 }}
          />
          <View className="flex-1 ml-3">
            <Text
              className={`font-medium mb-1 ${
                isDark ? 'text-blue-400' : 'text-blue-700'
              }`}
            >
              Your privacy is protected
            </Text>
            <Text className={isDark ? 'text-gray-400' : 'text-blue-600'} style={{ fontSize: 13 }}>
              All health data is processed locally on your device. We never store or share your biometric information with third parties.
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && permissionState === 'denied' && (
          <View className="flex-row items-center p-4 rounded-xl mb-4 bg-red-500/10">
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text className="text-red-500 ml-2 flex-1">{error}</Text>
          </View>
        )}

        {/* Actions */}
        <View className="gap-3">
          <TouchableOpacity
            onPress={handleRequestPermission}
            disabled={isInitializing || permissionState === 'requesting'}
            className={`py-4 rounded-full items-center ${
              permissionState === 'granted'
                ? 'bg-green-500'
                : 'bg-blue-500'
            }`}
            style={{ opacity: isInitializing ? 0.7 : 1 }}
          >
            {isInitializing || permissionState === 'requesting' ? (
              <ActivityIndicator color="#fff" />
            ) : permissionState === 'granted' ? (
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text className="text-white font-semibold">Connected!</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold text-base">
                {permissionState === 'denied' ? 'Try Again' : 'Connect Apple Health'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            className="py-4 rounded-full items-center"
          >
            <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
