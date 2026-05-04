import React, { type ReactNode } from 'react';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { listCatalogCurrentOfferSummariesBySetIds } from '@lego-platform/catalog/data-access-web';
import {
  buildCatalogReleaseLabel,
  getCatalogThemeDisplayName,
  buildCatalogThemeSlug,
} from '@lego-platform/catalog/util';
import {
  editorialAgentSetRailPropName,
  formatSetRailSetIdsForMdx,
} from '@lego-platform/content/util';
import {
  ContentArticleCallout,
  ContentArticleFeaturedSet,
  ContentArticleFaq,
  ContentArticleCard,
  ContentArticleImageGallery,
  ContentArticleSetRail,
} from '@lego-platform/content/ui';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import {
  buildSetDetailPath,
  buildThemePath,
} from '@lego-platform/shared/config';
import { ArticleMdxSetRailClient } from './article-mdx-set-rail-client';
import { ArticleMdxSetSpotlightListClient } from './article-mdx-set-spotlight-list-client';
import { buildCurrentSetCardPriceContext } from './current-set-card-price-context';
import type { ArticleSetSpotlightItem } from './article-mdx-set-spotlight-types';
import {
  normalizeFeaturedSetId,
  normalizeFaqItems,
  normalizeImageCarouselImages,
  normalizeSetRailIds,
} from './article-mdx-embed-normalization';
import {
  getArticleCatalogSetImageUrl,
  resolveCuratedRelatedArticleCatalogSetRail,
  resolveArticleCatalogSetCards,
  resolveArticleCatalogSetCard,
} from './article-catalog-set-resolver';

export {
  normalizeFeaturedSetId,
  normalizeFaqItems,
  normalizeImageCarouselImages,
  normalizeSetRailIds,
} from './article-mdx-embed-normalization';

type ArticleSetRailSurfaceVariant = 'default' | 'themed';

function ThemeLink({
  children,
  theme,
}: {
  children?: ReactNode;
  theme: string;
}) {
  const displayTheme = getCatalogThemeDisplayName(theme) ?? theme;

  return (
    <a href={buildThemePath(buildCatalogThemeSlug(theme))}>
      {children ?? displayTheme}
    </a>
  );
}

async function resolveArticleMdxSetRailSetCards({
  canonicalIds,
}: {
  canonicalIds: readonly string[];
}) {
  return resolveArticleCatalogSetCards({
    canonicalIds,
  });
}

async function resolveArticleMdxFeaturedSet({
  canonicalId,
}: {
  canonicalId: string;
}) {
  const [setCard] = await resolveArticleMdxSetRailSetCards({
    canonicalIds: [canonicalId],
  });

  if (!setCard) {
    return {};
  }

  const pricePanelSnapshot = getFeaturedSetPriceContext(canonicalId);
  let currentOfferSummariesBySetId:
    | Awaited<ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>>
    | undefined;

  try {
    currentOfferSummariesBySetId =
      await listCatalogCurrentOfferSummariesBySetIds({
        setIds: [canonicalId],
      });
  } catch {
    currentOfferSummariesBySetId = undefined;
  }

  return {
    currentOfferSummary: currentOfferSummariesBySetId?.get(canonicalId),
    pricePanelSnapshot,
    setCard,
  };
}

function extractFirstFeaturedSetId(mdx: string): string | undefined {
  const match = mdx.match(
    /<FeaturedSet\b[^>]*\bsetNumber\s*=\s*(?:"([^"]+)"|'([^']+)')/iu,
  );

  return normalizeFeaturedSetId(match?.[1] ?? match?.[2]);
}

function hasAuthoredSetRail(mdx: string): boolean {
  return /<SetRail\b/iu.test(mdx);
}

function insertBeforeConclusion({
  block,
  mdx,
}: {
  block: string;
  mdx: string;
}) {
  const conclusionMatch = mdx.match(/\n## Korte conclusie\b/iu);

  if (!conclusionMatch || typeof conclusionMatch.index !== 'number') {
    return `${mdx.trimEnd()}\n\n${block}\n`;
  }

  return `${mdx.slice(0, conclusionMatch.index).trimEnd()}\n\n${block}\n${mdx.slice(conclusionMatch.index)}`;
}

export async function resolveArticleMdxSourceWithCuratedRelatedSetRail(
  mdx: string,
): Promise<string> {
  if (hasAuthoredSetRail(mdx)) {
    return mdx;
  }

  const featuredSetId = extractFirstFeaturedSetId(mdx);

  if (!featuredSetId) {
    return mdx;
  }

  const featuredSetCard = await resolveArticleCatalogSetCard({
    canonicalId: featuredSetId,
  });

  if (!featuredSetCard) {
    return mdx;
  }

  const curatedRelatedRail = await resolveCuratedRelatedArticleCatalogSetRail({
    featuredSetCard,
  });

  if (!curatedRelatedRail) {
    return mdx;
  }

  const formattedSetIds = formatSetRailSetIdsForMdx(
    curatedRelatedRail.setCards.map((setCard) => setCard.id),
  );

  if (formattedSetIds.split(',').filter(Boolean).length < 2) {
    return mdx;
  }

  return insertBeforeConclusion({
    block: `<SetRail title="${curatedRelatedRail.title}" ${editorialAgentSetRailPropName}="${formattedSetIds}" />`,
    mdx,
  });
}

async function resolveArticleMdxSetSpotlightListItems({
  canonicalIds,
}: {
  canonicalIds: readonly string[];
}): Promise<ArticleSetSpotlightItem[]> {
  const setCards = await resolveArticleMdxSetRailSetCards({
    canonicalIds,
  });
  let currentOfferSummariesBySetId:
    | Awaited<ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>>
    | undefined;

  try {
    currentOfferSummariesBySetId =
      await listCatalogCurrentOfferSummariesBySetIds({
        setIds: canonicalIds,
      });
  } catch {
    currentOfferSummariesBySetId = undefined;
  }

  return setCards.map((setCard) => {
    const pricePanelSnapshot = getFeaturedSetPriceContext(setCard.id);
    const priceContext = buildCurrentSetCardPriceContext({
      currentOfferSummary: currentOfferSummariesBySetId?.get(setCard.id),
      pricePanelSnapshot,
      theme: setCard.theme,
    });
    const fallbackPriceValue = pricePanelSnapshot
      ? formatPriceMinor({
          currencyCode: pricePanelSnapshot.currencyCode,
          minorUnits: pricePanelSnapshot.headlinePriceMinor,
        })
      : undefined;
    const resolvedImageUrl = getArticleCatalogSetImageUrl(setCard);

    return {
      availabilityLabel:
        priceContext?.coverageLabel ?? pricePanelSnapshot?.availabilityLabel,
      ctaHref: buildSetDetailPath(setCard.slug),
      ctaLabel: 'Bekijk set',
      priceValue: priceContext?.currentPrice ?? fallbackPriceValue,
      priceContext,
      setSummary: {
        ...setCard,
        imageUrl: resolvedImageUrl,
        tagline:
          priceContext?.merchantLabel ??
          (pricePanelSnapshot
            ? `${pricePanelSnapshot.merchantCount} winkels gevolgd`
            : setCard.tagline),
      },
    };
  });
}

function resolveArticleSetRailSurfaceVariant({
  articleTheme,
}: {
  articleTheme?: string;
}): ArticleSetRailSurfaceVariant {
  return articleTheme === 'Multiple' ? 'default' : 'themed';
}

export async function renderArticleMdxSetRail({
  articleSlug,
  excludedCanonicalIds = [],
  eyebrow,
  setIds = [],
  subtitle,
  surfaceVariant = 'themed',
  title = 'Sets om nu te volgen',
}: {
  articleSlug?: string;
  excludedCanonicalIds?: readonly string[];
  eyebrow?: string;
  setIds?:
    | readonly string[]
    | Record<string, readonly string[] | string | number | undefined>
    | string;
  subtitle?: string;
  surfaceVariant?: ArticleSetRailSurfaceVariant;
  title?: string;
}): Promise<React.ReactNode> {
  const excludedSetIdSet = new Set(excludedCanonicalIds);
  const canonicalIds = normalizeSetRailIds(setIds).filter(
    (canonicalId) => !excludedSetIdSet.has(canonicalId),
  );

  if (!canonicalIds.length) {
    return null;
  }

  const setCards = await resolveArticleMdxSetRailSetCards({
    canonicalIds,
  });

  return (
    <ArticleMdxSetRailClient
      articleSlug={articleSlug}
      canonicalIds={canonicalIds}
      eyebrow={eyebrow}
      initialSetCards={setCards}
      subtitle={subtitle}
      surfaceVariant={surfaceVariant}
      title={title}
    />
  );
}

export async function renderArticleMdxSetSpotlightList({
  articleDescription,
  articleSlug,
  articleTitle,
  setIds = [],
}: {
  articleDescription?: string;
  articleSlug?: string;
  articleTitle?: string;
  setIds?:
    | readonly string[]
    | Record<string, readonly string[] | string | number | undefined>
    | string;
}): Promise<React.ReactNode> {
  const canonicalIds = normalizeSetRailIds(setIds);

  if (!canonicalIds.length) {
    return null;
  }

  const items = await resolveArticleMdxSetSpotlightListItems({
    canonicalIds,
  });

  if (!items.length) {
    return null;
  }

  return (
    <ArticleMdxSetSpotlightListClient
      articleDescription={articleDescription}
      articleSlug={articleSlug}
      articleTitle={articleTitle}
      items={items}
    />
  );
}

function ImageGallery(props: {
  images?:
    | ReadonlyArray<{
        alt: string;
        caption?: string;
        src: string;
      }>
    | Record<string, { alt: string; caption?: string; src: string }>
    | string;
}) {
  const resolvedImages = normalizeImageCarouselImages(props.images);

  if (!resolvedImages.length) {
    return null;
  }

  return <ContentArticleImageGallery images={resolvedImages} />;
}

function Faq(props: {
  items?:
    | ReadonlyArray<{
        answer: string;
        question: string;
      }>
    | Record<string, { answer: string; question: string }>
    | string;
  title: string;
}) {
  const resolvedItems = normalizeFaqItems(props.items);

  if (!resolvedItems.length) {
    return null;
  }

  return <ContentArticleFaq items={resolvedItems} title={props.title} />;
}

function ArticleCardMdx({
  cardImage,
  cardImageAlt,
  date,
  description,
  heroImage,
  heroImageAlt,
  slug,
  theme,
  title,
  updatedAt,
}: {
  cardImage?: string;
  cardImageAlt?: string;
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt?: string;
  slug: string;
  theme?: string;
  title: string;
  updatedAt?: string;
}) {
  return (
    <ContentArticleCard
      contentArticle={{
        cardImage,
        cardImageAlt: cardImageAlt ?? heroImageAlt ?? title,
        date,
        description,
        heroImage,
        heroImageAlt: heroImageAlt ?? title,
        slug,
        status: 'published',
        theme,
        title,
        updatedAt,
      }}
    />
  );
}

export function getArticleMdxComponents({
  articleDescription,
  articleSlug,
  articleTheme,
  articleTitle,
}: {
  articleDescription?: string;
  articleSlug?: string;
  articleTheme?: string;
  articleTitle?: string;
} = {}): NonNullable<MDXRemoteProps['components']> {
  const usedCanonicalIds = new Set<string>();
  const setRailSurfaceVariant = resolveArticleSetRailSurfaceVariant({
    articleTheme,
  });

  function ThemedCallout({
    children,
    title,
    tone,
  }: {
    children?: ReactNode;
    title?: string;
    tone?: 'accent' | 'default' | 'muted';
  }) {
    return (
      <ContentArticleCallout tone={tone} title={title}>
        {children}
      </ContentArticleCallout>
    );
  }

  async function SetRail(props: {
    eyebrow?: string;
    setIds?:
      | readonly string[]
      | Record<string, readonly string[] | string | number | undefined>
      | string;
    subtitle?: string;
    title?: string;
  }) {
    const requestedCanonicalIds = normalizeSetRailIds(props.setIds);
    const uniqueCanonicalIds = requestedCanonicalIds.filter(
      (canonicalId) => !usedCanonicalIds.has(canonicalId),
    );
    const railNode = await renderArticleMdxSetRail({
      articleSlug,
      eyebrow: props.eyebrow,
      excludedCanonicalIds: [...usedCanonicalIds],
      setIds: uniqueCanonicalIds,
      subtitle: props.subtitle,
      surfaceVariant: setRailSurfaceVariant,
      title: props.title,
    });

    for (const canonicalId of uniqueCanonicalIds) {
      usedCanonicalIds.add(canonicalId);
    }

    return railNode;
  }

  async function SetSpotlightList(props: {
    setIds?:
      | readonly string[]
      | Record<string, readonly string[] | string | number | undefined>
      | string;
  }) {
    return renderArticleMdxSetSpotlightList({
      articleDescription,
      articleSlug,
      articleTitle,
      setIds: props.setIds,
    });
  }

  async function FeaturedSet(props: { setNumber?: string }) {
    const canonicalId = normalizeFeaturedSetId(props.setNumber);

    if (!canonicalId) {
      return null;
    }

    const { currentOfferSummary, pricePanelSnapshot, setCard } =
      await resolveArticleMdxFeaturedSet({
        canonicalId,
      });

    if (!setCard) {
      return process.env.NODE_ENV === 'production' ? null : (
        <ContentArticleSetRail
          emptyMessage={`FeaturedSet: geen set gevonden voor ${canonicalId}`}
          title="Uitgelichte set"
        />
      );
    }

    usedCanonicalIds.add(canonicalId);

    const priceContext = buildCurrentSetCardPriceContext({
      currentOfferSummary,
      pricePanelSnapshot,
      theme: setCard.theme,
    });
    const releaseLabel = buildCatalogReleaseLabel({
      releaseDate: setCard.releaseDate,
      releaseDatePrecision: setCard.releaseDatePrecision,
      releaseYear: setCard.releaseYear,
      variant: 'detail',
    })?.value;
    const fallbackPriceValue = pricePanelSnapshot
      ? formatPriceMinor({
          currencyCode: pricePanelSnapshot.currencyCode,
          minorUnits: pricePanelSnapshot.headlinePriceMinor,
        })
      : undefined;

    return (
      <ContentArticleFeaturedSet
        availabilityLabel={
          priceContext?.coverageLabel ??
          pricePanelSnapshot?.availabilityLabel ??
          setCard.availability
        }
        ctaHref={buildSetDetailPath(setCard.slug)}
        articleSlug={articleSlug}
        imageAlt={`${setCard.name} LEGO-set`}
        imageUrl={getArticleCatalogSetImageUrl(setCard)}
        name={setCard.name}
        pieces={setCard.pieces}
        priceLabel={priceContext ? 'Beste prijs nu' : 'Laagste bekende prijs'}
        priceSupportingCopy={
          priceContext?.merchantLabel ??
          (pricePanelSnapshot
            ? `${pricePanelSnapshot.merchantCount} winkels gevolgd`
            : undefined)
        }
        priceValue={priceContext?.currentPrice ?? fallbackPriceValue}
        releaseLabel={releaseLabel}
        setNumber={setCard.id}
        theme={setCard.theme}
        themeHref={buildThemePath(buildCatalogThemeSlug(setCard.theme))}
      />
    );
  }

  return {
    ArticleCard: ArticleCardMdx,
    Callout: ThemedCallout,
    Faq,
    FAQAccordion: Faq,
    FeaturedSet,
    ImageCarousel: ImageGallery,
    ImageGallery,
    SetSpotlightList,
    SetRail,
    ThemeLink,
  };
}
