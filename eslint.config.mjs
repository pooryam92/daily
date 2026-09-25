import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['out', 'release', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'playwright.config.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_' }]
    }
  },
  // The layers point inwards (docs/development.md, "Structure"). `@/` and relative paths are both covered.
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^@/|/)((ui|electron)(/|$)|ports$)', message: 'domain/ imports nothing but itself.' }
          ]
        }
      ]
    }
  },
  {
    files: ['src/ports.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: '(^@/|/)(ui|electron)(/|$)', message: 'ports.ts may only import domain/.' }]
        }
      ]
    }
  },
  {
    files: ['src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^@/|/)electron(/|$)|^electron$',
              message: 'ui/ is platform-agnostic: it may only import domain/ and ports.'
            }
          ]
        }
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'api',
          message: 'ui/ reaches its platform through useGateway(), never window.api.'
        }
      ]
    }
  },
  {
    files: ['src/electron/main/**', 'src/electron/preload/**', 'e2e/**', 'playwright.config.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/ui/**', 'src/electron/renderer/**'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser }
  }
)
