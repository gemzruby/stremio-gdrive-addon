import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, { files: ['**/*.js', '**/*.mjs'], languageOptions: { globals: { URL: 'readonly', URLSearchParams: 'readonly', Response: 'readonly', fetch: 'readonly', process: 'readonly', console: 'readonly' } } }, { ignores: ['node_modules/**', '.wrangler/**'] });
