import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPublishedArticles = vi.fn();
const getPopularArticles = vi.fn();
const listCatalogSetCards = vi.fn();
const listCatalogSetCardsByIds = vi.fn();

vi.mock('@lego-platform/content/data-access', () => ({
  getPopularArticles,
  listPublishedArticles,
}));

vi.mock('@lego-platform/catalog/data-access', () => ({
  catalogSnapshot: {
    generatedAt: '2026-05-01T12:00:00.000Z',
    source: 'test',
    setRecords: [],
  },
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  listCatalogSetCards,
  listCatalogSetCardsByIds,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('articles index route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPopularArticles.mockResolvedValue([]);
    listCatalogSetCards.mockResolvedValue([]);
    listCatalogSetCardsByIds.mockResolvedValue([]);
  });

  it('stays server-rendered without client-side fetching', async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        'apps',
        'web',
        'src',
        'app',
        'artikelen',
        'page.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useSWR');
    expect(source).not.toContain('fetch(');
    expect(source).toContain('listPublishedArticles()');
    expect(source).toContain('getPopularArticles({');
    expect(source).toContain('revalidate = 60');
  });

  it('uses the shared editorial hero instead of duplicate page hero CSS', async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        'apps',
        'web',
        'src',
        'app',
        'artikelen',
        'page.tsx',
      ),
      'utf8',
    );
    const css = await readFile(
      path.join(
        process.cwd(),
        'apps',
        'web',
        'src',
        'app',
        'artikelen',
        'page.module.css',
      ),
      'utf8',
    );

    expect(source).toContain('EditorialHeroPanel');
    expect(source).toContain('<EditorialHeroPanel');
    expect(css).not.toContain('.hero');
    expect(css).not.toContain('.heroTitle');
  });

  it('does not keep the old /artikelen/[slug] route file', async () => {
    await expect(
      access(
        path.join(
          process.cwd(),
          'apps',
          'web',
          'src',
          'app',
          'artikelen',
          '[slug]',
          'page.tsx',
        ),
      ),
    ).rejects.toThrow();
  });

  it('renders published articles sorted by article date with the latest featured first', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        cardImageAlt: 'Older',
        date: '2026-04-20',
        description: 'Een oudere update.',
        heroImageAlt: 'Older',
        slug: 'older-update',
        status: 'published',
        theme: 'Icons',
        title: 'Oudere update',
      },
      {
        cardImage: 'https://storage.example/article-images/marvel/card.webp',
        cardImageAlt: 'Marvel card',
        date: '2026-05-03',
        description: 'De nieuwste reveal voor Marvel-fans.',
        heroImage: 'https://storage.example/article-images/marvel/hero.webp',
        heroImageAlt: 'Marvel hero',
        slug: 'lego-marvel-herbie',
        status: 'published',
        theme: 'Marvel',
        title: 'LEGO Marvel H.E.R.B.I.E. onthuld',
      },
      {
        cardImageAlt: 'Draft',
        date: '2026-05-04',
        description: 'Niet tonen.',
        heroImageAlt: 'Draft',
        slug: 'draft-update',
        status: 'draft',
        theme: 'Star Wars',
        title: 'Concept update',
      },
      {
        cardImageAlt: 'Middle',
        date: '2026-05-01',
        description: 'Nog een update.',
        heroImageAlt: 'Middle',
        slug: 'middle-update',
        status: 'published',
        theme: 'Star Wars',
        title: 'Nog een update',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('LEGO nieuws &amp; updates');
    expect(markup).toContain('ARTIKELEN');
    expect(markup).toContain(
      'Blijf op de hoogte van nieuwe LEGO-sets, deals en aankondigingen.',
    );
    expect(markup).toContain('/artikelen/marvel/lego-marvel-herbie');
    expect(markup).toContain('/artikelen/star-wars/middle-update');
    expect(markup).toContain('/artikelen/icons/older-update');
    expect(markup).toContain('--catalog-theme-badge-surface:#5573b5');
    expect(markup).toContain('--catalog-theme-badge-text:#ffffff');
    expect(markup).not.toContain('Concept update');
    expect(markup).toContain('featuredArticle');
    expect(markup).toContain('cardGrid');
    expect(markup).not.toContain('Populair deze week');
    expect(markup).not.toContain('Meer LEGO nieuws');
    expect(markup.indexOf('LEGO Marvel H.E.R.B.I.E. onthuld')).toBeLessThan(
      markup.indexOf('Nog een update'),
    );
    expect(markup.indexOf('Nog een update')).toBeLessThan(
      markup.indexOf('Oudere update'),
    );
  });

  it('renders popular articles only when server-side popular data exists', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        cardImageAlt: 'Latest',
        date: '2026-05-03',
        description: 'Laatste artikel.',
        heroImageAlt: 'Latest',
        slug: 'latest',
        status: 'published',
        theme: 'Marvel',
        title: 'Laatste artikel',
      },
      {
        cardImageAlt: 'Recent one',
        date: '2026-05-02',
        description: 'Eerste recente kaart.',
        heroImageAlt: 'Recent one',
        slug: 'recent-one',
        status: 'published',
        theme: 'Star Wars',
        title: 'Recent artikel een',
      },
      {
        cardImageAlt: 'Recent two',
        date: '2026-05-01',
        description: 'Tweede recente kaart.',
        heroImageAlt: 'Recent two',
        slug: 'recent-two',
        status: 'published',
        theme: 'Icons',
        title: 'Recent artikel twee',
      },
      {
        cardImageAlt: 'Recent three',
        date: '2026-04-30',
        description: 'Derde recente kaart.',
        heroImageAlt: 'Recent three',
        slug: 'recent-three',
        status: 'published',
        theme: 'City',
        title: 'Recent artikel drie',
      },
      {
        cardImageAlt: 'Older',
        date: '2026-04-29',
        description: 'Ouder artikel in de rest-grid.',
        heroImageAlt: 'Older',
        slug: 'older',
        status: 'published',
        theme: 'Ideas',
        title: 'Ouder artikel',
      },
    ]);
    getPopularArticles.mockResolvedValue([
      {
        cardImageAlt: 'Popular',
        date: '2026-05-01',
        description: 'Veel gelezen deze week.',
        heroImageAlt: 'Popular',
        slug: 'popular',
        status: 'published',
        theme: 'Star Wars',
        title: 'Populair artikel',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(getPopularArticles).toHaveBeenCalledWith({
      days: 7,
      limit: 6,
    });
    expect(markup).toContain('Populair deze week');
    expect(markup).toContain('POPULAIR');
    expect(markup).toContain('data-content-section-shell="inverse"');
    expect(markup).toContain('/artikelen/star-wars/popular');
    expect(markup).not.toContain('Veel gelezen deze week.');
    expect(markup.indexOf('Net binnen')).toBeLessThan(
      markup.indexOf('Populair deze week'),
    );
    expect(markup.indexOf('Populair deze week')).toBeLessThan(
      markup.indexOf('Meer LEGO nieuws'),
    );
  });

  it('renders the empty state when no articles are available', async () => {
    listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Nog geen artikelen beschikbaar');
    expect(markup).not.toContain('cardGrid');
  });

  it('uses the same resolved catalog image fallback for article cards', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        bodySource: '<SetSpotlightList setIds="75446, 75447" />',
        cardImageAlt: 'Roundup',
        date: '2026-05-03',
        description: 'Nieuwe Star Wars-sets op een rij.',
        heroImage: undefined,
        heroImageAlt: 'Roundup',
        slug: 'star-wars-roundup',
        status: 'published',
        theme: 'Star Wars',
        title: 'LEGO Star Wars juni onthuld',
      },
    ]);
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://images.example/75446.jpg',
        name: 'Up-Scaled Darth Vader',
        pieces: 1040,
        releaseYear: 2026,
        slug: 'up-scaled-darth-vader-75446',
        theme: 'Star Wars',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(listCatalogSetCardsByIds).toHaveBeenCalledWith({
      canonicalIds: expect.arrayContaining(['75446']),
    });
    expect(markup).toContain('https://images.example/75446.jpg');
    expect(markup).toContain('Up-Scaled Darth Vader LEGO-set');
    expect(markup).toContain('data-article-image-source="spotlight"');
    expect(markup).toContain('data-article-image-fit="contain"');
  });

  it('uses a representative set image from the article theme before the theme tile', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        bodySource: 'Geen embeds.',
        cardImageAlt: 'Artikel',
        date: '2026-05-03',
        description: 'Star Wars-artikel zonder concrete set embed.',
        heroImage: undefined,
        heroImageAlt: 'Artikel',
        slug: 'star-wars-zonder-embed',
        status: 'published',
        theme: 'Star Wars',
        title: 'LEGO Star Wars update',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '00001',
        imageUrl: 'https://images.example/zero-piece.jpg',
        name: 'Zero Piece Star Wars',
        pieces: 0,
        releaseYear: 2026,
        slug: 'zero-piece-star-wars',
        theme: 'Star Wars',
      },
      {
        id: '75446',
        imageUrl: 'https://images.example/representative.jpg',
        name: 'Up-Scaled Darth Vader',
        pieces: 1040,
        releaseYear: 2026,
        slug: 'up-scaled-darth-vader-75446',
        theme: 'Star Wars',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('https://images.example/representative.jpg');
    expect(markup).not.toContain('https://images.example/zero-piece.jpg');
  });

  it('does not pick a random representative set for Multiple theme articles', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        bodySource: 'Geen embeds.',
        cardImageAlt: 'Artikel',
        date: '2026-05-03',
        description: 'Meerdere thema’s zonder concrete set embed.',
        heroImage: undefined,
        heroImageAlt: 'Artikel',
        slug: 'multiple-zonder-embed',
        status: 'published',
        theme: 'Multiple',
        title: 'LEGO overzicht',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '75313',
        imageUrl: 'https://images.example/random.jpg',
        name: 'AT-AT',
        pieces: 6785,
        releaseYear: 2021,
        slug: 'at-at-75313',
        theme: 'Star Wars',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(listCatalogSetCardsByIds).not.toHaveBeenCalled();
    expect(markup).not.toContain('https://images.example/random.jpg');
  });

  it('keeps manual article card images before catalog fallbacks', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        bodySource: '<FeaturedSet setNumber="40787" />',
        cardImage: 'https://storage.example/article-images/manual/card.webp',
        cardImageAlt: 'Handmatige kaartafbeelding',
        cardImageSource: 'manual',
        date: '2026-05-03',
        description: 'Handmatige afbeelding blijft leidend.',
        heroImage: 'https://storage.example/article-images/manual/hero.webp',
        heroImageAlt: 'Handmatige hero',
        heroImageSource: 'manual',
        slug: 'manual-image',
        status: 'published',
        theme: 'Super Mario',
        title: 'Handmatige afbeelding',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(listCatalogSetCardsByIds).not.toHaveBeenCalled();
    expect(markup).toContain(
      'https://storage.example/article-images/manual/hero.webp',
    );
    expect(markup).toContain('data-article-image-fit="cover"');
    expect(markup).not.toContain('images.example');
  });

  it('renders uploaded Supabase hero images on article cards before catalog fallbacks', async () => {
    listPublishedArticles.mockResolvedValue([
      {
        bodySource: '<FeaturedSet setNumber="40787" />',
        cardImage:
          'https://project.supabase.co/storage/v1/object/public/article-images/articles/spiny-shell/hero.webp',
        cardImageAlt: 'Geuploade Spiny Shell hero',
        cardImageSource: 'manual',
        date: '2026-05-03',
        description: 'Handmatige hero moet winnen.',
        heroImage:
          'https://project.supabase.co/storage/v1/object/public/article-images/articles/spiny-shell/hero.webp',
        heroImageAlt: 'Geuploade Spiny Shell hero',
        heroImageSource: 'manual',
        slug: 'spiny-shell',
        status: 'published',
        theme: 'Super Mario',
        title: 'Spiny Shell terug',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain(
      'https://project.supabase.co/storage/v1/object/public/article-images/articles/spiny-shell/hero.webp',
    );
    expect(markup).toContain('data-article-image-fit="cover"');
    expect(listCatalogSetCardsByIds).not.toHaveBeenCalled();
  });
});
