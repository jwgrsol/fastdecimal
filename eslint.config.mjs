import { defineConfig, globalIgnores } from 'eslint/config';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default defineConfig(
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '.yarn/**',
    'test/vendored/**', // byte-for-byte upstream copy — never touched (see CONTRIBUTING)
    'bench/report.html',
    'big.js', // node10-resolution root stubs (plain CJS by design)
    'big.d.ts',
  ]),
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The facade reproduces big.js's dynamic constructor semantics (function-style
    // constructor, prototype reassignment) — `any` is unavoidable there.
    files: ['src/big.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // toExponential/toFixed hold `this` in a reassignable local (rounded copy) — intentional
      '@typescript-eslint/no-this-alias': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-conditional-expect': 'warn',
      'vitest/no-commented-out-tests': 'warn',
    },
  },
  prettier
);
