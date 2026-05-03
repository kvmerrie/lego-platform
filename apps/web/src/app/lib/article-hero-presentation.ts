import { cache } from 'react';
import {
  extractArticleHeroSetNumberCandidatesFromBody,
  type ContentArticle,
  type ContentArticleListItem,
} from '@lego-platform/content/util';
import { getThemeTileImage } from '@lego-platform/catalog/util';
import {
  getArticleCatalogSetImageUrl,
  resolveArticleCatalogSetCards,
} from './article-catalog-set-resolver';

export interface ResolvedArticleHeroPresentation {
  imageAlt: string;
  imageUrl: string;
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

    const setNumberCandidates = [
      ...(bodySource
        ? extractArticleHeroSetNumberCandidatesFromBody(bodySource)
        : []),
      ...(primarySetNumber ? [primarySetNumber] : []),
      ...(theme
        ? [getThemeTileImage(theme)].filter((setNumber): setNumber is string =>
            Boolean(setNumber),
          )
        : []),
    ];
    const uniqueSetNumberCandidates = [...new Set(setNumberCandidates)];

    if (!uniqueSetNumberCandidates.length) {
      return undefined;
    }

    const [firstResolvableSetCard] = await resolveArticleCatalogSetCards({
      canonicalIds: uniqueSetNumberCandidates,
    });
    const firstResolvableSetImageUrl = getArticleCatalogSetImageUrl(
      firstResolvableSetCard,
    );

    if (!firstResolvableSetCard || !firstResolvableSetImageUrl) {
      return undefined;
    }

    return {
      imageAlt: `${firstResolvableSetCard.name || theme || title} LEGO-set`,
      imageUrl: firstResolvableSetImageUrl,
    };
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
