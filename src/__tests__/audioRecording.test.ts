import { AudioRecordingService, audioRecordingService } from '../services/audioRecording'

let mockStartShouldFail = false
let mockStopCalls = 0

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    isDevice: true,
  },
}))

// Mock expo-av
jest.mock('expo-av', () => {
  class MockRecording {
    private uri: string | null = null
    async prepareToRecordAsync() {
      return Promise.resolve()
    }
    async startAsync() {
      if (mockStartShouldFail) {
        throw new Error('recording not started')
      }
      this.uri = 'file://mock/recording.wav'
      return Promise.resolve()
    }
    async stopAndUnloadAsync() {
      mockStopCalls += 1
      return Promise.resolve()
    }
    getURI() {
      return this.uri
    }
    async getStatusAsync() {
      return { isRecording: false, metering: -20 }
    }
    setOnRecordingStatusUpdate() {
      return undefined
    }
  }

  return {
    Audio: {
      RECORDING_OPTIONS_PRESET_HIGH_QUALITY: {},
      requestPermissionsAsync: async () => ({ status: 'granted', granted: true }),
      getPermissionsAsync: async () => ({ status: 'granted' }),
      setAudioModeAsync: async () => ({}),
      Recording: MockRecording,
    },
  }
})

// Mock expo-file-system used in service
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: async (uri: string) => ({ exists: true, size: 12345 }),
  readAsStringAsync: async (uri: string, opts?: any) => '',
  deleteAsync: async () => {},
}))

describe('audioRecordingService', () => {
  beforeEach(() => {
    mockStartShouldFail = false
    mockStopCalls = 0
  })

  test('startRecording is idempotent on double calls and stopRecording returns result', async () => {
    // First start
    const started1 = await audioRecordingService.startRecording()
    expect(started1).toBe(true)

    // Second start called quickly should not throw and should be treated as success
    const started2 = await audioRecordingService.startRecording()
    expect(started2).toBe(true)

    // stopRecording should return a RecordingResult
    const result = await audioRecordingService.stopRecording()
    expect(result).not.toBeNull()
    expect(result?.uri).toContain('file://')
    expect(result?.fileSize).toBeGreaterThanOrEqual(0)

    // After stop, service should be idle
    expect(audioRecordingService.isRecording()).toBe(false)
  })

  test('cleans up prepared recorder when startAsync fails', async () => {
    const service = new AudioRecordingService()

    mockStartShouldFail = true
    const failed = await service.startRecording()

    expect(failed).toBe(false)
    expect(service.getState()).toBe('idle')
    expect(mockStopCalls).toBeGreaterThanOrEqual(1)

    mockStartShouldFail = false
    const recovered = await service.startRecording()

    expect(recovered).toBe(true)
    expect(service.isRecording()).toBe(true)

    await service.cancelRecording()
  })
})
