import type { HealthEntry, SymptomEntry, SleepEntry, MoodEntry, ExerciseEntry, VitalsEntry } from '../types/health'
import type { HealthContext } from '../services/ai'

export function buildHealthContext(logs: HealthEntry[]): HealthContext {
  // Get logs from last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const recentLogs = logs.filter(log => new Date(log.timestamp) >= sevenDaysAgo)
  
  // Extract symptoms
  const symptomLogs = recentLogs
    .filter(l => l.data.category === 'symptoms')
    .map(l => (l.data as SymptomEntry).symptom)
  const recentSymptoms = [...new Set(symptomLogs)].slice(0, 5) // Unique, max 5
  
  // Calculate average sleep
  const sleepLogs = recentLogs.filter(l => l.data.category === 'sleep') as Array<HealthEntry & { data: SleepEntry }>
  const avgSleep = sleepLogs.length > 0
    ? sleepLogs.reduce((sum, l) => sum + l.data.hours, 0) / sleepLogs.length
    : null
  
  // Calculate average mood
  const moodLogs = recentLogs.filter(l => l.data.category === 'mood') as Array<HealthEntry & { data: MoodEntry }>
  const avgMood = moodLogs.length > 0
    ? moodLogs.reduce((sum, l) => sum + l.data.mood, 0) / moodLogs.length
    : null
  
  // Extract recent exercise activities
  const exerciseLogs = recentLogs
    .filter(l => l.data.category === 'exercise')
    .map(l => {
      const data = l.data as ExerciseEntry
      return `${data.activity} (${data.durationMinutes} min)`
    })
  const recentExercise = exerciseLogs.slice(0, 5)
  
  // Get most recent vitals
  const vitalsLogs = logs
    .filter(l => l.data.category === 'vitals')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  let recentVitals: HealthContext['recentVitals'] = null
  if (vitalsLogs.length > 0) {
    const latest = vitalsLogs[0].data as VitalsEntry
    recentVitals = {
      heartRate: latest.heartRate,
      bloodPressure: latest.bloodPressureSystolic && latest.bloodPressureDiastolic
        ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
        : undefined,
      temperature: latest.temperature,
      weight: latest.weight,
    }
  }
  
  // Calculate streak
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
  
  return {
    recentSymptoms,
    avgSleep,
    avgMood,
    recentExercise,
    recentVitals,
    totalEntries: logs.length,
    streak,
  }
}
