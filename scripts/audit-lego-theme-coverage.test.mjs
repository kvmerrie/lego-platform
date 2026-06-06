import { describe, expect, test } from 'vitest';

import { createThemeAudit } from './audit-lego-theme-coverage.mjs';

describe('LEGO theme coverage audit', () => {
  test('reports LEGO-aligned missing themes with candidate sets', () => {
    const auditRows = createThemeAudit({
      catalogSets: [
        {
          name: 'Shrek Swamp',
          primary_theme_id: null,
          set_id: '75687',
          source_theme_id: 'source:shrek',
          status: 'active',
        },
      ],
      catalogThemes: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          slug: 'star-wars',
          status: 'active',
        },
      ],
      sourceThemes: [
        {
          id: 'source:shrek',
          source_theme_name: 'Shrek',
        },
      ],
      themeMappings: [],
    });

    expect(auditRows.find((row) => row.slug === 'star-wars')).toMatchObject({
      recommendation: 'ok',
      status: 'public',
    });
    expect(auditRows.find((row) => row.slug === 'shrek')).toMatchObject({
      candidateSetCount: 1,
      recommendation: 'create active',
      status: 'missing',
    });
    expect(auditRows.find((row) => row.slug === 'bluey')).toMatchObject({
      candidateSetCount: 0,
      recommendation: 'create inactive',
      status: 'missing',
    });
  });
});
