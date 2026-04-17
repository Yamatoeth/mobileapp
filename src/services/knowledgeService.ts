import apiClient from './apiClient'

type KnowledgeItem = {
  id: string | number
  field_name: string
  field_value: string
}

type KnowledgeListResponse = {
  items: KnowledgeItem[]
}

type KnowledgeApplyResponse = {
  applied: number
}

export async function applyKBUpdates(updates: unknown[]) {
  return apiClient.post<KnowledgeApplyResponse>('/api/v1/kb/apply', { updates })
}

export async function listDomainItems(domain: string, userId: number | string) {
  return apiClient.get<KnowledgeListResponse>(
    `/api/v1/kb/items/${encodeURIComponent(domain)}/${encodeURIComponent(String(userId))}`
  )
}

export default { applyKBUpdates, listDomainItems }
