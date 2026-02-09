import { useState, useEffect, useCallback } from 'react'
import type { HealthEntry, HealthEntryData } from '../types/health'
import { getHealthLogs, saveHealthLog, deleteHealthLog } from '../services/storage'

export function useHealthLogs() {
  const [logs, setLogs] = useState<HealthEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getHealthLogs()
      setLogs(data)
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const addLog = useCallback(async (data: HealthEntryData) => {
    const entry: HealthEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      data,
    }
    await saveHealthLog(entry)
    setLogs(prev => [entry, ...prev])
    return entry
  }, [])

  const removeLog = useCallback(async (id: string) => {
    await deleteHealthLog(id)
    setLogs(prev => prev.filter(log => log.id !== id))
  }, [])

  const getRecentLogs = useCallback((limit: number = 10) => {
    return logs.slice(0, limit)
  }, [logs])

  const getLogsByCategory = useCallback((category: string) => {
    return logs.filter(log => log.data.category === category)
  }, [logs])

  return {
    logs,
    isLoading,
    addLog,
    removeLog,
    refreshLogs: loadLogs,
    getRecentLogs,
    getLogsByCategory,
  }
}
