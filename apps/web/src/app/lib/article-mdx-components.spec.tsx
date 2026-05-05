/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import React, { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  createEditorialAgentMockOutput,
  editorialAgentArticleComponentManifest,
  editorialAgentSetRailPropName,
} from '@lego-platform/content/util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleMdxSetRailClient } from './article-mdx-set-rail-client';
import { ArticleMdxSetSpotlightListClient } from './article-mdx-set-spotlight-list-client';
import {
  getArticleMdxComponents,
  normalizeFeaturedSetId,
  normalizeFaqItems,
  normalizeImageCarouselImages,
  normalizeSetRailIds,
  renderArticleMdxSetSpotlightList,
  renderArticleMdxSetRail,
  resolveArticleMdxSourceWithCuratedRelatedSetRail,
} from './article-mdx-components';

const {
  buildCurrentSetCardPriceContext,
  getFeaturedSetPriceContext,
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetCardsByIdsForBrowser,
} = vi.hoisted(() => ({
  buildCurrentSetCardPriceContext: vi.fn(),
  getFeaturedSetPriceContext: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogSetCards: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listCatalogSetCardsByIdsForBrowser: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access', () => ({
  catalogSnapshot: {
    generatedAt: '2026-04-30T12:00:00.000Z',
    source: 'test',
    setRecords: [
      {
        canonicalId: '75445',
        imageUrl: 'https://example.com/75445.jpg',
        name: 'Anzellan Starship',
        pieces: 702,
        releaseYear: 2026,
        slug: 'anzellan-starship-75445',
        sourceSetNumber: '75445-1',
        theme: 'Star Wars',
      },
      {
        canonicalId: '75382',
        imageUrl: 'https://example.com/75382.jpg',
        name: 'TIE Interceptor',
        pieces: 1931,
        releaseYear: 2024,
        slug: 'tie-interceptor-75382',
        sourceSetNumber: '75382-1',
        theme: 'Star Wars',
      },
    ],
  },
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetCardsByIdsForBrowser,
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogSetCard: ({
    actions,
    contextBadge,
    href,
    setSummary,
    showThemeBadge = true,
    variant = 'default',
    visualActions,
  }: {
    actions?: ReactNode;
    contextBadge?: { label: string };
    href?: string;
    setSummary: CatalogHomepageSetCard;
    showThemeBadge?: boolean;
    variant?: 'compact' | 'default' | 'featured';
    visualActions?: ReactNode;
  }) => (
    <article
      data-catalog-set-card={setSummary.id}
      data-catalog-set-card-theme-badge={showThemeBadge ? 'true' : 'false'}
      data-catalog-set-card-variant={variant}
    >
      <div
        data-catalog-set-card-visual="true"
        data-catalog-set-card-visual-variant="card"
      >
        {visualActions ? (
          <div data-catalog-set-card-visual-actions="true">{visualActions}</div>
        ) : null}
      </div>
      {contextBadge ? <span>{contextBadge.label}</span> : null}
      {href ? (
        <a href={href}>{setSummary.name}</a>
      ) : (
        <span>{setSummary.name}</span>
      )}
      {actions ? (
        <div data-catalog-set-card-actions="true">{actions}</div>
      ) : null}
      {href ? (
        <span data-catalog-set-card-primary-cta="true">Bekijk set</span>
      ) : null}
    </article>
  ),
  CatalogSetCardRailSection: ({
    ariaLabel,
    description,
    eyebrow,
    items,
    mobileOverflowBleed,
    mobileOverflowBleedUntil,
    surfaceVariant,
    tone,
    title,
    variant,
  }: {
    ariaLabel: string;
    description?: string;
    eyebrow?: string;
    items: Array<{
      href: string;
      id: string;
      setSummary: CatalogHomepageSetCard;
    }>;
    mobileOverflowBleed?: boolean;
    mobileOverflowBleedUntil?: 'mobile' | 'page' | 'tablet';
    surfaceVariant?: 'default' | 'themed';
    tone?: 'default' | 'inverse' | 'muted' | 'plain';
    title: string;
    variant?: 'compact' | 'featured';
  }) => (
    <section
      aria-label={ariaLabel}
      data-rail-mobile-bleed-until={mobileOverflowBleedUntil ?? 'mobile'}
      data-rail-tone={tone ?? 'plain'}
      data-rail-surface-variant={surfaceVariant ?? 'default'}
      data-rail-mobile-bleed={mobileOverflowBleed ? 'true' : 'false'}
      data-rail-variant={variant ?? 'featured'}
    >
      <header data-rail-header="true">
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        <div data-rail-controls="true">controls</div>
      </header>
      {items.map((item) => (
        <article data-href={item.href} key={item.id}>
          <a href={item.href}>{item.setSummary.name}</a>
        </article>
      ))}
    </section>
  ),
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: ({
    setId,
  }: {
    productIntent?: 'price-alert' | 'wishlist';
    setId: string;
    variant?: 'default' | 'inline' | 'product';
  }) => (
    <button
      aria-label="Aan verlanglijst toevoegen"
      data-wishlist-inline-toggle={setId}
      type="button"
    >
      wishlist
    </button>
  ),
}));

vi.mock('@lego-platform/catalog/util', () => ({
  buildCatalogReleaseLabel: ({ releaseYear }: { releaseYear?: number }) =>
    typeof releaseYear === 'number'
      ? {
          label: 'Release',
          value: `Nieuw in ${releaseYear}`,
        }
      : undefined,
  buildCatalogThemeSlug: (theme: string) =>
    theme.toLowerCase().replaceAll(' ', '-'),
  getCanonicalCatalogSetId: (sourceSetNumber: string) =>
    sourceSetNumber.trim().replace(/-1$/u, ''),
  getCatalogThemeDefinition: (theme: string) =>
    theme === 'Star Wars'
      ? {
          name: 'Star Wars™',
          slug: 'star-wars',
          visual: {
            backgroundColor: '#5573b5',
            textColor: '#ffffff',
          },
        }
      : undefined,
  getCatalogThemeDisplayName: (theme: string) =>
    theme === 'Star Wars' ? 'Star Wars™' : theme,
  getCatalogThemeMutedTextColor: () => '#f4f7fb',
  getCatalogThemeSurfaceTone: (theme: string) =>
    theme === 'Star Wars™' ? 'dark' : 'light',
  normalizeTheme: (theme?: string) =>
    theme
      ? {
          displayName: theme === 'Star Wars' ? 'Star Wars™' : theme,
          key: theme.toLowerCase().replaceAll(' ', '-'),
        }
      : undefined,
  normalizeCatalogSetImages: ({ imageUrl }: { imageUrl?: string }) => ({
    imageUrl,
    primaryImage: imageUrl,
  }),
}));

vi.mock('@lego-platform/content/ui', () => ({
  ContentArticleCallout: ({ children }: { children?: ReactNode }) => (
    <aside>{children}</aside>
  ),
  ContentArticleCard: ({
    contentArticle,
  }: {
    contentArticle: { title: string };
  }) => <article>{contentArticle.title}</article>,
  ContentArticleFeaturedSet: ({
    availabilityLabel,
    imageUrl,
    name,
    priceValue,
    releaseLabel,
    setNumber,
    theme,
  }: {
    availabilityLabel?: string;
    imageUrl?: string;
    name: string;
    priceValue?: string;
    releaseLabel?: string;
    setNumber: string;
    theme?: string;
  }) => (
    <section data-featured-set="true">
      <h2>{name}</h2>
      <p>Set {setNumber}</p>
      {theme ? <p>{theme}</p> : null}
      {releaseLabel ? <p>{releaseLabel}</p> : null}
      {imageUrl ? <p>{imageUrl}</p> : null}
      {priceValue ? <p>{priceValue}</p> : null}
      {availabilityLabel ? <p>{availabilityLabel}</p> : null}
    </section>
  ),
  ContentArticleFaq: ({
    items,
    title,
  }: {
    items: ReadonlyArray<{ answer: string; question: string }>;
    title: string;
  }) => (
    <section aria-label={title} data-faq="true">
      <h2>{title}</h2>
      {items.map((item) => (
        <article key={item.question}>
          <h3>{item.question}</h3>
          <p>{item.answer}</p>
        </article>
      ))}
    </section>
  ),
  ContentArticleImageGallery: ({
    images,
  }: {
    images: ReadonlyArray<{ alt: string; src: string }>;
  }) => (
    <section aria-label="Artikelgalerij" data-gallery="true">
      {images.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={image.alt} key={image.src} src={image.src} />
      ))}
    </section>
  ),
  ContentArticleImageCarousel: ({
    images,
  }: {
    images: ReadonlyArray<{ alt: string; src: string }>;
  }) => (
    <section aria-label="Artikelgalerij" data-gallery="true">
      {images.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={image.alt} key={image.src} src={image.src} />
      ))}
    </section>
  ),
  ContentArticleSetRail: ({
    children,
    debugMessage,
    emptyMessage,
    eyebrow,
    subtitle,
    title,
  }: {
    children?: ReactNode;
    debugMessage?: string;
    emptyMessage?: string;
    eyebrow?: string;
    subtitle?: string;
    title: string;
  }) => (
    <section aria-label={title}>
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {debugMessage ? <p>{debugMessage}</p> : null}
      {emptyMessage ? <p>{emptyMessage}</p> : null}
      {children}
    </section>
  ),
  ContentArticleSetSpotlightList: ({
    sections,
  }: {
    sections?: ReadonlyArray<{
      body?: ReactNode;
      description?: string;
      highlightSetNumber?: string;
      id: string;
      layoutVariant?: string;
      title: string;
    }>;
  }) => (
    <section data-set-spotlight-list="true">
      {(sections ?? []).map((section) => (
        <section
          data-set-spotlight-layout={section.layoutVariant ?? 'single'}
          data-set-spotlight-section={section.id}
          key={section.id}
        >
          <h3>{section.title}</h3>
          {section.description ? <p>{section.description}</p> : null}
          {section.body}
        </section>
      ))}
    </section>
  ),
  trackArticleSetClick: ({
    articleSlug,
    setId,
    setName,
  }: {
    articleSlug?: string;
    setId: string;
    setName: string;
  }) => {
    window.gtag?.('event', 'set_click', {
      article_slug: articleSlug,
      set_id: setId,
      set_name: setName,
      source: 'article',
    });
  },
}));

vi.mock('@lego-platform/pricing/data-access', () => ({
  getFeaturedSetPriceContext,
}));

vi.mock('@lego-platform/shared/config', () => ({
  buildSetDetailPath: (slug: string) => `/sets/${slug}`,
  buildThemePath: (slug: string) => `/themes/${slug}`,
}));

vi.mock('./current-set-card-price-context', () => ({
  buildCurrentSetCardPriceContext,
}));

describe('article mdx components', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    listCatalogSetCards.mockResolvedValue([]);
    listCatalogSetCardsByIdsForBrowser.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    process.env.NODE_ENV = originalNodeEnv;
    delete window.gtag;
    vi.resetAllMocks();
  });

  it('normalizes MDX set ids from both array and comma-separated input', () => {
    expect(normalizeSetRailIds(['75446', '75447-1', '75446'])).toEqual([
      '75446',
      '75447',
    ]);
    expect(normalizeSetRailIds('75445, 75440-1')).toEqual(['75445', '75440']);
    expect(normalizeSetRailIds(['75446, 75447', '75445-1'])).toEqual([
      '75446',
      '75447',
      '75445',
    ]);
    expect(
      normalizeSetRailIds({
        '0': '72050',
        '1': '72037',
      }),
    ).toEqual(['72050', '72037']);
  });

  it('normalizes FeaturedSet ids from plain and source set numbers', () => {
    expect(normalizeFeaturedSetId('40787')).toBe('40787');
    expect(normalizeFeaturedSetId('40787-1')).toBe('40787');
    expect(normalizeFeaturedSetId('')).toBeUndefined();
  });

  it('normalizes image carousel props from array and comma-separated string input', () => {
    expect(
      normalizeImageCarouselImages([
        {
          alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
          src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
        },
      ]),
    ).toHaveLength(1);

    expect(
      normalizeImageCarouselImages(
        'https://storage.example/article-images/star-wars-day-2026/grogu.webp,https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
      ),
    ).toEqual([
      {
        alt: 'Artikelafbeelding 1',
        src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
      },
      {
        alt: 'Artikelafbeelding 2',
        src: 'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
      },
    ]);

    expect(
      normalizeImageCarouselImages(
        'https://storage.example/article-images/star-wars-day-2026/grogu.webp::LEGO Star Wars Grogu als leerling van de Mandalorian;;https://storage.example/article-images/star-wars-day-2026/razor-crest.webp::LEGO Star Wars The Razor Crest',
      ),
    ).toEqual([
      {
        alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
        caption: undefined,
        src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
      },
      {
        alt: 'LEGO Star Wars The Razor Crest',
        caption: undefined,
        src: 'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
      },
    ]);
  });

  it('normalizes faq props from array and safe string input', () => {
    expect(
      normalizeFaqItems([
        {
          answer:
            'Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.',
          question: 'Wanneer is Star Wars Day?',
        },
      ]),
    ).toHaveLength(1);

    expect(
      normalizeFaqItems(
        'Wanneer is Star Wars Day?::Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.;;Zijn LEGO Star Wars sets dan altijd goedkoper?::Niet altijd. Soms zit de waarde juist in cadeaus bij aankoop, extra voorraad of tijdelijke acties.',
      ),
    ).toEqual([
      {
        answer:
          'Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.',
        question: 'Wanneer is Star Wars Day?',
      },
      {
        answer:
          'Niet altijd. Soms zit de waarde juist in cadeaus bij aankoop, extra voorraad of tijdelijke acties.',
        question: 'Zijn LEGO Star Wars sets dan altijd goedkoper?',
      },
    ]);
  });

  it('registers SetRail in the MDX components map', () => {
    expect(getArticleMdxComponents().SetRail).toBeTypeOf('function');
  });

  it('registers SetSpotlightList in the MDX components map', () => {
    expect(getArticleMdxComponents().SetSpotlightList).toBeTypeOf('function');
  });

  it('registers FeaturedSet in the MDX components map', () => {
    expect(getArticleMdxComponents().FeaturedSet).toBeTypeOf('function');
  });

  it('registers ImageCarousel in the MDX components map', () => {
    expect(getArticleMdxComponents().ImageCarousel).toBeTypeOf('function');
  });

  it('registers ImageGallery in the MDX components map', () => {
    expect(getArticleMdxComponents().ImageGallery).toBeTypeOf('function');
  });

  it('keeps regular MDX paragraphs wrapped as paragraphs', () => {
    const Paragraph = getArticleMdxComponents().p as React.ComponentType<{
      children?: ReactNode;
    }>;
    const markup = renderToStaticMarkup(
      <Paragraph>
        Een gewone alinea met <strong>nadruk</strong>.
      </Paragraph>,
    );

    expect(markup).toBe(
      '<p>Een gewone alinea met <strong>nadruk</strong>.</p>',
    );
  });

  it('unwraps MDX block components from paragraphs to keep article HTML valid', () => {
    const components = getArticleMdxComponents();
    const Paragraph = components.p as React.ComponentType<{
      children?: ReactNode;
    }>;
    const ImageGallery = components.ImageGallery as React.ComponentType<{
      images?: string;
    }>;
    const Callout = components.Callout as React.ComponentType<{
      children?: ReactNode;
      title?: string;
    }>;
    const markup = renderToStaticMarkup(
      <Paragraph>
        Eerst context.
        <ImageGallery images="https://storage.example/article-images/star-wars-day-2026/grogu.webp::Grogu" />
        <Callout title="Let op">Nog een blok.</Callout>
        Daarna verder.
      </Paragraph>,
    );

    expect(markup).not.toContain('<p><section');
    expect(markup).not.toContain('<p><aside');
    expect(markup).toContain('<p>Eerst context.</p>');
    expect(markup).toContain('data-gallery="true"');
    expect(markup).toContain('<aside>Nog een blok.</aside>');
    expect(markup).toContain('<p>Daarna verder.</p>');
  });

  it('registers Faq in the MDX components map', () => {
    expect(getArticleMdxComponents().Faq).toBeTypeOf('function');
  });

  it('renders ImageGallery inside the MDX component map', () => {
    const ImageGallery = getArticleMdxComponents()
      .ImageGallery as React.ComponentType<{
      images: Array<{ alt: string; src: string }>;
    }>;
    const markup = renderToStaticMarkup(
      <ImageGallery
        images={[
          {
            alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
            src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
          },
          {
            alt: 'LEGO Star Wars The Razor Crest',
            src: 'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
          },
        ]}
      />,
    );

    expect(markup).toContain('data-gallery="true"');
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
    );
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
    );
  });

  it('renders ImageCarousel as a compatibility alias when MDX passes a structured string prop', () => {
    const ImageCarousel = getArticleMdxComponents()
      .ImageCarousel as React.ComponentType<{
      images: string;
    }>;
    const markup = renderToStaticMarkup(
      <ImageCarousel images="https://storage.example/article-images/star-wars-day-2026/grogu.webp::LEGO Star Wars Grogu als leerling van de Mandalorian;;https://storage.example/article-images/star-wars-day-2026/razor-crest.webp::LEGO Star Wars The Razor Crest;;https://storage.example/article-images/star-wars-day-2026/anzellan-starship.webp::LEGO Star Wars Anzellan Starship" />,
    );

    expect(markup).toContain('data-gallery="true"');
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
    );
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
    );
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/anzellan-starship.webp',
    );
  });

  it('renders Faq from a safe string prop', () => {
    const Faq = getArticleMdxComponents().Faq as React.ComponentType<{
      items: string;
      title: string;
    }>;
    const markup = renderToStaticMarkup(
      <Faq
        items="Wanneer is Star Wars Day?::Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.;;Wanneer moet je kopen?::Als je al wist welke set je wilde en je ziet dat meerdere winkels tegelijk bewegen, is dat vaak een goed moment."
        title="Veelgestelde vragen over Star Wars Day"
      />,
    );

    expect(markup).toContain('data-faq="true"');
    expect(markup).toContain('Veelgestelde vragen over Star Wars Day');
    expect(markup).toContain('Wanneer is Star Wars Day?');
    expect(markup).toContain('Wanneer moet je kopen?');
  });

  it('renders FeaturedSet without requiring live price data', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '40787',
        imageUrl: 'https://example.com/40787.jpg',
        name: 'Mario Kart – Spiny Shell',
        pieces: 234,
        releaseYear: 2026,
        slug: 'mario-kart-spiny-shell-40787',
        theme: 'Super Mario',
      },
    ]);
    listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(new Map());
    getFeaturedSetPriceContext.mockReturnValue(undefined);
    buildCurrentSetCardPriceContext.mockReturnValue(undefined);

    const FeaturedSet = getArticleMdxComponents().FeaturedSet as (props: {
      setNumber?: string;
    }) => Promise<React.ReactNode>;
    const markup = renderToStaticMarkup(
      await FeaturedSet({
        setNumber: '40787',
      }),
    );

    expect(markup).toContain('data-featured-set="true"');
    expect(markup).toContain('Mario Kart – Spiny Shell');
    expect(markup).toContain('Set 40787');
    expect(markup).not.toContain('€');
  });

  it('keeps FeaturedSet visually standalone and injects curated helmet sets before the conclusion', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
      {
        id: '75327',
        imageUrl: 'https://example.com/75327.jpg',
        name: 'Luke Skywalker Red Five Helmet',
        pieces: 675,
        releaseYear: 2022,
        slug: 'luke-skywalker-red-five-helmet-75327',
        theme: 'Star Wars',
      },
      {
        id: '75328',
        imageUrl: 'https://example.com/75328.jpg',
        name: 'The Mandalorian Helmet',
        pieces: 584,
        releaseYear: 2022,
        slug: 'the-mandalorian-helmet-75328',
        theme: 'Star Wars',
      },
      {
        id: '75382',
        imageUrl: 'https://example.com/75382.jpg',
        name: 'TIE Interceptor',
        pieces: 1931,
        releaseYear: 2024,
        slug: 'tie-interceptor-75382',
        theme: 'Star Wars',
      },
    ]);
    const mdx = `Intro.

Nog intro.

<FeaturedSet setNumber="75458" />

## Wat is er aangekondigd?

Helmet nieuws.

## Korte conclusie

Klaar.`;
    const resolvedMdx =
      await resolveArticleMdxSourceWithCuratedRelatedSetRail(mdx);

    expect(resolvedMdx.indexOf('<FeaturedSet')).toBeLessThan(
      resolvedMdx.indexOf('## Wat is er aangekondigd?'),
    );
    expect(resolvedMdx).toContain(
      '<SetRail title="Andere helmets in deze lijn" setIds="75327, 75328" />',
    );
    expect(resolvedMdx.indexOf('<SetRail')).toBeGreaterThan(
      resolvedMdx.indexOf('## Wat is er aangekondigd?'),
    );
    expect(resolvedMdx.indexOf('<SetRail')).toBeLessThan(
      resolvedMdx.indexOf('## Korte conclusie'),
    );
    expect(
      resolvedMdx.slice(
        resolvedMdx.indexOf('<FeaturedSet'),
        resolvedMdx.indexOf('<SetRail'),
      ),
    ).toContain('## Wat is er aangekondigd?');
    expect(resolvedMdx).not.toContain('75382');
  });

  it('can inject up to twenty curated related sets without duplicates or weak matches', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
      ...Array.from({ length: 22 }, (_, index) => {
        const setId = String(75_300 + index);

        return {
          id: setId,
          imageUrl: `https://example.com/${setId}.jpg`,
          name: `Star Wars Helmet ${index + 1}`,
          pieces: 600 + index,
          releaseYear: 2026,
          slug: `star-wars-helmet-${setId}`,
          theme: 'Star Wars',
        };
      }),
      {
        id: '75300',
        imageUrl: 'https://example.com/75300-duplicate.jpg',
        name: 'Star Wars Helmet duplicate',
        pieces: 999,
        releaseYear: 2026,
        slug: 'star-wars-helmet-duplicate',
        theme: 'Star Wars',
      },
      {
        id: '75382',
        imageUrl: 'https://example.com/75382.jpg',
        name: 'TIE Interceptor',
        pieces: 1931,
        releaseYear: 2024,
        slug: 'tie-interceptor-75382',
        theme: 'Star Wars',
      },
    ]);

    const resolvedMdx = await resolveArticleMdxSourceWithCuratedRelatedSetRail(
      `<FeaturedSet setNumber="75458" />

## Wat is er aangekondigd?

Helmet nieuws.

## Korte conclusie

Klaar.`,
    );
    const setIdsMatch = resolvedMdx.match(/setIds="([^"]+)"/u);
    const setIds = normalizeSetRailIds(setIdsMatch?.[1] ?? '');

    expect(setIds).toHaveLength(20);
    expect(new Set(setIds).size).toBe(20);
    expect(setIds).not.toContain('75382');
  });

  it('does not inject random same-theme sets for non-collection FeaturedSet cards', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75461',
        imageUrl: 'https://example.com/75461.jpg',
        name: 'Up-Scaled Darth Vader Minifigure',
        pieces: 584,
        releaseYear: 2026,
        slug: 'up-scaled-darth-vader-minifigure-75461',
        theme: 'Star Wars',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
      {
        id: '75382',
        imageUrl: 'https://example.com/75382.jpg',
        name: 'TIE Interceptor',
        pieces: 1931,
        releaseYear: 2024,
        slug: 'tie-interceptor-75382',
        theme: 'Star Wars',
      },
    ]);
    const resolvedMdx = await resolveArticleMdxSourceWithCuratedRelatedSetRail(
      `<FeaturedSet setNumber="75461" />

## Korte conclusie

Klaar.`,
    );

    expect(resolvedMdx).toContain('<FeaturedSet setNumber="75461" />');
    expect(resolvedMdx).not.toContain('<SetRail');
    expect(resolvedMdx).not.toContain('75458');
    expect(resolvedMdx).not.toContain('75382');
  });

  it('hides curated related rails when fewer than two strong matches exist', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75458',
        imageUrl: 'https://example.com/75458.jpg',
        name: 'Imperial Remnant AT-RT Driver Helmet',
        pieces: 730,
        releaseYear: 2026,
        slug: 'imperial-remnant-at-rt-driver-helmet-75458',
        theme: 'Star Wars',
      },
    ]);
    listCatalogSetCards.mockResolvedValue([
      {
        id: '75327',
        imageUrl: 'https://example.com/75327.jpg',
        name: 'Luke Skywalker Red Five Helmet',
        pieces: 675,
        releaseYear: 2022,
        slug: 'luke-skywalker-red-five-helmet-75327',
        theme: 'Star Wars',
      },
    ]);
    const resolvedMdx = await resolveArticleMdxSourceWithCuratedRelatedSetRail(
      `<FeaturedSet setNumber="75458" />

## Korte conclusie

Klaar.`,
    );

    expect(resolvedMdx).toContain('<FeaturedSet setNumber="75458" />');
    expect(resolvedMdx).not.toContain('<SetRail');
    expect(resolvedMdx).not.toContain('75327');
  });

  it('repairs a single malformed image entry when MDX collapses multiple images into one src string', () => {
    expect(
      normalizeImageCarouselImages([
        {
          alt: 'Artikelafbeelding 1',
          src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp::LEGO Star Wars Grogu als leerling van de Mandalorian;;https://storage.example/article-images/star-wars-day-2026/razor-crest.webp::LEGO Star Wars The Razor Crest',
        },
      ]),
    ).toEqual([
      {
        alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
        caption: undefined,
        src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
      },
      {
        alt: 'LEGO Star Wars The Razor Crest',
        caption: undefined,
        src: 'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
      },
    ]);
  });

  it('renders the rail when at least one set exists', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446'],
        subtitle: 'Display, UCS en sets die echt iets doen op je plank.',
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('Star Wars sets om te volgen');
    expect(markup).toContain(
      'Display, UCS en sets die echt iets doen op je plank.',
    );
    expect(markup).toContain('data-rail-mobile-bleed="true"');
    expect(markup).toContain('data-rail-mobile-bleed-until="page"');
    expect(markup).toContain('data-rail-variant="compact"');
    expect(markup).toContain('data-rail-controls="true"');
    expect(markup).toContain('data-rail-header="true"');
    expect(markup).toContain('data-rail-surface-variant="themed"');
    expect(markup).toContain('data-rail-tone="default"');
    expect(markup).toContain('data-article-width="commerce-rail"');
    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
    expect(markup).toContain('/sets/grogu-mandalorian-apprentice-75446');
    expect(markup).not.toContain('Setselectie');
  });

  it('passes a custom SetRail eyebrow from MDX props', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const SetRail = getArticleMdxComponents().SetRail as (props: {
      eyebrow?: string;
      setIds?: readonly string[] | string;
      title?: string;
    }) => Promise<React.ReactNode>;
    const markup = renderToStaticMarkup(
      await SetRail({
        eyebrow: 'Kun je niet wachten?',
        setIds: '75446',
        title: 'Andere helmets om nu te bouwen',
      }),
    );

    expect(markup).toContain('Kun je niet wachten?');
    expect(markup).toContain('Andere helmets om nu te bouwen');
    expect(markup).not.toContain('Setselectie');
  });

  it('renders cards without requiring prices or offer summaries', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75447'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('The Razor Crest');
    expect(markup).not.toContain('price');
    expect(markup).not.toContain('offer');
  });

  it('tracks SetRail set clicks from article context without blocking navigation', async () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    await act(async () => {
      root.render(
        <ArticleMdxSetRailClient
          articleSlug="star-wars-day-2026"
          canonicalIds={['75447']}
          initialSetCards={[
            {
              id: '75447',
              imageUrl: 'https://example.com/75447.jpg',
              name: 'The Razor Crest',
              pieces: 930,
              releaseYear: 2026,
              slug: 'the-razor-crest-75447',
              theme: 'Star Wars',
            },
          ]}
          title="Star Wars sets om te volgen"
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/sets/the-razor-crest-75447"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(link?.dispatchEvent(clickEvent)).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(gtag).toHaveBeenCalledWith('event', 'set_click', {
      article_slug: 'star-wars-day-2026',
      set_id: '75447',
      set_name: 'The Razor Crest',
      source: 'article',
    });

    delete window.gtag;
  });

  it('does not crash when SetRail set tracking runs without gtag', async () => {
    delete window.gtag;

    await act(async () => {
      root.render(
        <ArticleMdxSetRailClient
          canonicalIds={['75446']}
          initialSetCards={[
            {
              id: '75446',
              imageUrl: 'https://example.com/75446.jpg',
              name: 'Grogu (Mandalorian Apprentice)',
              pieces: 1200,
              releaseYear: 2026,
              slug: 'grogu-mandalorian-apprentice-75446',
              theme: 'Star Wars',
            },
          ]}
          title="Star Wars sets om te volgen"
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/sets/grogu-mandalorian-apprentice-75446"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(() => link?.dispatchEvent(clickEvent)).not.toThrow();
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it('accepts array props from MDX and keeps matching cards visible', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446', '75447'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
    expect(markup).toContain('The Razor Crest');
  });

  it('dedupes previously used set ids across article rails', async () => {
    listCatalogSetCardsByIds.mockImplementation(
      async ({ canonicalIds }: { canonicalIds: string[] }) =>
        canonicalIds.flatMap((canonicalId) => {
          const setCardById: Record<string, CatalogHomepageSetCard> = {
            '75382': {
              id: '75382',
              imageUrl: 'https://example.com/75382.jpg',
              name: 'TIE Interceptor',
              pieces: 1931,
              releaseYear: 2024,
              slug: 'tie-interceptor-75382',
              theme: 'Star Wars',
            },
            '75445': {
              id: '75445',
              imageUrl: 'https://example.com/75445.jpg',
              name: 'Anzellan Starship',
              pieces: 702,
              releaseYear: 2026,
              slug: 'anzellan-starship-75445',
              theme: 'Star Wars',
            },
            '75446': {
              id: '75446',
              imageUrl: 'https://example.com/75446.jpg',
              name: 'Grogu (Mandalorian Apprentice)',
              pieces: 1200,
              releaseYear: 2026,
              slug: 'grogu-mandalorian-apprentice-75446',
              theme: 'Star Wars',
            },
            '75447': {
              id: '75447',
              imageUrl: 'https://example.com/75447.jpg',
              name: 'The Razor Crest',
              pieces: 930,
              releaseYear: 2026,
              slug: 'the-razor-crest-75447',
              theme: 'Star Wars',
            },
          };

          return setCardById[canonicalId] ? [setCardById[canonicalId]] : [];
        }),
    );

    const SetRail = getArticleMdxComponents().SetRail as (props: {
      setIds?: readonly string[] | string;
      subtitle?: string;
      title?: string;
    }) => Promise<React.ReactNode>;
    const firstRailMarkup = renderToStaticMarkup(
      await SetRail({
        setIds: ['75446', '75447'],
        title: 'Nieuwe Star Wars sets om te volgen',
      }),
    );
    const secondRailMarkup = renderToStaticMarkup(
      await SetRail({
        setIds: ['75446', '75445', '75382'],
        title: 'Star Wars deals die nu opvallen',
      }),
    );

    expect(firstRailMarkup).toContain('Grogu (Mandalorian Apprentice)');
    expect(firstRailMarkup).toContain('The Razor Crest');
    expect(secondRailMarkup).not.toContain('Grogu (Mandalorian Apprentice)');
    expect(secondRailMarkup).toContain('Anzellan Starship');
    expect(secondRailMarkup).toContain('TIE Interceptor');
  });

  it('accepts comma-separated set ids from MDX string props', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: '75446, 75447',
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
    expect(markup).toContain('The Razor Crest');
  });

  it('renders SetSpotlightList with multiple exact matches and skips duplicates automatically', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '11506',
        imageUrl: 'https://example.com/11506.jpg',
        name: 'Rocking Plants',
        pieces: 217,
        releaseYear: 2026,
        slug: 'rocking-plants-11506',
        theme: 'Botanicals',
      },
      {
        id: '43301',
        imageUrl: 'https://example.com/43301.jpg',
        name: "Belle's Storytime Horse Carriage",
        pieces: 290,
        releaseYear: 2026,
        slug: 'belles-storytime-horse-carriage-43301',
        theme: 'Disney',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetSpotlightList({
        setIds: '11506, 43301, 11506',
      }),
    );

    expect(markup).toContain('data-set-spotlight-list="true"');
    expect(markup).toContain('data-set-spotlight-item="11506"');
    expect(markup).toContain('data-set-spotlight-item="43301"');
    expect(markup).toContain(
      'data-set-spotlight-card-system="catalog-set-card"',
    );
    expect(markup).toContain('data-catalog-set-card="11506"');
    expect(markup).toContain('data-catalog-set-card="43301"');
    expect(markup).toContain('data-catalog-set-card-theme-badge="false"');
    expect(markup).toContain('data-catalog-set-card-variant="compact"');
    expect(markup).toContain('data-set-spotlight-section="toy-story-disney"');
    expect(markup).toContain('data-set-spotlight-section="botanicals"');
    expect(markup.match(/data-set-spotlight-item="11506"/gu)?.length).toBe(1);
  });

  it('skips unknown SetSpotlightList ids without crashing', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '11506',
        imageUrl: 'https://example.com/11506.jpg',
        name: 'Rocking Plants',
        pieces: 217,
        releaseYear: 2026,
        slug: 'rocking-plants-11506',
        theme: 'Botanicals',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetSpotlightList({
        setIds: '11506, 99999',
      }),
    );

    expect(markup).toContain('Rocking Plants');
    expect(markup).not.toContain('99999');
  });

  it('opens the shared lightbox from SetSpotlightList images and starts on the clicked set', async () => {
    await act(async () => {
      root.render(
        <ArticleMdxSetSpotlightListClient
          articleDescription="De Mandalorian valt hier extra op."
          articleTitle="Nieuwe LEGO-sets voor mei 2026"
          items={[
            {
              ctaHref: '/sets/rocking-plants-11506',
              setSummary: {
                id: '11506',
                imageUrl: 'https://example.com/11506.png',
                name: 'Rocking Plants',
                slug: 'rocking-plants-11506',
                theme: 'Botanicals',
              },
            },
            {
              availabilityLabel: 'Op voorraad',
              ctaHref: '/sets/the-mandalorians-n-1-starfighter-75442',
              priceValue: '€79,99',
              setSummary: {
                id: '75442',
                imageUrl: 'https://example.com/75442.png',
                name: "The Mandalorian's N-1 Starfighter",
                pieces: 825,
                slug: 'the-mandalorians-n-1-starfighter-75442',
                theme: 'Star Wars',
              },
            },
          ]}
        />,
      );
    });

    const imageOpenButtons = container.querySelectorAll(
      'button[aria-label="Bekijk afbeelding groot"]',
    );

    expect(imageOpenButtons).toHaveLength(2);
    expect(
      container.querySelectorAll(
        'button[aria-label="Aan verlanglijst toevoegen"]',
      ),
    ).toHaveLength(2);
    expect(
      container.querySelector(
        '[data-set-spotlight-lightbox-placement="image-area"]',
      ),
    ).not.toBeNull();
    expect(
      container
        .querySelector('button[data-set-spotlight-lightbox-set-id="75442"]')
        ?.closest('[data-catalog-set-card-visual="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-catalog-set-card-actions="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(
        '[data-catalog-set-card-actions="true"] button[aria-label="Bekijk afbeelding groot"]',
      ),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-catalog-set-card-primary-cta="true"]'),
    ).toHaveLength(2);
    expect(
      container.querySelector(
        'button[data-set-spotlight-lightbox-tone="secondary"]',
      ),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-set-spotlight-item="75442"]')
        ?.getAttribute('data-set-spotlight-highlighted'),
    ).toBe('true');
    expect(container.textContent).toContain('Star Wars');
    expect(container.textContent).toContain('Botanicals');

    act(() => {
      (
        container.querySelector(
          'button[data-set-spotlight-lightbox-set-id="11506"]',
        ) as HTMLButtonElement | null
      )?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('Rocking Plants · Set 11506');
    expect(
      document.body.querySelectorAll('[class*="lightboxThumbButton"]'),
    ).toHaveLength(2);
    expect(
      container.querySelector('a[href="/sets/rocking-plants-11506"]'),
    ).not.toBeNull();
  });

  it('tracks SetSpotlightList set links but not lightbox zoom clicks', async () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    await act(async () => {
      root.render(
        <ArticleMdxSetSpotlightListClient
          articleSlug="mei-release-roundup"
          articleTitle="Nieuwe LEGO-sets voor mei 2026"
          items={[
            {
              ctaHref: '/sets/rocking-plants-11506',
              setSummary: {
                id: '11506',
                imageUrl: 'https://example.com/11506.png',
                name: 'Rocking Plants',
                slug: 'rocking-plants-11506',
                theme: 'Botanicals',
              },
            },
          ]}
        />,
      );
    });

    const lightboxButton = container.querySelector(
      'button[data-set-spotlight-lightbox-set-id="11506"]',
    );
    const lightboxClickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      lightboxButton?.dispatchEvent(lightboxClickEvent);
    });

    expect(gtag).not.toHaveBeenCalled();

    const link = container.querySelector(
      'a[href="/sets/rocking-plants-11506"]',
    );
    const linkClickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(link?.dispatchEvent(linkClickEvent)).toBe(true);
    expect(linkClickEvent.defaultPrevented).toBe(false);
    expect(gtag).toHaveBeenCalledWith('event', 'set_click', {
      article_slug: 'mei-release-roundup',
      set_id: '11506',
      set_name: 'Rocking Plants',
      source: 'article',
    });

    delete window.gtag;
  });

  it('does not crash when SetSpotlightList set tracking runs without gtag', async () => {
    delete window.gtag;

    await act(async () => {
      root.render(
        <ArticleMdxSetSpotlightListClient
          articleSlug="mei-release-roundup"
          items={[
            {
              ctaHref: '/sets/rocking-plants-11506',
              setSummary: {
                id: '11506',
                imageUrl: 'https://example.com/11506.png',
                name: 'Rocking Plants',
                slug: 'rocking-plants-11506',
                theme: 'Botanicals',
              },
            },
          ]}
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/sets/rocking-plants-11506"]',
    );
    const linkClickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(() => link?.dispatchEvent(linkClickEvent)).not.toThrow();
    expect(linkClickEvent.defaultPrevented).toBe(false);
  });

  it('keeps SetSpotlightList stable when some items have no image', async () => {
    await act(async () => {
      root.render(
        <ArticleMdxSetSpotlightListClient
          articleTitle="Nieuwe LEGO-sets"
          items={[
            {
              ctaHref: '/sets/without-image-70000',
              setSummary: {
                id: '70000',
                name: 'Fallback set',
                slug: 'without-image-70000',
                theme: 'Icons',
              },
            },
            {
              ctaHref: '/sets/rocking-plants-11506',
              setSummary: {
                id: '11506',
                imageUrl: 'https://example.com/11506.png',
                name: 'Rocking Plants',
                slug: 'rocking-plants-11506',
                theme: 'Botanicals',
              },
            },
          ]}
        />,
      );
    });

    expect(
      container.querySelectorAll('button[aria-label$="in galerij"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(
        'button[aria-label="Bekijk afbeelding groot"]',
      ),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(
        'button[aria-label="Aan verlanglijst toevoegen"]',
      ),
    ).toHaveLength(2);
    expect(container.textContent).toContain('Fallback set');
    expect(container.textContent).toContain('Rocking Plants');
  });

  it('uses a fixed 3/2/1 spotlight grid rhythm with a shared compact action-row pattern', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'apps/web/src/app/lib/article-mdx-set-spotlight-list-client.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('@media (min-width: 48rem)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('@media (min-width: 72rem)');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('.cardActions {');
    expect(css).toContain('display: flex;');
    expect(css).toContain('gap: 0.5rem;');
    expect(css).toContain('aspect-ratio: 1;');
    expect(css).toContain('--lego-button-secondary-background: #ffffff;');
    expect(css).toContain(
      '--lego-button-secondary-border-color: var(--lego-text);',
    );
    expect(css).toContain('--lego-button-secondary-color: var(--lego-text);');
    expect(css).not.toContain('inset-block-start:');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toContain('border-inline: 0;');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('border-block: 0;');
    expect(css).toContain('gap: 0;');
    expect(css).toContain('.cardSlot {');
    expect(css).toContain('border-top: 1px solid var(--lego-border-subtle);');
    expect(css).toContain('.cardSlot:last-child {');
    expect(css).toContain(
      'border-bottom: 1px solid var(--lego-border-subtle);',
    );
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).toContain('opacity: 0;');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain(
      "[data-catalog-set-card-visual='true']:hover .lightboxButton,",
    );
    expect(css).toContain(
      "[data-catalog-set-card-visual='true']:focus-within .lightboxButton",
    );
    expect(css).toContain('@media (hover: none), (pointer: coarse)');
    expect(css).toContain('display: none;');
    expect(css).toContain(".sectionGrid[data-set-spotlight-count='1'] {");
    expect(css).toContain(".sectionGrid[data-set-spotlight-count='2'] {");
    expect(
      css.match(
        /\.sectionGrid\[data-set-spotlight-count='1'\]\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u,
      ),
    ).not.toBeNull();
    expect(
      css.match(
        /\.sectionGrid\[data-set-spotlight-count='2'\]\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u,
      ),
    ).not.toBeNull();
    expect(css).not.toContain('max-width: min(100%, 41rem);');
  });

  it('uses neutral rail styling for Multiple-theme articles while keeping themed articles themed', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const themedSetRail = getArticleMdxComponents({
      articleTheme: 'Star Wars',
    }).SetRail as (props: {
      setIds?: readonly string[] | string;
      subtitle?: string;
      title?: string;
    }) => Promise<React.ReactNode>;
    const multipleThemeSetRail = getArticleMdxComponents({
      articleTheme: 'Multiple',
    }).SetRail as (props: {
      setIds?: readonly string[] | string;
      subtitle?: string;
      title?: string;
    }) => Promise<React.ReactNode>;
    const themedRail = renderToStaticMarkup(
      await themedSetRail({
        setIds: '75446, 75447',
        title: 'Star Wars sets om te volgen',
      }),
    );
    const multipleThemeRail = renderToStaticMarkup(
      await multipleThemeSetRail({
        setIds: '75446, 75447',
        title: 'Nieuwe sets uit mei 2026',
      }),
    );

    expect(themedRail).toContain('data-rail-surface-variant="themed"');
    expect(multipleThemeRail).toContain('data-rail-surface-variant="default"');
  });

  it('keeps SetRail visible when MDX passes array props as a structured object', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '72050',
        imageUrl: 'https://example.com/72050.jpg',
        name: 'Mario Kart - Baby Peach & Grand Prix Set',
        pieces: 823,
        releaseYear: 2026,
        slug: 'mario-kart-baby-peach-grand-prix-set-72050',
        theme: 'Super Mario',
      },
      {
        id: '72037',
        imageUrl: 'https://example.com/72037.jpg',
        name: 'Mario Kart - Mario & Standard Kart',
        pieces: 1972,
        releaseYear: 2025,
        slug: 'mario-kart-mario-standard-kart-72037',
        theme: 'Super Mario',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: {
          '0': '72050',
          '1': '72037',
        },
        title: 'Mario Kart-sets voor naast de Spiny Shell',
      }),
    );

    expect(markup).toContain('Mario Kart - Baby Peach &amp; Grand Prix Set');
    expect(markup).toContain('Mario Kart - Mario &amp; Standard Kart');
  });

  it('keeps the Editorial Agent SetRail examples aligned with the real MDX API', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const SetRail = getArticleMdxComponents().SetRail as (props: {
      setIds?: readonly string[] | string;
      subtitle?: string;
      title?: string;
    }) => Promise<React.ReactNode>;
    const markup = renderToStaticMarkup(
      await SetRail({
        setIds: ['75446'],
        title: 'Star Wars sets om te volgen',
      }),
    );
    const manifestUsage = editorialAgentArticleComponentManifest.find(
      (item) => item.name === 'SetRail',
    )?.usage;
    const mockOutput = createEditorialAgentMockOutput();

    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
    expect(manifestUsage).toContain(`${editorialAgentSetRailPropName}=`);
    expect(manifestUsage).not.toContain('setNumbers=');
    expect(mockOutput.mdx).toContain(
      `<SetRail title="Mario Kart-sets voor naast de Spiny Shell" ${editorialAgentSetRailPropName}="72050, 72037"`,
    );
    expect(mockOutput.mdx).not.toContain('setNumbers=');
  });

  it('keeps the Editorial Agent SetSpotlightList examples aligned with the real MDX API', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '11506',
        imageUrl: 'https://example.com/11506.jpg',
        name: 'Rocking Plants',
        pieces: 217,
        releaseYear: 2026,
        slug: 'rocking-plants-11506',
        theme: 'Botanicals',
      },
      {
        id: '43301',
        imageUrl: 'https://example.com/43301.jpg',
        name: "Belle's Storytime Horse Carriage",
        pieces: 290,
        releaseYear: 2026,
        slug: 'belles-storytime-horse-carriage-43301',
        theme: 'Disney',
      },
    ]);

    const SetSpotlightList = getArticleMdxComponents()
      .SetSpotlightList as (props: {
      setIds?: readonly string[] | string;
    }) => Promise<React.ReactNode>;
    const markup = renderToStaticMarkup(
      await SetSpotlightList({
        setIds: '11506, 43301',
      }),
    );
    const manifestUsage = editorialAgentArticleComponentManifest.find(
      (item) => item.name === 'SetSpotlightList',
    )?.usage;

    expect(markup).toContain('data-set-spotlight-list="true"');
    expect(manifestUsage).toContain(`${editorialAgentSetRailPropName}="`);
    expect(manifestUsage).not.toContain('setNumbers=');
    expect(manifestUsage).not.toContain(`${editorialAgentSetRailPropName}={[`);
  });

  it('resolves source-set-number variants with a -1 suffix', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446-1'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(listCatalogSetCardsByIds).toHaveBeenCalledWith({
      canonicalIds: ['75446'],
    });
    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
  });

  it('falls back to the generated snapshot when live set-card lookup is empty', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75445'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('Anzellan Starship');
    expect(markup).toContain('/sets/anzellan-starship-75445');
  });

  it('uses the snapshot fallback for source_set_number variants too', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75445-1'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('Anzellan Starship');
  });

  it('keeps available cards visible when some set ids are missing', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75447', '75448'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain('The Razor Crest');
    expect(markup).toContain('SetRail: geen sets gevonden voor 75448');
  });

  it('preserves the requested set order when results come back shuffled', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446', '75447'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup.indexOf('Grogu (Mandalorian Apprentice)')).toBeLessThan(
      markup.indexOf('The Razor Crest'),
    );
  });

  it('shows a helpful fallback in test mode when all set ids are missing', async () => {
    process.env.NODE_ENV = 'test';
    listCatalogSetCardsByIds.mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446', '75447', '75440'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).toContain(
      'SetRail: geen sets gevonden voor 75446, 75447, 75440',
    );
    expect(markup).toContain(
      'Deze selectie vullen we aan zodra de sets live staan in Brickhunt.',
    );
  });

  it('does not show the empty state when matching cards exist', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    const markup = renderToStaticMarkup(
      await renderArticleMdxSetRail({
        setIds: ['75446', '75447'],
        title: 'Star Wars sets om te volgen',
      }),
    );

    expect(markup).not.toContain(
      'Deze selectie vullen we aan zodra de sets live staan in Brickhunt.',
    );
  });

  it('keeps ImageCarousel and SetRail compatible for article MDX usage', async () => {
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);

    const ImageCarousel = getArticleMdxComponents()
      .ImageCarousel as React.ComponentType<{
      images: Array<{ alt: string; src: string }>;
    }>;
    const rail = await renderArticleMdxSetRail({
      setIds: ['75446'],
      title: 'Nieuwe Star Wars sets',
    });
    const markup = renderToStaticMarkup(
      <>
        <ImageCarousel
          images={[
            {
              alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
              src: 'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
            },
            {
              alt: 'LEGO Star Wars The Razor Crest',
              src: 'https://storage.example/article-images/star-wars-day-2026/razor-crest.webp',
            },
          ]}
        />
        {rail}
      </>,
    );

    expect(markup).toContain('Artikelgalerij');
    expect(markup).toContain(
      'https://storage.example/article-images/star-wars-day-2026/grogu.webp',
    );
    expect(markup).toContain('Nieuwe Star Wars sets');
    expect(markup).toContain('Grogu (Mandalorian Apprentice)');
  });

  it('hydrates SetRail with browser-resolved catalog cards when the build fallback is empty', async () => {
    listCatalogSetCardsByIdsForBrowser.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://example.com/75446.jpg',
        name: 'Grogu (Mandalorian Apprentice)',
        pieces: 1200,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
      {
        id: '75447',
        imageUrl: 'https://example.com/75447.jpg',
        name: 'The Razor Crest',
        pieces: 930,
        releaseYear: 2026,
        slug: 'the-razor-crest-75447',
        theme: 'Star Wars',
      },
    ]);

    await act(async () => {
      root.render(
        <ArticleMdxSetRailClient
          canonicalIds={['75446', '75447']}
          initialSetCards={[]}
          subtitle="Nieuwe releases en sets die rond May the 4th extra bewegen."
          title="Nieuwe Star Wars sets"
        />,
      );
    });

    expect(listCatalogSetCardsByIdsForBrowser).toHaveBeenCalledWith({
      canonicalIds: ['75446', '75447'],
    });
    expect(container.textContent).toContain('Nieuwe Star Wars sets');
    expect(container.textContent).toContain('Grogu (Mandalorian Apprentice)');
    expect(container.textContent).toContain('The Razor Crest');
    expect(container.textContent).not.toContain(
      'Deze selectie vullen we aan zodra de sets live staan in Brickhunt.',
    );
  });

  it('shows the production fallback only after browser-side resolution confirms nothing matches', async () => {
    process.env.NODE_ENV = 'production';
    listCatalogSetCardsByIdsForBrowser.mockResolvedValue([]);

    await act(async () => {
      root.render(
        <ArticleMdxSetRailClient
          canonicalIds={['75446', '75447']}
          initialSetCards={[]}
          title="Star Wars sets om te volgen"
        />,
      );
    });

    expect(container.textContent).toContain('Star Wars sets om te volgen');
    expect(container.textContent).toContain(
      'Deze selectie vullen we aan zodra de sets live staan in Brickhunt.',
    );
    expect(container.textContent).not.toContain('SetRail: geen sets gevonden');
  });
});
