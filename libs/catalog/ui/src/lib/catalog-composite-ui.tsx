import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
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
}) {
  const Component = as;

  return (
    <Component
      className={joinClasses(styles.pageIntro, className)}
      data-has-breadcrumbs={breadcrumbs?.items.length ? 'true' : 'false'}
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
