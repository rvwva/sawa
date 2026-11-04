/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^../lib/prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
    '^../../lib/prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: { warnOnly: true } }],
  },
};
