import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Button, TextInput, Alert } from 'react-native'
import knowledgeService from '../services/knowledgeService'

const DOMAIN = 'identity' // default domain for quick view
const USER_ID = 1

export default function KnowledgeDashboard() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<{[k:number]: string}>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const resp = await knowledgeService.listDomainItems(DOMAIN, USER_ID)
      setItems(resp?.data?.items ?? [])
    } catch (e) {
      Alert.alert('Error', String(e))
    } finally {
      setLoading(false)
    }
  }

  function renderItem({ item }: { item: any }) {
    return (
      <View style={styles.row}>
        <Text style={styles.name}>{item.field_name}</Text>
        <TextInput style={styles.value} value={editing[item.id] ?? item.field_value} onChangeText={(t)=> setEditing({...editing, [item.id]: t})} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Knowledge Dashboard — {DOMAIN}</Text>
      {loading ? <ActivityIndicator /> : <FlatList data={items} keyExtractor={(i)=>String(i.id)} renderItem={renderItem} />}
      <Button title='Refresh' onPress={load} />
      <View style={{height:8}} />
      <Button title='Save Changes' onPress={async ()=>{
        const updates = Object.keys(editing).map((k)=>{
          const id = Number(k)
          const original = items.find(i=>i.id===id)
          return {
            domain: DOMAIN,
            user_id: USER_ID,
            field_name: original.field_name,
            field_value: editing[id] ?? original.field_value,
            confidence: 1.0,
            source: 'manual',
          }
        })
        try{
          const resp = await knowledgeService.applyKBUpdates(updates)
          Alert.alert('Saved', `Applied: ${resp?.data?.applied ?? 0}`)
          load()
        }catch(e){
          Alert.alert('Error', String(e))
        }
      }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  row: { marginBottom: 12 },
  name: { fontWeight: '600', marginBottom: 4 },
  value: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 },
})
