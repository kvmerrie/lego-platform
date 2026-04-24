import type { ReactNode } from 'react';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import {
  CatalogSetCard,
  CatalogSetCardCollection,
} from '@lego-platform/catalog/ui';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access-web';
import {
  ContentArticleCallout,
  ContentArticleCard,
} from '@lego-platform/content/ui';
import {
  buildSetDetailPath,
  buildThemePath,
} from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';

function ThemeLink({
  children,
  theme,
}: {
  children?: ReactNode;
  theme: string;
}) {
  return (
    <a href={buildThemePath(buildCatalogThemeSlug(theme))}>
      {children ?? theme}
    </a>
  );
}

async function SetRail({
  setIds = [],
  subtitle,
  title = 'Sets om nu te volgen',
}: {
  setIds?: readonly string[];
  subtitle?: string;
  title?: string;
}) {
  if (!setIds.length) {
    return null;
  }

  const setCards = await listCatalogSetCardsByIds({
    canonicalIds: setIds,
  });

  if (!setCards.length) {
    return null;
  }

  return (
    <section aria-label={title}>
      <SectionHeading
        description={subtitle}
        eyebrow="Setselectie"
        title={title}
        titleAs="h2"
      />
      <CatalogSetCardCollection
        gridMode="tiles"
        layout="grid"
        style={{ marginTop: 'var(--lego-space-4)' }}
        variant="compact"
      >
        {setCards.map((setCard) => (
          <CatalogSetCard
            href={buildSetDetailPath(setCard.slug)}
            key={setCard.id}
            setSummary={setCard}
            variant="compact"
          />
        ))}
      </CatalogSetCardCollection>
    </section>
  );
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

export function getArticleMdxComponents(): NonNullable<
  MDXRemoteProps['components']
> {
  return {
    ArticleCard: ArticleCardMdx,
    Callout: ContentArticleCallout,
    SetRail,
    ThemeLink,
  };
}
