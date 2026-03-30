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
  'lego-font-size-caption': '0.75rem',
  'lego-font-size-sm': '0.875rem',
  'lego-font-size-base': '1rem',
  'lego-font-size-body': '1rem',
  'lego-font-size-lg': '1.125rem',
  'lego-font-size-xl': '1.35rem',
  'lego-font-size-2xl': '1.85rem',
  'lego-font-size-3xl': '2.4rem',
  'lego-font-size-4xl': 'clamp(2.45rem, 4vw, 3.55rem)',
  'lego-font-size-5xl': 'clamp(3.45rem, 7vw, 5.75rem)',
  'lego-font-weight-regular': '400',
  'lego-font-weight-medium': '500',
  'lego-font-weight-semibold': '600',
  'lego-font-weight-bold': '700',
  'lego-line-height-tight': '1.05',
  'lego-line-height-heading': '1.12',
  'lego-line-height-body': '1.6',
  'lego-line-height-relaxed': '1.66',
  'lego-radius-xs': '4px',
  'lego-radius-sm': '8px',
  'lego-radius-md': '10px',
  'lego-radius-lg': '12px',
  'lego-radius-pill': '999px',
  'lego-shadow-sm': '0 1px 2px rgba(17, 24, 39, 0.05)',
  'lego-shadow-md': '0 2px 6px rgba(17, 24, 39, 0.07)',
  'lego-shadow-lg': '0 8px 16px rgba(17, 24, 39, 0.08)',
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
  'lego-space-14': '3.5rem',
  'lego-space-16': '4rem',
  'lego-max-width': '1600px',
  'lego-max-width-page': '1600px',
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
  'lego-text-role-body-weight': 'var(--lego-font-weight-regular)',
  'lego-text-role-meta-size': 'var(--lego-font-size-sm)',
  'lego-text-role-meta-line-height': '1.45',
  'lego-text-role-eyebrow-size': 'var(--lego-font-size-caption)',
  'lego-text-role-eyebrow-line-height': '1.2',
  'lego-text-role-mono-size': 'var(--lego-font-size-sm)',
  'lego-text-role-mono-line-height': '1.45',
};

const lightThemeTokens: ThemeTokenMap = {
  'lego-background': '#ffffff',
  'lego-surface': '#ffffff',
  'lego-surface-muted': '#eef1f5',
  'lego-surface-subtle': '#f6f7f9',
  'lego-surface-raised': '#ffffff',
  'lego-surface-accent': '#fff1e4',
  'lego-text': '#171a22',
  'lego-text-muted': '#707b8a',
  'lego-border': '#d5dbe5',
  'lego-border-subtle': '#e2e7ee',
  'lego-accent': '#1570ef',
  'lego-accent-hover': '#0f5ec9',
  'lego-accent-subtle': '#ebf3ff',
  'lego-accent-contrast': '#ffffff',
  'lego-brand': '#cf3a30',
  'lego-brand-hover': '#b63027',
  'lego-commerce': '#ef7c1c',
  'lego-commerce-hover': '#d86a12',
  'lego-commerce-subtle': '#fff0e1',
  'lego-positive': '#17874e',
  'lego-positive-subtle': '#e6f4ec',
  'lego-warning': '#f5c400',
  'lego-info': '#0086d8',
  'lego-info-subtle': '#e8f3fb',
  'lego-error': '#c92a2a',
  'lego-error-subtle': '#f8eaea',
  'lego-danger': '#c92a2a',
  'lego-focus-ring': 'rgba(21, 112, 239, 0.22)',
  'lego-disabled': '#aeb7c4',
  'lego-interactive-pressed': 'rgba(23, 26, 34, 0.06)',
  'lego-interactive-pressed-strong': 'rgba(9, 39, 84, 0.14)',
  'lego-shell-header-background': '#ffd500',
  'lego-shell-header-border': '#d4ad00',
  'lego-shell-header-text': '#171a22',
  'lego-shell-footer-background': '#1f3765',
  'lego-shell-footer-text': '#f7f9ff',
  'lego-shell-footer-text-muted': '#d3ddef',
};

const darkThemeTokens: ThemeTokenMap = {
  'lego-background': '#0f141d',
  'lego-surface': '#161c27',
  'lego-surface-muted': '#1c2330',
  'lego-surface-subtle': '#202836',
  'lego-surface-raised': '#161c27',
  'lego-surface-accent': '#2d2216',
  'lego-text': '#f4f7fb',
  'lego-text-muted': '#a7b4c4',
  'lego-border': '#334054',
  'lego-border-subtle': '#3d4a60',
  'lego-accent': '#4f9cff',
  'lego-accent-hover': '#79b6ff',
  'lego-accent-subtle': '#15335f',
  'lego-accent-contrast': '#f7fbff',
  'lego-brand': '#ff5b5f',
  'lego-brand-hover': '#ff7a7f',
  'lego-commerce': '#ff9a3d',
  'lego-commerce-hover': '#ffb160',
  'lego-commerce-subtle': '#38230f',
  'lego-positive': '#4cc57b',
  'lego-positive-subtle': '#193726',
  'lego-warning': '#f0c52d',
  'lego-info': '#54b7ff',
  'lego-info-subtle': '#18334a',
  'lego-error': '#ff7676',
  'lego-error-subtle': '#432324',
  'lego-danger': '#ff7676',
  'lego-focus-ring': 'rgba(79, 156, 255, 0.28)',
  'lego-disabled': '#708097',
  'lego-interactive-pressed': 'rgba(255, 255, 255, 0.06)',
  'lego-interactive-pressed-strong': 'rgba(255, 255, 255, 0.1)',
  'lego-shell-header-background': '#ffd500',
  'lego-shell-header-border': '#d4ad00',
  'lego-shell-header-text': '#111827',
  'lego-shell-footer-background': '#10203d',
  'lego-shell-footer-text': '#f4f7fb',
  'lego-shell-footer-text-muted': '#c3d1eb',
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
  background: var(--lego-background);
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
