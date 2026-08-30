import { jest } from '@jest/globals';

describe('CHUNK_MAX_TOKENS env parsing', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test.each([
    [undefined, undefined],
    ['300', 300],
    ['150', 150],
    ['1', 1],
  ])('CHUNK_MAX_TOKENS=%p resolves to %p', async (value, expected) => {
    if (value === undefined) {
      delete process.env.CHUNK_MAX_TOKENS;
    } else {
      process.env.CHUNK_MAX_TOKENS = value;
    }

    const { CHUNK_MAX_TOKENS } = await import('../src/config/chunking');
    expect(CHUNK_MAX_TOKENS).toBe(expected);
  });

  test.each([['0'], ['-1'], ['abc'], [''], ['   ']])(
    'CHUNK_MAX_TOKENS=%p throws',
    async (value) => {
      process.env.CHUNK_MAX_TOKENS = value;

      await expect(import('../src/config/chunking')).rejects.toThrow(
        /Invalid CHUNK_MAX_TOKENS/,
      );
    },
  );
});
