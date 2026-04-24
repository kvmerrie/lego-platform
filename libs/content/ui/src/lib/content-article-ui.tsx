import type { ReactNode } from 'react';
import {
  buildWebPath,
  buildArticlePath,
  webPathnames,
} from '@lego-platform/shared/config';
import { Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
import {
  formatContentArticleDate,
  type ContentArticle,
  type ContentArticleListItem,
} from '@lego-platform/content/util';
import styles from './content-article-ui.module.css';

function ContentArticleImage({
  alt,
  fallbackLabel,
  imageUrl,
  priority = false,
}: {
  alt: string;
  fallbackLabel: string;
  imageUrl?: string;
  priority?: boolean;
}) {
  if (imageUrl) {
    return (
      <div className={styles.imageFrame}>
        <img
          alt={alt}
          className={styles.image}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          src={imageUrl}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.imageFrame} ${styles.imageFallback}`}>
      <Badge tone="accent">{fallbackLabel}</Badge>
      <p className={styles.imageFallbackText}>
        Beeld volgt nog. De inhoud staat al klaar.
      </p>
    </div>
  );
}

function ContentArticleMeta({
  contentArticle,
}: {
  contentArticle: Pick<ContentArticleListItem, 'date' | 'theme' | 'updatedAt'>;
}) {
  return (
    <div className={styles.metaRow}>
      <time className={styles.metaText} dateTime={contentArticle.date}>
        {formatContentArticleDate(contentArticle.date)}
      </time>
      {contentArticle.updatedAt ? (
        <time className={styles.metaText} dateTime={contentArticle.updatedAt}>
          Bijgewerkt {formatContentArticleDate(contentArticle.updatedAt)}
        </time>
      ) : null}
      {contentArticle.theme ? (
        <Badge tone="info">{contentArticle.theme}</Badge>
      ) : null}
    </div>
  );
}

export function ContentArticleCard({
  contentArticle,
}: {
  contentArticle: ContentArticleListItem;
}) {
  return (
    <Surface as="article" className={styles.card} elevation="rested">
      <a
        className={styles.cardLink}
        href={buildArticlePath(contentArticle.slug)}
      >
        <ContentArticleImage
          alt={contentArticle.cardImageAlt}
          fallbackLabel={contentArticle.theme ?? 'Artikel'}
          imageUrl={contentArticle.cardImage}
        />
        <div className={styles.cardBody}>
          <ContentArticleMeta contentArticle={contentArticle} />
          <h3 className={styles.cardTitle}>{contentArticle.title}</h3>
          <p className={styles.cardDescription}>{contentArticle.description}</p>
        </div>
      </a>
    </Surface>
  );
}

export function ContentArticleGrid({
  contentArticles,
}: {
  contentArticles: readonly ContentArticleListItem[];
}) {
  return (
    <div className={styles.cardGrid}>
      {contentArticles.map((contentArticle) => (
        <ContentArticleCard
          contentArticle={contentArticle}
          key={contentArticle.slug}
        />
      ))}
    </div>
  );
}

export function ContentArticleRail({
  contentArticles,
  maxItems,
  subtitle,
  title,
}: {
  contentArticles: readonly ContentArticleListItem[];
  maxItems?: number;
  subtitle?: string;
  title: string;
}) {
  const visibleArticles =
    typeof maxItems === 'number'
      ? contentArticles.slice(0, maxItems)
      : contentArticles;

  if (!visibleArticles.length) {
    return null;
  }

  return (
    <section className={styles.rail} aria-label={title}>
      <SectionHeading
        description={subtitle}
        eyebrow="Artikelen"
        title={title}
        titleAs="h2"
      />
      <ContentArticleGrid contentArticles={visibleArticles} />
    </section>
  );
}

export function ContentArticleCallout({
  children,
  title,
  tone = 'accent',
}: {
  children: ReactNode;
  title?: string;
  tone?: 'accent' | 'default' | 'muted';
}) {
  return (
    <Surface as="aside" className={styles.callout} tone={tone}>
      {title ? <h3 className={styles.calloutTitle}>{title}</h3> : null}
      <div className={styles.calloutBody}>{children}</div>
    </Surface>
  );
}

export function ContentArticlePage({
  body,
  contentArticle,
}: {
  body: ReactNode;
  contentArticle: ContentArticle;
}) {
  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <ContentArticleImage
          alt={contentArticle.heroImageAlt}
          fallbackLabel={contentArticle.theme ?? 'Artikel'}
          imageUrl={contentArticle.heroImage}
          priority
        />
        <div className={styles.heroContent}>
          <a
            className={styles.backLink}
            href={buildWebPath(webPathnames.articles)}
          >
            Terug naar artikelen
          </a>
          <ContentArticleMeta contentArticle={contentArticle} />
          <h1 className={styles.pageTitle}>{contentArticle.title}</h1>
          <p className={styles.pageDescription}>{contentArticle.description}</p>
        </div>
      </header>
      <div className={styles.prose}>{body}</div>
    </article>
  );
}
