export type ThemeMode = 'light' | 'dark';

export type StatusTone = 'accent' | 'neutral' | 'positive' | 'warning';

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
}

export interface MetricCard {
  label: string;
  value: string;
  detail?: string;
  tone?: StatusTone;
}

export interface SectionIntro {
  eyebrow: string;
  title: string;
  description: string;
}

export interface TimelinePoint {
  label: string;
  value: number;
  annotation?: string;
}
