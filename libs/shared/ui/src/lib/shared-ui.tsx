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
      {children}
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
  description?: string;
  eyebrow?: string;
  title: string;
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

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.visuallyHidden}>{children}</span>;
}
