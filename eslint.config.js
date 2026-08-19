import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'evaluation/**/.venv/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);
