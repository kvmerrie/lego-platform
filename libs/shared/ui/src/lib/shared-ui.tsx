import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react';
import styles from './shared-ui.module.css';

function joinClasses(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

type SurfaceElement = 'article' | 'div' | 'footer' | 'header' | 'nav' | 'section';
type SurfaceTone = 'default' | 'muted';
type SurfacePadding = 'md' | 'lg';
type ActionTone = 'accent' | 'card' | 'ghost' | 'secondary';
type BadgeTone = 'accent' | 'neutral' | 'positive' | 'warning';
type SectionHeadingLevel = 'h1' | 'h2' | 'h3';

const buttonToneClasses: Record<Exclude<ActionTone, 'card'>, string> = {
  accent: styles.buttonAccent,
  ghost: styles.buttonGhost,
  secondary: styles.buttonSecondary,
};

const linkToneClasses: Record<ActionTone, string> = {
  accent: styles.linkAccent,
  card: styles.linkCard,
  ghost: styles.linkGhost,
  secondary: styles.linkSecondary,
};

const badgeToneClasses: Record<BadgeTone, string | undefined> = {
  accent: styles.badgeAccent,
  neutral: undefined,
  positive: styles.badgePositive,
  warning: styles.badgeWarning,
};

export function Surface({
  as = 'div',
  children,
  className,
  padding = 'md',
  tone = 'default',
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  children: ReactNode;
  padding?: SurfacePadding;
  tone?: SurfaceTone;
}) {
  const Component = as;

  return (
    <Component
      className={joinClasses(
        styles.surface,
        tone === 'muted' ? styles.surfaceMuted : undefined,
        padding === 'lg' ? styles.surfacePaddingLg : styles.surfacePaddingMd,
        className,
      )}
      {...rest}
    >
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
  tone?: Exclude<ActionTone, 'card'>;
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
}: {
  children: ReactNode;
  className?: string;
  href: string;
  prefetch?: boolean;
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
  description,
  eyebrow,
  title,
  titleAs = 'h2',
}: {
  description?: string;
  eyebrow?: string;
  title: string;
  titleAs?: SectionHeadingLevel;
}) {
  const TitleTag = titleAs;

  return (
    <div className={styles.sectionHeading}>
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
