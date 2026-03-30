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
    "var(--font-plus-jakarta-sans), 'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif",
  'lego-font-family-heading':
    "var(--font-plus-jakarta-sans), 'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif",
  'lego-font-family-mono': "'SFMono-Regular', 'Cascadia Code', monospace",
  'lego-font-size-caption': '0.78rem',
  'lego-font-size-sm': '0.92rem',
  'lego-font-size-body': '1rem',
  'lego-font-size-lg': '1.125rem',
  'lego-font-size-xl': '1.35rem',
  'lego-font-size-2xl': '1.85rem',
  'lego-font-size-3xl': '2.4rem',
  'lego-font-size-4xl': 'clamp(2.45rem, 4vw, 3.55rem)',
  'lego-font-size-5xl': 'clamp(3.45rem, 7vw, 5.75rem)',
  'lego-font-weight-medium': '500',
  'lego-font-weight-semibold': '600',
  'lego-font-weight-bold': '700',
  'lego-line-height-tight': '1.05',
  'lego-line-height-heading': '1.12',
  'lego-line-height-body': '1.6',
  'lego-line-height-relaxed': '1.72',
  'lego-radius-xs': '6px',
  'lego-radius-sm': '10px',
  'lego-radius-md': '12px',
  'lego-radius-lg': '14px',
  'lego-radius-pill': '999px',
  'lego-shadow-sm': '0 1px 2px rgba(20, 27, 38, 0.04)',
  'lego-shadow-md': '0 2px 6px rgba(20, 27, 38, 0.05)',
  'lego-shadow-lg': '0 8px 18px rgba(20, 27, 38, 0.08)',
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
  'lego-background': '#f4f6f9',
  'lego-surface': '#ffffff',
  'lego-surface-muted': '#eef2f7',
  'lego-surface-raised': '#ffffff',
  'lego-surface-accent': '#fff3ea',
  'lego-text': '#17202c',
  'lego-text-muted': '#5d6776',
  'lego-border': '#d8e0ea',
  'lego-accent': '#d84533',
  'lego-accent-hover': '#bf3424',
  'lego-accent-subtle': '#fde1da',
  'lego-accent-contrast': '#fff8f5',
  'lego-positive': '#1c8a5a',
  'lego-warning': '#c8920c',
  'lego-info': '#2d69ca',
  'lego-error': '#c7423a',
  'lego-focus-ring': 'rgba(216, 69, 51, 0.22)',
  'lego-disabled': '#aeb7c4',
  'lego-interactive-pressed': 'rgba(23, 32, 44, 0.06)',
  'lego-interactive-pressed-strong': 'rgba(23, 32, 44, 0.11)',
};

const darkThemeTokens: ThemeTokenMap = {
  'lego-background': '#0f1621',
  'lego-surface': '#171f2b',
  'lego-surface-muted': '#1e2938',
  'lego-surface-raised': '#1b2532',
  'lego-surface-accent': '#2c1f1a',
  'lego-text': '#f4f7fb',
  'lego-text-muted': '#b8c1cf',
  'lego-border': '#334255',
  'lego-accent': '#ff7d69',
  'lego-accent-hover': '#ff9786',
  'lego-accent-subtle': '#412621',
  'lego-accent-contrast': '#1f1411',
  'lego-positive': '#63d29a',
  'lego-warning': '#efc35d',
  'lego-info': '#88bbff',
  'lego-error': '#ff8a80',
  'lego-focus-ring': 'rgba(255, 185, 172, 0.24)',
  'lego-disabled': '#637187',
  'lego-interactive-pressed': 'rgba(255, 255, 255, 0.06)',
  'lego-interactive-pressed-strong': 'rgba(255, 255, 255, 0.1)',
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
      circle at 12% 0%,
      color-mix(in srgb, var(--lego-accent-subtle) 62%, transparent),
      transparent 28%
    ),
    radial-gradient(
      circle at 100% 0%,
      color-mix(in srgb, var(--lego-warning) 10%, transparent),
      transparent 22%
    ),
    radial-gradient(
      circle at 100% 100%,
      color-mix(in srgb, var(--lego-info) 10%, transparent),
      transparent 26%
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
