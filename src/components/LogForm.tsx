import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { 
  HealthCategory, 
  SymptomEntry, 
  VitalsEntry, 
  SleepEntry, 
  NutritionEntry, 
  ExerciseEntry, 
  MoodEntry,
  HealthEntryData,
  CategoryConfig
} from '../types/health'

interface LogFormProps {
  category: CategoryConfig
  onSave: (data: HealthEntryData) => void
  onCancel: () => void
}

// Rating selector component
function RatingSelector({ 
  value, 
  onChange, 
  label,
  labels = ['1', '2', '3', '4', '5']
}: { 
  value: number
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
  label: string
  labels?: string[]
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            className={`flex-1 py-3 rounded-lg items-center ${
              value === n ? 'bg-primary' : 'bg-gray-100'
            }`}
          >
            <Text className={`text-sm font-medium ${value === n ? 'text-white' : 'text-gray-600'}`}>
              {labels[n - 1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// Symptoms Form
function SymptomsForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!symptom.trim()) return
    const entry: SymptomEntry = {
      category: 'symptoms',
      symptom: symptom.trim(),
      severity,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  return (
    <View className="gap-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Symptom</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="e.g., Headache, Fatigue, Cough..."
          value={symptom}
          onChangeText={setSymptom}
        />
      </View>
      <RatingSelector
        value={severity}
        onChange={setSeverity}
        label="Severity"
        labels={['Mild', 'Light', 'Moderate', 'Strong', 'Severe']}
      />
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Any additional details..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={!symptom.trim()} />
    </View>
  )
}

// Vitals Form
function VitalsForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [heartRate, setHeartRate] = useState('')
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [temperature, setTemperature] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    const entry: VitalsEntry = {
      category: 'vitals',
      heartRate: heartRate ? parseInt(heartRate) : undefined,
      bloodPressureSystolic: systolic ? parseInt(systolic) : undefined,
      bloodPressureDiastolic: diastolic ? parseInt(diastolic) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  const hasAnyValue = heartRate || systolic || diastolic || temperature || weight

  return (
    <ScrollView className="gap-4" showsVerticalScrollIndicator={false}>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 mb-2">Heart Rate</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            placeholder="bpm"
            value={heartRate}
            onChangeText={setHeartRate}
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 mb-2">Temperature</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            placeholder="°F"
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Blood Pressure</Text>
        <View className="flex-row gap-3 items-center">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
            placeholder="Systolic"
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="number-pad"
          />
          <Text className="text-gray-400">/</Text>
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
            placeholder="Diastolic"
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Weight (lbs)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Weight"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
        />
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Any additional details..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={!hasAnyValue} />
    </ScrollView>
  )
}

// Sleep Form
function SleepForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!hours) return
    const entry: SleepEntry = {
      category: 'sleep',
      hours: parseFloat(hours),
      quality,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  return (
    <View className="gap-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Hours Slept</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="e.g., 7.5"
          value={hours}
          onChangeText={setHours}
          keyboardType="decimal-pad"
        />
      </View>
      <RatingSelector
        value={quality}
        onChange={setQuality}
        label="Sleep Quality"
        labels={['Poor', 'Fair', 'Good', 'Great', 'Excellent']}
      />
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Dreams, interruptions, etc..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={!hours} />
    </View>
  )
}

// Nutrition Form
function NutritionForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch')
  const [description, setDescription] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!description.trim()) return
    const entry: NutritionEntry = {
      category: 'nutrition',
      meal,
      description: description.trim(),
      calories: calories ? parseInt(calories) : undefined,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  const mealOptions: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = ['breakfast', 'lunch', 'dinner', 'snack']

  return (
    <View className="gap-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Meal Type</Text>
        <View className="flex-row gap-2">
          {mealOptions.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMeal(m)}
              className={`flex-1 py-3 rounded-lg items-center ${
                meal === m ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <Text className={`text-xs font-medium capitalize ${meal === m ? 'text-white' : 'text-gray-600'}`}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">What did you eat?</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Describe your meal..."
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Calories (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Estimated calories"
          value={calories}
          onChangeText={setCalories}
          keyboardType="number-pad"
        />
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="How did you feel after eating?"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={!description.trim()} />
    </View>
  )
}

// Exercise Form
function ExerciseForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState<'light' | 'moderate' | 'vigorous'>('moderate')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!activity.trim() || !duration) return
    const entry: ExerciseEntry = {
      category: 'exercise',
      activity: activity.trim(),
      durationMinutes: parseInt(duration),
      intensity,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  const intensityOptions: Array<'light' | 'moderate' | 'vigorous'> = ['light', 'moderate', 'vigorous']

  return (
    <View className="gap-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Activity</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="e.g., Running, Yoga, Weightlifting..."
          value={activity}
          onChangeText={setActivity}
        />
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Duration (minutes)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Minutes"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Intensity</Text>
        <View className="flex-row gap-2">
          {intensityOptions.map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setIntensity(i)}
              className={`flex-1 py-3 rounded-lg items-center ${
                intensity === i ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <Text className={`text-sm font-medium capitalize ${intensity === i ? 'text-white' : 'text-gray-600'}`}>
                {i}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="How did it feel?"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={!activity.trim() || !duration} />
    </View>
  )
}

// Mood Form
function MoodForm({ onSave, onCancel }: Omit<LogFormProps, 'category'>) {
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    const entry: MoodEntry = {
      category: 'mood',
      mood,
      energy,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
  }

  return (
    <View className="gap-4">
      <RatingSelector
        value={mood}
        onChange={setMood}
        label="How are you feeling?"
        labels={['😢', '😕', '😐', '🙂', '😄']}
      />
      <RatingSelector
        value={energy}
        onChange={setEnergy}
        label="Energy Level"
        labels={['Very Low', 'Low', 'Normal', 'High', 'Very High']}
      />
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="What's on your mind?"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>
      <FormButtons onSave={handleSave} onCancel={onCancel} disabled={false} />
    </View>
  )
}

// Form buttons
function FormButtons({ 
  onSave, 
  onCancel, 
  disabled 
}: { 
  onSave: () => void
  onCancel: () => void
  disabled: boolean 
}) {
  return (
    <View className="flex-row gap-3 mt-2">
      <TouchableOpacity
        className="flex-1 p-3 rounded-lg items-center border border-gray-300 active:bg-gray-50"
        onPress={onCancel}
      >
        <Text className="text-gray-900 font-medium">Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className={`flex-1 p-3 rounded-lg items-center ${disabled ? 'bg-gray-300' : 'bg-primary active:opacity-80'}`}
        onPress={onSave}
        disabled={disabled}
      >
        <Text className={`font-semibold ${disabled ? 'text-gray-500' : 'text-white'}`}>Save Entry</Text>
      </TouchableOpacity>
    </View>
  )
}

// Main LogForm component
export function LogForm({ category, onSave, onCancel }: LogFormProps) {
  const formProps = { onSave, onCancel }
  
  switch (category.id) {
    case 'symptoms':
      return <SymptomsForm {...formProps} />
    case 'vitals':
      return <VitalsForm {...formProps} />
    case 'sleep':
      return <SleepForm {...formProps} />
    case 'nutrition':
      return <NutritionForm {...formProps} />
    case 'exercise':
      return <ExerciseForm {...formProps} />
    case 'mood':
      return <MoodForm {...formProps} />
    default:
      return null
  }
}
