module.exports = {
  preset: 'react-native',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@unimodules|expo|expo-.*|expo-font|@expo|@expo/vector-icons|react-native-css-interop|expo-modules-core|@testing-library)/)'
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native-css-interop/.*/jsx-runtime$': '<rootDir>/__mocks__/jsxRuntimeMock.js',
    '^react-native-css-interop/jsx-runtime$': '<rootDir>/__mocks__/jsxRuntimeMock.js'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/components/VoiceOrb/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  watchman: false,
  verbose: true,
  silent: false,
}
