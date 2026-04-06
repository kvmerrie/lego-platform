import Link from 'next/link';
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
type LabelValueAppearance = 'plain' | 'tile';
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
  plain: undefined,
  tile: styles.labelValueTile,
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
  tone = 'secondary',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  tone?: Exclude<ActionTone, 'card' | 'inline'>;
}) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={joinClasses(
        styles.interactiveBase,
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
  tone = 'secondary',
  ...rest
}: Omit<ComponentProps<typeof Link>, 'className' | 'children' | 'href'> & {
  children: ReactNode;
  className?: string;
  href: string;
  tone?: ActionTone;
}) {
  return (
    <Link
      className={joinClasses(
        styles.interactiveBase,
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
    <dl className={joinClasses(styles.labelValueList, className)}>
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
