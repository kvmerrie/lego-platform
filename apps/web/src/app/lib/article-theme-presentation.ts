import type { CSSProperties } from 'react';
import {
  getCatalogThemeDefinition,
  getCatalogThemeMutedTextColor,
  getCatalogThemeSurfaceTone,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import type { ContentArticleThemePresentation } from '@lego-platform/content/ui';

export function buildArticleThemePresentation({
  href,
  theme,
}: {
  href?: string;
  theme?: string;
}): ContentArticleThemePresentation | undefined {
  if (!theme) {
    return href ? { href } : undefined;
  }

  const themeDefinition = getCatalogThemeDefinition(theme);
  const normalizedTheme = normalizeTheme(theme);
  const resolvedThemeLabel =
    themeDefinition?.name ?? normalizedTheme?.displayName ?? theme;
  const themeVisual = themeDefinition?.visual;
  const style =
    themeVisual?.backgroundColor || themeVisual?.textColor
      ? ({
          ...(themeVisual.backgroundColor
            ? {
                '--article-theme-accent': themeVisual.backgroundColor,
                '--article-theme-surface': themeVisual.backgroundColor,
                '--catalog-theme-badge-surface': themeVisual.backgroundColor,
              }
            : {}),
          ...(themeVisual.textColor
            ? {
                '--article-theme-accent-text': themeVisual.textColor,
                '--article-theme-muted-text': getCatalogThemeMutedTextColor(
                  themeVisual.textColor,
                ),
                '--article-theme-surface-text': themeVisual.textColor,
                '--catalog-theme-badge-text': themeVisual.textColor,
              }
            : {}),
        } as CSSProperties)
      : undefined;

  if (!resolvedThemeLabel && !href && !style) {
    return undefined;
  }

  return {
    href,
    label: resolvedThemeLabel,
    style,
    tone: getCatalogThemeSurfaceTone(resolvedThemeLabel),
  };
}
