import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Wavo intentionally hydrates/subscribes to external Supabase state in effects.
      // The stricter React 19 rule treats these legitimate sync points as cascading renders.
      'react-hooks/set-state-in-effect': 'off',
      // Keep unused values visible in CI without blocking a deploy for a harmless icon import.
      'no-unused-vars': 'warn',
    },
  },
])
