export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: [],
  transformIgnorePatterns: [
    'node_modules/(?!(node-llama-cpp|sqlite-vec)/)'
  ],
  moduleNameMapper: {
    '^node-llama-cpp$': '<rootDir>/src/__mocks__/node-llama-cpp.ts',
    '^sqlite-vec$': '<rootDir>/src/__mocks__/sqlite-vec.ts',
    '^(\\.\\.?\\/.+)\\.js$': '$1'
  }
};