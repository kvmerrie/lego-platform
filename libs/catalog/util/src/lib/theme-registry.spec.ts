import { describe, expect, it } from 'vitest';
import {
  getThemeDisplayName,
  isThemeVisible,
  normalizeTheme,
  sortThemesForHome,
} from './theme-registry';

describe('Brickhunt theme registry', () => {
  it('uses Rebrickable/catalog theme names as fallback entries', () => {
    expect(normalizeTheme('Lord of the Rings')?.key).toBe('lord-of-the-rings');
    expect(getThemeDisplayName('Lord of the Rings')).toBe(
      'Lord of the Rings™',
    );
    expect(normalizeTheme('Unknown Product Line')?.displayName).toBe(
      'Unknown Product Line',
    );
  });

  it('normalizes theme aliases with custom public slugs', () => {
    expect(normalizeTheme('Creator 3-in-1')?.key).toBe('creator-3in1');
    expect(normalizeTheme("Gabby's Dollhouse")?.key).toBe('gabby-s-poppenhuis');
    expect(normalizeTheme('Lord of the Rings')?.key).toBe('lord-of-the-rings');
    expect(normalizeTheme('Minifigures')?.key).toBe('collectible-minifigures');
    expect(normalizeTheme('Star Wars')?.key).toBe('star-wars');
    expect(normalizeTheme('Zelda')?.key).toBe('the-legend-of-zelda');
    expect(normalizeTheme('The Legend of Zelda')?.key).toBe(
      'the-legend-of-zelda',
    );
  });

  it('maps child themes to a parent when hierarchy context says they belong there', () => {
    expect(
      normalizeTheme('Toy Story', {
        parentTheme: 'Disney',
        theme: 'Toy Story',
      })?.key,
    ).toBe('disney');
  });

  it('keeps Lord of the Rings as a visible product line even with root or utility parent context', () => {
    expect(
      normalizeTheme('Lord of the Rings', {
        parentTheme: 'Licensed',
        theme: 'Lord of the Rings',
      })?.key,
    ).toBe('lord-of-the-rings');
    expect(
      normalizeTheme('The Lord of the Rings', {
        parentTheme: 'Books',
        theme: 'The Lord of the Rings',
      })?.displayName,
    ).toBe('Lord of the Rings™');
    expect(isThemeVisible('LOTR')).toBe(true);
  });

  it('recognizes Icons-backed Lord of the Rings catalog sets by context', () => {
    expect(
      normalizeTheme('Icons', {
        name: 'The Lord of the Rings: Barad-dur',
        setId: '10333',
        theme: 'Icons',
      })?.key,
    ).toBe('lord-of-the-rings');
    expect(
      normalizeTheme('Icons', {
        name: 'Rivendell',
        setId: '10316',
        slug: 'lord-of-the-rings-rivendell-10316',
        theme: 'Icons',
      })?.key,
    ).toBe('lord-of-the-rings');
  });

  it('maps Skylines to Architecture instead of a standalone theme', () => {
    expect(normalizeTheme('Skylines')?.key).toBe('architecture');
    expect(getThemeDisplayName('Skylines')).toBe('Architecture');
  });

  it('normalizes Advent to City when the hierarchy or set context is a City advent calendar', () => {
    expect(
      normalizeTheme('Advent', {
        name: 'LEGO City Advent Calendar 2026',
        parentTheme: 'City',
        setId: '60510',
        theme: 'Advent',
      })?.key,
    ).toBe('city');
  });

  it('infers a better public theme for raw Other when set metadata is recognizable', () => {
    expect(
      normalizeTheme('Other', {
        name: 'Lewis Hamilton Helmet',
        setId: '42244',
        slug: 'lewis-hamilton-helmet-42244',
        theme: 'Other',
      })?.displayName,
    ).toBe('Speed Champions');
  });

  it('hides source and utility themes by default', () => {
    expect(isThemeVisible('Gear')).toBe(false);
    expect(isThemeVisible('Books')).toBe(false);
    expect(isThemeVisible('Powered UP')).toBe(false);
    expect(isThemeVisible('SERIOUS PLAY')).toBe(false);
    expect(isThemeVisible('BrickLink Designer Program')).toBe(false);
    expect(isThemeVisible('Lord of the Rings')).toBe(true);
  });

  it('uses display overrides for known branded themes', () => {
    expect(getThemeDisplayName('Sonic The Hedgehog')).toBe(
      'Sonic the Hedgehog™',
    );
    expect(getThemeDisplayName('Star Wars')).toBe('Star Wars™');
    expect(getThemeDisplayName('Collectible Minifigures')).toBe('Minifiguren');
  });

  it('sorts themes by set count and alphabetical fallback without presentation priority', () => {
    expect(
      sortThemesForHome([
        { themeSnapshot: { name: 'Unknown A', setCount: 2 } },
        { themeSnapshot: { name: 'Unknown B', setCount: 8 } },
        { themeSnapshot: { name: 'Marvel', setCount: 1 } },
        { themeSnapshot: { name: 'Star Wars', setCount: 1 } },
      ]).map((item) => item.themeSnapshot.name),
    ).toEqual(['Unknown B', 'Unknown A', 'Marvel', 'Star Wars']);
  });
});
