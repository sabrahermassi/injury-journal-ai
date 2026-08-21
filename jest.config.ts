import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',

  testEnvironment: 'node',

  maxWorkers: 1,

  extensionsToTreatAsEsm: ['.ts'],

  setupFiles: ['<rootDir>/tests/setup.ts'],

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json',
        isolatedModules: true,
      },
    ],
  },

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  testMatch: ['**/tests/**/*.test.ts'],
};

export default config;
