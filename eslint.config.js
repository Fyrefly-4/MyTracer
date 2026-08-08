import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sourceFiles = ['src/**/*.{ts,tsx}']
const testFiles = ['tests/**/*.ts', 'vitest.config.ts', 'playwright.config.ts']

export default defineConfig(
  globalIgnores([
    'node_modules/**',
    'out/**',
    'dist/**',
    'release/**',
    '.tmp/**',
    'user/**',
    'test-results/**',
    'playwright-report/**'
  ]),
  {
    files: [...sourceFiles, ...testFiles, 'electron.vite.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended]
  },
  {
    files: [
      ...testFiles,
      'electron.vite.config.ts',
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/infrastructure/**/*.ts'
    ],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'electron',
                'electron/*',
                'better-sqlite3',
                '../../application/**',
                '../../domain/**',
                '../../infrastructure/**',
                '../../main/**',
                '../../preload/**',
                '../../../tests/**'
              ],
              message: 'Renderer may depend only on UI code and serializable contracts.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'electron',
                'electron/*',
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'better-sqlite3',
                '../application/**',
                '../contracts/**',
                '../infrastructure/**',
                '../main/**',
                '../preload/**',
                '../renderer/**',
                '../../tests/**'
              ],
              message: 'Domain must remain independent of frameworks, infrastructure, and tests.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'electron',
                'electron/*',
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'better-sqlite3',
                '../infrastructure/**',
                '../main/**',
                '../preload/**',
                '../renderer/**',
                '../../tests/**'
              ],
              message:
                'Application may depend on Domain, contracts, and ports, not concrete adapters.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../application/**',
                '../domain/**',
                '../infrastructure/**',
                '../main/**',
                '../renderer/**',
                '../../tests/**'
              ],
              message: 'Preload may expose only narrow contract-backed APIs.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/infrastructure/**/*.ts', 'src/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../tests/**', '../renderer/**'],
              message:
                'Production Main and adapters must not depend on tests or Renderer implementation.'
            }
          ]
        }
      ]
    }
  }
)
