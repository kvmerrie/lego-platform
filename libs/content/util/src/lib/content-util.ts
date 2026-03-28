export interface EditorialSection {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface PreviewPanel {
  status: string;
  summary: string;
  updatedAt: string;
}

export function getHeroSection(
  sections: readonly EditorialSection[],
): EditorialSection {
  return sections[0];
}
