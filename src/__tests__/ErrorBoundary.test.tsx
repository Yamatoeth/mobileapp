import React from 'react'
import { Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { ErrorBoundary } from '../components/ErrorBoundary'

describe('ErrorBoundary', () => {
  const consoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = consoleError
  })

  it('shows a recovery UI and can reset after a render error', () => {
    let shouldThrow = true
    function Bomb() {
      if (shouldThrow) {
        throw new Error('Boom')
      }

      return <Text>Recovered</Text>
    }

    const screen = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Boom')).toBeTruthy()

    shouldThrow = false
    fireEvent.press(screen.getByLabelText('Try again'))

    expect(screen.getByText('Recovered')).toBeTruthy()
  })
})
