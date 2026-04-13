import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  ReactNode,
} from 'react';
import styles from './shared-ui.module.css';

function joinClasses(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

type SurfaceElement =
  | 'article'
  | 'aside'
  | 'div'
  | 'footer'
  | 'header'
  | 'nav'
  | 'section';
type SurfaceElevation = 'default' | 'floating' | 'rested';
type SurfaceTone = 'default' | 'muted' | 'accent';
type SurfacePadding = 'md' | 'lg';
type ActionTone = 'accent' | 'card' | 'ghost' | 'inline' | 'secondary';
type ActionSize = 'compact' | 'default' | 'hero';
type ActionSurface = 'default' | 'light' | 'dark' | 'image';
type ContainerElement =
  | 'div'
  | 'footer'
  | 'header'
  | 'main'
  | 'nav'
  | 'section';
type BadgeTone =
  | 'accent'
  | 'error'
  | 'info'
  | 'neutral'
  | 'positive'
  | 'warning';
type SectionHeadingLevel = 'h1' | 'h2' | 'h3';
type SectionHeadingTone = 'default' | 'display';
type PanelSpacing = 'compact' | 'default';
type MetaSignalTone = 'accent' | 'default' | 'info' | 'positive' | 'warning';
type MarkerListTone = 'accent' | 'default' | 'info' | 'positive' | 'warning';
type MarkerListSpacing = 'compact' | 'default';
type LabelValueAppearance = 'hero' | 'plain' | 'tile';
type LabelValueSpacing = 'compact' | 'default';
type LabelValueTone = 'default' | 'muted';
type LabelValueEmphasis = 'regular' | 'strong';

export interface MarkerListItem {
  content: ReactNode;
  id: string;
}

export interface LabelValueItem {
  description?: ReactNode;
  emphasis?: LabelValueEmphasis;
  icon?: ReactNode;
  id: string;
  label: ReactNode;
  tone?: LabelValueTone;
  value: ReactNode;
}

export interface BreadcrumbItem {
  href?: string;
  id: string;
  label: ReactNode;
}

const buttonToneClasses: Record<
  Exclude<ActionTone, 'card' | 'inline'>,
  string
> = {
  accent: styles.buttonAccent,
  ghost: styles.buttonGhost,
  secondary: styles.buttonSecondary,
};

const linkToneClasses: Record<ActionTone, string> = {
  accent: styles.linkAccent,
  card: styles.linkCard,
  ghost: styles.linkGhost,
  inline: styles.linkInline,
  secondary: styles.linkSecondary,
};

const actionSizeClasses: Record<ActionSize, string | undefined> = {
  compact: styles.interactiveSizeCompact,
  default: styles.interactiveSizeDefault,
  hero: styles.interactiveSizeHero,
};

const actionSurfaceClasses: Record<ActionSurface, string | undefined> = {
  default: styles.interactiveSurfaceDefault,
  light: styles.interactiveSurfaceLight,
  dark: styles.interactiveSurfaceDark,
  image: styles.interactiveSurfaceImage,
};

const badgeToneClasses: Record<BadgeTone, string | undefined> = {
  accent: styles.badgeAccent,
  error: styles.badgeError,
  info: styles.badgeInfo,
  neutral: undefined,
  positive: styles.badgePositive,
  warning: styles.badgeWarning,
};

const surfaceElevationClasses: Record<SurfaceElevation, string> = {
  default: styles.surfaceElevationDefault,
  floating: styles.surfaceElevationFloating,
  rested: styles.surfaceElevationRested,
};

const surfaceToneClasses: Record<SurfaceTone, string | undefined> = {
  accent: styles.surfaceAccent,
  default: undefined,
  muted: styles.surfaceMuted,
};

const sectionHeadingToneClasses: Record<
  SectionHeadingTone,
  string | undefined
> = {
  default: undefined,
  display: styles.sectionHeadingDisplay,
};

const panelSpacingClasses: Record<PanelSpacing, string | undefined> = {
  compact: styles.panelCompact,
  default: undefined,
};

const metaSignalToneClasses: Record<MetaSignalTone, string | undefined> = {
  accent: styles.metaSignalAccent,
  default: undefined,
  info: styles.metaSignalInfo,
  positive: styles.metaSignalPositive,
  warning: styles.metaSignalWarning,
};

const markerListToneClasses: Record<MarkerListTone, string | undefined> = {
  accent: styles.markerListAccent,
  default: undefined,
  info: styles.markerListInfo,
  positive: styles.markerListPositive,
  warning: styles.markerListWarning,
};

const markerListSpacingClasses: Record<MarkerListSpacing, string | undefined> =
  {
    compact: styles.markerListCompact,
    default: undefined,
  };

const labelValueAppearanceClasses: Record<
  LabelValueAppearance,
  string | undefined
> = {
  hero: styles.labelValueHero,
  plain: undefined,
  tile: styles.labelValueTile,
};

const labelValueListAppearanceClasses: Record<
  LabelValueAppearance,
  string | undefined
> = {
  hero: styles.labelValueListHero,
  plain: undefined,
  tile: undefined,
};

const labelValueSpacingClasses: Record<LabelValueSpacing, string | undefined> =
  {
    compact: styles.labelValueCompact,
    default: undefined,
  };

const labelValueToneClasses: Record<LabelValueTone, string | undefined> = {
  default: undefined,
  muted: styles.labelValueValueMuted,
};

const labelValueEmphasisClasses: Record<
  LabelValueEmphasis,
  string | undefined
> = {
  regular: styles.labelValueValueRegular,
  strong: undefined,
};

export function Surface({
  as = 'div',
  children,
  className,
  elevation = 'default',
  padding = 'md',
  tone = 'default',
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  children: ReactNode;
  elevation?: SurfaceElevation;
  padding?: SurfacePadding;
  tone?: SurfaceTone;
}) {
  const Component = as;

  return (
    <Component
      className={joinClasses(
        styles.surface,
        surfaceToneClasses[tone],
        surfaceElevationClasses[elevation],
        padding === 'lg' ? styles.surfacePaddingLg : styles.surfacePaddingMd,
        className,
      )}
      data-surface-element={as}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function Container({
  as = 'div',
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: ContainerElement;
  children: ReactNode;
}) {
  const Component = as;

  return (
    <Component className={joinClasses(styles.container, className)} {...rest}>
      {children}
    </Component>
  );
}

export function Button({
  children,
  className,
  disabled,
  isLoading,
  size = 'default',
  surface = 'default',
  tone = 'secondary',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  size?: ActionSize;
  surface?: ActionSurface;
  tone?: Exclude<ActionTone, 'card' | 'inline'>;
}) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={joinClasses(
        styles.interactiveBase,
        actionSizeClasses[size],
        actionSurfaceClasses[surface],
        buttonToneClasses[tone],
        className,
      )}
      data-loading={isLoading || undefined}
      disabled={disabled || isLoading}
      type={type}
      {...rest}
    >
      <span className={styles.interactiveContent}>{children}</span>
    </button>
  );
}

export function ActionLink({
  children,
  className,
  href,
  prefetch,
  size = 'default',
  surface = 'default',
  tone = 'secondary',
  ...rest
}: Omit<ComponentProps<typeof Link>, 'className' | 'children' | 'href'> & {
  children: ReactNode;
  className?: string;
  href: string;
  size?: ActionSize;
  surface?: ActionSurface;
  tone?: ActionTone;
}) {
  const usesCardLayout = tone === 'card';
  const usesInlineLayout = tone === 'inline';

  if (usesCardLayout) {
    return (
      <Link
        className={joinClasses(
          styles.cardLinkBase,
          linkToneClasses[tone],
          className,
        )}
        href={href}
        prefetch={prefetch}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      className={joinClasses(
        styles.interactiveBase,
        usesInlineLayout ? undefined : actionSizeClasses[size],
        actionSurfaceClasses[surface],
        linkToneClasses[tone],
        className,
      )}
      href={href}
      prefetch={prefetch}
      {...rest}
    >
      <span className={styles.interactiveContent}>{children}</span>
    </Link>
  );
}

export function Breadcrumbs({
  ariaLabel = 'Breadcrumb',
  className,
  items,
}: {
  ariaLabel?: string;
  className?: string;
  items: readonly BreadcrumbItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={joinClasses(styles.breadcrumbNav, className)}
    >
      <ol className={styles.breadcrumbList}>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li className={styles.breadcrumbItem} key={item.id}>
              {index > 0 ? (
                <span aria-hidden="true" className={styles.breadcrumbSeparator}>
                  <ChevronRight size={14} strokeWidth={2.2} />
                </span>
              ) : null}
              {isCurrent || !item.href ? (
                <span
                  aria-current={isCurrent ? 'page' : undefined}
                  className={styles.breadcrumbCurrent}
                >
                  {item.label}
                </span>
              ) : (
                <ActionLink
                  className={styles.breadcrumbLink}
                  href={item.href}
                  tone="inline"
                >
                  {item.label}
                </ActionLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={joinClasses(styles.badge, badgeToneClasses[tone], className)}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  className,
  description,
  eyebrow,
  title,
  titleAs = 'h2',
  tone = 'default',
}: {
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  titleAs?: SectionHeadingLevel;
  tone?: SectionHeadingTone;
}) {
  const TitleTag = titleAs;

  return (
    <div
      className={joinClasses(
        styles.sectionHeading,
        sectionHeadingToneClasses[tone],
        className,
      )}
    >
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <TitleTag className={styles.sectionTitle}>{title}</TitleTag>
      {description ? (
        <p className={styles.sectionDescription}>{description}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  as = 'section',
  children,
  className,
  description,
  elevation = 'rested',
  eyebrow,
  headingClassName,
  headingTone = 'default',
  padding = 'md',
  spacing = 'default',
  title,
  titleAs = 'h2',
  tone = 'default',
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  as?: SurfaceElement;
  children?: ReactNode;
  description?: ReactNode;
  elevation?: SurfaceElevation;
  eyebrow?: string;
  headingClassName?: string;
  headingTone?: SectionHeadingTone;
  padding?: SurfacePadding;
  spacing?: PanelSpacing;
  title?: ReactNode;
  titleAs?: SectionHeadingLevel;
  tone?: SurfaceTone;
}) {
  return (
    <Surface
      as={as}
      className={joinClasses(
        styles.panel,
        panelSpacingClasses[spacing],
        className,
      )}
      elevation={elevation}
      padding={padding}
      tone={tone}
      {...rest}
    >
      {title ? (
        <SectionHeading
          className={headingClassName}
          description={description}
          eyebrow={eyebrow}
          title={title}
          titleAs={titleAs}
          tone={headingTone}
        />
      ) : null}
      {children}
    </Surface>
  );
}

export function MetaSignal({
  children,
  className,
  icon,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  tone?: MetaSignalTone;
}) {
  return (
    <span
      className={joinClasses(
        styles.metaSignal,
        metaSignalToneClasses[tone],
        className,
      )}
    >
      {icon ? <span className={styles.metaSignalIcon}>{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}

export function MarkerList({
  className,
  items,
  spacing = 'default',
  tone = 'accent',
}: {
  className?: string;
  items: readonly MarkerListItem[];
  spacing?: MarkerListSpacing;
  tone?: MarkerListTone;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      className={joinClasses(
        styles.markerList,
        markerListToneClasses[tone],
        markerListSpacingClasses[spacing],
        className,
      )}
    >
      {items.map((item) => (
        <li className={styles.markerListItem} key={item.id}>
          {item.content}
        </li>
      ))}
    </ul>
  );
}

export function LabelValue({
  appearance = 'plain',
  className,
  description,
  emphasis = 'strong',
  icon,
  label,
  spacing = 'default',
  tone = 'default',
  value,
}: {
  appearance?: LabelValueAppearance;
  className?: string;
  description?: ReactNode;
  emphasis?: LabelValueEmphasis;
  icon?: ReactNode;
  label: ReactNode;
  spacing?: LabelValueSpacing;
  tone?: LabelValueTone;
  value: ReactNode;
}) {
  return (
    <div
      className={joinClasses(
        styles.labelValue,
        icon ? styles.labelValueWithIcon : undefined,
        labelValueAppearanceClasses[appearance],
        labelValueSpacingClasses[spacing],
        className,
      )}
    >
      {icon ? <div className={styles.labelValueIcon}>{icon}</div> : null}
      <div className={styles.labelValueCopy}>
        <div className={styles.labelValueLabel}>{label}</div>
        <div
          className={joinClasses(
            styles.labelValueValue,
            labelValueToneClasses[tone],
            labelValueEmphasisClasses[emphasis],
          )}
        >
          {value}
        </div>
        {description ? (
          <div className={styles.labelValueDescription}>{description}</div>
        ) : null}
      </div>
    </div>
  );
}

export function LabelValueList({
  appearance = 'plain',
  className,
  items,
  spacing = 'default',
}: {
  appearance?: LabelValueAppearance;
  className?: string;
  items: readonly LabelValueItem[];
  spacing?: LabelValueSpacing;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <dl
      className={joinClasses(
        styles.labelValueList,
        labelValueListAppearanceClasses[appearance],
        className,
      )}
    >
      {items.map((item) => (
        <div
          className={joinClasses(
            styles.labelValue,
            styles.labelValueListItem,
            item.icon ? styles.labelValueWithIcon : undefined,
            labelValueAppearanceClasses[appearance],
            labelValueSpacingClasses[spacing],
          )}
          key={item.id}
        >
          {item.icon ? (
            <div className={styles.labelValueIcon}>{item.icon}</div>
          ) : null}
          <div className={styles.labelValueCopy}>
            <dt className={styles.labelValueLabel}>{item.label}</dt>
            <dd
              className={joinClasses(
                styles.labelValueValue,
                labelValueToneClasses[item.tone ?? 'default'],
                labelValueEmphasisClasses[item.emphasis ?? 'strong'],
              )}
            >
              {item.value}
            </dd>
            {item.description ? (
              <div className={styles.labelValueDescription}>
                {item.description}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </dl>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.visuallyHidden}>{children}</span>;
}
