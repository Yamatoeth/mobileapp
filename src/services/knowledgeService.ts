import apiClient from './apiClient'

export async function applyKBUpdates(updates: any[]) {
  return apiClient.post('/kb/apply', { updates })
}

export async function listDomainItems(domain: string, userId: number) {
  return apiClient.get(`/kb/items/${domain}/${userId}`)
}

export default { applyKBUpdates, listDomainItems }
