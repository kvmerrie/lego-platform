import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  getArticleMdxComponents,
  resolveArticleMdxSourceWithCuratedRelatedSetRail,
} from '../../../lib/article-mdx-components';
import { resolveArticleHeroPresentation } from '../../../lib/article-hero-presentation';
import { getArticlePreviewById } from '@lego-platform/content/data-access';
import {
  getCatalogThemeDefinition,
  getCatalogThemeMutedTextColor,
  getCatalogThemeSurfaceTone,
} from '@lego-platform/catalog/util';
import { ContentArticlePage } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  isArticlePreviewEnabled,
  webPathnames,
} from '@lego-platform/shared/config';
import React, { type CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ previewId: string }>;
}): Promise<Metadata> {
  if (!isArticlePreviewEnabled()) {
    return {
      robots: {
        follow: false,
        index: false,
      },
    };
  }

  const { previewId } = await params;
  const contentArticle = await getArticlePreviewById({ previewId });

  return {
    robots: {
      follow: false,
      index: false,
    },
    title: contentArticle ? `Preview: ${contentArticle.title}` : 'Preview',
  };
}

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ previewId: string }>;
}) {
  if (!isArticlePreviewEnabled()) {
    notFound();
  }

  const { previewId } = await params;
  const contentArticle = await getArticlePreviewById({ previewId });

  if (!contentArticle) {
    notFound();
  }

  const resolvedHeroPresentation =
    await resolveArticleHeroPresentation(contentArticle);
  const articleWithResolvedHero = resolvedHeroPresentation
    ? {
        ...contentArticle,
        heroImage: resolvedHeroPresentation.imageUrl,
        heroImageAlt: resolvedHeroPresentation.imageAlt,
        heroImageSource: resolvedHeroPresentation.source,
      }
    : {
        ...contentArticle,
        heroImage: undefined,
      };
  const themeDefinition = getCatalogThemeDefinition(
    articleWithResolvedHero.theme,
  );
  const resolvedThemeLabel =
    themeDefinition?.name ?? articleWithResolvedHero.theme;
  const themeHref = themeDefinition
    ? buildThemePath(themeDefinition.slug)
    : undefined;
  const themePresentation =
    resolvedThemeLabel || themeHref || themeDefinition?.visual
      ? {
          href: themeHref,
          label: resolvedThemeLabel,
          style:
            themeDefinition?.visual.backgroundColor ||
            themeDefinition?.visual.textColor
              ? ({
                  ...(themeDefinition.visual.backgroundColor
                    ? {
                        '--article-theme-accent':
                          themeDefinition.visual.backgroundColor,
                        '--article-theme-surface':
                          themeDefinition.visual.backgroundColor,
                        '--catalog-theme-badge-surface':
                          themeDefinition.visual.backgroundColor,
                      }
                    : {}),
                  ...(themeDefinition.visual.textColor
                    ? {
                        '--article-theme-accent-text':
                          themeDefinition.visual.textColor,
                        '--article-theme-surface-text':
                          themeDefinition.visual.textColor,
                        '--article-theme-muted-text':
                          getCatalogThemeMutedTextColor(
                            themeDefinition.visual.textColor,
                          ),
                        '--catalog-theme-badge-text':
                          themeDefinition.visual.textColor,
                      }
                    : {}),
                } as CSSProperties)
              : undefined,
          tone: getCatalogThemeSurfaceTone(resolvedThemeLabel),
        }
      : undefined;
  const breadcrumbs = [
    {
      href: buildWebPath(webPathnames.articles),
      id: 'articles',
      label: 'Artikelen',
    },
    {
      id: `article-preview-${previewId}`,
      label: `Preview: ${articleWithResolvedHero.title}`,
    },
  ];
  const articleBodySource =
    await resolveArticleMdxSourceWithCuratedRelatedSetRail(
      articleWithResolvedHero.bodySource,
    );

  return (
    <ShellWeb>
      <ContentArticlePage
        breadcrumbs={breadcrumbs}
        body={
          <MDXRemote
            components={getArticleMdxComponents({
              articleDescription: articleWithResolvedHero.description,
              articleSlug: articleWithResolvedHero.slug,
              articleTheme: articleWithResolvedHero.theme,
              articleTitle: articleWithResolvedHero.title,
            })}
            source={articleBodySource}
          />
        }
        contentArticle={articleWithResolvedHero}
        relatedArticles={[]}
        themePresentation={themePresentation}
      />
    </ShellWeb>
  );
}
