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
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import {
  formatContentArticleDate,
  normalizePublicContentArticleTheme,
  type ContentArticle,
  type ContentArticleHeroImageSource,
  type ContentArticleListItem,
} from '@lego-platform/content/util';
import {
  ContentArticleLink,
  ContentArticleSetActionLink,
} from './content-article-link';
import { ContentArticleFeaturedSetLightbox } from './content-article-featured-set-lightbox';
import {
  ContentArticleGalleryLightboxProvider,
  ContentArticleGalleryLightboxWidget,
} from './content-article-gallery-lightbox';
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

function getArticleThemeSlugForLink(
  contentArticle: Pick<ContentArticleListItem, 'theme' | 'themeSlug'>,
): string {
  return (
    contentArticle.themeSlug ??
    normalizeArticleThemeKey(contentArticle.theme) ??
    'lego'
  );
}

function getArticleImageFit({
  kind,
  source,
}: {
  kind: 'card' | 'featured' | 'hero' | 'spotlight';
  source?: ContentArticleHeroImageSource;
}): 'contain' | 'cover' {
  if (source) {
    return source === 'manual' ? 'cover' : 'contain';
  }

  return kind === 'card' ? 'cover' : 'contain';
}

function getArticleCardImageSource(
  contentArticle: Pick<
    ContentArticleListItem,
    'cardImageSource' | 'heroImageSource'
  >,
): ContentArticleHeroImageSource | undefined {
  return contentArticle.cardImageSource ?? contentArticle.heroImageSource;
}

export interface ContentArticleThemePresentation {
  href?: string;
  label?: string;
  style?: CSSProperties;
  tone?: 'dark' | 'light';
}

type ContentArticleThemeAwareListItem = ContentArticleListItem & {
  themePresentation?: ContentArticleThemePresentation;
};

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
  themePresentation?: ContentArticleThemePresentation;
}

export interface ContentArticleSetSpotlightSection {
  body: ReactNode;
  description?: string;
  highlightSetNumber?: string;
  id: string;
  layoutVariant?: 'single' | 'pair' | 'trio' | 'cluster';
  title: string;
}

export function ContentArticleSectionShell({
  bodyClassName,
  children,
  className,
  eyebrow,
  title,
  tone = 'default',
}: {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
  tone?: 'default' | 'inverse';
}) {
  return (
    <section
      className={joinClasses(
        styles.sectionShell,
        tone === 'inverse'
          ? styles.sectionShellInverse
          : styles.sectionShellDefault,
        styles.sectionShellPaddingDefault,
        className,
      )}
      data-content-section-shell={tone}
    >
      <div className={styles.sectionShellHeader}>
        {eyebrow ? (
          <p className={styles.sectionShellEyebrow}>{eyebrow}</p>
        ) : null}
        <h2 className={styles.sectionShellTitle}>{title}</h2>
      </div>
      <div className={joinClasses(styles.sectionShellBody, bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

function ContentArticleImage({
  alt,
  fallbackLabel,
  imageUrl,
  kind = 'card',
  priority = false,
  source,
}: {
  alt: string;
  fallbackLabel: string;
  imageUrl?: string;
  kind?: 'card' | 'featured' | 'hero' | 'spotlight';
  priority?: boolean;
  source?: ContentArticleHeroImageSource;
}) {
  const imageFit = getArticleImageFit({ kind, source });
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
    imageFit === 'cover' ? styles.imageFitCover : styles.imageFitContain,
  );

  if (imageUrl) {
    return (
      <div className={imageFrameClassName}>
        <img
          alt={alt}
          className={imageClassName}
          data-article-image-fit={imageFit}
          data-article-image-kind={kind}
          data-article-image-source={source}
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
  showAuthor = false,
  themePresentation,
}: {
  contentArticle: Pick<
    ContentArticleListItem,
    'authorName' | 'date' | 'theme' | 'updatedAt'
  >;
  showAuthor?: boolean;
  themePresentation?: ContentArticleThemePresentation;
}) {
  const resolvedThemeLabel = normalizePublicContentArticleTheme(
    themePresentation?.label ?? contentArticle.theme,
  );
  const authorName = contentArticle.authorName?.trim();

  return (
    <div className={styles.metaRow}>
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
      <time className={styles.metaText} dateTime={contentArticle.date}>
        {formatContentArticleDate(contentArticle.date)}
      </time>
      {showAuthor && authorName ? (
        <span className={styles.metaText}>Door {authorName}</span>
      ) : null}
      {contentArticle.updatedAt ? (
        <time className={styles.metaText} dateTime={contentArticle.updatedAt}>
          Bijgewerkt {formatContentArticleDate(contentArticle.updatedAt)}
        </time>
      ) : null}
    </div>
  );
}

export function ContentArticleCard({
  contentArticle,
}: {
  contentArticle: ContentArticleThemeAwareListItem;
}) {
  return (
    <Surface as="article" className={styles.card} elevation="rested">
      <ContentArticleLink
        className={styles.cardLink}
        href={buildArticlePath(
          contentArticle.slug,
          getArticleThemeSlugForLink(contentArticle),
        )}
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
          source={getArticleCardImageSource(contentArticle)}
        />
        <div className={styles.cardBody}>
          <ContentArticleMeta
            contentArticle={contentArticle}
            themePresentation={contentArticle.themePresentation}
          />
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
  contentArticle: ContentArticleThemeAwareListItem;
}) {
  return (
    <Surface as="article" className={styles.featuredArticle} elevation="rested">
      <ContentArticleLink
        className={styles.featuredArticleLink}
        href={buildArticlePath(
          contentArticle.slug,
          getArticleThemeSlugForLink(contentArticle),
        )}
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
          source={
            contentArticle.heroImageSource ?? contentArticle.cardImageSource
          }
        />
        <div className={styles.featuredArticleBody}>
          <ContentArticleMeta
            contentArticle={contentArticle}
            themePresentation={contentArticle.themePresentation}
          />
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
  contentArticles: readonly ContentArticleThemeAwareListItem[];
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

export function ContentArticleCompactRail({
  contentArticles,
  maxItems,
  title,
}: {
  contentArticles: readonly ContentArticleThemeAwareListItem[];
  maxItems?: number;
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
    <ContentArticleSectionShell
      bodyClassName={styles.compactRailBody}
      className={styles.compactRail}
      eyebrow="POPULAIR"
      title={title}
      tone="inverse"
    >
      <div className={styles.compactRailScroller}>
        {visibleArticles.map((contentArticle) => (
          <article className={styles.compactCard} key={contentArticle.slug}>
            <ContentArticleLink
              className={styles.compactCardLink}
              href={buildArticlePath(
                contentArticle.slug,
                getArticleThemeSlugForLink(contentArticle),
              )}
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
                source={getArticleCardImageSource(contentArticle)}
              />
              <div className={styles.compactCardBody}>
                <ContentArticleMeta
                  contentArticle={contentArticle}
                  themePresentation={contentArticle.themePresentation}
                />
                <h3 className={styles.compactCardTitle}>
                  {contentArticle.title}
                </h3>
              </div>
            </ContentArticleLink>
          </article>
        ))}
      </div>
    </ContentArticleSectionShell>
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
  contentArticles: readonly ContentArticleThemeAwareListItem[];
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
          eyebrow={eyebrow}
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
  themePresentation,
}: ContentArticleFeaturedSetProps) {
  const visibleTheme = normalizePublicContentArticleTheme(
    themePresentation?.label ?? theme,
  );
  const visibleThemeHref = themePresentation?.href ?? themeHref;
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
        <ContentArticleFeaturedSetLightbox
          imageAlt={imageAlt}
          imageUrl={imageUrl}
          name={name}
        >
          <ContentArticleImage
            alt={imageAlt}
            fallbackLabel={visibleTheme ?? 'Set'}
            imageUrl={imageUrl}
            kind="featured"
            source="featuredSet"
          />
        </ContentArticleFeaturedSetLightbox>

        <div className={styles.featuredSetContent}>
          <div className={styles.featuredSetHeader}>
            <div className={styles.featuredSetBadges}>
              <Badge tone="neutral">Set {setNumber}</Badge>
              {visibleTheme ? (
                visibleThemeHref ? (
                  <a
                    className={styles.featuredSetThemeLink}
                    href={visibleThemeHref}
                  >
                    <span
                      className={styles.themeBadgeShell}
                      style={themePresentation?.style}
                    >
                      <Badge className={styles.themeBadge} tone="neutral">
                        {visibleTheme}
                      </Badge>
                    </span>
                  </a>
                ) : (
                  <span
                    className={styles.themeBadgeShell}
                    style={themePresentation?.style}
                  >
                    <Badge className={styles.themeBadge} tone="neutral">
                      {visibleTheme}
                    </Badge>
                  </span>
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
      <ContentArticleGalleryLightboxWidget
        ariaLabel="Artikelgalerij"
        className={styles.embeddedCarouselWidget}
        images={images}
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
                source={contentArticle.heroImageSource}
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
                showAuthor
                themePresentation={themePresentation}
              />
              <p className={styles.pageDescription}>
                {contentArticle.description}
              </p>
            </div>
          </div>
        </header>
        <div className={styles.articleBody} data-article-layout="body">
          <ContentArticleGalleryLightboxProvider>
            <div className={styles.prose} data-article-layout="prose">
              {body}
            </div>
          </ContentArticleGalleryLightboxProvider>
          {contentArticle.sourceAttribution ? (
            <footer
              className={styles.sourceAttribution}
              data-article-layout="source-attribution"
              data-source-attribution-tone={
                contentArticle.sourceAttribution.tone
              }
            >
              <p>{contentArticle.sourceAttribution.label}</p>
              {contentArticle.sourceAttribution.imageCredit ? (
                <p>{contentArticle.sourceAttribution.imageCredit}</p>
              ) : null}
            </footer>
          ) : null}
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
