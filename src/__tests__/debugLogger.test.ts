jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

import { formatDebugLogExport, formatDebugValue } from '../services/debugLogger'

describe('debug logger formatting', () => {
  it('formats errors with message and stack context', () => {
    const error = new Error('Boom')
    const formatted = formatDebugValue(error)

    expect(formatted).toContain('Error: Boom')
  })

  it('formats exported logs into a copyable text block', () => {
    const exportText = formatDebugLogExport([
      {
        id: '1',
        timestamp: 1710000000000,
        level: 'error',
        source: 'exception',
        message: 'Unhandled JS error Error: Boom',
      },
    ])

    expect(exportText).toContain('JARVIS Runtime Diagnostics')
    expect(exportText).toContain('[ERROR] [exception] Unhandled JS error Error: Boom')
  })
})
