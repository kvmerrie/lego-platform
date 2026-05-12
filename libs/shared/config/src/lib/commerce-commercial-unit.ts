export const commerceCommercialUnitTypes = [
  'full_set',
  'display_box',
  'blind_bag',
  'single_unit',
  'accessory',
  'magazine_bonus',
  'unknown',
] as const;

export type CommerceCommercialUnitType =
  (typeof commerceCommercialUnitTypes)[number];

export type CommerceCommercialUnitComparisonGroup =
  | 'set_package'
  | 'single_item'
  | 'accessory'
  | 'magazine_bonus'
  | 'unknown';

export interface CommerceCommercialUnitClassificationInput {
  notes?: string | null;
  productTitle?: string | null;
  productUrl?: string | null;
  setId?: string | null;
}

const displayBoxPattern =
  /\b(random box|display box|displaydoos|display|sealed box|complete serie|complete series|complete set|complete collectie|full set|volledige serie|volledige collectie|box of (?:12|24|36)|(?:12|24|36)\s*(?:stuks|pcs|pieces|x))\b/i;
const blindBagPattern =
  /\b(blind bag|mystery bag|blindbox|blind box|verrassingszakje|mystery pack|single figure|single minifigure|losse minifiguur|losse figuur|1\s*stuk|per stuk|single pack|foil bag|polybag)\b/i;
const accessoryPattern =
  /\b(accessory|accessoire|sleutelhanger|keychain|display case|vitrine|light kit|verlichting|minifigure frame)\b/i;
const magazinePattern = /\b(magazine|tijdschrift|boekje|booklet|foil pack)\b/i;
const fullSetPattern = /\b(full set|complete set|bouwset|construction set)\b/i;
const legoSetNumberPattern = /\b\d{4,7}(?:-1)?\b/;
const collectibleMinifigureSeriesPattern = /^710\d{2}(?:-1)?$/;

function normalizeCommercialUnitText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function classifyCommerceCommercialUnitType({
  notes,
  productTitle,
  productUrl,
  setId,
}: CommerceCommercialUnitClassificationInput): CommerceCommercialUnitType {
  const text = normalizeCommercialUnitText(
    [productTitle, notes, productUrl].filter(Boolean).join(' '),
  );

  if (!text) {
    return 'unknown';
  }

  if (magazinePattern.test(text)) {
    return 'magazine_bonus';
  }

  if (accessoryPattern.test(text)) {
    return 'accessory';
  }

  if (fullSetPattern.test(text)) {
    return 'full_set';
  }

  if (displayBoxPattern.test(text)) {
    return 'display_box';
  }

  if (blindBagPattern.test(text)) {
    return 'blind_bag';
  }

  const normalizedSetId = normalizeCommercialUnitText(setId).trim();

  if (
    normalizedSetId &&
    !collectibleMinifigureSeriesPattern.test(normalizedSetId) &&
    (legoSetNumberPattern.test(normalizedSetId) ||
      legoSetNumberPattern.test(text))
  ) {
    return 'full_set';
  }

  return 'unknown';
}

export function getCommerceCommercialUnitComparisonGroup(
  unitType?: CommerceCommercialUnitType,
): CommerceCommercialUnitComparisonGroup {
  switch (unitType) {
    case 'full_set':
    case 'display_box':
      return 'set_package';
    case 'blind_bag':
    case 'single_unit':
      return 'single_item';
    case 'accessory':
      return 'accessory';
    case 'magazine_bonus':
      return 'magazine_bonus';
    case 'unknown':
    default:
      return 'unknown';
  }
}

export function isCommerceCommercialUnitComparableForDeals(
  unitType?: CommerceCommercialUnitType,
): boolean {
  return getCommerceCommercialUnitComparisonGroup(unitType) !== 'unknown';
}

export function compareCommerceCommercialUnitPreference(
  left?: CommerceCommercialUnitType,
  right?: CommerceCommercialUnitType,
): number {
  const leftGroup = getCommerceCommercialUnitComparisonGroup(left);
  const rightGroup = getCommerceCommercialUnitComparisonGroup(right);

  if (leftGroup === rightGroup) {
    return 0;
  }

  const groupPriority: Record<CommerceCommercialUnitComparisonGroup, number> = {
    set_package: 0,
    single_item: 1,
    accessory: 2,
    magazine_bonus: 3,
    unknown: 4,
  };

  return groupPriority[leftGroup] - groupPriority[rightGroup];
}

export function areCommerceCommercialUnitsComparableForDeals(
  left?: CommerceCommercialUnitType,
  right?: CommerceCommercialUnitType,
): boolean {
  const leftGroup = getCommerceCommercialUnitComparisonGroup(left);
  const rightGroup = getCommerceCommercialUnitComparisonGroup(right);

  return leftGroup !== 'unknown' && leftGroup === rightGroup;
}
