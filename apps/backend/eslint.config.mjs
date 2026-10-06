// ESLint 9 flat config (backend)
// Policy: structural / correctness rules only; existing code passes unchanged.
import { defineConfig } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', '*.bak-*'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: parser,
      parserOptions: { project: null },
    },
    plugins: { '@typescript-eslint': typescriptEslint },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
