import { describe, expect, it } from 'vitest';
import { getMetadataFromSeoFields } from './editorial-metadata';

describe('editorial metadata', () => {
  it('canonicalizes public routes when a canonical path is provided', () => {
    const metadata = getMetadataFromSeoFields(
      {
        description: 'LEGO nieuws over Star Wars sets.',
        title: 'Star Wars nieuws',
      },
      {
        canonicalPath: '/artikelen/star-wars?utm_source=newsletter',
      },
    );

    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/artikelen/star-wars',
    );
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/artikelen/star-wars',
    );
  });
});
