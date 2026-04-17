import AsyncStorage from '@react-native-async-storage/async-storage'

const DEBUG_LOGS_KEY = 'jarvis_debug_logs_v1'
const MAX_DEBUG_LOGS = 250

export type DebugLogLevel = 'log' | 'info' | 'warn' | 'error' | 'fatal'
export type DebugLogSource = 'console' | 'exception' | 'app'

export interface DebugLogEntry {
  id: string
  timestamp: number
  level: DebugLogLevel
  source: DebugLogSource
  message: string
}

type DebugLogListener = (entries: DebugLogEntry[]) => void

type PatchedConsole = typeof console & {
  debug?: (...args: unknown[]) => void
}

const listeners = new Set<DebugLogListener>()
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: typeof console.debug === 'function' ? console.debug.bind(console) : console.log.bind(console),
}

let entries: DebugLogEntry[] = []
let installPromise: Promise<void> | null = null
let hasPatchedConsole = false
let hasPatchedErrorUtils = false
let writePromise: Promise<void> = Promise.resolve()
let hasLoadedPersistedLogs = false

function createEntry(
  level: DebugLogLevel,
  source: DebugLogSource,
  message: string
): DebugLogEntry {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level,
    source,
    message,
  }
}

export function formatDebugValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`
  }

  if (typeof value === 'string') {
    return value
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'undefined'
  ) {
    return String(value)
  }

  if (value === null) {
    return 'null'
  }

  try {
    return JSON.stringify(
      value,
      (_key, nestedValue) => {
        if (nestedValue instanceof Error) {
          return {
            name: nestedValue.name,
            message: nestedValue.message,
            stack: nestedValue.stack,
          }
        }
        return nestedValue
      },
      2
    )
  } catch {
    return String(value)
  }
}

function formatConsoleArgs(args: unknown[]): string {
  return args.map((arg) => formatDebugValue(arg)).join(' ')
}

function notifyListeners() {
  const snapshot = [...entries]
  listeners.forEach((listener) => listener(snapshot))
}

function schedulePersist() {
  const snapshot = [...entries]
  writePromise = writePromise
    .catch(() => undefined)
    .then(async () => {
      try {
        await AsyncStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(snapshot))
      } catch (error) {
        originalConsole.error('[debugLogger] Failed to persist logs', error)
      }
    })
}

function appendEntry(entry: DebugLogEntry) {
  entries = [entry, ...entries].slice(0, MAX_DEBUG_LOGS)
  notifyListeners()
  schedulePersist()
}

function patchConsole() {
  if (hasPatchedConsole) return
  hasPatchedConsole = true

  const patchedConsole = console as PatchedConsole
  const methods: Array<{ method: keyof typeof originalConsole; level: DebugLogLevel }> = [
    { method: 'log', level: 'log' },
    { method: 'info', level: 'info' },
    { method: 'warn', level: 'warn' },
    { method: 'error', level: 'error' },
    { method: 'debug', level: 'info' },
  ]

  methods.forEach(({ method, level }) => {
    patchedConsole[method] = (...args: unknown[]) => {
      originalConsole[method](...args)
      appendEntry(createEntry(level, 'console', formatConsoleArgs(args)))
    }
  })
}

function patchGlobalErrorHandler() {
  if (hasPatchedErrorUtils) return

  const globalAny = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void
    }
  }

  const errorUtils = globalAny.ErrorUtils
  if (!errorUtils?.setGlobalHandler) {
    return
  }

  hasPatchedErrorUtils = true
  const previousHandler = errorUtils.getGlobalHandler?.()

  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    appendEntry(
      createEntry(
        isFatal ? 'fatal' : 'error',
        'exception',
        formatConsoleArgs([isFatal ? 'Fatal JS error' : 'Unhandled JS error', error])
      )
    )

    previousHandler?.(error, isFatal)
  })
}

async function loadPersistedLogs() {
  if (hasLoadedPersistedLogs) {
    return
  }

  hasLoadedPersistedLogs = true

  try {
    const raw = await AsyncStorage.getItem(DEBUG_LOGS_KEY)
    if (!raw) {
      return
    }

    const persistedEntries = JSON.parse(raw) as DebugLogEntry[]
    if (!Array.isArray(persistedEntries) || persistedEntries.length === 0) {
      return
    }

    entries = [...entries, ...persistedEntries].slice(0, MAX_DEBUG_LOGS)
    notifyListeners()
  } catch (error) {
    originalConsole.error('[debugLogger] Failed to load persisted logs', error)
  }
}

export function installGlobalDebugLogger(): Promise<void> {
  if (installPromise) {
    return installPromise
  }

  patchConsole()
  patchGlobalErrorHandler()

  installPromise = loadPersistedLogs().then(() => {
    appendEntry(createEntry('info', 'app', 'Debug logger installed'))
  })

  return installPromise
}

export async function getDebugLogs(): Promise<DebugLogEntry[]> {
  await loadPersistedLogs()
  return [...entries]
}

export function subscribeDebugLogs(listener: DebugLogListener): () => void {
  listeners.add(listener)
  listener([...entries])
  return () => {
    listeners.delete(listener)
  }
}

export async function clearDebugLogs(): Promise<void> {
  entries = []
  notifyListeners()
  try {
    await AsyncStorage.removeItem(DEBUG_LOGS_KEY)
  } catch (error) {
    originalConsole.error('[debugLogger] Failed to clear logs', error)
  }
}

export function formatDebugLogExport(logEntries: DebugLogEntry[]): string {
  const header = [
    'JARVIS Runtime Diagnostics',
    `Exported: ${new Date().toISOString()}`,
    `Entries: ${logEntries.length}`,
    '---',
  ]

  const lines = logEntries.map((entry) => {
    const timestamp = new Date(entry.timestamp).toISOString()
    return `${timestamp} [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
  })

  return [...header, ...lines].join('\n')
}
