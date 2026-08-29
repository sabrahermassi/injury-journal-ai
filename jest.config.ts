import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',

  testEnvironment: 'node',

  // Cap parallelism: unbounded workers all pay a cold ESM/ts-jest import
  // cost at once, which was starving CPU time from the first Prisma/app.ts
  // import in tests/app.test.ts and intermittently blowing its timeout
  // under full-suite load (#186).
  maxWorkers: '50%',

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
