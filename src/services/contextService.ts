/**
 * Context Aggregation Service (server-backed)
 *
 * The frontend no longer assembles biometric or calendar context locally.
 * Instead, `getServerContext` requests layers 2-4 from the backend Context Builder:
 *  - layer2_identity: Knowledge Base summary (Postgres)
 *  - layer3_recent: Working memory (Redis)
 *  - layer4_relevant: Episodic memory search (Pinecone)
 */

import { getWorkingMemory, searchMemory } from './apiClient';

export type ServerContext = {
  layer2_identity?: Record<string, unknown> | null;
  layer3_recent?: Record<string, unknown> | null;
  layer4_relevant?: Array<Record<string, unknown>>;
};

/**
 * Fetch a server-assembled context for use in the voice pipeline.
 *
 * Args:
 *  - userId: string
 *  - query: optional string used to search episodic memory (Layer 4)
 */
export async function getServerContext(
  userId: string,
  query?: string
): Promise<ServerContext> {
  const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

  // Parallel fetches: working memory (Redis) + knowledge summary (Postgres)
  const workingPromise = getWorkingMemory(userId).catch((e) => {
    console.warn('[contextService] getWorkingMemory failed', e)
    return null
  })

  const kbPromise = fetch(`${base}/api/v1/knowledge/summary?user_id=${encodeURIComponent(
    userId
  )}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((r) => r.ok ? r.json().catch(() => null) : null)
    .catch((e) => {
      console.warn('[contextService] knowledge summary fetch failed', e)
      return null
    })

  const [layer3_recent, layer2_identity] = await Promise.all([
    workingPromise,
    kbPromise,
  ])

  // Episodic memory: only search when query provided
  let layer4_relevant: Array<Record<string, unknown>> = []
  if (query && query.length > 0) {
    layer4_relevant = await searchMemory(userId, query, 5).catch((e) => {
      console.warn('[contextService] searchMemory failed', e)
      return []
    })
  }

  return {
    layer2_identity: layer2_identity || null,
    layer3_recent: layer3_recent || null,
    layer4_relevant,
  }
}

export default {
  getServerContext,
}
