import { cache } from 'react';
import {
  type ContentArticle,
  type ContentArticleHeroImageSource,
  type ContentArticleListItem,
  normalizeContentArticleSetNumber,
} from '@lego-platform/content/util';
import { isCatalogBrowsablePrimaryTheme } from '@lego-platform/catalog/util';
import {
  getArticleCatalogSetImageUrl,
  resolveRepresentativeArticleCatalogSetCardByTheme,
  resolveArticleCatalogSetCards,
} from './article-catalog-set-resolver';

export interface ResolvedArticleHeroPresentation {
  imageAlt: string;
  imageUrl: string;
  source: ContentArticleHeroImageSource;
}

const NON_REPRESENTATIVE_THEME_LABELS = new Set([
  'multiple',
  'other',
  'unknown',
]);

function canUseRepresentativeThemeFallback(theme?: string): theme is string {
  const normalizedTheme = theme?.trim().toLowerCase();

  return Boolean(
    normalizedTheme &&
      !NON_REPRESENTATIVE_THEME_LABELS.has(normalizedTheme) &&
      isCatalogBrowsablePrimaryTheme(theme),
  );
}

interface ArticleHeroSetCandidate {
  setNumber: string;
  source: Extract<
    ContentArticleHeroImageSource,
    'featuredSet' | 'spotlight' | 'rail'
  >;
}

function readFirstMdxComponentSetNumberCandidates({
  bodySource,
  componentName,
  source,
}: {
  bodySource: string;
  componentName: 'FeaturedSet' | 'SetSpotlightList' | 'SetRail';
  source: ArticleHeroSetCandidate['source'];
}): ArticleHeroSetCandidate[] {
  const componentMatch = bodySource.match(
    new RegExp(`<${componentName}\\b[^>]*>`, 'iu'),
  );

  if (!componentMatch) {
    return [];
  }

  const componentSource = componentMatch[0];
  const singleSetMatch = componentSource.match(
    /<FeaturedSet\b[^>]*\bsetNumber\s*=\s*(?:"([^"]+)"|'([^']+)')/u,
  );

  if (singleSetMatch) {
    const setNumber = normalizeContentArticleSetNumber(
      singleSetMatch[1] ?? singleSetMatch[2],
    );

    return setNumber ? [{ setNumber, source }] : [];
  }

  const setIdsMatch = componentSource.match(
    /\bsetIds\s*=\s*(?:"([^"]+)"|'([^']+)')/u,
  );

  return (setIdsMatch?.[1] ?? setIdsMatch?.[2] ?? '')
    .split(',')
    .map(normalizeContentArticleSetNumber)
    .filter((setNumber): setNumber is string => Boolean(setNumber))
    .map((setNumber) => ({ setNumber, source }));
}

function extractArticleHeroSetCandidatesFromBody(
  bodySource: string,
): ArticleHeroSetCandidate[] {
  const candidates = [
    ...readFirstMdxComponentSetNumberCandidates({
      bodySource,
      componentName: 'FeaturedSet',
      source: 'featuredSet',
    }),
    ...readFirstMdxComponentSetNumberCandidates({
      bodySource,
      componentName: 'SetSpotlightList',
      source: 'spotlight',
    }),
    ...readFirstMdxComponentSetNumberCandidates({
      bodySource,
      componentName: 'SetRail',
      source: 'rail',
    }),
  ];
  const seenSetNumbers = new Set<string>();

  return candidates.filter((candidate) => {
    if (seenSetNumbers.has(candidate.setNumber)) {
      return false;
    }

    seenSetNumbers.add(candidate.setNumber);
    return true;
  });
}

const resolveArticleHeroPresentationCached = cache(
  async (
    bodySource: string | undefined,
    heroImage: string | undefined,
    heroImageAlt: string,
    primarySetNumber: string | undefined,
    theme: string | undefined,
    title: string,
  ): Promise<ResolvedArticleHeroPresentation | undefined> => {
    if (heroImage) {
      return {
        imageAlt: heroImageAlt || title,
        imageUrl: heroImage,
        source: 'manual',
      };
    }

    const embeddedSetNumberCandidates = [
      ...(bodySource
        ? extractArticleHeroSetCandidatesFromBody(bodySource)
        : []),
      ...(primarySetNumber
        ? [
            {
              setNumber: primarySetNumber,
              source: 'featuredSet' as const,
            },
          ]
        : []),
    ];
    const uniqueEmbeddedSetNumberCandidates =
      embeddedSetNumberCandidates.filter(
        (candidate, index, candidates) =>
          candidates.findIndex(
            (otherCandidate) =>
              otherCandidate.setNumber === candidate.setNumber,
          ) === index,
      );

    if (uniqueEmbeddedSetNumberCandidates.length) {
      const candidateSetCards = await Promise.all(
        uniqueEmbeddedSetNumberCandidates.map(async (candidate) => {
          const [setCard] = await resolveArticleCatalogSetCards({
            canonicalIds: [candidate.setNumber],
          });

          return { candidate, setCard };
        }),
      );

      for (const { candidate, setCard } of candidateSetCards) {
        const setImageUrl = getArticleCatalogSetImageUrl(setCard);

        if (setCard && setImageUrl) {
          return {
            imageAlt: `${setCard.name || theme || title} LEGO-set`,
            imageUrl: setImageUrl,
            source: candidate.source,
          };
        }
      }
    }

    if (canUseRepresentativeThemeFallback(theme)) {
      const representativeSetCard =
        await resolveRepresentativeArticleCatalogSetCardByTheme({
          theme,
        });
      const representativeSetImageUrl = getArticleCatalogSetImageUrl(
        representativeSetCard,
      );

      if (representativeSetCard && representativeSetImageUrl) {
        return {
          imageAlt: `${representativeSetCard.name || theme || title} LEGO-set`,
          imageUrl: representativeSetImageUrl,
          source: 'representativeThemeSet',
        };
      }
    }

    return undefined;
  },
);

export function resolveArticleHeroPresentation(
  contentArticle: Pick<
    ContentArticle | ContentArticleListItem,
    | 'bodySource'
    | 'heroImage'
    | 'heroImageAlt'
    | 'primarySetNumber'
    | 'theme'
    | 'title'
  >,
): Promise<ResolvedArticleHeroPresentation | undefined> {
  return resolveArticleHeroPresentationCached(
    contentArticle.bodySource,
    contentArticle.heroImage,
    contentArticle.heroImageAlt,
    contentArticle.primarySetNumber,
    contentArticle.theme,
    contentArticle.title,
  );
}
