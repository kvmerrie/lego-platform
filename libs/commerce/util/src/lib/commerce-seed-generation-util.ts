import {
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
} from './commerce-util';

export const generatedCommerceSeedNotePrefix = '[seed-generator:v1]';

const commerceSeedValidationStopWords = new Set([
  'and',
  'de',
  'der',
  'die',
  'een',
  'en',
  'for',
  'het',
  'la',
  'met',
  'set',
  'the',
  'van',
]);

const commerceSeedAccessorySignalFragments = [
  'acrylic',
  'display box',
  'display case',
  'displaycase',
  'displaystand',
  'led kit',
  'led-verlichting',
  'licht kit',
  'lichtset',
  'lighting kit',
  'lightailing',
  'light my bricks',
  'replacement part',
  'spare part',
  'sticker',
  'stickers',
  'verlichting',
  'vitrine',
] as const;

const commerceSeedMarketplaceNoiseFragments = [
  'compatible',
  'moc',
  'occasion',
  'refurbished',
  'tweedehands',
  'used',
] as const;

function normalizeCommerceSeedValidationText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeCommerceSeedValidationName(value: string): string[] {
  return normalizeCommerceSeedValidationText(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3 &&
        !commerceSeedValidationStopWords.has(token) &&
        !/^\d+$/.test(token),
    );
}

function buildNormalizedPieceCountSignals(pieceCount?: number): string[] {
  if (!pieceCount || pieceCount <= 0) {
    return [];
  }

  return [
    String(pieceCount),
    pieceCount.toLocaleString('nl-NL'),
    pieceCount.toLocaleString('en-US'),
  ].map((value) => normalizeCommerceSeedValidationText(value));
}

function extractPotentialSetNumbers(value: string): string[] {
  return [...value.matchAll(/\b\d{4,6}\b/g)].map((match) => match[0]);
}

function containsAnyFragment({
  fragments,
  normalizedText,
}: {
  fragments: readonly string[];
  normalizedText: string;
}): boolean {
  return fragments.some((fragment) =>
    normalizedText.includes(normalizeCommerceSeedValidationText(fragment)),
  );
}

export interface CommerceGeneratedSeedValidationTarget {
  pieceCount?: number;
  setId: string;
  setName: string;
}

export interface CommerceGeneratedSeedValidationSignals {
  accessorySignal: boolean;
  exactSetIdMatch: boolean;
  legoBrandSignal: boolean;
  marketplaceNoiseSignal: boolean;
  matchedNameTokens: readonly string[];
  nameMatchRatio: number;
  otherSetNumbers: readonly string[];
  pieceCountMatch: boolean;
}

export interface CommerceGeneratedSeedValidationAssessment {
  decision: 'invalid' | 'stale' | 'valid';
  reason: string;
  score: number;
  signals: CommerceGeneratedSeedValidationSignals;
}

export function buildGeneratedCommerceSeedCandidateNote(input: {
  merchantSlug: string;
  setId: string;
}): string {
  return `${generatedCommerceSeedNotePrefix} candidate merchant=${input.merchantSlug} set=${input.setId}`;
}

export function buildGeneratedCommerceSeedValidatedNote(input: {
  merchantSlug: string;
  setId: string;
}): string {
  return `${generatedCommerceSeedNotePrefix} validated merchant=${input.merchantSlug} set=${input.setId}`;
}

export function buildGeneratedCommerceSeedRejectedNote(input: {
  merchantSlug: string;
  setId: string;
}): string {
  return `${generatedCommerceSeedNotePrefix} rejected merchant=${input.merchantSlug} set=${input.setId}`;
}

export function buildGeneratedCommerceSeedStaleNote(input: {
  merchantSlug: string;
  setId: string;
}): string {
  return `${generatedCommerceSeedNotePrefix} unresolved merchant=${input.merchantSlug} set=${input.setId}`;
}

export function isGeneratedCommerceSeedNote(note?: string): boolean {
  return note?.startsWith(generatedCommerceSeedNotePrefix) ?? false;
}

export function buildCommerceGeneratedSeedSearchUrl(input: {
  merchantSlug: string;
  setId: string;
}): string | undefined {
  return buildCommerceMerchantSearchUrl({
    merchantSlug: input.merchantSlug,
    query: buildCommerceMerchantSearchQuery({
      setId: input.setId,
    }),
  });
}

export function assessCommerceGeneratedSeedCandidate(input: {
  contextText: string;
  target: CommerceGeneratedSeedValidationTarget;
  url?: string;
}): CommerceGeneratedSeedValidationAssessment {
  const normalizedText = normalizeCommerceSeedValidationText(
    [input.url ?? '', input.contextText].join(' '),
  );
  const nameTokens = tokenizeCommerceSeedValidationName(input.target.setName);
  const matchedNameTokens = nameTokens.filter((token) =>
    normalizedText.includes(token),
  );
  const exactSetIdMatch = normalizedText.includes(
    normalizeCommerceSeedValidationText(input.target.setId),
  );
  const potentialSetNumbers = extractPotentialSetNumbers(normalizedText);
  const otherSetNumbers = [...new Set(potentialSetNumbers)].filter(
    (setNumber) => setNumber !== input.target.setId,
  );
  const pieceCountSignals = buildNormalizedPieceCountSignals(
    input.target.pieceCount,
  );
  const pieceCountMatch = pieceCountSignals.some(
    (pieceCountSignal) =>
      pieceCountSignal && normalizedText.includes(pieceCountSignal),
  );
  const accessorySignal = containsAnyFragment({
    normalizedText,
    fragments: commerceSeedAccessorySignalFragments,
  });
  const marketplaceNoiseSignal = containsAnyFragment({
    normalizedText,
    fragments: commerceSeedMarketplaceNoiseFragments,
  });
  const legoBrandSignal =
    normalizedText.includes(' lego ') ||
    normalizedText.startsWith('lego ') ||
    normalizedText.endsWith(' lego') ||
    normalizedText.includes(' lego-') ||
    normalizedText.includes(' brand lego');
  const nameMatchRatio =
    nameTokens.length === 0 ? 0 : matchedNameTokens.length / nameTokens.length;

  let score = 0;

  if (exactSetIdMatch) {
    score += 60;
  }

  if (legoBrandSignal) {
    score += 20;
  }

  if (pieceCountMatch) {
    score += 10;
  }

  score += Math.round(nameMatchRatio * 30);

  if (accessorySignal) {
    score -= 120;
  }

  if (marketplaceNoiseSignal) {
    score -= 25;
  }

  if (!exactSetIdMatch && otherSetNumbers.length > 0) {
    score -= 40;
  }

  const signals: CommerceGeneratedSeedValidationSignals = {
    exactSetIdMatch,
    legoBrandSignal,
    matchedNameTokens,
    nameMatchRatio,
    pieceCountMatch,
    accessorySignal,
    marketplaceNoiseSignal,
    otherSetNumbers,
  };

  if (accessorySignal && exactSetIdMatch) {
    return {
      decision: 'invalid',
      reason:
        'Exact setnummer gevonden, maar de pagina oogt als accessoire of displaykit.',
      score,
      signals,
    };
  }

  if (!exactSetIdMatch && otherSetNumbers.length > 0 && nameMatchRatio < 0.5) {
    return {
      decision: 'invalid',
      reason:
        'De pagina noemt wel andere setnummers, maar niet het bedoelde LEGO-setnummer.',
      score,
      signals,
    };
  }

  if (
    exactSetIdMatch &&
    !accessorySignal &&
    ((legoBrandSignal &&
      (nameMatchRatio >= 0.5 ||
        pieceCountMatch ||
        otherSetNumbers.length === 0)) ||
      nameMatchRatio >= 0.8)
  ) {
    return {
      decision: 'valid',
      reason:
        nameMatchRatio >= 0.5 || pieceCountMatch
          ? 'Setnummer, naam en LEGO-signalen wijzen sterk naar de juiste set.'
          : 'Setnummer en LEGO-signalen wijzen sterk naar de juiste productpagina, ook al verschilt de titel lokaal.',
      score,
      signals,
    };
  }

  if (!exactSetIdMatch && nameMatchRatio < 0.34 && !pieceCountMatch) {
    return {
      decision: 'invalid',
      reason:
        'De pagina geeft te weinig signalen dat dit de bedoelde LEGO-set is.',
      score,
      signals,
    };
  }

  return {
    decision: 'stale',
    reason:
      'De pagina geeft nog geen sterke of eenduidige match voor deze set.',
    score,
    signals,
  };
}
