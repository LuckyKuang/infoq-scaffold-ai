import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default tseslint.config(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,cjs,ts,mts,tsx,vue}']
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },
  {
    languageOptions: {
      globals: globals.browser
    }
  },
  pluginVue.configs['flat/essential'],
  tseslint.configs.recommended.map((config) => ({
    ...config,
    ...(config.files?.includes('**/*.ts') ? { files: [...config.files, '**/*.vue'] } : {})
  })),
  ...pluginVue.configs['flat/base'],
  {
    name: 'app/vue-typescript-parser',
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: {
          js: 'espree',
          jsx: 'espree',
          ts: tseslint.parser,
          tsx: tseslint.parser
        },
        ecmaVersion: 2024,
        ecmaFeatures: { jsx: false },
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      'vue/block-lang': ['error', { script: { lang: ['ts'], allowNoLang: false } }]
    }
  },
  skipFormatting,
  {
    plugins: { prettier },
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      // vue
      'vue/multi-word-component-names': 'off',
      'vue/valid-define-props': 'off',
      'vue/no-v-model-argument': 'off',
      'prefer-rest-params': 'off',
      // prettier
      'prettier/prettier': 'error',
      // 允许使用空Object类型 {}
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  }
);
