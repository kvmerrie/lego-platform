import importPlugin from 'eslint-plugin-import';
import nx from '@nx/eslint-plugin';

export default [
  {
    ignores: ['**/dist', '**/out-tsc', '**/storybook-static'],
  },
  ...nx.configs['flat/base'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-cycle': [
        'error',
        {
          ignoreExternal: true,
        },
      ],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          banTransitiveDependencies: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:shell',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:shell',
                'scope:catalog',
                'scope:collection',
                'scope:wishlist',
                'scope:pricing',
                'scope:affiliate',
                'scope:content',
                'scope:user',
              ],
            },
            {
              sourceTag: 'scope:catalog',
              onlyDependOnLibsWithTags: [
                'scope:catalog',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:collection',
              onlyDependOnLibsWithTags: [
                'scope:collection',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:wishlist',
              onlyDependOnLibsWithTags: [
                'scope:wishlist',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:pricing',
              onlyDependOnLibsWithTags: [
                'scope:pricing',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:affiliate',
              onlyDependOnLibsWithTags: [
                'scope:affiliate',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:content',
              onlyDependOnLibsWithTags: [
                'scope:content',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:user',
              onlyDependOnLibsWithTags: [
                'scope:user',
                'scope:shared',
                'scope:shell',
              ],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:api',
                'scope:shared',
                'scope:catalog',
                'scope:collection',
                'scope:wishlist',
                'scope:pricing',
                'scope:affiliate',
                'scope:content',
                'scope:user',
              ],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:util',
                'type:config',
                'type:design-system',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:data-access',
                'type:util',
                'type:config',
                'type:design-system',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:util',
                'type:config',
                'type:design-system',
              ],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:util',
                'type:config',
              ],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:config'],
            },
            {
              sourceTag: 'type:config',
              onlyDependOnLibsWithTags: ['type:config'],
            },
            {
              sourceTag: 'type:design-system',
              onlyDependOnLibsWithTags: [
                'type:design-system',
                'type:util',
                'type:config',
              ],
            },
            {
              sourceTag: 'type:testing',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:util',
                'type:config',
                'type:design-system',
                'type:testing',
              ],
            },
            {
              sourceTag: 'platform:web',
              onlyDependOnLibsWithTags: ['platform:web', 'platform:shared'],
            },
            {
              sourceTag: 'platform:admin',
              onlyDependOnLibsWithTags: ['platform:admin', 'platform:shared'],
            },
            {
              sourceTag: 'platform:server',
              onlyDependOnLibsWithTags: ['platform:server', 'platform:shared'],
            },
            {
              sourceTag: 'platform:shared',
              onlyDependOnLibsWithTags: ['platform:shared'],
            },
          ],
        },
      ],
    },
  },
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
];
