import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'evaluation/embeddings.venv/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
];
