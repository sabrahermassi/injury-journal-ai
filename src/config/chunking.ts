// Unset (the common case) resolves to `undefined`, not a hardcoded number:
// chunkDocument/chunkDocuments treat an explicit maxTokens as an override
// that wins over SOURCE_TYPE_CHUNK_CONFIG's per-sourceType defaults (see
// document-chunker.ts). Defaulting this to DEFAULT_MAX_TOKENS would silently
// force that same value onto every sourceType during real ingestion,
// permanently short-circuiting per-sourceType tuning. Only set
// CHUNK_MAX_TOKENS when you actually want to override every sourceType at
// once (e.g. the chunk-size sweep).
const rawMaxTokens = process.env.CHUNK_MAX_TOKENS;

const CHUNK_MAX_TOKENS: number | undefined = (() => {
  if (rawMaxTokens === undefined) {
    return undefined;
  }

  if (rawMaxTokens.trim() === '') {
    throw new Error(`Invalid CHUNK_MAX_TOKENS: ${rawMaxTokens}`);
  }

  const parsed = Number(rawMaxTokens);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid CHUNK_MAX_TOKENS: ${rawMaxTokens}`);
  }

  return parsed;
})();

export { CHUNK_MAX_TOKENS };
