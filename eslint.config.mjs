import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.husky/_/**', 'package-lock.json'],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],

    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
