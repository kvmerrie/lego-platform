import { MetricCard, StatusTone, ThemeMode } from '@lego-platform/shared/types';

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function sortByLabel<T extends { label: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function uniqueBy<T, K>(
  items: readonly T[],
  getKey: (item: T) => K,
): T[] {
  const seen = new Set<K>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function readStringArrayProperty(
  payload: unknown,
  propertyName: string,
): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const propertyValue = (payload as Record<string, unknown>)[propertyName];

  if (!Array.isArray(propertyValue)) {
    return [];
  }

  return propertyValue.filter(
    (value): value is string => typeof value === 'string',
  );
}

export function normalizeCatalogSetId(input: string): string {
  const normalizedInput = input.trim().replace(/\s+/g, ' ');
  const legoSetNumberMatch = normalizedInput.match(
    /^(?:LEGO\s*)?(\d{4,7})(?:\s*-\s*[0-9A-Za-z]+)?$/i,
  );

  if (legoSetNumberMatch?.[1]) {
    return legoSetNumberMatch[1];
  }

  const variantMatch = normalizedInput.match(
    /^([0-9A-Za-z]+)\s*-\s*[0-9A-Za-z]+$/,
  );

  return variantMatch ? variantMatch[1] : normalizedInput;
}

const toneCopy: Record<StatusTone, string> = {
  accent: 'Strategisch signaal',
  neutral: 'Stabiele basis',
  positive: 'Positief momentum',
  warning: 'Heeft aandacht nodig',
};

export function getMetricNarrative(metric: MetricCard): string {
  return `${metric.label}: ${metric.value}${metric.detail ? `, ${metric.detail}` : ''}`;
}

export function getToneCopy(tone: StatusTone = 'neutral'): string {
  return toneCopy[tone];
}

export function getThemeToggleLabel(mode: ThemeMode): string {
  return mode === 'dark'
    ? 'Schakel naar lichte modus'
    : 'Schakel naar donkere modus';
}

const ACCESSIBLE_FOREGROUND_DARK = '#05070d';
const ACCESSIBLE_FOREGROUND_LIGHT = '#ffffff';

function parseHexColor(
  color?: string,
): [red: number, green: number, blue: number] | undefined {
  const normalizedColor = color?.trim().toLowerCase();

  if (!normalizedColor) {
    return undefined;
  }

  const shortHexMatch = normalizedColor.match(
    /^#([0-9a-f])([0-9a-f])([0-9a-f])$/u,
  );

  if (shortHexMatch) {
    return [
      parseInt(`${shortHexMatch[1]}${shortHexMatch[1]}`, 16),
      parseInt(`${shortHexMatch[2]}${shortHexMatch[2]}`, 16),
      parseInt(`${shortHexMatch[3]}${shortHexMatch[3]}`, 16),
    ];
  }

  const hexMatch = normalizedColor.match(
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u,
  );

  if (!hexMatch) {
    return undefined;
  }

  return [
    parseInt(hexMatch[1], 16),
    parseInt(hexMatch[2], 16),
    parseInt(hexMatch[3], 16),
  ];
}

function getRelativeLuminance([red, green, blue]: [
  red: number,
  green: number,
  blue: number,
]): number {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map(
    (channel) => {
      const normalizedChannel = channel / 255;

      return normalizedChannel <= 0.03928
        ? normalizedChannel / 12.92
        : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
    },
  );

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

export function getAccessibleForegroundColor(
  backgroundColor?: string,
): string | undefined {
  const background = parseHexColor(backgroundColor);

  if (!background) {
    return undefined;
  }

  const backgroundLuminance = getRelativeLuminance(background);
  const darkForeground = parseHexColor(ACCESSIBLE_FOREGROUND_DARK);
  const lightForeground = parseHexColor(ACCESSIBLE_FOREGROUND_LIGHT);

  if (!darkForeground || !lightForeground) {
    return ACCESSIBLE_FOREGROUND_DARK;
  }

  const darkContrast = getContrastRatio(
    getRelativeLuminance(darkForeground),
    backgroundLuminance,
  );
  const lightContrast = getContrastRatio(
    getRelativeLuminance(lightForeground),
    backgroundLuminance,
  );

  return darkContrast >= lightContrast
    ? ACCESSIBLE_FOREGROUND_DARK
    : ACCESSIBLE_FOREGROUND_LIGHT;
}

function getContrastRatio(
  foregroundLuminance: number,
  backgroundLuminance: number,
): number {
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}
