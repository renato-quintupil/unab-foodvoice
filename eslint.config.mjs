import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/generated/**',
      'apps/web/src/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // FR-005, SC-024, T075: `apps/web` no puede consultar la API por temporizador.
    // Un sondeo en segundo plano refrescaría `last_activity_at` para siempre y
    // una sesión abandonada no expiraría nunca. La regla lo impide en revisión
    // automática en vez de depender de que alguien lo recuerde.
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'setInterval',
          message:
            'Prohibido el sondeo en segundo plano contra la API (FR-005, SC-024). Ver T075.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='setInterval'], CallExpression[callee.property.name='setInterval']",
          message:
            'Prohibido el sondeo en segundo plano contra la API (FR-005, SC-024). Ver T075.',
        },
      ],
    },
  },
  {
    // Los archivos de configuración de Jest son CommonJS y se ejecutan en Node.
    files: ['**/*.config.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
  prettier,
);
