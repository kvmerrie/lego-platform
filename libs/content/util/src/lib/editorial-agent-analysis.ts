import {
  type EditorialAgentArticleType,
  type EditorialAgentCatalogMatch,
  type EditorialAgentDetectedSignals,
  type EditorialAgentEventFingerprint,
  type EditorialAgentExtractedFacts,
  type EditorialAgentExtractedSource,
  type EditorialAgentPrimarySetSelection,
  type EditorialAgentRelatedSetCandidate,
} from './editorial-agent';

const GWP_SIGNAL_TERMS = [
  'cadeau bij aankoop',
  'gwp',
  'insiders',
  'reward',
] as const;
const DEAL_SIGNAL_TERMS = [
  'aanbieding',
  'deal',
  'discount',
  'korting',
  'sale',
] as const;
const RELEASE_ROUNDUP_SIGNAL_TERMS = [
  'alle nieuwe lego-sets',
  'deze nieuwe lego-sets',
  'nieuwe lego-sets',
  'overzicht',
  'release roundup',
  'releasegolf',
  'releases',
] as const;

const DUTCH_MONTHS = new Map([
  ['januari', '01'],
  ['februari', '02'],
  ['maart', '03'],
  ['april', '04'],
  ['mei', '05'],
  ['juni', '06'],
  ['juli', '07'],
  ['augustus', '08'],
  ['september', '09'],
  ['oktober', '10'],
  ['november', '11'],
  ['december', '12'],
]);

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function normalizeSetNumber(value: string): string {
  return value.trim().replace(/-1$/u, '');
}

function lowerCaseContext(values: readonly string[]): string {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function includesAnyTerm(context: string, terms: readonly string[]): boolean {
  return terms.some((term) => context.includes(term));
}

function extractSourceSlugContext(
  source: EditorialAgentExtractedSource,
): string {
  const sourceUrl = source.finalUrl || source.inputUrl;

  if (!sourceUrl) {
    return '';
  }

  try {
    const url = new URL(sourceUrl);
    const pathnameSegments = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathnameSegments.at(-1) ?? '';

    return decodeURIComponent(lastSegment)
      .replace(/[-_]+/gu, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

function findMentionedSetNumbersInContext(
  context: string,
  setNumbers: readonly string[],
): string[] {
  return setNumbers.filter((setNumber) =>
    context.includes(setNumber.toLowerCase()),
  );
}

function buildHeadlineContextParts(
  facts: EditorialAgentExtractedFacts,
  source: EditorialAgentExtractedSource,
): string[] {
  return [
    facts.title,
    source.title,
    source.description,
    extractSourceSlugContext(source),
  ];
}

function findDominantHeadlineSetNumbers({
  detectedSetNumbers,
  facts,
  source,
}: {
  detectedSetNumbers: readonly string[];
  facts: EditorialAgentExtractedFacts;
  source: EditorialAgentExtractedSource;
}): string[] {
  const headlineContext = lowerCaseContext(
    buildHeadlineContextParts(facts, source),
  );

  return findMentionedSetNumbersInContext(headlineContext, detectedSetNumbers);
}

function titleMentionsMatchedSet({
  matchedSet,
  title,
}: {
  matchedSet: EditorialAgentCatalogMatch;
  title: string;
}): boolean {
  const lowerTitle = title.toLowerCase();

  return (
    lowerTitle.includes(matchedSet.setNumber.toLowerCase()) ||
    lowerTitle.includes(matchedSet.name.toLowerCase())
  );
}

function slugifyEventKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 80);
}

function extractYearMonthFromDateSignal(
  dateSignal: string,
): string | undefined {
  const isoMatch = dateSignal.match(/\b(20\d{2})-(\d{2})-\d{2}\b/u);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const monthMatch = dateSignal.match(
    /\b(?:(\d{1,2})\s+)?(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/iu,
  );

  if (monthMatch) {
    const monthNumber = DUTCH_MONTHS.get(monthMatch[2].toLowerCase());

    if (monthNumber) {
      return `${monthMatch[3]}-${monthNumber}`;
    }
  }

  const yearOnlyMatch = dateSignal.match(/\b(20\d{2})\b/u);

  if (yearOnlyMatch) {
    return `${yearOnlyMatch[1]}-01`;
  }

  return undefined;
}

export function detectArticleType(
  facts: EditorialAgentExtractedFacts,
  detected: EditorialAgentDetectedSignals,
  source: EditorialAgentExtractedSource,
): EditorialAgentArticleType {
  const context = lowerCaseContext([
    facts.title,
    facts.summary,
    facts.theme,
    source.title,
    source.description,
    ...facts.keywords,
    ...detected.keywords,
  ]);
  const detectedSetNumbers = uniqueStrings([
    ...facts.setNumbers.map(normalizeSetNumber),
    ...detected.setNumbers.map(normalizeSetNumber),
  ]);
  const headlineContext = lowerCaseContext(
    buildHeadlineContextParts(facts, source),
  );
  const headlineSetNumbers = findDominantHeadlineSetNumbers({
    detectedSetNumbers,
    facts,
    source,
  });
  const hasExplicitRoundupHeadline = includesAnyTerm(
    headlineContext,
    RELEASE_ROUNDUP_SIGNAL_TERMS,
  );

  if (
    includesAnyTerm(context, GWP_SIGNAL_TERMS) &&
    headlineSetNumbers.length === 1
  ) {
    return 'gwp_reward';
  }

  if (includesAnyTerm(context, DEAL_SIGNAL_TERMS)) {
    return 'deal';
  }

  if (headlineSetNumbers.length === 1 && !hasExplicitRoundupHeadline) {
    return 'single_set_news';
  }

  if (
    hasExplicitRoundupHeadline ||
    (detectedSetNumbers.length > 1 &&
      detected.dateSignals.length > 0 &&
      headlineSetNumbers.length !== 1)
  ) {
    return 'release_roundup';
  }

  if (includesAnyTerm(context, GWP_SIGNAL_TERMS)) {
    return 'gwp_reward';
  }

  if (detectedSetNumbers.length === 1) {
    return 'single_set_news';
  }

  return 'unknown';
}

export function selectPrimarySet(
  articleType: EditorialAgentArticleType,
  matchedSets: readonly EditorialAgentCatalogMatch[],
  facts: EditorialAgentExtractedFacts,
  detected: EditorialAgentDetectedSignals,
  source: EditorialAgentExtractedSource,
): EditorialAgentPrimarySetSelection | null {
  if (matchedSets.length === 0) {
    return null;
  }

  if (articleType === 'unknown') {
    return null;
  }

  const titleContext = [facts.title, source.title].filter(Boolean).join(' ');
  const normalizedDetectedSetNumbers = uniqueStrings([
    ...facts.setNumbers.map(normalizeSetNumber),
    ...detected.setNumbers.map(normalizeSetNumber),
  ]);
  const dominantHeadlineSetNumbers = findDominantHeadlineSetNumbers({
    detectedSetNumbers: normalizedDetectedSetNumbers,
    facts,
    source,
  });

  if (articleType === 'release_roundup') {
    const titleMatches = matchedSets.filter((matchedSet) =>
      titleMentionsMatchedSet({
        matchedSet,
        title: titleContext,
      }),
    );

    if (titleMatches.length === 1) {
      return {
        ...titleMatches[0],
        reason: 'title_match',
      };
    }

    return null;
  }

  if (dominantHeadlineSetNumbers.length === 1) {
    const headlineMatchedSet = matchedSets.find(
      (matchedSet) => matchedSet.setNumber === dominantHeadlineSetNumbers[0],
    );

    if (headlineMatchedSet) {
      return {
        ...headlineMatchedSet,
        reason:
          dominantHeadlineSetNumbers.length === 1 &&
          normalizedDetectedSetNumbers.length === 1
            ? 'single_set'
            : 'title_match',
      };
    }

    return null;
  }

  const firstMatchedSet = matchedSets[0];

  return {
    ...firstMatchedSet,
    reason:
      normalizedDetectedSetNumbers.length === 1
        ? 'single_set'
        : 'first_detected',
  };
}

export function selectRelatedSetCandidates({
  articleType,
  matchedSets,
  primarySet,
}: {
  articleType: EditorialAgentArticleType;
  matchedSets: readonly EditorialAgentCatalogMatch[];
  primarySet: EditorialAgentPrimarySetSelection | null;
}): EditorialAgentRelatedSetCandidate[] {
  if (articleType === 'deal' || articleType === 'unknown') {
    return [];
  }

  const seenSetNumbers = new Set<string>();
  const primarySetNumber = primarySet?.setNumber;
  const candidates =
    articleType === 'release_roundup'
      ? matchedSets
      : matchedSets.filter(
          (matchedSet) => matchedSet.setNumber !== primarySetNumber,
        );

  return candidates
    .filter((matchedSet) => {
      if (matchedSet.setNumber === primarySetNumber) {
        return false;
      }

      if (seenSetNumbers.has(matchedSet.setNumber)) {
        return false;
      }

      seenSetNumbers.add(matchedSet.setNumber);
      return true;
    })
    .slice(0, 6)
    .map((matchedSet) => ({
      ...matchedSet,
      reason: 'same_article' as const,
    }));
}

export function buildEventFingerprint(
  articleType: EditorialAgentArticleType,
  primarySet: EditorialAgentPrimarySetSelection | null,
  facts: EditorialAgentExtractedFacts,
  source: EditorialAgentExtractedSource,
  detected: EditorialAgentDetectedSignals,
): EditorialAgentEventFingerprint {
  if (articleType === 'release_roundup') {
    const dateKey =
      detected.dateSignals.map(extractYearMonthFromDateSignal).find(Boolean) ??
      slugifyEventKey(source.title || facts.title || source.domain);

    return {
      key: dateKey,
      type: articleType,
    };
  }

  if (primarySet?.setNumber) {
    return {
      key: primarySet.setNumber,
      type: articleType,
    };
  }

  return {
    key: slugifyEventKey(source.title || facts.title || source.domain),
    type: articleType,
  };
}
