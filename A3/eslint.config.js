// Lint browser code and Node scripts with the correct globals. Generated output and dependencies are excluded.
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**', '**/emulator-data/**', '**/.firebase/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  { files: ['functions/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.config.js'], languageOptions: { globals: globals.node } },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
])
