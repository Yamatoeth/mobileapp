// Pure unit test of the TTS indicator logic without React or React Native.
describe('TTS playback indicator (pure functions)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('sets playing true on onTTS and clears after timeout', () => {
    let isPlaying = false
    let ttsTimeout: ReturnType<typeof setTimeout> | null = null

    const onTTS = () => {
      if (ttsTimeout) clearTimeout(ttsTimeout)
      isPlaying = true
      ttsTimeout = setTimeout(() => (isPlaying = false), 8000)
    }

    const onTTSComplete = () => {
      if (ttsTimeout) {
        clearTimeout(ttsTimeout)
        ttsTimeout = null
      }
      isPlaying = false
    }

    expect(isPlaying).toBe(false)
    onTTS()
    expect(isPlaying).toBe(true)

    // advance timers to trigger fallback clear
    jest.advanceTimersByTime(8000)
    expect(isPlaying).toBe(false)

    // test explicit completion clears immediately
    onTTS()
    expect(isPlaying).toBe(true)
    onTTSComplete()
    expect(isPlaying).toBe(false)
  })
})
