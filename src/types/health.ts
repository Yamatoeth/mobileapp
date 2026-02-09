export type HealthCategory = 
  | 'symptoms'
  | 'vitals'
  | 'sleep'
  | 'nutrition'
  | 'exercise'
  | 'mood'

export interface SymptomEntry {
  category: 'symptoms'
  symptom: string
  severity: 1 | 2 | 3 | 4 | 5
  notes?: string
}

export interface VitalsEntry {
  category: 'vitals'
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  heartRate?: number
  temperature?: number
  weight?: number
  notes?: string
}

export interface SleepEntry {
  category: 'sleep'
  hours: number
  quality: 1 | 2 | 3 | 4 | 5
  notes?: string
}

export interface NutritionEntry {
  category: 'nutrition'
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: string
  calories?: number
  notes?: string
}

export interface ExerciseEntry {
  category: 'exercise'
  activity: string
  durationMinutes: number
  intensity: 'light' | 'moderate' | 'vigorous'
  notes?: string
}

export interface MoodEntry {
  category: 'mood'
  mood: 1 | 2 | 3 | 4 | 5
  energy: 1 | 2 | 3 | 4 | 5
  notes?: string
}

export type HealthEntryData = 
  | SymptomEntry 
  | VitalsEntry 
  | SleepEntry 
  | NutritionEntry 
  | ExerciseEntry 
  | MoodEntry

export interface HealthEntry {
  id: string
  timestamp: string
  data: HealthEntryData
}

export interface CategoryConfig {
  id: HealthCategory
  label: string
  icon: 'thermometer-outline' | 'heart-outline' | 'moon-outline' | 'leaf-outline' | 'fitness-outline' | 'happy-outline'
  color: string
}

export const HEALTH_CATEGORIES: CategoryConfig[] = [
  { id: 'symptoms', label: 'Symptoms', icon: 'thermometer-outline', color: '#ef4444' },
  { id: 'vitals', label: 'Vitals', icon: 'heart-outline', color: '#ec4899' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#8b5cf6' },
  { id: 'nutrition', label: 'Nutrition', icon: 'leaf-outline', color: '#22c55e' },
  { id: 'exercise', label: 'Exercise', icon: 'fitness-outline', color: '#f97316' },
  { id: 'mood', label: 'Mood', icon: 'happy-outline', color: '#eab308' },
]
