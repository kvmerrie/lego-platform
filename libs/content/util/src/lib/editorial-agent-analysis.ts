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
  'gratis bij aankoop',
  'gwp',
  'insiders reward',
  'inwisselen met punten',
  'reward center',
  'reward centre',
  'rewardpagina',
] as const;
const DEAL_SIGNAL_TERMS = [
  'aanbieding',
  'actie',
  'deal',
  'discount',
  'dubbele insiders-punten',
  'dubbele insiders punten',
  'korting',
  'sale',
] as const;
const AVAILABILITY_SIGNAL_TERMS = [
  'leverbaar',
  'niet meer te bestellen',
  'op voorraad',
  'uitverkocht',
  'weer beschikbaar',
] as const;
const PREORDER_SIGNAL_TERMS = [
  'nu te pre-orderen',
  'pre-order',
  'pre-orderen',
  'voorbestellen',
] as const;
const ANNOUNCEMENT_CONTEXT_TERMS = [
  'aangekondigd',
  'onthuld',
  'verschijnt op',
] as const;
const RELEASE_ROUNDUP_SIGNAL_TERMS = [
  'alle nieuwe sets',
  'alle nieuwe lego-sets',
  'alle sets',
  'deze nieuwe lego-sets',
  'nieuwe lego-sets voor',
  'overzicht',
  'release roundup',
  'releasegolf',
] as const;
const MONTH_CONTEXT_ROUNDUP_TERMS = [
  'gepresenteerd',
  'release',
  'releases',
  'verschijnen',
] as const;
const MULTI_SET_ANNOUNCEMENT_TERMS = [
  'aangekondigd',
  'aankondiging',
  'beelden',
  'eerste beelden',
  'eerste foto',
  'eerste fotos',
  "eerste foto's",
  'foto',
  "foto's",
  'gepresenteerd',
  'goedgekeurd',
  'onthuld',
  'reveal',
  'revealed',
  'te zien',
  'uitgebracht',
] as const;
const IDEAS_APPROVAL_TERMS = [
  'approved',
  'goedgekeurd',
  'ideas projecten',
  'ideas-projecten',
  'reviewronde',
  'selected',
  'worden als set uitgebracht',
] as const;
const CONTEXT_REFERENCE_TERMS = [
  'al uitgebracht',
  'als voorbeeld',
  'eerder',
  'eerder verschenen',
  'in het verleden',
  'net als',
  'referentie',
  'vergelijkbaar met',
  'voormalige',
  'voorbeeld',
  'zoals',
] as const;
const MATCHED_SET_TITLE_STOP_WORDS = new Set([
  'a',
  'aan',
  'and',
  'de',
  'een',
  'en',
  'het',
  'in',
  'lego',
  'of',
  'set',
  'sets',
  'the',
  'van',
  'voor',
]);

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

function hasAnnouncementContext(context: string): boolean {
  return includesAnyTerm(context, ANNOUNCEMENT_CONTEXT_TERMS);
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
  return [facts.title, source.title, extractSourceSlugContext(source)];
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

function findCentralLegoHeadlineSetNumbers({
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
  const centralSetMatches = [
    ...headlineContext.matchAll(
      /\blego(?:\s+[\p{L}0-9&.'-]+){0,4}\s+(\d{5})(?:-\d+)?\b/giu,
    ),
  ].map((match) => normalizeSetNumber(match[1]));
  const centralSetNumbers = uniqueStrings(centralSetMatches);

  return centralSetNumbers.filter((setNumber) =>
    detectedSetNumbers.includes(setNumber),
  );
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

function matchedSetIsCentralToHeadline({
  headlineContext,
  matchedSet,
}: {
  headlineContext: string;
  matchedSet: EditorialAgentCatalogMatch;
}): boolean {
  if (
    headlineContext.includes(matchedSet.setNumber.toLowerCase()) ||
    headlineContext.includes(matchedSet.name.toLowerCase())
  ) {
    return true;
  }

  const significantNameTokens = uniqueStrings(
    matchedSet.name
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter(
        (token) =>
          token.length >= 2 && !MATCHED_SET_TITLE_STOP_WORDS.has(token),
      ),
  );
  const matchedTokenCount = significantNameTokens.filter((token) =>
    headlineContext.includes(token),
  ).length;

  return matchedTokenCount >= 2;
}

function includesContextReferenceAroundMatchedSet({
  context,
  matchedSet,
}: {
  context: string;
  matchedSet: EditorialAgentCatalogMatch;
}): boolean {
  const needles = [
    matchedSet.setNumber.toLowerCase(),
    matchedSet.name.toLowerCase(),
  ].filter((needle) => needle.length > 0);

  for (const needle of needles) {
    let searchFrom = 0;

    for (;;) {
      const index = context.indexOf(needle, searchFrom);

      if (index === -1) {
        break;
      }

      const windowStart = Math.max(0, index - 90);
      const windowEnd = Math.min(context.length, index + needle.length + 90);
      const surroundingText = context.slice(windowStart, windowEnd);

      if (includesAnyTerm(surroundingText, CONTEXT_REFERENCE_TERMS)) {
        return true;
      }

      searchFrom = index + needle.length;
    }
  }

  return false;
}

function isIdeasApprovalArticle({
  context,
  headlineContext,
}: {
  context: string;
  headlineContext: string;
}): boolean {
  const hasIdeasContext =
    context.includes('lego ideas') ||
    context.includes('ideas-project') ||
    context.includes('ideas project');

  return (
    hasIdeasContext &&
    includesAnyTerm(context, IDEAS_APPROVAL_TERMS) &&
    includesAnyTerm(headlineContext || context, [
      'goedgekeurd',
      'reviewronde',
      'selected',
      'worden als set uitgebracht',
    ])
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
  const centralLegoHeadlineSetNumbers = findCentralLegoHeadlineSetNumbers({
    detectedSetNumbers,
    facts,
    source,
  });
  const hasExplicitRoundupHeadline = includesAnyTerm(
    headlineContext,
    RELEASE_ROUNDUP_SIGNAL_TERMS,
  );
  const hasDateGrouping = detected.dateSignals.length > 0;
  const hasMonthContextRoundupHeadline =
    hasDateGrouping &&
    includesAnyTerm(headlineContext, MONTH_CONTEXT_ROUNDUP_TERMS) &&
    (headlineContext.includes('maand') ||
      headlineContext.includes('nieuwe sets') ||
      headlineContext.includes('lego sets') ||
      headlineContext.includes('lego-sets'));
  const hasStrongRoundupHeadline =
    hasExplicitRoundupHeadline || hasMonthContextRoundupHeadline;
  const hasIdeasApprovalSignal = isIdeasApprovalArticle({
    context,
    headlineContext,
  });
  const hasManySetsWithStrongDateGrouping =
    detectedSetNumbers.length > 6 && hasDateGrouping;
  const hasMultiSetAnnouncementHeadline =
    detectedSetNumbers.length <= 6 &&
    (includesAnyTerm(headlineContext, MULTI_SET_ANNOUNCEMENT_TERMS) ||
      hasIdeasApprovalSignal);
  const hasSingleCentralHeadlineSet =
    !hasStrongRoundupHeadline &&
    (headlineSetNumbers.length === 1 ||
      centralLegoHeadlineSetNumbers.length === 1);

  const hasPreorderAnnouncementSignal =
    includesAnyTerm(context, PREORDER_SIGNAL_TERMS) &&
    hasAnnouncementContext(context);
  const hasAvailabilitySignal =
    includesAnyTerm(context, AVAILABILITY_SIGNAL_TERMS) &&
    !hasAnnouncementContext(context);
  const hasDealSignal =
    includesAnyTerm(context, DEAL_SIGNAL_TERMS) || hasAvailabilitySignal;
  const hasExplicitGwpSignal = includesAnyTerm(context, GWP_SIGNAL_TERMS);

  if (
    hasPreorderAnnouncementSignal &&
    (hasSingleCentralHeadlineSet || detectedSetNumbers.length === 1)
  ) {
    return 'single_set_news';
  }

  if (hasDealSignal && !hasExplicitGwpSignal) {
    return 'deal';
  }

  if (hasExplicitGwpSignal && headlineSetNumbers.length === 1) {
    return 'gwp_reward';
  }

  if (hasSingleCentralHeadlineSet) {
    return 'single_set_news';
  }

  if (hasMultiSetAnnouncementHeadline && !hasStrongRoundupHeadline) {
    return 'multi_set_announcement';
  }

  if (
    hasStrongRoundupHeadline ||
    (hasManySetsWithStrongDateGrouping && headlineSetNumbers.length !== 1)
  ) {
    return 'release_roundup';
  }

  if (hasExplicitGwpSignal) {
    return 'gwp_reward';
  }

  if (detectedSetNumbers.length === 1) {
    return 'single_set_news';
  }

  if (detectedSetNumbers.length >= 2 && detectedSetNumbers.length <= 6) {
    return 'multi_set_announcement';
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
  const centralLegoHeadlineSetNumbers = findCentralLegoHeadlineSetNumbers({
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

  if (articleType === 'multi_set_announcement') {
    const bodyContext = lowerCaseContext([facts.summary, source.description]);
    const multiSetHeadlineContext = lowerCaseContext([
      titleContext,
      extractSourceSlugContext(source),
    ]);
    const isIdeasApproval = isIdeasApprovalArticle({
      context: lowerCaseContext([
        facts.title,
        facts.summary,
        source.title,
        source.description,
        ...facts.keywords,
        ...detected.keywords,
      ]),
      headlineContext: multiSetHeadlineContext,
    });
    const titleMatches = matchedSets.filter(
      (matchedSet) =>
        matchedSetIsCentralToHeadline({
          headlineContext: multiSetHeadlineContext,
          matchedSet,
        }) &&
        !includesContextReferenceAroundMatchedSet({
          context: bodyContext,
          matchedSet,
        }) &&
        (!isIdeasApproval ||
          findMentionedSetNumbersInContext(multiSetHeadlineContext, [
            matchedSet.setNumber,
          ]).length > 0 ||
          multiSetHeadlineContext.includes(matchedSet.name.toLowerCase())),
    );

    if (titleMatches.length > 0) {
      return {
        ...titleMatches[0],
        reason: 'title_match',
      };
    }

    return null;
  }

  if (
    dominantHeadlineSetNumbers.length === 1 ||
    centralLegoHeadlineSetNumbers.length === 1
  ) {
    const headlineSetNumber =
      dominantHeadlineSetNumbers.length === 1
        ? dominantHeadlineSetNumbers[0]
        : centralLegoHeadlineSetNumbers[0];
    const headlineMatchedSet = matchedSets.find(
      (matchedSet) => matchedSet.setNumber === headlineSetNumber,
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

  if (articleType === 'multi_set_announcement' && !primarySet) {
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
