import { DEFAULT_MAX_TOKENS } from '../ingestion/chunking/document-chunker.js';

const rawMaxTokens = process.env.CHUNK_MAX_TOKENS ?? String(DEFAULT_MAX_TOKENS);

if (rawMaxTokens.trim() === '') {
  throw new Error(`Invalid CHUNK_MAX_TOKENS: ${rawMaxTokens}`);
}

const CHUNK_MAX_TOKENS = Number(rawMaxTokens);

if (!Number.isInteger(CHUNK_MAX_TOKENS) || CHUNK_MAX_TOKENS < 1) {
  throw new Error(`Invalid CHUNK_MAX_TOKENS: ${rawMaxTokens}`);
}

export { CHUNK_MAX_TOKENS };
