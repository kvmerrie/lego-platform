import type { CSSProperties, ReactNode } from 'react';
import {
  buildWebPath,
  buildArticlePath,
  webPathnames,
} from '@lego-platform/shared/config';
import {
  Badge,
  Breadcrumbs,
  type BreadcrumbItem,
  type CarouselImage,
  ImageGallery,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import {
  formatContentArticleDate,
  normalizePublicContentArticleTheme,
  type ContentArticle,
  type ContentArticleListItem,
} from '@lego-platform/content/util';
import {
  ContentArticleLink,
  ContentArticleSetActionLink,
  ContentArticleSetLink,
} from './content-article-link';
import styles from './content-article-ui.module.css';

function joinClasses(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

function normalizeArticleThemeKey(theme?: string): string | undefined {
  if (!theme) {
    return undefined;
  }

  return theme
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

export interface ContentArticleThemePresentation {
  href?: string;
  label?: string;
  style?: CSSProperties;
  tone?: 'dark' | 'light';
}

export interface ContentArticleFeaturedSetProps {
  articleSlug?: string;
  availabilityLabel?: string;
  ctaHref: string;
  ctaLabel?: string;
  imageAlt: string;
  imageUrl?: string;
  name: string;
  pieces?: number;
  priceLabel?: string;
  priceSupportingCopy?: string;
  priceValue?: string;
  releaseLabel?: string;
  setNumber: string;
  theme?: string;
  themeHref?: string;
}

export interface ContentArticleSetSpotlightSection {
  body: ReactNode;
  description?: string;
  highlightSetNumber?: string;
  id: string;
  layoutVariant?: 'single' | 'pair' | 'trio' | 'cluster';
  title: string;
}

function ContentArticleImage({
  alt,
  fallbackLabel,
  imageUrl,
  kind = 'card',
  priority = false,
}: {
  alt: string;
  fallbackLabel: string;
  imageUrl?: string;
  kind?: 'card' | 'featured' | 'hero' | 'spotlight';
  priority?: boolean;
}) {
  const imageFrameClassName = [
    styles.imageFrame,
    kind === 'hero'
      ? styles.heroImageFrame
      : kind === 'spotlight'
        ? styles.spotlightSetImageFrame
        : kind === 'featured'
          ? styles.featuredSetImageFrame
          : styles.cardImageFrame,
  ].join(' ');
  const imageClassName = joinClasses(
    styles.image,
    kind === 'hero'
      ? styles.heroImage
      : kind === 'spotlight'
        ? styles.spotlightSetImage
        : kind === 'featured'
          ? styles.featuredSetImage
          : styles.cardImage,
  );

  if (imageUrl) {
    return (
      <div className={imageFrameClassName}>
        <img
          alt={alt}
          className={imageClassName}
          data-article-image-fit={
            kind === 'hero' || kind === 'featured' || kind === 'spotlight'
              ? 'contain'
              : 'cover'
          }
          data-article-image-kind={kind}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          src={imageUrl}
        />
      </div>
    );
  }

  return (
    <div className={`${imageFrameClassName} ${styles.imageFallback}`}>
      <Badge tone="accent">{fallbackLabel}</Badge>
      <p className={styles.imageFallbackText}>
        Beeld volgt nog. De inhoud staat al klaar.
      </p>
    </div>
  );
}

function ContentArticleMeta({
  contentArticle,
  themePresentation,
}: {
  contentArticle: Pick<ContentArticleListItem, 'date' | 'theme' | 'updatedAt'>;
  themePresentation?: ContentArticleThemePresentation;
}) {
  const resolvedThemeLabel = normalizePublicContentArticleTheme(
    themePresentation?.label ?? contentArticle.theme,
  );

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
      {resolvedThemeLabel ? (
        themePresentation?.href ? (
          <a className={styles.themeBadgeLink} href={themePresentation.href}>
            <span
              className={styles.themeBadgeShell}
              style={themePresentation.style}
            >
              <Badge className={styles.themeBadge} tone="neutral">
                {resolvedThemeLabel}
              </Badge>
            </span>
          </a>
        ) : (
          <span
            className={styles.themeBadgeShell}
            style={themePresentation?.style}
          >
            <Badge className={styles.themeBadge} tone="neutral">
              {resolvedThemeLabel}
            </Badge>
          </span>
        )
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
      <ContentArticleLink
        className={styles.cardLink}
        href={buildArticlePath(contentArticle.slug)}
        slug={contentArticle.slug}
        theme={contentArticle.theme}
      >
        <ContentArticleImage
          alt={contentArticle.cardImageAlt}
          fallbackLabel={
            normalizePublicContentArticleTheme(contentArticle.theme) ??
            'Artikel'
          }
          imageUrl={contentArticle.cardImage ?? contentArticle.heroImage}
        />
        <div className={styles.cardBody}>
          <ContentArticleMeta contentArticle={contentArticle} />
          <h3 className={styles.cardTitle}>{contentArticle.title}</h3>
          <p className={styles.cardDescription}>{contentArticle.description}</p>
        </div>
      </ContentArticleLink>
    </Surface>
  );
}

export function ContentArticleFeaturedCard({
  contentArticle,
}: {
  contentArticle: ContentArticleListItem;
}) {
  return (
    <Surface as="article" className={styles.featuredArticle} elevation="rested">
      <ContentArticleLink
        className={styles.featuredArticleLink}
        href={buildArticlePath(contentArticle.slug)}
        slug={contentArticle.slug}
        theme={contentArticle.theme}
      >
        <ContentArticleImage
          alt={contentArticle.heroImageAlt ?? contentArticle.cardImageAlt}
          fallbackLabel={
            normalizePublicContentArticleTheme(contentArticle.theme) ??
            'Artikel'
          }
          imageUrl={contentArticle.heroImage ?? contentArticle.cardImage}
          kind="featured"
          priority
        />
        <div className={styles.featuredArticleBody}>
          <ContentArticleMeta contentArticle={contentArticle} />
          <h2 className={styles.featuredArticleTitle}>
            {contentArticle.title}
          </h2>
          <p className={styles.featuredArticleDescription}>
            {contentArticle.description}
          </p>
        </div>
      </ContentArticleLink>
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
  className,
  contentArticles,
  maxItems,
  subtitle,
  title,
}: {
  className?: string;
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
    <section className={joinClasses(styles.rail, className)} aria-label={title}>
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
  className,
  title,
  tone = 'accent',
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  tone?: 'accent' | 'default' | 'muted';
}) {
  return (
    <Surface
      as="aside"
      className={joinClasses(styles.callout, className)}
      data-article-layout="prose-block"
      tone={tone}
    >
      {title ? <h3 className={styles.calloutTitle}>{title}</h3> : null}
      <div className={styles.calloutBody}>{children}</div>
    </Surface>
  );
}

export function ContentArticleSetRail({
  children,
  debugMessage,
  emptyMessage,
  subtitle,
  title,
}: {
  children?: ReactNode;
  debugMessage?: string;
  emptyMessage?: string;
  subtitle?: string;
  title: string;
}) {
  if (!children && !debugMessage && !emptyMessage) {
    return null;
  }

  return (
    <section
      aria-label={title}
      className={joinClasses(styles.embeddedRail, styles.wideBlock)}
      data-article-layout="wide-block"
      data-article-module="set-rail"
      data-article-width="commerce-rail"
    >
      <Surface
        className={styles.embeddedRailSurface}
        elevation="rested"
        tone="muted"
      >
        <SectionHeading
          description={subtitle}
          eyebrow="Setselectie"
          title={title}
          titleAs="h2"
        />
        {debugMessage ? (
          <p className={styles.embeddedRailDebug} role="status">
            {debugMessage}
          </p>
        ) : null}
        {!children && emptyMessage ? (
          <p className={styles.embeddedRailEmpty}>{emptyMessage}</p>
        ) : null}
        {children ? (
          <div className={styles.embeddedRailBody}>{children}</div>
        ) : null}
      </Surface>
    </section>
  );
}

export function ContentArticleFeaturedSet({
  articleSlug,
  availabilityLabel,
  ctaHref,
  ctaLabel = 'Bekijk set',
  imageAlt,
  imageUrl,
  name,
  pieces,
  priceLabel,
  priceSupportingCopy,
  priceValue,
  releaseLabel,
  setNumber,
  theme,
  themeHref,
}: ContentArticleFeaturedSetProps) {
  const visibleTheme = normalizePublicContentArticleTheme(theme);
  const hasMetaFacts =
    Boolean(visibleTheme) ||
    typeof pieces === 'number' ||
    Boolean(releaseLabel);
  const hasCommercePanel =
    Boolean(priceValue) ||
    Boolean(priceSupportingCopy) ||
    Boolean(availabilityLabel);

  return (
    <section
      aria-label={`${name} uitgelicht`}
      className={joinClasses(styles.featuredSetBlock, styles.mediaBlock)}
      data-article-layout="media-block"
      data-article-module="featured-set"
      data-article-width="editorial-media"
      data-featured-set="true"
    >
      <Surface
        as="article"
        className={styles.featuredSet}
        elevation="rested"
        tone="muted"
      >
        <ContentArticleSetLink
          articleSlug={articleSlug}
          className={styles.featuredSetVisualLink}
          href={ctaHref}
          setId={setNumber}
          setName={name}
        >
          <ContentArticleImage
            alt={imageAlt}
            fallbackLabel={visibleTheme ?? 'Set'}
            imageUrl={imageUrl}
            kind="featured"
          />
        </ContentArticleSetLink>

        <div className={styles.featuredSetContent}>
          <div className={styles.featuredSetHeader}>
            <div className={styles.featuredSetBadges}>
              <Badge tone="neutral">Set {setNumber}</Badge>
              {visibleTheme ? (
                themeHref ? (
                  <a className={styles.featuredSetThemeLink} href={themeHref}>
                    <Badge tone="accent">{visibleTheme}</Badge>
                  </a>
                ) : (
                  <Badge tone="accent">{visibleTheme}</Badge>
                )
              ) : null}
            </div>
            <h2 className={styles.featuredSetTitle}>{name}</h2>
          </div>

          {hasMetaFacts ? (
            <dl className={styles.featuredSetFacts}>
              {visibleTheme ? (
                <div className={styles.featuredSetFact}>
                  <dt>Thema</dt>
                  <dd>{visibleTheme}</dd>
                </div>
              ) : null}
              {typeof pieces === 'number' ? (
                <div className={styles.featuredSetFact}>
                  <dt>Onderdelen</dt>
                  <dd>{pieces.toLocaleString('nl-NL')}</dd>
                </div>
              ) : null}
              {releaseLabel ? (
                <div className={styles.featuredSetFact}>
                  <dt>Release</dt>
                  <dd>{releaseLabel}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {hasCommercePanel ? (
            <div className={styles.featuredSetCommercePanel}>
              {priceValue ? (
                <div className={styles.featuredSetPriceRow}>
                  <span className={styles.featuredSetPriceLabel}>
                    {priceLabel ?? 'Beste prijs nu'}
                  </span>
                  <strong className={styles.featuredSetPriceValue}>
                    {priceValue}
                  </strong>
                </div>
              ) : null}
              {priceSupportingCopy ? (
                <p className={styles.featuredSetPriceSupportingCopy}>
                  {priceSupportingCopy}
                </p>
              ) : null}
              {availabilityLabel ? (
                <p className={styles.featuredSetAvailability}>
                  {availabilityLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.featuredSetActions}>
            <ContentArticleSetActionLink
              articleSlug={articleSlug}
              href={ctaHref}
              setId={setNumber}
              setName={name}
            >
              {ctaLabel}
            </ContentArticleSetActionLink>
          </div>
        </div>
      </Surface>
    </section>
  );
}

export function ContentArticleSetSpotlightList({
  sections,
}: {
  sections?: readonly ContentArticleSetSpotlightSection[];
}) {
  if (!sections?.length) {
    return null;
  }

  return (
    <section
      className={joinClasses(styles.setSpotlightListBlock, styles.mediaBlock)}
      data-article-layout="media-block"
      data-article-module="set-spotlight-list"
      data-article-width="editorial-media"
      data-set-spotlight-list="true"
    >
      <div className={styles.setSpotlightList}>
        {sections.map((section) => (
          <section
            className={styles.setSpotlightSection}
            data-set-spotlight-layout={section.layoutVariant ?? 'single'}
            data-set-spotlight-section={section.id}
            key={section.id}
          >
            <div className={styles.setSpotlightSectionHeader}>
              <h3 className={styles.setSpotlightSectionTitle}>
                {section.title}
              </h3>
              {section.description ? (
                <p className={styles.setSpotlightSectionDescription}>
                  {section.description}
                </p>
              ) : null}
            </div>
            <div className={styles.setSpotlightSectionItems}>
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function ContentArticleImageGallery({
  images,
}: {
  images: readonly CarouselImage[];
}) {
  if (!images.length) {
    return null;
  }

  return (
    <div
      className={joinClasses(styles.embeddedCarousel, styles.mediaBlock)}
      data-article-layout="media-block"
      data-article-module="image-gallery"
      data-article-width="editorial-media"
    >
      <ImageGallery
        ariaLabel="Artikelgalerij"
        className={styles.embeddedCarouselWidget}
        images={images}
        variant="article"
      />
    </div>
  );
}

export const ContentArticleImageCarousel = ContentArticleImageGallery;

export function ContentArticlePage({
  body,
  breadcrumbs,
  contentArticle,
  relatedArticles,
  relatedArticlesTitle,
  themePresentation,
}: {
  body: ReactNode;
  breadcrumbs?: readonly BreadcrumbItem[];
  contentArticle: ContentArticle;
  relatedArticles?: readonly ContentArticleListItem[];
  relatedArticlesTitle?: string;
  themePresentation?: ContentArticleThemePresentation;
}) {
  const resolvedThemeLabel = normalizePublicContentArticleTheme(
    themePresentation?.label ?? contentArticle.theme,
  );

  return (
    <article className={styles.page}>
      <div
        className={styles.articleShell}
        data-article-layout="shell"
        data-article-theme={normalizeArticleThemeKey(resolvedThemeLabel)}
        data-article-theme-tone={themePresentation?.tone ?? 'light'}
        style={themePresentation?.style}
      >
        {breadcrumbs?.length ? (
          <Breadcrumbs
            ariaLabel="Artikelcontext"
            className={styles.breadcrumbs}
            items={breadcrumbs}
          />
        ) : null}
        <header className={styles.hero} data-article-layout="hero">
          {contentArticle.heroImage ? (
            <div className={styles.heroMedia}>
              <ContentArticleImage
                alt={contentArticle.heroImageAlt}
                fallbackLabel={resolvedThemeLabel ?? 'Artikel'}
                imageUrl={contentArticle.heroImage}
                kind="hero"
                priority
              />
            </div>
          ) : null}
          <div className={styles.heroContentWrap}>
            <div className={styles.heroContent}>
              {!breadcrumbs?.length ? (
                <a
                  className={styles.backLink}
                  href={buildWebPath(webPathnames.articles)}
                >
                  Terug naar artikelen
                </a>
              ) : null}
              <h1 className={styles.pageTitle}>{contentArticle.title}</h1>
              <ContentArticleMeta
                contentArticle={contentArticle}
                themePresentation={themePresentation}
              />
              <p className={styles.pageDescription}>
                {contentArticle.description}
              </p>
            </div>
          </div>
        </header>
        <div className={styles.articleBody} data-article-layout="body">
          <div className={styles.prose} data-article-layout="prose">
            {body}
          </div>
        </div>
        {relatedArticles?.length ? (
          <div
            className={joinClasses(
              styles.relatedArticlesBlock,
              styles.wideBlock,
            )}
            data-article-layout="wide-block"
            data-article-module="related-articles"
            data-article-width="commerce-rail"
          >
            <ContentArticleRail
              className={styles.relatedArticlesRail}
              contentArticles={relatedArticles}
              title={
                relatedArticlesTitle ??
                (resolvedThemeLabel
                  ? `Meer in ${resolvedThemeLabel}`
                  : 'Meer om verder te lezen')
              }
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
