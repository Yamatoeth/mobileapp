import { useEffect, useState } from 'react'
import { DebugLogEntry, getDebugLogs, subscribeDebugLogs } from '../services/debugLogger'

export function useDebugLogs() {
  const [logs, setLogs] = useState<DebugLogEntry[]>([])

  useEffect(() => {
    let isMounted = true

    void getDebugLogs().then((initialLogs) => {
      if (isMounted) {
        setLogs(initialLogs)
      }
    })

    const unsubscribe = subscribeDebugLogs((nextLogs) => {
      if (isMounted) {
        setLogs(nextLogs)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return {
    logs,
  }
}
