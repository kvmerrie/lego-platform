import { platformConfig } from '@lego-platform/shared/config';
import { ThemeMode } from '@lego-platform/shared/types';

type ThemeTokenMap = Record<string, string>;

export const designBreakpoints = {
  md: '48rem',
  lg: '56rem',
} as const;

const baseTokens: ThemeTokenMap = {
  'lego-border-width-1': '1px',
  'lego-border-width-2': '2px',
  'lego-breakpoint-md': designBreakpoints.md,
  'lego-breakpoint-lg': designBreakpoints.lg,
  'lego-font-family-body':
    "'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif",
  'lego-font-family-heading':
    "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif",
  'lego-font-family-mono': "'SFMono-Regular', 'Cascadia Code', monospace",
  'lego-font-size-caption': '0.78rem',
  'lego-font-size-sm': '0.92rem',
  'lego-font-size-body': '1rem',
  'lego-font-size-lg': '1.125rem',
  'lego-font-size-xl': '1.35rem',
  'lego-font-size-2xl': '1.85rem',
  'lego-font-size-3xl': '2.4rem',
  'lego-font-size-4xl': 'clamp(2.9rem, 5vw, 4.4rem)',
  'lego-font-size-5xl': 'clamp(3.45rem, 7vw, 5.75rem)',
  'lego-font-weight-medium': '500',
  'lego-font-weight-semibold': '600',
  'lego-font-weight-bold': '700',
  'lego-line-height-tight': '1.05',
  'lego-line-height-heading': '1.12',
  'lego-line-height-body': '1.6',
  'lego-line-height-relaxed': '1.72',
  'lego-radius-xs': '8px',
  'lego-radius-sm': '14px',
  'lego-radius-md': '18px',
  'lego-radius-lg': '24px',
  'lego-radius-pill': '999px',
  'lego-shadow-sm':
    '0 8px 18px rgba(24, 22, 18, 0.07), 0 2px 6px rgba(24, 22, 18, 0.04)',
  'lego-shadow-md':
    '0 16px 34px rgba(24, 22, 18, 0.1), 0 6px 14px rgba(24, 22, 18, 0.06)',
  'lego-shadow-lg':
    '0 24px 56px rgba(24, 22, 18, 0.13), 0 10px 24px rgba(24, 22, 18, 0.08)',
  'lego-shadow': 'var(--lego-shadow-md)',
  'lego-space-1': '0.25rem',
  'lego-space-2': '0.5rem',
  'lego-space-3': '0.75rem',
  'lego-space-4': '1rem',
  'lego-space-5': '1.25rem',
  'lego-space-6': '1.5rem',
  'lego-space-8': '2rem',
  'lego-space-10': '2.5rem',
  'lego-space-12': '3rem',
  'lego-space-16': '4rem',
  'lego-max-width': '1200px',
  'lego-max-width-page': '1200px',
  'lego-max-width-reading': '68ch',
  'lego-motion-duration-fast': '140ms',
  'lego-motion-duration-normal': '220ms',
  'lego-motion-duration-slow': '320ms',
  'lego-motion-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'lego-motion-ease-emphasized': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'lego-text-role-display-size': 'var(--lego-font-size-5xl)',
  'lego-text-role-display-line-height': '0.96',
  'lego-text-role-display-weight': 'var(--lego-font-weight-bold)',
  'lego-text-role-hero-size': 'var(--lego-font-size-4xl)',
  'lego-text-role-hero-line-height': '1.02',
  'lego-text-role-hero-weight': 'var(--lego-font-weight-bold)',
  'lego-text-role-section-size': 'var(--lego-font-size-2xl)',
  'lego-text-role-section-line-height': 'var(--lego-line-height-heading)',
  'lego-text-role-section-weight': 'var(--lego-font-weight-bold)',
  'lego-text-role-card-title-size': 'var(--lego-font-size-xl)',
  'lego-text-role-card-title-line-height': '1.2',
  'lego-text-role-card-title-weight': 'var(--lego-font-weight-semibold)',
  'lego-text-role-body-size': 'var(--lego-font-size-body)',
  'lego-text-role-body-line-height': 'var(--lego-line-height-body)',
  'lego-text-role-body-weight': 'var(--lego-font-weight-medium)',
  'lego-text-role-meta-size': 'var(--lego-font-size-sm)',
  'lego-text-role-meta-line-height': '1.45',
  'lego-text-role-eyebrow-size': 'var(--lego-font-size-caption)',
  'lego-text-role-eyebrow-line-height': '1.2',
  'lego-text-role-mono-size': 'var(--lego-font-size-sm)',
  'lego-text-role-mono-line-height': '1.45',
};

const lightThemeTokens: ThemeTokenMap = {
  'lego-background': '#f5efe6',
  'lego-surface': '#fff9f2',
  'lego-surface-muted': '#f2e7da',
  'lego-surface-raised': '#fffdf8',
  'lego-surface-accent': '#f9eee7',
  'lego-text': '#1d2230',
  'lego-text-muted': '#615d65',
  'lego-border': '#d8cab8',
  'lego-accent': '#c25a2f',
  'lego-accent-hover': '#a94a23',
  'lego-accent-subtle': '#f6d9ca',
  'lego-accent-contrast': '#fff8f2',
  'lego-positive': '#1d7a61',
  'lego-warning': '#9f6a00',
  'lego-info': '#2c6ca8',
  'lego-error': '#b5453f',
  'lego-focus-ring': 'rgba(194, 90, 47, 0.26)',
  'lego-disabled': '#b9ad9a',
  'lego-interactive-pressed': 'rgba(42, 32, 22, 0.08)',
  'lego-interactive-pressed-strong': 'rgba(42, 32, 22, 0.14)',
};

const darkThemeTokens: ThemeTokenMap = {
  'lego-background': '#11161d',
  'lego-surface': '#181f29',
  'lego-surface-muted': '#222c39',
  'lego-surface-raised': '#202b38',
  'lego-surface-accent': '#332720',
  'lego-text': '#f4ede4',
  'lego-text-muted': '#b7beca',
  'lego-border': '#39475d',
  'lego-accent': '#ff8f64',
  'lego-accent-hover': '#ffa785',
  'lego-accent-subtle': '#3d2a23',
  'lego-accent-contrast': '#1b1410',
  'lego-positive': '#66d0a2',
  'lego-warning': '#e4bd61',
  'lego-info': '#82b7eb',
  'lego-error': '#ff8d82',
  'lego-focus-ring': 'rgba(255, 201, 178, 0.28)',
  'lego-disabled': '#657286',
  'lego-interactive-pressed': 'rgba(255, 255, 255, 0.08)',
  'lego-interactive-pressed-strong': 'rgba(255, 255, 255, 0.12)',
};

const themeTokens: Record<ThemeMode, ThemeTokenMap> = {
  light: {
    ...baseTokens,
    ...lightThemeTokens,
  },
  dark: {
    ...baseTokens,
    ...darkThemeTokens,
  },
};

export const themeStorageKey = 'lego-platform-theme';

function toCssVariables(tokens: ThemeTokenMap): string {
  return Object.entries(tokens)
    .map(([tokenName, tokenValue]) => `  --${tokenName}: ${tokenValue};`)
    .join('\n');
}

export function getThemeStyles(): string {
  return `
:root {
${toCssVariables(themeTokens.light)}
  color-scheme: light;
}

:root[data-theme='dark'] {
${toCssVariables(themeTokens.dark)}
  color-scheme: dark;
}

html {
  background: var(--lego-background);
  color: var(--lego-text);
}

body {
  background:
    radial-gradient(
      circle at 14% 0%,
      color-mix(in srgb, var(--lego-accent-subtle) 58%, transparent),
      transparent 34%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--lego-surface-raised) 42%, transparent),
      transparent 22rem
    ),
    var(--lego-background);
  color: var(--lego-text);
  font-family: var(--lego-font-family-body);
  font-size: var(--lego-text-role-body-size);
  font-weight: var(--lego-text-role-body-weight);
  line-height: var(--lego-text-role-body-line-height);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`.trim();
}

export function getThemeBootstrapScript(): string {
  return `
(() => {
  const key = '${themeStorageKey}';
  const stored = window.localStorage.getItem(key);
  const supportsMatchMedia = typeof window.matchMedia === 'function';
  const system = supportsMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const mode = stored === 'dark' || stored === 'light' ? stored : system;
  document.documentElement.dataset.theme = mode;
})();
`.trim();
}

export function getInitialThemeMode(): ThemeMode {
  return platformConfig.defaultThemeMode;
}

export function getPreferredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return getInitialThemeMode();
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  if (typeof window.matchMedia !== 'function') {
    return getInitialThemeMode();
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset['theme'] = mode;
}

export function persistThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(themeStorageKey, mode);
}

export function toggleThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark';
}
