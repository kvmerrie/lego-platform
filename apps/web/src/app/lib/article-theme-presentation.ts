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

  const resolvedThemeLabel = theme.trim() || undefined;

  if (!resolvedThemeLabel && !href) {
    return undefined;
  }

  return {
    href,
    label: resolvedThemeLabel,
    tone: 'light',
  };
}
