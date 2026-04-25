import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useChatHistory } from '../hooks/useChatHistory'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe('useChatHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedStorage.getItem.mockResolvedValue(null)
    mockedStorage.setItem.mockResolvedValue()
  })

  it('loads the default assistant greeting when storage is empty', async () => {
    const { result } = renderHook(() => useChatHistory())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
  })

  it('adds and persists a new message', async () => {
    const { result } = renderHook(() => useChatHistory())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addMessage({
        id: 'user-1',
        role: 'user',
        content: 'Remember this',
      })
    })

    expect(result.current.messages).toHaveLength(2)
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      'chat_history',
      expect.stringContaining('Remember this')
    )
  })

  it('clears history back to the default greeting', async () => {
    mockedStorage.getItem.mockResolvedValue(
      JSON.stringify([{ id: 'old', role: 'user', content: 'old message' }])
    )

    const { result } = renderHook(() => useChatHistory())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.clearHistory()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
  })
})
