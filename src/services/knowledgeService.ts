import apiClient from './apiClient'
import { z } from 'zod'

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

const KnowledgeApplyResponseSchema = z.object({
  applied: z.number(),
})

const KnowledgeListResponseSchema = z.object({
  items: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    field_name: z.string(),
    field_value: z.string(),
  })),
})

export async function applyKBUpdates(updates: unknown[]) {
  return apiClient.post<KnowledgeApplyResponse>(
    '/api/v1/kb/apply',
    KnowledgeApplyResponseSchema,
    { updates }
  )
}

export async function listDomainItems(domain: string, userId: number | string) {
  return apiClient.get<KnowledgeListResponse>(
    `/api/v1/kb/items/${encodeURIComponent(domain)}/${encodeURIComponent(String(userId))}`,
    KnowledgeListResponseSchema
  )
}

export default { applyKBUpdates, listDomainItems }
