import { AudioRecordingService, audioRecordingService } from '../services/audioRecording'

let mockStartShouldFail = false
let mockStopCalls = 0

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    isDevice: true,
  },
}))

jest.mock('expo-audio', () => ({
  RecordingPresets: {
    HIGH_QUALITY: {
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
  },
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
  AudioQuality: { HIGH: 96 },
  requestRecordingPermissionsAsync: async () => ({ status: 'granted', granted: true }),
  getRecordingPermissionsAsync: async () => ({ status: 'granted' }),
  setAudioModeAsync: async () => ({}),
}))

jest.mock('expo-audio/build/AudioModule', () => {
  class MockAudioRecorder {
    uri: string | null = null

    async prepareToRecordAsync() {
      return Promise.resolve()
    }

    record() {
      if (mockStartShouldFail) {
        throw new Error('recording not started')
      }
      this.uri = 'file://mock/recording.wav'
    }

    async stop() {
      mockStopCalls += 1
      return Promise.resolve()
    }

    getStatus() {
      return { isRecording: Boolean(this.uri), metering: -20, url: this.uri }
    }
  }

  return {
    __esModule: true,
    default: {
      AudioRecorder: MockAudioRecorder,
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
  const consoleLog = console.log
  const consoleWarn = console.warn
  const consoleError = console.error

  beforeAll(() => {
    console.log = jest.fn()
    console.warn = jest.fn()
    console.error = jest.fn()
  })

  afterAll(() => {
    console.log = consoleLog
    console.warn = consoleWarn
    console.error = consoleError
  })

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
