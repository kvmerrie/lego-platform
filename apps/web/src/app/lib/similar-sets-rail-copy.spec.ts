import { describe, expect, it } from 'vitest';
import { buildSimilarSetsRailDescription } from './similar-sets-rail-copy';

describe('buildSimilarSetsRailDescription', () => {
  it('uses the current set name when it stays compact enough', () => {
    expect(
      buildSimilarSetsRailDescription('The Lord of the Rings: Barad-dur'),
    ).toBe(
      'Als The Lord of the Rings: Barad-dur je aanspreekt, liggen deze het dichtst in de buurt.',
    );
  });

  it('normalizes extra whitespace before building the inline sentence', () => {
    expect(buildSimilarSetsRailDescription('  Rivendell   ')).toBe(
      'Als Rivendell je aanspreekt, liggen deze het dichtst in de buurt.',
    );
  });

  it('falls back to generic copy when the set name becomes too long', () => {
    expect(
      buildSimilarSetsRailDescription(
        'The Lord of the Rings: The Fellowship of the Ring Book Nook Collector Edition',
      ),
    ).toBe('Deze sets lijken qua schaal en prijs het meest op deze set.');
  });
});
