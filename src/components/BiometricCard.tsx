/**
 * BiometricCard - Real-time display of HRV and BPM data
 */
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useBiometricStore, BiometricTrend } from '../store/biometricStore';

interface BiometricCardProps {
  onPress?: () => void;
  compact?: boolean;
}

function getTrendIcon(trend: BiometricTrend): keyof typeof Ionicons.glyphMap {
  switch (trend) {
    case 'rising':
      return 'trending-up';
    case 'falling':
      return 'trending-down';
    default:
      return 'remove';
  }
}

function getTrendColor(trend: BiometricTrend, isDark: boolean): string {
  switch (trend) {
    case 'rising':
      return '#10b981'; // green
    case 'falling':
      return '#ef4444'; // red
    default:
      return isDark ? '#9ca3af' : '#6b7280'; // gray
  }
}

function getStressLabel(score: number): { label: string; color: string } {
  if (score < 0.3) return { label: 'Low', color: '#10b981' };
  if (score < 0.6) return { label: 'Moderate', color: '#f59e0b' };
  if (score < 0.8) return { label: 'High', color: '#f97316' };
  return { label: 'Very High', color: '#ef4444' };
}

function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BiometricCard({ onPress, compact = false }: BiometricCardProps) {
  const { isDark } = useTheme();
  const {
    hrvMs,
    bpm,
    stressScore,
    trend,
    lastUpdated,
    isLoading,
    error,
    currentState,
  } = useBiometricStore();

  const trendColor = getTrendColor(trend, isDark);
  const stress = getStressLabel(stressScore);
  const hasData = hrvMs > 0 || bpm > 0;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className={`flex-row items-center justify-between p-3 rounded-xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
        style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }}
      >
        <View className="flex-row items-center gap-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: '#ef444420' }}
          >
            <Ionicons name="heart" size={20} color="#ef4444" />
          </View>
          <View>
            <Text
              className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {hasData ? `${bpm} BPM` : '--'}
            </Text>
            <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              {hasData ? `HRV ${Math.round(hrvMs)}ms` : 'No data'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {isLoading && <ActivityIndicator size="small" color={trendColor} />}
          <Ionicons
            name={getTrendIcon(trend)}
            size={20}
            color={trendColor}
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`rounded-2xl p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Ionicons
            name="fitness"
            size={20}
            color={isDark ? '#60a5fa' : '#3b82f6'}
          />
          <Text
            className={`text-base font-medium ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Biometrics
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {isLoading && (
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#3b82f6'} />
          )}
          <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {formatTime(lastUpdated)}
          </Text>
        </View>
      </View>

      {/* Error State */}
      {error && (
        <View className="flex-row items-center gap-2 mb-3 p-2 bg-red-500/10 rounded-lg">
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text className="text-red-500 text-xs flex-1">{error}</Text>
        </View>
      )}

      {/* Main Metrics */}
      <View className="flex-row justify-between mb-4">
        {/* Heart Rate */}
        <View className="flex-1 items-center">
          <View
            className="w-14 h-14 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: '#ef444420' }}
          >
            <Ionicons name="heart" size={28} color="#ef4444" />
          </View>
          <Text
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {hasData ? bpm : '--'}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            BPM
          </Text>
        </View>

        {/* HRV */}
        <View className="flex-1 items-center">
          <View
            className="w-14 h-14 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: '#8b5cf620' }}
          >
            <Ionicons name="pulse" size={28} color="#8b5cf6" />
          </View>
          <Text
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {hasData ? Math.round(hrvMs) : '--'}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            HRV (ms)
          </Text>
        </View>

        {/* Stress */}
        <View className="flex-1 items-center">
          <View
            className="w-14 h-14 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: `${stress.color}20` }}
          >
            <Ionicons name="analytics" size={28} color={stress.color} />
          </View>
          <Text
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {hasData ? Math.round(stressScore * 100) : '--'}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Stress %
          </Text>
        </View>
      </View>

      {/* Status Bar */}
      <View
        className={`flex-row items-center justify-between p-3 rounded-xl ${
          isDark ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}
      >
        <View className="flex-row items-center gap-2">
          <View
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stress.color }}
          />
          <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            {stress.label} stress
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Ionicons name={getTrendIcon(trend)} size={16} color={trendColor} />
          <Text style={{ color: trendColor }} className="text-sm capitalize">
            {currentState}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * BiometricMini - Ultra compact biometric indicator
 */
export function BiometricMini() {
  const { isDark } = useTheme();
  const { bpm, stressScore, isLoading } = useBiometricStore();

  const stress = getStressLabel(stressScore);
  const hasData = bpm > 0;

  return (
    <View className="flex-row items-center gap-2">
      {isLoading ? (
        <ActivityIndicator size="small" color="#ef4444" />
      ) : (
        <>
          <Ionicons name="heart" size={14} color="#ef4444" />
          <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            {hasData ? `${bpm}` : '--'}
          </Text>
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: stress.color }}
          />
        </>
      )}
    </View>
  );
}
