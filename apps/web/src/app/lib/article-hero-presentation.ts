import { cache } from 'react';
import type { ContentArticle } from '@lego-platform/content/util';
import {
  resolveArticleCatalogSetCard,
  getArticleCatalogSetImageUrl,
} from './article-catalog-set-resolver';

export interface ResolvedArticleHeroPresentation {
  imageAlt: string;
  imageUrl: string;
}

const resolveArticleHeroPresentationCached = cache(
  async (
    heroImage: string | undefined,
    heroImageAlt: string,
    primarySetNumber: string | undefined,
    title: string,
  ): Promise<ResolvedArticleHeroPresentation | undefined> => {
    if (heroImage) {
      return {
        imageAlt: heroImageAlt || title,
        imageUrl: heroImage,
      };
    }

    if (!primarySetNumber) {
      return undefined;
    }

    const primarySetCard = await resolveArticleCatalogSetCard({
      canonicalId: primarySetNumber,
    });
    const primarySetImageUrl = getArticleCatalogSetImageUrl(primarySetCard);

    if (!primarySetCard || !primarySetImageUrl) {
      return undefined;
    }

    return {
      imageAlt: `${primarySetCard.name} LEGO-set`,
      imageUrl: primarySetImageUrl,
    };
  },
);

export function resolveArticleHeroPresentation(
  contentArticle: Pick<
    ContentArticle,
    'heroImage' | 'heroImageAlt' | 'primarySetNumber' | 'title'
  >,
): Promise<ResolvedArticleHeroPresentation | undefined> {
  return resolveArticleHeroPresentationCached(
    contentArticle.heroImage,
    contentArticle.heroImageAlt,
    contentArticle.primarySetNumber,
    contentArticle.title,
  );
}
