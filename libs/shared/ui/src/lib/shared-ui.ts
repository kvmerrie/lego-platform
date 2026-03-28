import { MetricCard, StatusTone, ThemeMode } from '@lego-platform/shared/types';

const toneCopy: Record<StatusTone, string> = {
  accent: 'Strategic signal',
  neutral: 'Steady baseline',
  positive: 'Positive momentum',
  warning: 'Needs attention',
};

export function getMetricNarrative(metric: MetricCard): string {
  return `${metric.label}: ${metric.value}${metric.detail ? `, ${metric.detail}` : ''}`;
}

export function getToneCopy(tone: StatusTone = 'neutral'): string {
  return toneCopy[tone];
}

export function getThemeToggleLabel(mode: ThemeMode): string {
  return mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}
