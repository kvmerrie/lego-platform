import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPublishedArticles = vi.fn();

vi.mock('@lego-platform/content/data-access', () => ({
  listPublishedArticles,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('articles index route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    expect(source).toContain('await listPublishedArticles()');
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
        cardImage: '/articles/marvel/card.jpg',
        cardImageAlt: 'Marvel card',
        date: '2026-05-03',
        description: 'De nieuwste reveal voor Marvel-fans.',
        heroImage: '/articles/marvel/hero.jpg',
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
    expect(markup).toContain('/artikelen/lego-marvel-herbie');
    expect(markup).toContain('/artikelen/middle-update');
    expect(markup).toContain('/artikelen/older-update');
    expect(markup).not.toContain('Concept update');
    expect(markup).toContain('featuredArticle');
    expect(markup).toContain('cardGrid');
    expect(markup.indexOf('LEGO Marvel H.E.R.B.I.E. onthuld')).toBeLessThan(
      markup.indexOf('Nog een update'),
    );
    expect(markup.indexOf('Nog een update')).toBeLessThan(
      markup.indexOf('Oudere update'),
    );
  });

  it('renders the empty state when no articles are available', async () => {
    listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Nog geen artikelen beschikbaar');
    expect(markup).not.toContain('cardGrid');
  });
});
