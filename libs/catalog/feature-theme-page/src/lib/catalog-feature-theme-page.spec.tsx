/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addUserThemeFavoriteForBrowser,
  listUserThemeFavoritesForBrowser,
  removeUserThemeFavoriteForBrowser,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogThemeDirectoryItem } from '@lego-platform/catalog/util';
import { CatalogFeatureThemeIndex } from './catalog-feature-theme-index';
import { CatalogFeatureFavoriteThemesRail } from './catalog-feature-theme-favorites';
import { CatalogFeatureThemePage } from './catalog-feature-theme-page';

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  addUserThemeFavoriteForBrowser: vi.fn(),
  getUserThemeFavoriteContextForBrowser: vi.fn(),
  listUserThemeFavoritesForBrowser: vi.fn(),
  removeUserThemeFavoriteForBrowser: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

async function flushFavoriteRailEffects() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const pickerThemeDirectoryItems: CatalogThemeDirectoryItem[] = [
  {
    imageUrl: 'https://images.example/minecraft.jpg',
    themeSnapshot: {
      id: 'theme:minecraft',
      momentum: 'Bouw biomes, mobs en herkenbare blokkenwerelden.',
      name: 'Minecraft®',
      setCount: 35,
      signatureSet: 'The Creeper',
      slug: 'minecraft',
    },
    visual: {
      backgroundColor: '#5f8a4b',
      textColor: '#ffffff',
      tileImageUrl: 'https://images.example/minecraft-tile.jpg',
    },
  },
  {
    imageUrl: 'https://images.example/icons.jpg',
    themeSnapshot: {
      id: 'theme:icons',
      momentum: 'Displaymodellen die gebouwd zijn om te blijven staan.',
      name: 'Icons',
      setCount: 38,
      signatureSet: 'Rivendell',
      slug: 'icons',
    },
    visual: {
      backgroundColor: '#6f8594',
      textColor: '#ffffff',
      tileImageUrl: 'https://images.example/icons-tile.jpg',
    },
  },
];

async function renderFavoriteThemesRail(
  props?: ComponentProps<typeof CatalogFeatureFavoriteThemesRail>,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<CatalogFeatureFavoriteThemesRail {...props} />);
  });
  await flushFavoriteRailEffects();

  return {
    container,
    root,
  };
}

describe('CatalogFeatureThemePage', () => {
  it('renders a dedicated theme landing with browse grid and optional deals', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        dealSetCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
            collectorAngle: 'Marvel flagship showcase',
            tagline:
              'A marquee licensed set with broad household recognizability.',
            availability: 'Stable with strong seasonal demand',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
          {
            id: '76294',
            slug: 'the-x-mansion-76294',
            name: 'The X-Mansion',
            theme: 'Marvel',
            releaseYear: 2024,
            pieces: 3093,
            collectorAngle: 'Mutant mansion display anchor',
            tagline: 'A character-led Marvel set with strong crossover appeal.',
            availability: 'Fresh release momentum',
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 289.99',
              merchantLabel: 'Lowest reviewed price at LEGO',
              pricePositionLabel: 'EUR 15.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        themeFavoriteAction={({ buttonSurface }) => (
          <button data-button-surface={buttonSurface} type="button">
            Bewaar thema
          </button>
        )}
        themePage={{
          themeSnapshot: {
            name: 'Marvel',
            slug: 'marvel',
            setCount: 3,
            momentum:
              'Marvel now reads as a real collector lane with both a flagship tower and a landmark companion build.',
            signatureSet: 'Avengers Tower',
          },
          setCards: [
            {
              id: '76269',
              slug: 'avengers-tower-76269',
              name: 'Avengers Tower',
              theme: 'Marvel',
              releaseYear: 2023,
              pieces: 5202,
              collectorAngle: 'Marvel flagship showcase',
              tagline:
                'A marquee licensed set with broad household recognizability.',
              availability: 'Stable with strong seasonal demand',
            },
            {
              id: '76294',
              slug: 'the-x-mansion-76294',
              name: 'The X-Mansion',
              theme: 'Marvel',
              releaseYear: 2024,
              pieces: 3093,
              collectorAngle: 'Mutant mansion display anchor',
              tagline:
                'A character-led Marvel set with strong crossover appeal.',
              availability: 'Fresh release momentum',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('Marvel');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Bekijk alle');
    expect(markup).toContain('Bewaar thema');
    expect(markup).toContain('data-button-surface="light"');
    expect(markup).toContain('Bekijk beste deals');
    expect(markup).toContain('Themacontext');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="#theme-browse"');
    expect(markup).toContain('href="#theme-deals"');
    expect(markup).toContain('interactiveSurfaceLight');
    expect(markup).not.toContain('_introVisualStage_');
    expect(markup).not.toContain('Klaar voor themabeeld');
    expect(markup).toContain('Hier wil je nu als eerste kijken in');
    expect(markup).not.toContain(
      'Scroll Hier wil je nu als eerste kijken in Marvel naar rechts',
    );
    expect(markup).not.toContain(
      'Hier vergelijk je sets binnen een lijn in plaats van losse winkelhits.',
    );
    const dealSectionIdIndex = markup.indexOf('id="theme-deals"');
    const dealSectionStart = Math.max(0, dealSectionIdIndex - 500);
    const dealSectionEnd =
      markup.indexOf('</section><section', dealSectionIdIndex) +
      '</section>'.length;
    const dealSectionMarkup = markup.slice(dealSectionStart, dealSectionEnd);
    expect(dealSectionMarkup).toContain('sectionShellInverse');
    expect(dealSectionMarkup).not.toContain('sectionShellDefault');
    expect(dealSectionMarkup).not.toContain('setCardRailSectionThemed');
    expect(dealSectionMarkup).toContain('sectionHeaderTitle');
    expect(dealSectionMarkup).not.toContain('sectionHeaderDescription');
    expect(dealSectionMarkup).not.toContain('sectionHeaderSignal');
    expect(dealSectionMarkup).toContain('setCard');
    expect(markup).toContain('2 producten worden weergegeven');
    expect(markup).toContain('Alle');
    expect(markup).not.toContain('Scroll All Marvel sets forward');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });

  it('renders related article links and crawlable pagination links', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        currentPage={1}
        pageSize={1}
        relatedArticles={[
          {
            date: '2026-05-04',
            description: 'Welke Star Wars-sets je eerst wilt bekijken.',
            href: '/artikelen/star-wars/star-wars-day-2026',
            title: 'Star Wars Day 2026',
          },
        ]}
        themePage={{
          themeSnapshot: {
            name: 'Star Wars',
            slug: 'star-wars',
            setCount: 2,
            momentum: 'Ships, walkers en displaywaarde.',
            signatureSet: 'X-wing Starfighter',
          },
          setCards: [
            {
              id: '75355',
              slug: 'x-wing-starfighter-75355',
              name: 'X-wing Starfighter',
              theme: 'Star Wars',
              releaseYear: 2023,
              pieces: 1949,
            },
            {
              id: '75446',
              slug: 'grogu-mandalorian-apprentice-75446',
              name: 'Grogu with Hover Pram',
              theme: 'Star Wars',
              releaseYear: 2026,
              pieces: 1048,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/sets/x-wing-starfighter-75355"');
    expect(markup).not.toContain(
      'href="/sets/grogu-mandalorian-apprentice-75446"',
    );
    expect(markup).toContain('href="/themes/star-wars"');
    expect(markup).toContain('href="/themes/star-wars?page=2"');
    expect(markup).toContain('href="/artikelen/star-wars/star-wars-day-2026"');
  });

  it('uses server-paginated theme set cards without slicing them again', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        currentPage={2}
        pageSize={1}
        themePage={{
          themeSnapshot: {
            name: 'Star Wars',
            slug: 'star-wars',
            setCount: 2,
            momentum: 'Ships, walkers en displaywaarde.',
            signatureSet: 'X-wing Starfighter',
          },
          setCards: [
            {
              id: '75446',
              slug: 'grogu-mandalorian-apprentice-75446',
              name: 'Grogu with Hover Pram',
              theme: 'Star Wars',
              releaseYear: 2026,
              pieces: 1048,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/sets/grogu-mandalorian-apprentice-75446"');
    expect(markup).not.toContain('href="/sets/x-wing-starfighter-75355"');
    expect(markup).toContain('href="/themes/star-wars"');
    expect(markup).toContain('href="/themes/star-wars?page=2"');
  });

  it('does not synthesize hardcoded theme visual mapping for theme page surfaces', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        themePage={{
          themeSnapshot: {
            name: 'Architecture',
            slug: 'architecture',
            setCount: 1,
            momentum:
              'Voor strakke landmarks die rust, schaal en herkenning op één plank brengen.',
            signatureSet: 'Notre-Dame de Paris',
          },
          setCards: [
            {
              id: '21061',
              slug: 'notre-dame-de-paris-21061',
              name: 'Notre-Dame de Paris',
              theme: 'Architecture',
              releaseYear: 2024,
              pieces: 4383,
              collectorAngle: 'Monumentale skylineblikvanger',
              tagline: 'Een landmark die meteen statig leest op je plank.',
              availability: 'Goed verkrijgbaar',
            },
          ],
        }}
      />,
    );

    expect(markup).not.toContain('--theme-page-surface:#6f8594');
    expect(markup).not.toContain('--theme-page-text:#ffffff');
    expect(markup).toContain('interactiveSurfaceLight');
  });

  it('uses curated public theme visual metadata when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        themePage={{
          themeSnapshot: {
            name: 'Editions',
            slug: 'editions',
            setCount: 14,
            momentum:
              'Voor losse specials die juist opvallen doordat ze nergens anders bij horen.',
            signatureSet: 'Nike Dunk x LEGO Set',
          },
          visual: {
            backgroundColor: '#e0b84f',
            imageUrl: 'https://images.example/editions.jpg',
            textColor: '#171a22',
          },
          setCards: [
            {
              id: '43020',
              slug: 'nike-dunk-x-lego-set-43020',
              name: 'Nike Dunk x LEGO Set',
              theme: 'Editions',
              releaseYear: 2026,
              pieces: 1180,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('--theme-page-surface:#e0b84f');
    expect(markup).toContain('--theme-page-text:#171a22');
    expect(markup).toContain('interactiveSurfaceLight');
  });
});

describe('CatalogFeatureFavoriteThemesRail', () => {
  it('renders a logged-in minecraft favorite once', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: ['theme:minecraft'],
      themes: [
        {
          favoritedAt: '2026-06-07T06:12:50.83928+00:00',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/21588-1/162591.jpg',
          themeSnapshot: {
            id: 'theme:minecraft',
            momentum:
              'Bouw biomes, mobs, huizen en avonturen uit de bekende blokkenwereld.',
            name: 'Minecraft®',
            setCount: 35,
            signatureSet: 'Minecraft®',
            slug: 'minecraft',
          },
          visual: {
            backgroundColor: '#5f8a4b',
            imageUrl:
              'https://cdn.rebrickable.com/media/sets/21588-1/162591.jpg',
            textColor: '#ffffff',
            tileImageUrl:
              'https://cdn.rebrickable.com/media/sets/21588-1/162591.jpg',
          },
        },
      ],
    });

    const { container, root } = await renderFavoriteThemesRail();

    expect(container.textContent).toContain('Jouw favoriete thema’s');
    expect(container.textContent).toContain('Minecraft®');
    expect(
      container.querySelectorAll('a[href="/themes/minecraft"]'),
    ).toHaveLength(1);
    expect(container.querySelector('[data-theme="minecraft"]')).not.toBeNull();
    expect(container.textContent).toContain('Thema’s toevoegen');
    expect(listUserThemeFavoritesForBrowser).toHaveBeenCalledTimes(1);

    await flushFavoriteRailEffects();

    expect(listUserThemeFavoritesForBrowser).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('uses safe card fallbacks when optional favorite fields are missing', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: ['theme:minecraft'],
      themes: [
        {
          favoritedAt: '2026-06-07T06:12:50.83928+00:00',
          themeSnapshot: {
            id: 'theme:minecraft',
            name: 'Minecraft®',
            slug: 'minecraft',
          },
        },
      ],
    } as Awaited<ReturnType<typeof listUserThemeFavoritesForBrowser>>);

    const { container, root } = await renderFavoriteThemesRail();

    expect(container.textContent).toContain('Minecraft®');
    expect(container.textContent).toContain('0 sets');
    expect(container.querySelector('img')).toBeNull();
    expect(listUserThemeFavoritesForBrowser).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('skips malformed favorites and keeps the logged-in add tile usable', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: ['theme:minecraft'],
      themes: [
        {
          favoritedAt: '2026-06-07T06:12:50.83928+00:00',
          themeSnapshot: {
            id: 'theme:minecraft',
          },
        },
      ],
    } as Awaited<ReturnType<typeof listUserThemeFavoritesForBrowser>>);

    const { container, root } = await renderFavoriteThemesRail();

    expect(container.textContent).toContain('Jouw favoriete thema’s');
    expect(container.textContent).toContain('Thema’s toevoegen');
    expect(container.querySelector('a')).toBeNull();
    expect(listUserThemeFavoritesForBrowser).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders null when the favorites API fails', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockRejectedValue(
      new Error('network unavailable'),
    );

    const { container, root } = await renderFavoriteThemesRail();

    expect(container.textContent).not.toContain('Jouw favoriete thema’s');
    expect(container.querySelector('a')).toBeNull();
    expect(listUserThemeFavoritesForBrowser).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('reuses homepage-style portrait theme rail structure', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/catalog-feature-theme-favorites.tsx'),
      'utf-8',
    );
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/catalog-feature-theme-page.module.css'),
      'utf-8',
    );
    const viewportRule =
      css.match(/\.favoriteThemesRailViewport \{[^}]+\}/u)?.[0] ?? '';
    const trackRule =
      css.match(/\.favoriteThemesRailTrack \{[^}]+\}/u)?.[0] ?? '';
    const itemRule =
      css.match(/\.favoriteThemesRailTrack > \* \{[^}]+\}/u)?.[0] ?? '';

    expect(source).toContain('CatalogThemeHighlight');
    expect(source).toContain('variant="portrait"');
    expect(source).toContain('tone="inverse"');
    expect(viewportRule).toContain('overflow-x: auto;');
    expect(viewportRule).toContain('scroll-padding-inline:');
    expect(trackRule).toContain('display: flex;');
    expect(trackRule).toContain('gap: var(--lego-space-2);');
    expect(trackRule).toContain('scroll-snap-type: x proximity;');
    expect(itemRule).toContain(
      'flex: 0 0 min(13rem, calc(100% - var(--lego-space-6)));',
    );
    expect(itemRule).toContain('max-inline-size: 13rem;');
    expect(css).not.toContain(
      '.favoriteThemesRailTrack > * {\n    flex: 1 1 0;',
    );
  });

  it('renders an add tile for logged-in users without favorites', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: [],
      themes: [],
    });

    const { container, root } = await renderFavoriteThemesRail({
      availableThemes: pickerThemeDirectoryItems,
    });

    expect(container.textContent).toContain('Jouw favoriete thema’s');
    expect(container.textContent).toContain('Thema’s toevoegen');
    expect(container.querySelector('a[href^="/themes/"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('opens the theme picker from the add tile', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: [],
      themes: [],
    });

    const { container, root } = await renderFavoriteThemesRail({
      availableThemes: pickerThemeDirectoryItems,
    });
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Thema’s toevoegen'),
    );

    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Thema’s toevoegen');
    expect(document.body.textContent).toContain('Minecraft®');
    expect(document.body.textContent).toContain('Icons');
    expect(document.body.textContent).toContain('38 sets');

    await act(async () => {
      root.unmount();
    });
  });

  it('optimistically adds and removes favorite themes from the picker', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: [],
      themes: [],
    });
    vi.mocked(addUserThemeFavoriteForBrowser).mockResolvedValue({
      isAuthenticated: true,
      isFavorited: true,
      themeId: 'theme:icons',
    });
    vi.mocked(removeUserThemeFavoriteForBrowser).mockResolvedValue({
      isAuthenticated: true,
      isFavorited: false,
      themeId: 'theme:icons',
    });

    const { container, root } = await renderFavoriteThemesRail({
      availableThemes: pickerThemeDirectoryItems,
    });
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Thema’s toevoegen'),
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const iconsButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Icons'));

    await act(async () => {
      iconsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(addUserThemeFavoriteForBrowser).toHaveBeenCalledWith({
      themeId: 'theme:icons',
    });
    expect(container.querySelector('a[href="/themes/icons"]')).not.toBeNull();

    const selectedIconsButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Icons'));

    await act(async () => {
      selectedIconsButton?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(removeUserThemeFavoriteForBrowser).toHaveBeenCalledWith({
      themeId: 'theme:icons',
    });
    expect(container.querySelector('a[href="/themes/icons"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('rolls back picker optimistic updates on API errors', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: true,
      themeIds: [],
      themes: [],
    });
    vi.mocked(addUserThemeFavoriteForBrowser).mockRejectedValue(
      new Error('nope'),
    );

    const { container, root } = await renderFavoriteThemesRail({
      availableThemes: pickerThemeDirectoryItems,
    });
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Thema’s toevoegen'),
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const iconsButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Icons'));

    await act(async () => {
      iconsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('a[href="/themes/icons"]')).toBeNull();
    expect(container.textContent).toContain(
      'Dit thema kon niet worden toegevoegd.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('opens the gated modal when an anonymous add action is exposed', async () => {
    vi.mocked(listUserThemeFavoritesForBrowser).mockResolvedValue({
      isAuthenticated: false,
      themeIds: [],
      themes: [],
    });

    const { container, root } = await renderFavoriteThemesRail({
      availableThemes: pickerThemeDirectoryItems,
      showAddTileForAnonymous: true,
    });
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Thema’s toevoegen'),
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Log in om dit te bewaren');

    await act(async () => {
      root.unmount();
    });
  });
});

describe('CatalogFeatureThemeIndex', () => {
  it('renders a calm theme directory without set rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        visual={{
          backgroundColor: '#234bcd',
          textColor: '#ffffff',
        }}
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/icons.jpg',
            themeSnapshot: {
              name: 'Icons',
              slug: 'icons',
              setCount: 14,
              momentum:
                'Big display-led builds, nostalgic callbacks, and collector anchors.',
              signatureSet: 'Rivendell',
            },
          },
          {
            imageUrl: 'https://images.example/marvel.jpg',
            themeSnapshot: {
              name: 'Marvel',
              slug: 'marvel',
              setCount: 3,
              momentum:
                'Superhero flagships and skyline-style display builds with broad recognition.',
              signatureSet: 'Avengers Tower',
            },
          },
          {
            imageUrl: 'https://images.example/lotr.jpg',
            themeSnapshot: {
              name: 'Lord of the Rings™',
              slug: 'lord-of-the-rings',
              setCount: 3,
              momentum:
                'Middle-earth display builds with clear shelf presence.',
              signatureSet: 'Rivendell',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Alle thema');
    expect(markup).toContain('--theme-index-surface:#234bcd');
    expect(markup).toContain('--theme-index-text:#ffffff');
    expect(markup).toContain('Paginapad');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('3 themapagina');
    expect(markup).toContain('Ontdekken blijft beter voor gemengd bladeren');
    expect(markup).toContain('Kies je thema');
    expect(markup).toContain(
      'Icons, Star Wars, Botanicals en meer. Kies hier de lijn waar je als eerste in wilt duiken.',
    );
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain('href="/themes/lord-of-the-rings"');
    expect(markup).toContain('Lord of the Rings');
    expect(markup).toContain('src="https://images.example/icons.jpg"');
    expect(markup).not.toContain('href="/sets/');
  });

  it('renders late public themes such as Editions in the overview grid', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/editions.jpg',
            themeSnapshot: {
              name: 'Editions',
              slug: 'editions',
              setCount: 14,
              momentum:
                'Voor losse specials die juist opvallen doordat ze nergens anders bij horen.',
              signatureSet: 'Editions',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/themes/editions"');
    expect(markup).toContain('Editions');
    expect(markup).toContain('src="https://images.example/editions.jpg"');
  });

  it('renders favorite themes content above the full theme directory', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        beforeDirectory={
          <section data-testid="favorite-themes-rail">
            Jouw favoriete thema’s
          </section>
        }
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/minecraft.jpg',
            themeSnapshot: {
              name: 'Minecraft®',
              slug: 'minecraft',
              setCount: 35,
              momentum: 'Bouw biomes, mobs en herkenbare blokkenwerelden.',
              signatureSet: 'Minecraft®',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('data-testid="favorite-themes-rail"');
    expect(markup.indexOf('data-testid="favorite-themes-rail"')).toBeLessThan(
      markup.indexOf('Kies je thema'),
    );
    expect(markup).toContain('href="/themes/minecraft"');
  });
});
