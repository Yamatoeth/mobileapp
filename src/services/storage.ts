import AsyncStorage from '@react-native-async-storage/async-storage'
import type { HealthEntry, HealthCategory } from '../types/health'

const STORAGE_KEY = 'health_logs'

export async function getHealthLogs(): Promise<HealthEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load health logs:', error)
    return []
  }
}

export async function saveHealthLog(entry: HealthEntry): Promise<void> {
  try {
    const logs = await getHealthLogs()
    logs.unshift(entry) // Add to beginning (newest first)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch (error) {
    console.error('Failed to save health log:', error)
    throw error
  }
}

export async function deleteHealthLog(id: string): Promise<void> {
  try {
    const logs = await getHealthLogs()
    const filtered = logs.filter(log => log.id !== id)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to delete health log:', error)
    throw error
  }
}

export async function getLogsByCategory(category: HealthCategory): Promise<HealthEntry[]> {
  const logs = await getHealthLogs()
  return logs.filter(log => log.data.category === category)
}

export async function getRecentLogs(limit: number = 10): Promise<HealthEntry[]> {
  const logs = await getHealthLogs()
  return logs.slice(0, limit)
}

export async function clearAllLogs(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
