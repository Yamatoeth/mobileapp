import Constants from 'expo-constants'

const DEFAULT_BACKEND_URL = 'http://localhost:8000'
const DEFAULT_BACKEND_PORT = '8000'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function getExpoDevHost(): string | null {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string }
    manifest?: { debuggerHost?: string }
    manifest2?: { extra?: { expoClient?: { hostUri?: string; debuggerHost?: string } } }
  }

  const hostUri =
    constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoClient?.hostUri ||
    constants.manifest?.debuggerHost ||
    constants.manifest2?.extra?.expoClient?.debuggerHost

  const host = hostUri?.split('/')[0]?.split(':')[0]
  return host && !LOCAL_HOSTS.has(host) ? host : null
}

export function getBackendBaseUrl(baseUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const configured = (baseUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '')

  try {
    const url = new URL(configured)
    if (LOCAL_HOSTS.has(url.hostname)) {
      const devHost = getExpoDevHost()
      if (devHost) {
        url.hostname = devHost
        url.port = url.port || DEFAULT_BACKEND_PORT
      }
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    return configured
  }
}

export function getBackendWsUrl(baseUrl?: string): string {
  return getBackendBaseUrl(baseUrl).replace(/^http/i, 'ws')
}
