import React, { useState } from 'react'
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView } from 'react-native'
import { applyKBUpdates } from '../services/knowledgeService'
import apiClient from '../services/apiClient'

export default function SummaryReviewScreen() {
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')

  async function handleSubmit() {
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (err) {
      Alert.alert('Invalid JSON', 'Please paste a valid JSON array of updates')
      return
    }

    setLoading(true)
    try {
      const resp = await applyKBUpdates(parsed)
      Alert.alert('Success', `Applied: ${resp?.data?.applied ?? 0}`)
      setJsonText('')
    } catch (e) {
      Alert.alert('Error', String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSuggest() {
    if (!transcript.trim()) {
      Alert.alert('Transcript required', 'Paste the onboarding transcript to extract facts')
      return
    }
    setLoading(true)
    try {
      const resp = await apiClient.post('/api/v1/kb/extract', { user_id: 1, transcript })
      const suggested = resp?.data?.suggested ?? []
      setJsonText(JSON.stringify(suggested, null, 2))
    } catch (e) {
      Alert.alert('Error', String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Summary Review</Text>
      <Text style={styles.hint}>Paste JSON array of KB updates (domain, user_id, field_name, field_value, confidence, source)</Text>
      <Text style={styles.hint}>Or paste the onboarding transcript and press "Suggest"</Text>
      <TextInput
        multiline
        value={transcript}
        onChangeText={setTranscript}
        style={[styles.input, {height: 120}]}
        placeholder='Paste onboarding transcript here to extract facts'
        editable={!loading}
      />
      <Button title='Suggest from Transcript' onPress={handleSuggest} disabled={loading} />
      <View style={{height:12}} />
      <TextInput
        multiline
        value={jsonText}
        onChangeText={setJsonText}
        style={styles.input}
        placeholder='[ { "domain": "identity", "user_id": 1, "field_name": "name", "field_value": "Simon", "confidence": 0.98, "source": "onboarding" } ]'
        editable={!loading}
      />
      <Button title={loading ? 'Submitting...' : 'Submit Updates'} onPress={handleSubmit} disabled={loading} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  hint: { marginBottom: 8, color: '#666' },
  input: { height: 240, borderWidth: 1, borderColor: '#ddd', padding: 8, marginBottom: 12, borderRadius: 6 },
})
