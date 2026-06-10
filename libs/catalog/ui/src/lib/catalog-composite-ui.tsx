import type {
  ComponentProps,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from 'react';
import {
  ActionLink,
  Breadcrumbs,
  type BreadcrumbItem,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './catalog-ui.module.css';

function joinClasses(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

type CatalogSectionHeaderTone = 'default' | 'inverse';
type CatalogSectionHeaderUtilityPlacement = 'aside' | 'below-heading';
type CatalogPageIntroElement = 'div' | 'header' | 'section';
type CatalogSectionShellElement = 'article' | 'aside' | 'div' | 'section';
type CatalogSectionShellBodySpacing = 'compact' | 'default' | 'relaxed';
type CatalogSectionShellPadding = 'default' | 'none' | 'relaxed';
type CatalogSectionShellTone = 'default' | 'inverse' | 'muted' | 'plain';
type CatalogSectionShellSpacing = 'compact' | 'default' | 'relaxed';
export type HeroActionVariant = 'black' | 'white';
export type HeroButtonSurface = 'dark' | 'light';

export interface HeroButtonToneInput {
  backgroundColor?: string;
  textColor?: string;
}

export interface CatalogIntroPanelSection {
  description?: string;
  eyebrow?: string;
  meta?: string;
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  tone?: 'default' | 'display';
}

const catalogSectionShellToneClasses: Record<
  CatalogSectionShellTone,
  string | undefined
> = {
  default: styles.sectionShellDefault,
  inverse: styles.sectionShellInverse,
  muted: styles.sectionShellMuted,
  plain: undefined,
};

const catalogSectionShellSpacingClasses: Record<
  CatalogSectionShellSpacing,
  string | undefined
> = {
  compact: styles.sectionShellCompact,
  default: undefined,
  relaxed: styles.sectionShellRelaxed,
};

const catalogSectionShellPaddingClasses: Record<
  CatalogSectionShellPadding,
  string | undefined
> = {
  default: styles.sectionShellPaddingDefault,
  none: styles.sectionShellPaddingNone,
  relaxed: styles.sectionShellPaddingRelaxed,
};

const catalogSectionShellBodySpacingClasses: Record<
  CatalogSectionShellBodySpacing,
  string | undefined
> = {
  compact: styles.sectionShellBodyCompact,
  default: undefined,
  relaxed: styles.sectionShellBodyRelaxed,
};

function parseHeroHexColor(
  color?: string,
): [red: number, green: number, blue: number] | undefined {
  const normalizedColor = color?.trim().toLowerCase();

  if (!normalizedColor) {
    return undefined;
  }

  const shortHexMatch = normalizedColor.match(
    /^#([0-9a-f])([0-9a-f])([0-9a-f])$/u,
  );

  if (shortHexMatch) {
    return [
      parseInt(`${shortHexMatch[1]}${shortHexMatch[1]}`, 16),
      parseInt(`${shortHexMatch[2]}${shortHexMatch[2]}`, 16),
      parseInt(`${shortHexMatch[3]}${shortHexMatch[3]}`, 16),
    ];
  }

  const hexMatch = normalizedColor.match(
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u,
  );

  if (!hexMatch) {
    return undefined;
  }

  return [
    parseInt(hexMatch[1], 16),
    parseInt(hexMatch[2], 16),
    parseInt(hexMatch[3], 16),
  ];
}

function getHeroRelativeLuminance([red, green, blue]: [
  red: number,
  green: number,
  blue: number,
]): number {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map(
    (channel) => {
      const normalizedChannel = channel / 255;

      return normalizedChannel <= 0.03928
        ? normalizedChannel / 12.92
        : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
    },
  );

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

export function getHeroButtonTone({
  backgroundColor,
  textColor,
}: HeroButtonToneInput = {}): HeroActionVariant {
  const foreground = parseHeroHexColor(textColor);

  if (foreground) {
    return getHeroRelativeLuminance(foreground) > 0.56 ? 'white' : 'black';
  }

  const background = parseHeroHexColor(backgroundColor);

  if (!background) {
    return 'black';
  }

  return getHeroRelativeLuminance(background) < 0.42 ? 'white' : 'black';
}

export function getHeroButtonSurface(
  input: HeroButtonToneInput = {},
): HeroButtonSurface {
  return getHeroButtonTone(input) === 'white' ? 'dark' : 'light';
}

export function CatalogSectionHeader({
  action,
  actionClassName,
  className,
  description,
  headingClassName,
  headingTone = 'default',
  signal,
  signalClassName,
  title,
  titleAs = 'h2',
  tone = 'default',
  utility,
  utilityClassName,
  utilityPlacement = 'aside',
}: {
  action?: ReactNode;
  actionClassName?: string;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  headingClassName?: string;
  headingTone?: 'default' | 'display';
  signal?: ReactNode;
  signalClassName?: string;
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  tone?: CatalogSectionHeaderTone;
  utility?: ReactNode;
  utilityClassName?: string;
  utilityPlacement?: CatalogSectionHeaderUtilityPlacement;
}) {
  const hasAside = Boolean(signal || (utility && utilityPlacement === 'aside'));
  const TitleTag = titleAs;

  return (
    <div
      className={joinClasses(
        styles.sectionHeader,
        hasAside && styles.sectionHeaderWithAside,
        tone === 'inverse' && styles.sectionHeaderInverse,
        className,
      )}
    >
      <div className={styles.sectionHeaderMain}>
        <div
          className={joinClasses(
            styles.sectionHeaderHeading,
            headingTone === 'display' && styles.sectionHeaderHeadingDisplay,
            headingClassName,
          )}
        >
          <div className={styles.sectionHeaderTitleRow}>
            <TitleTag className={styles.sectionHeaderTitle}>{title}</TitleTag>
            {action ? (
              <div
                className={joinClasses(
                  styles.sectionHeaderAction,
                  actionClassName,
                )}
              >
                {action}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className={styles.sectionHeaderDescription}>{description}</p>
          ) : null}
        </div>
        {utility && utilityPlacement === 'below-heading' ? (
          <div
            className={joinClasses(
              styles.sectionHeaderUtility,
              styles.sectionHeaderUtilityInline,
              utilityClassName,
            )}
          >
            {utility}
          </div>
        ) : null}
      </div>
      {hasAside ? (
        <div className={styles.sectionHeaderAside}>
          {signal ? (
            <p
              className={joinClasses(
                styles.sectionHeaderSignal,
                signalClassName,
              )}
            >
              {signal}
            </p>
          ) : null}
          {utility && utilityPlacement === 'aside' ? (
            <div
              className={joinClasses(
                styles.sectionHeaderUtility,
                styles.sectionHeaderUtilityAside,
                utilityClassName,
              )}
            >
              {utility}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CatalogPageIntro({
  as = 'section',
  breadcrumbs,
  children,
  className,
  contentClassName,
  heroButtonTone,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: CatalogPageIntroElement;
  breadcrumbs?: {
    ariaLabel?: string;
    className?: string;
    items: readonly BreadcrumbItem[];
  };
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  heroButtonTone?: HeroActionVariant;
}) {
  const Component = as;

  return (
    <Component
      className={joinClasses(styles.pageIntro, className)}
      data-has-breadcrumbs={breadcrumbs?.items.length ? 'true' : 'false'}
      data-hero-button-tone={heroButtonTone}
      {...rest}
    >
      {breadcrumbs?.items.length ? (
        <Breadcrumbs
          ariaLabel={breadcrumbs.ariaLabel}
          className={joinClasses(
            styles.pageIntroBreadcrumbs,
            breadcrumbs.className,
          )}
          items={breadcrumbs.items}
        />
      ) : null}
      {children ? (
        <div className={joinClasses(styles.pageIntroContent, contentClassName)}>
          {children}
        </div>
      ) : null}
    </Component>
  );
}

export function CatalogHeroMedia({
  alt,
  className,
  imageClassName,
  ...imageProps
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'className'> & {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={joinClasses(styles.heroMediaFrame, className)}>
      <img
        alt={alt}
        className={joinClasses(styles.heroMediaImage, imageClassName)}
        {...imageProps}
      />
    </div>
  );
}

export function CatalogSectionShell({
  action,
  actionClassName,
  as = 'section',
  bodyClassName,
  bodySpacing = 'default',
  children,
  className,
  description,
  headerClassName,
  headerTone,
  headingClassName,
  headingTone = 'default',
  padding = 'default',
  signal,
  signalClassName,
  spacing = 'default',
  title,
  titleAs = 'h2',
  tone = 'plain',
  utility,
  utilityClassName,
  utilityPlacement = 'aside',
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  action?: ReactNode;
  actionClassName?: string;
  as?: CatalogSectionShellElement;
  bodyClassName?: string;
  bodySpacing?: CatalogSectionShellBodySpacing;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  headerClassName?: string;
  headerTone?: CatalogSectionHeaderTone;
  headingClassName?: string;
  headingTone?: 'default' | 'display';
  padding?: CatalogSectionShellPadding;
  signal?: ReactNode;
  signalClassName?: string;
  spacing?: CatalogSectionShellSpacing;
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  tone?: CatalogSectionShellTone;
  utility?: ReactNode;
  utilityClassName?: string;
  utilityPlacement?: CatalogSectionHeaderUtilityPlacement;
}) {
  const Component = as;
  const content = (
    <>
      <CatalogSectionHeader
        action={action}
        actionClassName={actionClassName}
        className={headerClassName}
        description={description}
        headingClassName={headingClassName}
        headingTone={headingTone}
        signal={signal}
        signalClassName={signalClassName}
        title={title}
        titleAs={titleAs}
        tone={headerTone ?? (tone === 'inverse' ? 'inverse' : 'default')}
        utility={utility}
        utilityClassName={utilityClassName}
        utilityPlacement={utilityPlacement}
      />
      {children ? (
        <div
          className={joinClasses(
            styles.sectionShellBody,
            catalogSectionShellBodySpacingClasses[bodySpacing],
            bodyClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </>
  );

  return (
    <Component
      className={joinClasses(
        styles.sectionShell,
        tone !== 'plain' && catalogSectionShellToneClasses[tone],
        catalogSectionShellSpacingClasses[spacing],
        catalogSectionShellPaddingClasses[padding],
        className,
      )}
      {...rest}
    >
      {content}
    </Component>
  );
}

export function CatalogQuickFilterBar({
  ariaLabel,
  className,
  items,
}: {
  ariaLabel: string;
  className?: string;
  items: readonly {
    href: string;
    isActive?: boolean;
    label: string;
  }[];
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={joinClasses(styles.quickFilterNav, className)}
    >
      <ul className={styles.quickFilterList}>
        {items.map((item) => (
          <li className={styles.quickFilterItem} key={item.label}>
            <a
              aria-current={item.isActive ? 'page' : undefined}
              className={joinClasses(
                styles.quickFilterChip,
                item.isActive && styles.quickFilterChipActive,
              )}
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CatalogSplitIntroPanel({
  actionHref,
  actionLabel,
  actionTone = 'accent',
  className,
  primary,
  secondary,
}: {
  actionHref?: string;
  actionLabel?: string;
  actionTone?: ComponentProps<typeof ActionLink>['tone'];
  className?: string;
  primary: CatalogIntroPanelSection;
  secondary: CatalogIntroPanelSection;
}) {
  return (
    <Surface
      as="section"
      className={joinClasses(styles.heroPanel, className)}
      elevation="floating"
      tone="default"
    >
      <div className={styles.heroPrimary}>
        <div className={styles.heroPrimaryContent}>
          <SectionHeading
            className={styles.heroCopy}
            description={primary.description}
            title={primary.title}
            titleAs={primary.titleAs}
            tone={primary.tone}
          />
          {primary.meta ? (
            <p className={styles.heroMeta}>{primary.meta}</p>
          ) : null}
        </div>
      </div>
      <div className={styles.heroSecondary}>
        <SectionHeading
          className={styles.heroCopy}
          description={secondary.description}
          title={secondary.title}
          titleAs={secondary.titleAs}
          tone={secondary.tone}
        />
        {actionHref && actionLabel ? (
          <ActionLink
            className={styles.actionLink}
            href={actionHref}
            tone={actionTone}
          >
            {actionLabel}
          </ActionLink>
        ) : null}
      </div>
    </Surface>
  );
}

export function CatalogSetDetailHero({
  badges,
  className,
  children,
  decisionPrimary,
  decisionSecondary,
  decisionPanel,
  gallery,
  keyFacts,
  title,
  titleAs: TitleTag = 'h1',
  titleSupplement,
}: {
  badges?: ReactNode;
  className?: string;
  children?: ReactNode;
  decisionPanel?: ReactNode;
  decisionPrimary?: ReactNode;
  decisionSecondary?: ReactNode;
  gallery: ReactNode;
  keyFacts?: ReactNode;
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  titleSupplement?: ReactNode;
}) {
  const heroHeader = (
    <div className={styles.detailHeroHeader}>
      {badges ? <div className={styles.badgeRow}>{badges}</div> : null}
      <TitleTag className={styles.detailTitle}>{title}</TitleTag>
      {titleSupplement ? titleSupplement : null}
    </div>
  );

  const hasSplitDecision = Boolean(decisionPrimary || decisionSecondary);

  return (
    <Surface
      as="section"
      className={joinClasses(styles.detailHero, className)}
      elevation="rested"
      tone="default"
    >
      <div className={styles.detailHeroMain}>
        <div className={styles.detailHeroRail}>
          <div className={styles.detailHeroRailInner}>
            {gallery}
            {keyFacts ? (
              <div className={styles.detailHeroSpecs}>{keyFacts}</div>
            ) : null}
          </div>
        </div>
        <div className={styles.detailHeroContent}>
          {hasSplitDecision ? (
            <>
              <div className={styles.detailHeroPrimary}>
                {heroHeader}
                {decisionPrimary}
              </div>
              {decisionSecondary ? (
                <div className={styles.detailHeroSecondary}>
                  {decisionSecondary}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {heroHeader}
              {decisionPanel}
            </>
          )}
        </div>
        {children ? (
          <div className={styles.detailHeroSupplementary}>{children}</div>
        ) : null}
      </div>
    </Surface>
  );
}
