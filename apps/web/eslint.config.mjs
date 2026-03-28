import nextPlugin from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

const nextCoreWebVitals = nextPlugin.configs['core-web-vitals'];

export default [
  {
    ignores: ['**/dist', '**/out-tsc', '.next/**/*'],
  },
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  {
    ...nextCoreWebVitals,
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      ...nextCoreWebVitals.rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
