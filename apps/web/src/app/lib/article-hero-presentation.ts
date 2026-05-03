import { cache } from 'react';
import {
  extractArticleHeroSetNumberCandidatesFromBody,
  type ContentArticle,
  type ContentArticleListItem,
} from '@lego-platform/content/util';
import {
  getThemeTileImage,
  isCatalogBrowsablePrimaryTheme,
} from '@lego-platform/catalog/util';
import {
  getArticleCatalogSetImageUrl,
  resolveRepresentativeArticleCatalogSetCardByTheme,
  resolveArticleCatalogSetCards,
} from './article-catalog-set-resolver';

export interface ResolvedArticleHeroPresentation {
  imageAlt: string;
  imageUrl: string;
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
      };
    }

    const embeddedSetNumberCandidates = [
      ...(bodySource
        ? extractArticleHeroSetNumberCandidatesFromBody(bodySource)
        : []),
      ...(primarySetNumber ? [primarySetNumber] : []),
    ];
    const uniqueEmbeddedSetNumberCandidates = [
      ...new Set(embeddedSetNumberCandidates),
    ];

    if (uniqueEmbeddedSetNumberCandidates.length) {
      const [firstResolvableSetCard] = await resolveArticleCatalogSetCards({
        canonicalIds: uniqueEmbeddedSetNumberCandidates,
      });
      const firstResolvableSetImageUrl = getArticleCatalogSetImageUrl(
        firstResolvableSetCard,
      );

      if (firstResolvableSetCard && firstResolvableSetImageUrl) {
        return {
          imageAlt: `${firstResolvableSetCard.name || theme || title} LEGO-set`,
          imageUrl: firstResolvableSetImageUrl,
        };
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
        };
      }
    }

    const themeTileSetNumber = theme ? getThemeTileImage(theme) : undefined;

    if (!themeTileSetNumber) {
      return undefined;
    }

    const [themeTileSetCard] = await resolveArticleCatalogSetCards({
      canonicalIds: [themeTileSetNumber],
    });
    const themeTileSetImageUrl = getArticleCatalogSetImageUrl(themeTileSetCard);

    return themeTileSetCard && themeTileSetImageUrl
      ? {
          imageAlt: `${themeTileSetCard.name || theme || title} LEGO-set`,
          imageUrl: themeTileSetImageUrl,
        }
      : undefined;
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
