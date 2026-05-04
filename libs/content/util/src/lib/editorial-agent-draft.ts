import {
  type EditorialAgentArticleType,
  editorialAgentSetRailPropName,
  formatSetSpotlightListSetIdsForMdx,
  formatSetRailSetIdsForMdx,
  type EditorialAgentArticleFrontmatter,
  type EditorialAgentDraftGenerationInput,
  type EditorialAgentDraftOutput,
  type EditorialAgentExtractedFacts,
  type EditorialAgentExtractedSource,
  type EditorialAgentPrimarySetSelection,
  type EditorialAgentRelatedSetCandidate,
  type EditorialAgentSetPreview,
} from './editorial-agent';
import {
  DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
  normalizePublicContentArticleTheme,
} from './content-util';

const DUTCH_MONTH_LABELS = new Map([
  ['01', 'januari'],
  ['02', 'februari'],
  ['03', 'maart'],
  ['04', 'april'],
  ['05', 'mei'],
  ['06', 'juni'],
  ['07', 'juli'],
  ['08', 'augustus'],
  ['09', 'september'],
  ['10', 'oktober'],
  ['11', 'november'],
  ['12', 'december'],
]);

const RELEASE_ROUNDUP_SETS_SECTION_ID = 'nieuwe-sets-die-opvallen';
const ARTICLE_DATE_FALLBACK_WARNING =
  'Geen bronpublicatiedatum of duidelijke artikeldatum gevonden; frontmatter.date is teruggevallen op vandaag.';
const SET_NAME_RELEASE_SUFFIX_PATTERNS = [
  /\s+(?:verschijnt|komt)\s+op\b[\s\S]*$/iu,
  /\s+verkrijgbaar\s+vanaf\b[\s\S]*$/iu,
  /\s+opnieuw\s+verkrijgbaar\s+als\b[\s\S]*$/iu,
  /\s+uitverkocht\b[\s\S]*$/iu,
] as const;

export type EditorialArticleTone = 'decision' | 'discovery';
export type EditorialSingleSetDraftTone = 'announcement' | 'decision';
type EditorialDraftTemplateKind =
  | 'release_roundup'
  | 'single_set'
  | 'deal'
  | 'unknown';
type ThemeToneCopyContext =
  | 'announcement_audience'
  | 'announcement_conclusion'
  | 'announcement_description'
  | 'announcement_intro';

const SINGLE_SET_ANNOUNCEMENT_TERMS = [
  'verschijnt',
  'komt op',
  'onthuld',
  'aangekondigd',
  'release',
] as const;

const SINGLE_SET_DECISION_TERMS = [
  'deal',
  'korting',
  'sale',
  'uitverkocht',
  'opnieuw verkrijgbaar',
  'reward',
  'gwp',
  'insiders',
] as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function normalizeThemeToneKey(
  theme: string,
  context = '',
): 'harry_potter' | 'lord_of_the_rings' | 'star_wars' | null {
  const normalizedValue = normalizeWhitespace(`${theme} ${context}`)
    .toLowerCase()
    .replace(/[™®]/gu, '');

  if (normalizedValue.includes('star wars')) {
    return 'star_wars';
  }

  if (normalizedValue.includes('harry potter')) {
    return 'harry_potter';
  }

  if (
    normalizedValue.includes('lord of the rings') ||
    normalizedValue.includes('middle-earth') ||
    normalizedValue.includes('rivendell') ||
    normalizedValue.includes('barad') ||
    normalizedValue.includes('shire')
  ) {
    return 'lord_of_the_rings';
  }

  return null;
}

function hasEnoughThemeToneConfidence(theme: string, context: string): boolean {
  return Boolean(normalizeThemeToneKey(theme, context));
}

export function getThemeToneCopy(
  theme: string,
  context: ThemeToneCopyContext,
): string | null {
  const themeToneKey = normalizeThemeToneKey(theme);

  if (!themeToneKey) {
    return null;
  }

  const copyByThemeAndContext: Record<
    NonNullable<ReturnType<typeof normalizeThemeToneKey>>,
    Record<ThemeToneCopyContext, string>
  > = {
    harry_potter: {
      announcement_audience:
        'Voor Harry Potter-fans zit de lol vooral in Hogwarts, herkenbare scènes en dat displaygevoel van een klein diorama.',
      announcement_conclusion:
        'Zet hem vooral op je radar als Hogwarts, scènes en herkenbare momenten het deel van Harry Potter zijn waar je collectie sterker van wordt.',
      announcement_description:
        'Voor Harry Potter-fans is dit vooral interessant door de Hogwarts-sfeer, herkenbare scènes en het displaygevoel.',
      announcement_intro:
        'De haak zit hier in Hogwarts-herkenning: scènes, kleine details en dat diorama-gevoel dat meteen aan de films doet denken.',
    },
    lord_of_the_rings: {
      announcement_audience:
        'Voor Lord of the Rings-fans draait dit om Middle-earth, sterke locaties en epische scènes die als display blijven werken.',
      announcement_conclusion:
        'Volg hem vooral als Middle-earth-locaties en epische scènes precies zijn wat je op de plank wilt zien.',
      announcement_description:
        'Voor Lord of the Rings-fans is dit vooral interessant door Middle-earth, herkenbare locaties en epische displaywaarde.',
      announcement_intro:
        'De haak zit hier in Middle-earth: locaties, sfeer en epische scènes die als displaystuk kunnen blijven hangen.',
    },
    star_wars: {
      announcement_audience:
        'Voor Star Wars-fans is dit vooral leuk als je deze lijn spaart of iets hebt met Imperial, Rebel of trooper designs.',
      announcement_conclusion:
        'Zet hem vooral op je radar als je deze lijn spaart of graag Star Wars-designs met duidelijke displaywaarde neerzet.',
      announcement_description:
        'Voor Star Wars-fans is dit vooral interessant als je deze lijn spaart of iets hebt met displaysets, Imperial/Rebel-details of trooper designs.',
      announcement_intro:
        'De haak zit hier in displaywaarde: denk aan Helmet Collection-energie, strakke Star Wars-vormen en Imperial/Rebel vibes.',
    },
  };

  return copyByThemeAndContext[themeToneKey][context];
}

export function capitalizeSentenceStart(value: string): string {
  const normalizedValue = value.trimStart();

  if (normalizedValue.length === 0) {
    return '';
  }

  const firstLetterMatch = normalizedValue.match(/\p{L}/u);

  if (!firstLetterMatch || typeof firstLetterMatch.index !== 'number') {
    return normalizedValue;
  }

  const letterIndex = firstLetterMatch.index;

  return (
    normalizedValue.slice(0, letterIndex) +
    normalizedValue.charAt(letterIndex).toLocaleUpperCase('nl-NL') +
    normalizedValue.slice(letterIndex + 1)
  );
}

function escapeFrontmatterValue(value: string): string {
  return value.replace(/"/gu, '\\"');
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 96);
}

const DUTCH_MONTH_NUMBERS = new Map(
  [...DUTCH_MONTH_LABELS.entries()].map(([monthNumber, monthLabel]) => [
    monthLabel,
    monthNumber,
  ]),
);

function normalizeIsoDate(value: string): string | null {
  const match = value.match(/\b(20\d{2})-(\d{2})-(\d{2})(?=\b|T)/u);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function normalizeDutchDateSignal(value: string): string | null {
  const normalizedValue = normalizeWhitespace(value).toLowerCase();
  const match = normalizedValue.match(
    /\b(?:(\d{1,2})\s+)?(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/iu,
  );

  if (!match) {
    return null;
  }

  const day = String(Number(match[1] ?? '1')).padStart(2, '0');
  const month = DUTCH_MONTH_NUMBERS.get(match[2].toLowerCase());
  const year = match[3];

  return month && year ? `${year}-${month}-${day}` : null;
}

function resolveDraftArticleDate(input: EditorialAgentDraftGenerationInput): {
  date: string;
  usedFallback: boolean;
} {
  const sourcePublishedDate = input.source.publishedAt
    ? (normalizeIsoDate(input.source.publishedAt) ??
      normalizeDutchDateSignal(input.source.publishedAt))
    : null;

  if (sourcePublishedDate) {
    return {
      date: sourcePublishedDate,
      usedFallback: false,
    };
  }

  for (const dateSignal of input.detected.dateSignals) {
    const date =
      normalizeIsoDate(dateSignal) ?? normalizeDutchDateSignal(dateSignal);

    if (date) {
      return {
        date,
        usedFallback: false,
      };
    }
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    usedFallback: true,
  };
}

function resolveSourceUrl(input: EditorialAgentDraftGenerationInput): string {
  return input.source.finalUrl || input.source.inputUrl;
}

function resolveDraftTemplateKind(
  articleType: EditorialAgentArticleType,
): EditorialDraftTemplateKind {
  switch (articleType) {
    case 'release_roundup':
      return 'release_roundup';
    case 'multi_set_announcement':
    case 'single_set_news':
    case 'gwp_reward':
      return 'single_set';
    case 'deal':
      return 'deal';
    case 'unknown':
    default:
      return 'unknown';
  }
}

export function getEditorialToneForArticleType(
  articleType: EditorialAgentArticleType,
): EditorialArticleTone {
  switch (articleType) {
    case 'single_set_news':
    case 'gwp_reward':
    case 'deal':
      return 'decision';
    case 'multi_set_announcement':
    case 'release_roundup':
    case 'unknown':
    default:
      return 'discovery';
  }
}

function buildSingleSetDraftContext(
  input: EditorialAgentDraftGenerationInput,
): string {
  return normalizeWhitespace(
    [
      input.source.title,
      input.facts.title,
      input.source.description,
      input.source.finalUrl,
      input.source.inputUrl,
    ]
      .filter(Boolean)
      .join(' '),
  ).toLowerCase();
}

export function getSingleSetDraftTone(
  input: EditorialAgentDraftGenerationInput,
): EditorialSingleSetDraftTone {
  if (input.matching.articleType === 'multi_set_announcement') {
    return 'announcement';
  }

  if (input.matching.articleType !== 'single_set_news') {
    return 'decision';
  }

  const context = buildSingleSetDraftContext(input);

  if (
    SINGLE_SET_DECISION_TERMS.some((term) =>
      context.includes(term.toLowerCase()),
    )
  ) {
    return 'decision';
  }

  if (
    SINGLE_SET_ANNOUNCEMENT_TERMS.some((term) =>
      context.includes(term.toLowerCase()),
    )
  ) {
    return 'announcement';
  }

  return 'decision';
}

export function getEditorialToneForDraftInput(
  input: EditorialAgentDraftGenerationInput,
): EditorialArticleTone {
  if (input.matching.articleType === 'multi_set_announcement') {
    return 'discovery';
  }

  if (input.matching.articleType === 'single_set_news') {
    return getSingleSetDraftTone(input) === 'announcement'
      ? 'discovery'
      : 'decision';
  }

  return getEditorialToneForArticleType(input.matching.articleType);
}

function resolveTheme(input: EditorialAgentDraftGenerationInput): string {
  function resolveKeywordTheme(): string | undefined {
    const context = normalizeWhitespace(
      [
        input.facts.title,
        input.facts.summary,
        input.source.title,
        input.source.description,
        input.source.finalUrl,
        input.source.inputUrl,
        input.primarySet?.name,
        input.primarySet?.theme,
        ...input.facts.setNames,
        ...input.facts.keywords,
        ...input.detected.keywords,
        ...input.matching.matchedSets.map((matchedSet) => matchedSet.name),
      ]
        .filter(Boolean)
        .join(' '),
    ).toLowerCase();

    if (context.includes('lego marvel')) {
      return 'Marvel';
    }

    if (context.includes('star wars')) {
      return 'Star Wars';
    }

    if (context.includes('super mario')) {
      return 'Super Mario';
    }

    if (context.includes('sonic')) {
      return 'Sonic The Hedgehog';
    }

    if (
      context.includes('lego icons') ||
      context.includes('star trek') ||
      context.includes('rivendell') ||
      context.includes('barad')
    ) {
      return 'LEGO® Icons';
    }

    if (
      context.includes('speed champions') ||
      context.includes('formula 1') ||
      /\bf1\b/u.test(context) ||
      context.includes('lewis hamilton') ||
      context.includes('piastri') ||
      context.includes('norris') ||
      context.includes('mclaren') ||
      context.includes('ferrari') ||
      context.includes('mercedes-amg') ||
      context.includes('williams racing')
    ) {
      return 'Speed Champions';
    }

    if (
      context.includes('technic') ||
      context.includes('bugatti') ||
      context.includes('lamborghini') ||
      context.includes('koenigsegg')
    ) {
      return 'Technic';
    }

    return undefined;
  }

  if (
    resolveDraftTemplateKind(input.matching.articleType) === 'release_roundup'
  ) {
    const uniqueThemes = [...new Set(input.detected.themes.filter(Boolean))];

    if (uniqueThemes.length > 1) {
      return 'Multiple';
    }

    if (uniqueThemes.length === 1) {
      return uniqueThemes[0];
    }
  }

  const catalogTheme = normalizePublicContentArticleTheme(
    input.primarySet?.theme || input.matching.matchedSets[0]?.theme,
  );

  if (catalogTheme) {
    return catalogTheme;
  }

  const keywordTheme = resolveKeywordTheme();

  if (keywordTheme) {
    return keywordTheme;
  }

  if (input.matching.articleType === 'single_set_news') {
    if (input.facts.theme === 'Multiple') {
      const uniqueThemes = [...new Set(input.detected.themes.filter(Boolean))];

      return uniqueThemes.length === 1
        ? (normalizePublicContentArticleTheme(uniqueThemes[0]) ?? 'LEGO')
        : 'LEGO';
    }
  }

  return (
    normalizePublicContentArticleTheme(input.facts.theme) ||
    normalizePublicContentArticleTheme(input.detected.themes[0]) ||
    'LEGO'
  );
}

function isDutchSourceLanguage(language?: string): boolean {
  return (
    typeof language === 'string' && language.toLowerCase().startsWith('nl')
  );
}

function stripEnglishTitlePunctuation(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[!?]+$/gu, '')
    .trim();
}

function localizeEnglishNumberWord(value: string): string {
  const normalizedValue = value.toLowerCase();
  const numberWords = new Map([
    ['one', 'Een'],
    ['two', 'Twee'],
    ['three', 'Drie'],
    ['four', 'Vier'],
    ['five', 'Vijf'],
    ['six', 'Zes'],
    ['seven', 'Zeven'],
    ['eight', 'Acht'],
    ['nine', 'Negen'],
    ['ten', 'Tien'],
  ]);

  return numberWords.get(normalizedValue) ?? value;
}

function localizeEnglishTitleSubject(value: string): string {
  return stripEnglishTitlePunctuation(value)
    .replace(/\bquick look\b/giu, 'Korte blik')
    .replace(/\bfirst look\b/giu, 'Eerste blik')
    .replace(/\bbeautiful botanical\b/giu, 'nieuwe Botanicals')
    .replace(/\bbotanical\b/giu, 'Botanicals')
    .replace(/\bhelmets\b/giu, 'helmen')
    .replace(/\bhelmet\b/giu, 'helmet')
    .replace(/\bsummer\b/giu, 'zomer')
    .trim();
}

function localizeEnglishTitleVerb(value: string): string {
  return value.toLowerCase() === 'announced' ? 'aangekondigd' : 'onthuld';
}

function localizeNonDutchArticleTitle(
  title: string,
  input: EditorialAgentDraftGenerationInput,
): string {
  if (isDutchSourceLanguage(input.source.language)) {
    return title;
  }

  const cleanTitle = stripEnglishTitlePunctuation(title);

  if (!cleanTitle) {
    return title;
  }

  if (/^summer lego harry potter sets revealed$/iu.test(cleanTitle)) {
    return 'Nieuwe LEGO Harry Potter-sets voor de zomer onthuld';
  }

  const summerLegoThemeSetsMatch = cleanTitle.match(
    /^summer\s+lego\s+(.+?)\s+sets\s+(revealed|unveiled|announced)$/iu,
  );

  if (summerLegoThemeSetsMatch) {
    return `Nieuwe LEGO ${summerLegoThemeSetsMatch[1]}-sets voor de zomer ${localizeEnglishTitleVerb(summerLegoThemeSetsMatch[2])}`;
  }

  const newDecorativeLegoThemeSetsMatch = cleanTitle.match(
    /^new\s+decorative\s+lego\s+(.+?)\s+sets\s+(revealed|unveiled|announced)$/iu,
  );

  if (newDecorativeLegoThemeSetsMatch) {
    return `Nieuwe decoratieve LEGO ${newDecorativeLegoThemeSetsMatch[1]}-sets ${localizeEnglishTitleVerb(newDecorativeLegoThemeSetsMatch[2])}`;
  }

  const newLegoThemeSetsMatch = cleanTitle.match(
    /^new\s+lego\s+(.+?)\s+sets\s+(revealed|unveiled|announced)$/iu,
  );

  if (newLegoThemeSetsMatch) {
    return `Nieuwe LEGO ${newLegoThemeSetsMatch[1]}-sets ${localizeEnglishTitleVerb(newLegoThemeSetsMatch[2])}`;
  }

  const numberedAdjectiveLegoThemeSetsMatch = cleanTitle.match(
    /^(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+.+?\s+lego\s+(.+?)\s+sets\s+(revealed|unveiled|announced)$/iu,
  );

  if (numberedAdjectiveLegoThemeSetsMatch) {
    return `${localizeEnglishNumberWord(numberedAdjectiveLegoThemeSetsMatch[1])} nieuwe LEGO ${numberedAdjectiveLegoThemeSetsMatch[2]}-sets ${localizeEnglishTitleVerb(numberedAdjectiveLegoThemeSetsMatch[3])}`;
  }

  const botanicalSetsMatch = cleanTitle.match(
    /^(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+beautiful\s+botanical\s+sets\s+revealed$/iu,
  );

  if (botanicalSetsMatch) {
    return `${localizeEnglishNumberWord(botanicalSetsMatch[1])} nieuwe Botanicals-sets onthuld`;
  }

  const setsRevealedMatch = cleanTitle.match(/^(.+?)\s+sets\s+revealed$/iu);

  if (setsRevealedMatch) {
    const subject = localizeEnglishTitleSubject(setsRevealedMatch[1]);

    return `${capitalizeSentenceStart(subject)}-sets onthuld`;
  }

  const firstLookMatch = cleanTitle.match(/^first look[:\s-]+(.+)$/iu);

  if (firstLookMatch) {
    return `Eerste blik: ${stripEnglishTitlePunctuation(firstLookMatch[1])}`;
  }

  const quickLookMatch = cleanTitle.match(/^quick look[:\s-]+(.+)$/iu);

  if (quickLookMatch) {
    return `Korte blik: ${stripEnglishTitlePunctuation(quickLookMatch[1])}`;
  }

  const reviewMatch = cleanTitle.match(/^review[:\s-]+(.+)$/iu);

  if (reviewMatch) {
    return `Review: ${stripEnglishTitlePunctuation(reviewMatch[1])}`;
  }

  const revealedMatch = cleanTitle.match(/^(.+?)\s+revealed$/iu);

  if (revealedMatch) {
    return `${capitalizeSentenceStart(localizeEnglishTitleSubject(revealedMatch[1]))} onthuld`;
  }

  return cleanTitle;
}

function resolveTitle(input: EditorialAgentDraftGenerationInput): string {
  const sourceTitle = normalizeWhitespace(input.source.title);
  const factsTitle = normalizeWhitespace(input.facts.title);
  const templateKind = resolveDraftTemplateKind(input.matching.articleType);

  if (templateKind === 'single_set' || templateKind === 'deal') {
    if (factsTitle.length > 0) {
      return localizeNonDutchArticleTitle(factsTitle, input);
    }

    if (input.primarySet) {
      return `LEGO ${input.primarySet.setNumber} ${input.primarySet.name}`;
    }
  }

  if (sourceTitle.length > 0) {
    return localizeNonDutchArticleTitle(sourceTitle, input);
  }

  if (factsTitle.length > 0) {
    return localizeNonDutchArticleTitle(factsTitle, input);
  }

  if (input.primarySet) {
    return `LEGO ${input.primarySet.setNumber} ${input.primarySet.name}`;
  }

  return 'LEGO nieuwsartikel';
}

function cleanConciseSetTitleSubject(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^lego\s+/iu, '')
    .replace(
      /^(?:star wars|icons|marvel|harry potter|super mario|sonic(?:\s+the\s+hedgehog)?|technic|city|ideas|creator(?:\s+3in1)?|disney)\s+/iu,
      '',
    )
    .replace(/^\d{4,6}(?:-\d+)?\s+/u, '')
    .replace(/\s*\((?:lego\s*)?\d{4,6}(?:-\d+)?\)\s*$/iu, '')
    .replace(/^star trek:\s*/iu, 'Star Trek ')
    .replace(/\s+NCC-\d+(?:-[A-Z])?\b/gu, '')
    .replace(/\s+set\b/giu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function resolveConciseSingleSetTitleAction(
  title: string,
  input: EditorialAgentDraftGenerationInput,
  subject: string,
): string {
  const normalizedTitle = normalizeWhitespace(
    [
      title,
      input.source.title,
      input.source.description,
      input.facts.title,
      input.facts.summary,
      input.facts.keyPoints.join(' '),
      input.facts.keywords.join(' '),
      input.detected.keywords.join(' '),
      input.detected.rumorSignals.join(' '),
      input.detected.prices.join(' '),
    ].join(' '),
  );

  if (
    input.matching.articleType === 'deal' ||
    /\b(?:deal|korting|actie|aanbieding|discount|temporarily cheaper|cheaper|sale|dubbele\s+insiders-punten|€\s*\d+)/iu.test(
      normalizedTitle,
    )
  ) {
    return pickTitleVariant(
      ['met korting', 'tijdelijk goedkoper', 'nu voordeliger'],
      subject,
      input,
    );
  }

  if (
    input.facts.isRumor ||
    input.detected.rumorSignals.length > 0 ||
    /\b(?:leak|leaked|gelekt|rumor|rumour|gerucht|geruchten)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return pickTitleVariant(
      ['gelekt', 'mogelijk onthuld', 'eerste info opgedoken'],
      subject,
      input,
    );
  }

  if (
    /\b(?:pre-?order|voorbestel|voorbestellen|pre-orderen)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return 'nu te pre-orderen';
  }

  if (
    /\b(?:available|beschikbaar|verkrijgbaar|nu te koop|back in stock|op voorraad)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return 'nu beschikbaar';
  }

  if (/\buitverkocht\b/iu.test(normalizedTitle)) {
    return 'uitverkocht';
  }

  if (/\b(?:terug|opnieuw beschikbaar)\b/iu.test(normalizedTitle)) {
    return 'terug';
  }

  if (
    /\b(?:revealed|unveiled|announced|aangekondigd|onthuld|gepresenteerd|eerste beelden|first look|first images|officially presented)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return pickTitleVariant(
      ['aangekondigd', 'officieel gepresenteerd', 'nu zichtbaar'],
      subject,
      input,
    );
  }

  return pickTitleVariant(
    ['aangekondigd', 'officieel gepresenteerd', 'nu zichtbaar'],
    subject,
    input,
  );
}

function pickTitleVariant(
  variants: readonly string[],
  subject: string,
  input: EditorialAgentDraftGenerationInput,
): string {
  const seed = `${subject}|${input.primarySet?.setNumber ?? ''}|${input.source.canonicalUrl || input.source.finalUrl || input.source.inputUrl}`;
  const hash = [...seed].reduce(
    (currentHash, character) => currentHash + character.charCodeAt(0),
    0,
  );

  return variants[hash % variants.length] ?? variants[0] ?? '';
}

function formatConciseArticleTitle({
  input,
  title,
}: {
  input: EditorialAgentDraftGenerationInput;
  title: string;
}): string {
  if (
    !input.primarySet ||
    (input.matching.articleType !== 'single_set_news' &&
      input.matching.articleType !== 'deal')
  ) {
    return title;
  }

  const subject =
    cleanConciseSetTitleSubject(input.primarySet.name) ||
    cleanConciseSetTitleSubject(
      getSetDisplayNameForDraft(input.primarySet, input.facts, input.source),
    );
  if (!subject) {
    return title;
  }

  const action = resolveConciseSingleSetTitleAction(title, input, subject);

  return `${subject} ${action}`;
}

function resolveMonthLabel(input: EditorialAgentDraftGenerationInput): string {
  const signal = input.detected.dateSignals[0] ?? input.facts.releaseDate;
  const isoMatch = signal.match(/\b(20\d{2})-(\d{2})-\d{2}\b/u);

  if (isoMatch) {
    const monthLabel = DUTCH_MONTH_LABELS.get(isoMatch[2]);

    if (monthLabel) {
      return `${monthLabel} ${isoMatch[1]}`;
    }
  }

  const monthMatch = signal.match(
    /\b(?:\d{1,2}\s+)?(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/iu,
  );

  if (monthMatch) {
    return `${monthMatch[1].toLowerCase()} ${monthMatch[2]}`;
  }

  return 'de komende releasegolf';
}

function cleanDraftSetDisplayName(value: string): string {
  let nextValue = normalizeWhitespace(value);

  if (!nextValue) {
    return '';
  }

  nextValue = nextValue
    .replace(/^lego\s+\d{5}(?:-\d+)?\s+/iu, '')
    .replace(/^lego\s+/iu, '');

  for (const pattern of SET_NAME_RELEASE_SUFFIX_PATTERNS) {
    nextValue = nextValue.replace(pattern, '');
  }

  nextValue = nextValue
    .replace(/\s+[|•·:-]\s*$/u, '')
    .replace(/\s+(?:is|blijft)\s*$/iu, '')
    .trim();

  return normalizeWhitespace(nextValue);
}

export function getSetDisplayNameForDraft(
  primarySet: EditorialAgentPrimarySetSelection | null,
  facts: EditorialAgentExtractedFacts,
  source: EditorialAgentExtractedSource,
): string {
  if (primarySet?.name.trim()) {
    return primarySet.name.trim();
  }

  for (const setName of facts.setNames) {
    const cleanedSetName = cleanDraftSetDisplayName(setName);

    if (cleanedSetName.length > 0) {
      return cleanedSetName;
    }
  }

  const cleanedHeadline =
    cleanDraftSetDisplayName(source.title) ||
    cleanDraftSetDisplayName(facts.title);

  return cleanedHeadline || 'deze set';
}

function getMultiSetAnnouncementDisplayName(
  input: EditorialAgentDraftGenerationInput,
): string {
  return input.primarySet?.name.trim() || 'Deze sets';
}

function formatDutchList(values: readonly string[]): string {
  const uniqueValues = [...new Set(values.map(normalizeWhitespace))].filter(
    Boolean,
  );

  if (uniqueValues.length <= 1) {
    return uniqueValues[0] ?? '';
  }

  if (uniqueValues.length === 2) {
    return `${uniqueValues[0]} en ${uniqueValues[1]}`;
  }

  return `${uniqueValues.slice(0, -1).join(', ')} en ${uniqueValues.at(-1)}`;
}

function cleanMultiSetSubjectName(value: string): string {
  return cleanDraftSetDisplayName(value)
    .replace(/^lego\s+/iu, '')
    .replace(
      /\s+(?:sets?|revealed|unveiled|announced|onthuld|aangekondigd)\s*$/iu,
      '',
    )
    .replace(/\s+[|:]\s*.+$/u, '')
    .trim();
}

function isFullHeadlineSubject(
  subject: string,
  input: EditorialAgentDraftGenerationInput,
): boolean {
  const normalizedSubject = normalizeWhitespace(subject).toLowerCase();
  const titles = [input.source.title, input.facts.title]
    .map((title) => normalizeWhitespace(title).toLowerCase())
    .filter(Boolean);

  return titles.some((title) => normalizedSubject === title);
}

function subjectMatchesTitleByTokens(
  subject: string,
  titleContext: string,
): boolean {
  const stopWords = new Set([
    'and',
    'de',
    'driver',
    'en',
    'het',
    'imperial',
    'lego',
    'minifigure',
    'remnant',
    'set',
    'sets',
    'the',
    'van',
  ]);
  const tokens = normalizeWhitespace(subject)
    .toLowerCase()
    .split(/[^a-z0-9-]+/u)
    .filter((token) => token.length >= 2 && !stopWords.has(token));

  if (tokens.length === 0) {
    return false;
  }

  const matchedTokens = tokens.filter((token) => titleContext.includes(token));

  return matchedTokens.length >= Math.min(2, tokens.length);
}

function summarizeF1HelmetSubjects(
  input: EditorialAgentDraftGenerationInput,
): string {
  const context = normalizeWhitespace(
    [input.source.title, input.facts.title, input.facts.summary]
      .filter(Boolean)
      .join(' '),
  );

  if (!/\bf1[-\s]?helmen?\b|\bhelmets?\b/iu.test(context)) {
    return '';
  }

  const driverNames = ['Piastri', 'Norris', 'Hamilton']
    .filter((name) => new RegExp(`\\b${name}\\b`, 'iu').test(context))
    .slice(0, 3);

  return driverNames.length >= 2
    ? `${formatDutchList(driverNames)}-helmen`
    : '';
}

function getMultiSetTitleSubjects(
  input: EditorialAgentDraftGenerationInput,
): string[] {
  if (isIdeasApprovalDraft(input)) {
    return [];
  }

  const f1HelmetSubjects = summarizeF1HelmetSubjects(input);

  if (f1HelmetSubjects) {
    return [f1HelmetSubjects];
  }

  const titleContext = normalizeWhitespace(
    [input.source.title, input.facts.title, input.facts.summary]
      .filter(Boolean)
      .join(' '),
  ).toLowerCase();
  const factNameCandidates = input.facts.setNames
    .map(cleanMultiSetSubjectName)
    .filter(
      (name) =>
        name.length > 0 &&
        !isFullHeadlineSubject(name, input) &&
        (titleContext.includes(name.toLowerCase()) ||
          input.facts.setNames.includes(name)),
    );
  const matchedSetCandidates = input.matching.matchedSets
    .map((set) => cleanMultiSetSubjectName(set.name))
    .filter(
      (name) =>
        name.length > 0 &&
        !isFullHeadlineSubject(name, input) &&
        (titleContext.includes(name.toLowerCase()) ||
          subjectMatchesTitleByTokens(name, titleContext)),
    );
  const candidates = [...factNameCandidates, ...matchedSetCandidates];

  return [...new Set(candidates)].slice(0, 4);
}

function getMultiSetAnnouncementSubjectPhrase(
  input: EditorialAgentDraftGenerationInput,
): string {
  const subjects = getMultiSetTitleSubjects(input);

  return formatDutchList(subjects);
}

function hasMultiSetAnnouncementPrimary(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  return (
    input.matching.articleType === 'multi_set_announcement' &&
    Boolean(input.primarySet)
  );
}

function isIdeasApprovalDraft(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  const context = buildSingleSetDraftContext(input);

  return (
    input.matching.articleType === 'multi_set_announcement' &&
    (context.includes('lego ideas') ||
      context.includes('ideas-project') ||
      context.includes('ideas project')) &&
    (context.includes('goedgekeurd') ||
      context.includes('reviewronde') ||
      context.includes('approved') ||
      context.includes('selected') ||
      context.includes('worden als set uitgebracht'))
  );
}

function isBricksetWeakMultiSetDraft(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  return (
    input.matching.articleType === 'multi_set_announcement' &&
    !input.primarySet &&
    input.source.domain.toLowerCase().includes('brickset.com')
  );
}

function buildThemeFollowSentence(
  input: EditorialAgentDraftGenerationInput,
): string {
  const theme = resolveTheme(input);

  return theme === 'LEGO'
    ? ''
    : `Voor ${theme}-fans is dit leuk om rustig te volgen.`;
}

function sentenceCaseParagraphStarts(value: string): string {
  return value
    .split('\n\n')
    .map((paragraph) => {
      const trimmedStart = paragraph.trimStart();

      if (
        trimmedStart.startsWith('---') ||
        trimmedStart.startsWith('<') ||
        trimmedStart.startsWith('[')
      ) {
        return paragraph;
      }

      return capitalizeSentenceStart(paragraph);
    })
    .join('\n\n');
}

function cleanPublicDraftCopy(value: string): string {
  return sentenceCaseParagraphStarts(value)
    .replace(/\bdeze sets trekt\b/giu, 'Deze sets trekken')
    .replace(/\bdeze sets laat\b/giu, 'Deze sets laten')
    .replace(/\bdeze aankondiging trekt\b/giu, 'Deze aankondiging trekt')
    .replace(/\bdeze aankondiging laat\b/giu, 'Deze aankondiging laat')
    .replace(
      /\bdit draft helpt je snel kiezen of je nu moet opletten of rustig kunt wachten\.?/giu,
      'Je ziet snel of je moet opletten of rustig kunt wachten.',
    )
    .replace(
      /\bdit artikel helpt je(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Je ziet snel of je moet opletten of rustig kunt wachten.',
    )
    .replace(
      /\bartikel helpt je(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Je ziet snel of je moet opletten of rustig kunt wachten.',
    )
    .replace(
      /\bgebruik deze draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Handig om te bepalen of deze set op je radar moet.',
    )
    .replace(
      /\bdeze draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Handig om te bepalen of deze set op je radar moet.',
    )
    .replace(
      /\bdit draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Je ziet snel of je moet opletten of rustig kunt wachten.',
    )
    .replace(
      /\bconceptdraft(?:\s+[^.!?\n]*)?[.!?]?/giu,
      'Handig om te bepalen of deze set op je radar moet.',
    )
    .replace(/\bconcept\b/giu, 'nieuws')
    .replace(/\bdraft\b/giu, 'nieuws');
}

function sentenceMentionsMatchedCatalogSet(
  sentence: string,
  input: EditorialAgentDraftGenerationInput,
): boolean {
  const lowerSentence = sentence.toLowerCase();

  return input.matching.matchedSets.some(
    (matchedSet) =>
      lowerSentence.includes(matchedSet.name.toLowerCase()) ||
      lowerSentence.includes(matchedSet.setNumber.toLowerCase()),
  );
}

function getIdeasApprovalSubjectLine(
  input: EditorialAgentDraftGenerationInput,
): string {
  const candidateSentences = normalizeWhitespace(
    [input.source.description, input.facts.summary].filter(Boolean).join(' '),
  )
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const subjectSentence = candidateSentences.find(
    (sentence) =>
      !sentenceMentionsMatchedCatalogSet(sentence, input) &&
      /\b(?:goedgekeurd|geselecteerd|selected|worden als set uitgebracht|zijn geselecteerd)\b/iu.test(
        sentence,
      ),
  );

  return subjectSentence ?? '';
}

function buildDescription(input: EditorialAgentDraftGenerationInput): string {
  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const themeToneContext = buildSingleSetDraftContext(input);
  const singleSetTone = getSingleSetDraftTone(input);
  const releaseLabel =
    input.facts.releaseDate || input.detected.dateSignals[0] || '';

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `${setName} is vooral leuk als je de punten al hebt. Moet je extra aankopen doen om hem vrij te spelen, dan kun je hem beter laten lopen.`;
    case 'release_roundup':
      return `Overzicht van de LEGO-sets uit ${resolveMonthLabel(input)} waar je vrolijk doorheen wilt bladeren. Van kleine blikvangers tot grotere thema-releases: dit is vooral een maand om te ontdekken wat jou echt aanspreekt.`;
    case 'deal':
      return `${setName} is alleen interessant als de prijs nu echt scherp is. Hier zie je snel of dit een pak-moment is of niet.`;
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase && !input.primarySet) {
          return `${capitalizeSentenceStart(subjectPhrase)} staan centraal in deze LEGO-aankondiging. Vooral leuk om te volgen hoe deze sets zich straks onderscheiden.`;
        }

        if (subjectPhrase && input.primarySet) {
          return `${capitalizeSentenceStart(subjectPhrase)} zetten samen de toon voor deze LEGO-aankondiging. ${input.primarySet.name} mag de blikvanger zijn, maar dit nieuws draait duidelijk om meer dan één set.`;
        }
      }

      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        const themeSentence = buildThemeFollowSentence(input);

        return themeSentence
          ? `Meerdere nieuwe LEGO-sets zijn opgedoken. ${themeSentence}`
          : 'Meerdere nieuwe LEGO-sets zijn opgedoken. Vooral handig om kort te zien welke richting LEGO op beweegt.';
      }

      if (!input.primarySet && isIdeasApprovalDraft(input)) {
        const subjectLine = getIdeasApprovalSubjectLine(input);

        return subjectLine
          ? `${subjectLine} Vooral leuk om te volgen omdat deze fanideeën straks een officiële LEGO Ideas-uitwerking kunnen krijgen.`
          : 'Deze goedgekeurde LEGO Ideas-projecten zijn vooral leuk om te volgen omdat ze laten zien welke fanideeën straks officieel uitgewerkt kunnen worden.';
      }

      if (!input.primarySet) {
        return 'Deze aankondiging laat een richting zien voor meerdere nieuwe LEGO-sets. Vooral leuk om te volgen welke set straks echt blijft hangen.';
      }

      return `${getMultiSetAnnouncementDisplayName(input)} laat een opvallende richting zien voor meerdere nieuwe LEGO-sets. Vooral leuk om te volgen welke set er straks echt uitspringt.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const themeToneCopy = hasEnoughThemeToneConfidence(
          resolveTheme(input),
          themeToneContext,
        )
          ? getThemeToneCopy(
              `${resolveTheme(input)} ${themeToneContext}`,
              'announcement_description',
            )
          : null;

        if (themeToneCopy) {
          return releaseLabel
            ? `${setName} is aangekondigd als LEGO-release voor ${releaseLabel}. ${themeToneCopy}`
            : `${setName} is aangekondigd als nieuwe LEGO-set. ${themeToneCopy}`;
        }

        return releaseLabel
          ? `${setName} is aangekondigd als LEGO-release voor ${releaseLabel}. Vooral iets om rustig te volgen als dit thema, object of deze wereld je meteen iets doet.`
          : `${setName} is aangekondigd als nieuwe LEGO-set. Vooral iets om rustig te volgen als dit thema, object of deze wereld je meteen iets doet.`;
      }

      return `${setName} is vooral relevant als je hem al op je lijst had staan. Je ziet snel of je moet opletten of rustig kunt wachten.`;
    case 'unknown':
    default:
      return 'Handig om te bepalen of deze set op je radar moet. Let vooral op de details die straks echt het verschil maken.';
  }
}

function resolveDealHighlight(
  input: EditorialAgentDraftGenerationInput,
): string {
  const context = normalizeWhitespace(
    [
      input.facts.title,
      input.facts.summary,
      input.source.title,
      input.source.description,
      ...input.facts.keyPoints,
      ...input.facts.keywords,
      ...input.detected.keywords,
      ...input.detected.prices,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const lowerContext = context.toLowerCase();
  const discountMatch = context.match(/€\s?\d+(?:[,.]\d{1,2})?\s+korting/iu);
  const hasDoublePoints =
    lowerContext.includes('dubbele insiders-punten') ||
    lowerContext.includes('dubbele insiders punten');

  if (hasDoublePoints && discountMatch) {
    return `dubbele Insiders-punten of ${discountMatch[0]}`;
  }

  if (hasDoublePoints) {
    return 'dubbele Insiders-punten';
  }

  if (discountMatch) {
    return discountMatch[0];
  }

  if (lowerContext.includes('korting')) {
    return 'korting';
  }

  return 'een tijdelijke deal';
}

function buildFrontmatter(
  input: EditorialAgentDraftGenerationInput,
  articleDate: string,
): EditorialAgentArticleFrontmatter {
  const title = formatConciseArticleTitle({
    input,
    title: resolveTitle(input),
  });

  return {
    authorName: DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
    date: articleDate,
    description: buildDescription(input),
    heroImage: '',
    heroImageAlt: input.primarySet
      ? `LEGO ${input.primarySet.name} setbeeld`
      : title,
    slug: slugify(title),
    signalSourceName: getSignalSourceName(input.source.domain),
    sourceDisplayMode: 'auto',
    sourceUrl: resolveSourceUrl(input),
    status: 'draft',
    theme: resolveTheme(input),
    title,
  };
}

function getSignalSourceName(domain: string): string | undefined {
  const normalizedDomain = domain.toLowerCase();

  if (normalizedDomain.includes('brickset.com')) {
    return 'Brickset';
  }

  if (normalizedDomain.includes('bricktastic.nl')) {
    return 'BrickTastic';
  }

  return domain || undefined;
}

function toSetPreview(
  relatedCandidate: EditorialAgentRelatedSetCandidate,
): EditorialAgentSetPreview {
  return {
    name: relatedCandidate.name,
    reason: 'Genoemd in hetzelfde artikel en exact gematcht in de catalog.',
    setNumber: relatedCandidate.setNumber,
  };
}

function buildFeaturedSetBlock(
  input: EditorialAgentDraftGenerationInput,
): string {
  const articleType = input.matching.articleType;

  if (!input.primarySet) {
    return '';
  }

  if (articleType === 'unknown') {
    return '';
  }

  if (
    articleType === 'release_roundup' &&
    input.primarySet.reason !== 'title_match'
  ) {
    return '';
  }

  return '<FeaturedSet setNumber="' + input.primarySet.setNumber + '" />';
}

function buildSetRailBlock({
  intro,
  relatedCandidates,
  title,
}: {
  intro: string;
  relatedCandidates: readonly EditorialAgentRelatedSetCandidate[];
  title: string;
}): string {
  const formattedSetIds = formatSetRailSetIdsForMdx(
    relatedCandidates.map((candidate) => candidate.setNumber),
  );

  if (formattedSetIds.split(',').filter(Boolean).length < 2) {
    return '';
  }

  return `## Leuk voor erbij

${intro}

<SetRail title="${title}" ${editorialAgentSetRailPropName}="${formattedSetIds}" />`;
}

function buildWhenToBuySection(
  input: EditorialAgentDraftGenerationInput,
): string {
  const shortName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const singleSetTone = getSingleSetDraftTone(input);
  const releaseLabel =
    input.facts.releaseDate || input.detected.dateSignals[0] || '';

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `## Wanneer kopen?

Heb je genoeg Insiders-punten en wil je ${shortName} echt hebben, pak hem dan nu. Dit soort rewards kan zonder veel waarschuwing verdwijnen, dus wachten levert weinig op als hij al op je lijstje stond.

Moet je eerst nog punten sparen of extra aankopen doen om hem te krijgen? Dan zou ik hem laten lopen. ${shortName} is leuk voor fans, maar niet sterk genoeg om speciaal voor te gaan bijbestellen.`;
    case 'deal':
      return `## Wanneer kopen?

Zakt de prijs naar een niveau waar je ${shortName} al eerder voor wilde hebben, dan is dit je moment. Een deal werkt alleen als hij een set goedkoper maakt die je toch al serieus overwoog.

Moet je jezelf nog overtuigen dat je deze set eigenlijk wilt? Dan is korting alleen niet genoeg. Laat hem lopen en wacht op een set waar je meteen ja tegen zegt.`;
    case 'multi_set_announcement':
      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return `## Waarom volgen?

${buildThemeFollowSentence(input) || 'Dit is vooral handig om rustig te volgen.'} Wacht op betere beelden voordat je hier een koopmoment van maakt.`;
      }

      return `## Waarom volgen?

Dit is vooral nieuws om rustig te volgen. Eerste beelden en aankondigingen zijn handig om te voelen welke richting LEGO op wil.

Kijk ${input.primarySet ? 'welke set' : 'welk idee'} eruit springt door vorm, scène of personage. Daarna kun je rustig wachten op betere beelden, prijzen en de eerste winkelinformatie.`;
    case 'release_roundup':
      return `## Wanneer kopen?

Bij zo’n releasemaand hoef je niet alles meteen op dag één te kopen. Kijk vooral welke sets je echt blij maken en welke je later nog eens rustig terugpakt.

Zie je nu al één of twee dozen waar je meteen energie van krijgt, dan zijn dat de logische eerste keuzes. De rest mag best even blijven liggen tot je later voelt welke sets je alsnog naar je wishlist trekken.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        return `## Wanneer verschijnt hij?

${releaseLabel ? `Als de huidige info klopt, verschijnt ${shortName} op ${releaseLabel}.` : `${shortName} heeft nu vooral de status van een aangekondigde release.`} Dat is vooral handig om te onthouden, niet om nu al zenuwachtig van te worden.

Tot die datum is dit vooral iets om rustig te volgen voor extra beelden, bevestigde details en de eerste winkelvermeldingen.`;
      }

      return `## Wanneer kopen?

Stond ${shortName} al op je lijst en klopt de prijs zodra hij live gaat, dan wil je vooral snel schakelen. Dit is geen artikel om eindeloos over te dubben, maar om te bepalen of dit jouw set is.

Twijfel je nog of deze set echt iets toevoegt aan je collectie? Wacht dan rustig tot er meer beelden, reviews of betere prijzen zijn.`;
    case 'unknown':
    default:
      return `## Wanneer kopen?

Handig om te bepalen of deze set op je radar moet. Kijk eerst naar de details die voor jouw collectie echt tellen.

Pas daarna kun je bepalen of dit een nu-pakken, volgen of laten-lopen moment is.`;
  }
}

function buildConclusionSection(
  input: EditorialAgentDraftGenerationInput,
): string {
  const shortName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const singleSetTone = getSingleSetDraftTone(input);
  const themeToneContext = buildSingleSetDraftContext(input);

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `## Korte conclusie

Heb je de punten al klaarstaan en zegt ${shortName} je meteen iets, dan is dit een makkelijke ja. Moet je er moeite voor doen, spaar je punten dan liever voor iets waar je langer naar blijft kijken.`;
    case 'deal':
      return `## Korte conclusie

Een deal is pas goed nieuws als hij op een set valt die je toch al wilde hebben. Gebruik deze daarom als koopmoment-check, niet als excuus om iets mee te pakken waar je morgen alweer over twijfelt.`;
    case 'multi_set_announcement':
      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return `## Korte conclusie

Kort volgen is genoeg. Zodra er betere beelden of prijzen zijn, zie je vanzelf welke set blijft hangen.`;
      }

      if (!input.primarySet) {
        return `## Korte conclusie

Dit nieuws is vooral leuk om te volgen. De projecten geven alvast een eerste richting, maar de echte waarde zit in welk idee straks het sterkste beeld, personage of displaymoment krijgt.`;
      }

      return `## Korte conclusie

Dit nieuws is vooral leuk om te volgen. ${capitalizeSentenceStart(getMultiSetAnnouncementDisplayName(input))} geeft alvast een eerste richting, maar de echte waarde zit in welk idee straks het sterkste beeld, personage of displaymoment krijgt.`;
    case 'release_roundup':
      return `## Korte conclusie

${capitalizeSentenceStart(resolveMonthLabel(input))} is vooral een leuke maand om door de nieuwe releases te bladeren. Niet alles hoeft meteen mee, maar er staan genoeg sets tussen waar je spontaan even voor wilt doorklikken.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const themeToneCopy = hasEnoughThemeToneConfidence(
          resolveTheme(input),
          themeToneContext,
        )
          ? getThemeToneCopy(
              `${resolveTheme(input)} ${themeToneContext}`,
              'announcement_conclusion',
            )
          : null;

        if (themeToneCopy) {
          return `## Korte conclusie

${shortName} is vooral een leuke aankondiging om in de gaten te houden. ${themeToneCopy}`;
        }

        return `## Korte conclusie

${shortName} is vooral een leuke aankondiging om in de gaten te houden. Nog geen set waar je nu al iets op hoeft te forceren, wel eentje om te onthouden als deze wereld of dit object je meteen iets doet.`;
      }

      return `## Korte conclusie

Als ${shortName} al op je radar stond, heb je nu genoeg om te bepalen of je alert wilt blijven. Zo niet, dan mag deze rustig langs je heen gaan zonder dat je iets mist.`;
    case 'unknown':
    default:
      return `## Korte conclusie

Je ziet snel of je moet opletten of rustig kunt wachten. Vooral relevant als je deze set al volgde.`;
  }
}

function buildIntroParagraphs(
  input: EditorialAgentDraftGenerationInput,
): string[] {
  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const theme = resolveTheme(input);
  const themeToneContext = buildSingleSetDraftContext(input);
  const singleSetTone = getSingleSetDraftTone(input);
  const releaseLabel =
    input.facts.releaseDate || input.detected.dateSignals[0] || '';

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return [
        `${setName} duikt op als Insiders reward. Leuk als je al iets met ${theme} hebt, maar te mager om los punten voor te gaan najagen.`,
        `Heb je de punten al klaarstaan en wilde je deze reward toch al, dan is dit een snelle ja. Moet je eerst aankopen forceren om hem vrij te spelen, dan kun je hem beter laten schieten.`,
      ];
    case 'deal':
      return [
        `${setName} is nu vooral interessant door ${resolveDealHighlight(input)}. Dit is geen artikel om een willekeurige korting te vieren, maar om te checken of het moment eindelijk klopt.`,
        `Wilde je deze set al en wordt de prijs of bonus nu sterk genoeg, dan moet je opletten. Was je nog niet overtuigd, dan verandert een deal daar meestal weinig aan.`,
      ];
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase && !input.primarySet) {
          return [
            `${capitalizeSentenceStart(subjectPhrase)} staan centraal in deze LEGO-aankondiging. Dat is concreter dan een gewone lijst nieuwe sets: je ziet meteen welke namen de aandacht trekken.`,
            'Let vooral op de eerste beelden, herkenbare vormen en details die straks op een plank blijven hangen.',
          ];
        }

        if (subjectPhrase && input.primarySet) {
          return [
            `${capitalizeSentenceStart(subjectPhrase)} staan samen in de schijnwerpers. ${input.primarySet.name} mag de sterkste blikvanger zijn, maar deze aankondiging draait duidelijk om meerdere sets.`,
            'De vraag is nu welke doos straks het meest blijft hangen door vorm, scène of personage. Eerste beelden zijn vooral handig om die richting te voelen.',
          ];
        }
      }

      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return [
          'Er zijn meerdere nieuwe LEGO-sets opgedoken. Zie dit als korte eerste blik.',
          buildThemeFollowSentence(input) ||
            'Let vooral op welke richting LEGO kiest en welke set later de meeste aandacht verdient.',
        ];
      }

      if (!input.primarySet && isIdeasApprovalDraft(input)) {
        const subjectLine = getIdeasApprovalSubjectLine(input);

        return [
          'Deze goedgekeurde LEGO Ideas-projecten trekken de aandacht omdat ze laten zien welke fanideeën LEGO nu serieus verder onderzoekt.',
          ...(subjectLine ? [subjectLine] : []),
          'Dit is vooral leuk om te volgen voor de richting: welke gebouwen, films of scènes krijgen straks genoeg karakter om op een plank te blijven hangen?',
        ];
      }

      if (!input.primarySet) {
        return [
          'Deze aankondiging draait om meerdere nieuwe LEGO-sets. Het is vooral een eerste blik op een richting die leuk is om te volgen.',
          'De vraag is nu welk idee eruit springt zodra er meer beelden zijn. Let op herkenbare scènes, sterke displayvormen en details die straks op een plank blijven hangen.',
        ];
      }

      return [
        `${getMultiSetAnnouncementDisplayName(input)} trekt de aandacht in een nieuwe LEGO-aankondiging met meerdere sets. Dat maakt dit geen release-overzicht, maar een eerste blik op een richting die leuk is om te volgen.`,
        `De vraag is nu vooral ${input.primarySet ? 'welke set' : 'welk idee'} eruit springt zodra er meer beelden zijn. Let op herkenbare scènes, sterke displayvormen en details die straks op een plank blijven hangen.`,
      ];
    case 'release_roundup':
      return [
        capitalizeSentenceStart(
          `${resolveMonthLabel(input)} wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen: van kleine planten tot Disney, Jurassic World en Star Wars. Niet alles hoeft meteen op je wishlist, maar er is genoeg om vrolijk doorheen te bladeren.`,
        ),
        `Dit overzicht is vooral handig om te zien wat eraan komt en waar je aandacht direct naartoe gaat. Sommige sets springen meteen naar voren, andere zijn vooral leuk om later nog eens rustig terug te pakken.`,
      ].map(capitalizeSentenceStart);
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const themeToneCopy = hasEnoughThemeToneConfidence(
          theme,
          themeToneContext,
        )
          ? getThemeToneCopy(
              `${theme} ${themeToneContext}`,
              'announcement_intro',
            )
          : null;

        if (themeToneCopy) {
          return [
            `${
              releaseLabel
                ? `${setName} krijgt een LEGO-release op ${releaseLabel}.`
                : `${setName} is aangekondigd als nieuwe LEGO-set.`
            } ${themeToneCopy}`,
            `Dit is geen artikel waarbij je meteen hoeft te beslissen. Zie het vooral als iets om rustig te volgen als ${theme === 'LEGO' ? 'deze set' : `${theme}-sets`} je normaal gesproken toch al trekken.`,
          ];
        }

        return [
          `${
            releaseLabel
              ? `${setName} krijgt een LEGO-release op ${releaseLabel}.`
              : `${setName} is aangekondigd als nieuwe LEGO-set.`
          } Alleen dat idee is al leuk voor fans die precies dit soort werelden, objecten of licenties graag als bouwset op de plank zien.`,
          `Dit is geen artikel waarbij je meteen hoeft te beslissen. Zie het vooral als iets om rustig te volgen als ${theme === 'LEGO' ? 'deze set' : `${theme}-sets`} je normaal gesproken toch al trekken.`,
        ];
      }

      return [
        `${setName} is opgedoken als nieuwe LEGO-set. Dit is vooral nieuws voor verzamelaars die precies op deze doos zaten te wachten, niet voor iedereen die nog zoekt waar het budget heen moet.`,
        `Stond hij al op je lijst, dan wil je nu vooral weten of je hem moet volgen of meteen moet pakken zodra hij live gaat. Twijfel je nog, dan is dit juist het moment om kritisch te blijven.`,
      ];
    case 'unknown':
    default:
      return [
        `Er is nieuw LEGO-nieuws om kort te beoordelen. Begin bij de set, het thema en de details die straks op een plank echt opvallen.`,
        `Je ziet snel of je moet opletten of rustig kunt wachten. Vooral relevant als je deze set al volgde.`,
      ];
  }
}

function buildMidSection(input: EditorialAgentDraftGenerationInput): string {
  const singleSetTone = getSingleSetDraftTone(input);

  switch (input.matching.articleType) {
    case 'release_roundup':
      return `## Waar moet je op letten?

Bij een volle releasemaand hoeft niet alles meteen raak te zijn. Juist dan merk je snel welke sets je meteen wilt openen en welke dozen vooral leuk zijn om nog even in je achterhoofd te houden.

Tussen de grotere blikvangers staan vaak ook kleinere sets die pas op een tweede blik charmant worden. Dat maakt dit soort overzichten vooral fijn om even rustig doorheen te scrollen.`;
    case 'unknown':
      return `## Waar moet je op letten?

Kijk vooral naar de herkenbare details, de bouwvorm en de plek die deze set in je collectie zou krijgen. Als dat niet meteen iets doet, kun je rustig wachten op meer informatie.`;
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase) {
          return `## Wat is er aangekondigd?

${capitalizeSentenceStart(subjectPhrase)} vormen de kern van dit nieuws. Daardoor draait de eerste indruk niet om één losse favoriet, maar om vergelijken: welke set heeft de sterkste vorm, het herkenbaarste detail of het beste displaymoment?

Kijk vooral welke naam straks blijft hangen zodra er betere beelden, prijzen en officiële details zijn.`;
        }
      }

      if (!input.primarySet) {
        if (isBricksetWeakMultiSetDraft(input)) {
          return `## Wat valt op?

Het belangrijkste is de richting: meerdere sets, zonder dat één set alles draagt. Kijk vooral naar kleuren, vormen en displaywaarde.`;
        }

        if (isIdeasApprovalDraft(input)) {
          const subjectLine = getIdeasApprovalSubjectLine(input);

          return `## Wat is er goedgekeurd?

${subjectLine || 'De bron draait om LEGO Ideas-projecten die als officiële set mogen worden uitgewerkt.'} De projecten zitten nog vroeg in het proces, dus het draait nu vooral om de ideeën zelf.

Kijk vooral naar wat er aangekondigd is: welke ideeën hebben een sterke scène, welk project voelt herkenbaar en welke richting maakt nieuwsgierig naar de uiteindelijke LEGO-uitwerking?`;
        }

        return `## Wat is er aangekondigd?

Deze aankondiging draait om meerdere nieuwe LEGO-sets, zonder dat één set alles draagt.

Kijk vooral naar wat er aangekondigd is, welke richting LEGO kiest en welke sets straks opvallen zodra er betere beelden of officiële details zijn.`;
      }

      return `## Wat is er aangekondigd?

${input.facts.summary || `${getMultiSetAnnouncementDisplayName(input)} voert deze nieuwe LEGO-aankondiging aan.`}

Omdat het om meerdere sets gaat, draait het nu vooral om richting en eerste indruk. Welke set heeft het sterkste beeld, welke voelt het meest herkenbaar en welke blijft interessant als er straks meer details volgen?`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        return `## Wat is er aangekondigd?

${input.facts.summary || `${getSetDisplayNameForDraft(input.primarySet, input.facts, input.source)} is genoemd als nieuwe LEGO-release.`}

Voor nu is dit vooral een eerste aankondiging om op je radar te zetten. De waarde zit hier dus meer in herkenning en nieuwsgierigheid dan in direct koopadvies.`;
      }

      return `## Waarom dit opvalt

${input.facts.summary || 'Dit verhaal is vooral interessant omdat er een concrete setkoppeling en een duidelijk koopmoment in zit.'}`;
    default:
      return `## Waarom dit opvalt

${input.facts.summary || 'Dit verhaal is vooral interessant omdat er een concrete setkoppeling en een duidelijk koopmoment in zit.'}`;
  }
}

function buildAnnouncementAudienceSection(
  input: EditorialAgentDraftGenerationInput,
): string {
  if (
    input.matching.articleType === 'multi_set_announcement' &&
    !input.primarySet
  ) {
    const theme = resolveTheme(input);

    return `## Voor wie is dit leuk?

Dit nieuws is vooral leuk voor fans van ${theme === 'LEGO' ? 'dit soort projecten' : theme} en voor verzamelaars die graag vroeg zien welke richting LEGO op beweegt.

Zonder duidelijke hoofdkeuze draait het nu vooral om vergelijken: welke ideeën blijven hangen, welke beelden maken nieuwsgierig en welke projecten wil je later nog eens terugzien?`;
  }

  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const theme = resolveTheme(input);
  const themeToneContext = buildSingleSetDraftContext(input);
  const themeToneCopy = hasEnoughThemeToneConfidence(theme, themeToneContext)
    ? getThemeToneCopy(`${theme} ${themeToneContext}`, 'announcement_audience')
    : null;

  return `## Voor wie is dit leuk?

${themeToneCopy || `Deze aankondiging is vooral leuk voor fans van ${theme === 'LEGO' ? 'dit soort sets' : theme} en voor verzamelaars die graag vroeg zien welke nieuwe dozen eraan komen.`}

Zoek je vooral naar sets die meteen iets herkenbaars op de plank zetten, dan is ${setName} precies het soort release waar je even voor blijft hangen.`;
}

function buildReleaseRoundupSetSpotlightListBlock(
  input: EditorialAgentDraftGenerationInput,
): string {
  const uniqueMatchedSetIds = [
    ...new Set(input.matching.matchedSets.map((set) => set.setNumber)),
  ];
  const formattedSetIds =
    formatSetSpotlightListSetIdsForMdx(uniqueMatchedSetIds);

  if (!formattedSetIds.trim()) {
    return '';
  }

  return `<h2 id="${RELEASE_ROUNDUP_SETS_SECTION_ID}">Nieuwe sets die opvallen</h2>

Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.

<SetSpotlightList ${editorialAgentSetRailPropName}="${formattedSetIds}" />`;
}

function buildReleaseRoundupJumpLink(hasSpotlightBlock: boolean): string {
  if (!hasSpotlightBlock) {
    return '';
  }

  return `[Bekijk meteen de nieuwe sets ↓](#${RELEASE_ROUNDUP_SETS_SECTION_ID})`;
}

function buildSourceLine(input: EditorialAgentDraftGenerationInput): string {
  const sourceName = getSignalSourceName(input.source.domain);

  if (isBricksetWeakMultiSetDraft(input)) {
    return sourceName
      ? `Via: ${sourceName}`
      : 'Bronnen: officiële setinformatie.';
  }

  return 'Bronnen: officiële setinformatie en openbare berichtgeving.';
}

export function generateEditorialMdxDraft(
  input: EditorialAgentDraftGenerationInput,
): EditorialAgentDraftOutput {
  const templateKind = resolveDraftTemplateKind(input.matching.articleType);
  const singleSetTone = getSingleSetDraftTone(input);
  const articleDate = resolveDraftArticleDate(input);
  const frontmatter = buildFrontmatter(input, articleDate.date);
  const introParagraphs = buildIntroParagraphs(input);
  const featuredSetBlock = buildFeaturedSetBlock(input);
  const generationWarnings: string[] = [];
  const releaseRoundupSetSpotlightListBlock =
    templateKind === 'release_roundup'
      ? buildReleaseRoundupSetSpotlightListBlock(input)
      : '';
  const releaseRoundupJumpLink =
    templateKind === 'release_roundup'
      ? buildReleaseRoundupJumpLink(
          releaseRoundupSetSpotlightListBlock.trim().length > 0,
        )
      : '';
  const relatedSetRail =
    templateKind === 'single_set'
      ? input.relatedCandidates.length >= 2 &&
        (input.matching.articleType !== 'multi_set_announcement' ||
          hasMultiSetAnnouncementPrimary(input))
        ? buildSetRailBlock({
            intro: `Zoek je naast ${input.primarySet?.name || 'de hoofdset'} nog iets met meer bouw- of displaywaarde, dan zijn dit de sets die hier logisch naast hangen.`,
            relatedCandidates: input.relatedCandidates,
            title: `${resolveTheme(input)}-sets voor naast ${input.primarySet?.name || 'deze set'}`,
          })
        : ''
      : '';

  if (templateKind === 'unknown') {
    generationWarnings.push(
      'Article type bleef onbekend; de draft houdt het daarom bewust voorzichtig.',
    );
  }
  if (articleDate.usedFallback) {
    generationWarnings.push(ARTICLE_DATE_FALLBACK_WARNING);
  }
  if (
    (templateKind === 'single_set' || templateKind === 'deal') &&
    !input.primarySet
  ) {
    generationWarnings.push(
      'Geen betrouwbare primarySet gevonden; FeaturedSet is daarom weggelaten.',
    );
  }

  if (input.matching.unmatchedSetNumbers.length > 0) {
    generationWarnings.push(
      `Ongekoppelde setnummers zijn niet in de draft gebruikt: ${input.matching.unmatchedSetNumbers.join(', ')}.`,
    );
  }

  const cleanDescription = cleanPublicDraftCopy(
    frontmatter.description,
  ).replace(/\bheeft de LEGO\b/gu, 'heeft LEGO');
  const frontmatterBlock = `---\ntitle: "${escapeFrontmatterValue(frontmatter.title)}"\nslug: "${frontmatter.slug}"\ndescription: "${escapeFrontmatterValue(cleanDescription)}"\ndate: "${frontmatter.date}"\ntheme: "${escapeFrontmatterValue(frontmatter.theme)}"\nheroImage: "${frontmatter.heroImage}"\nheroImageAlt: "${escapeFrontmatterValue(frontmatter.heroImageAlt)}"\nstatus: "${frontmatter.status}"\nsourceUrl: "${frontmatter.sourceUrl}"\nsourceDisplayMode: "${frontmatter.sourceDisplayMode}"\nsignalSourceName: "${escapeFrontmatterValue(frontmatter.signalSourceName ?? '')}"\n---`;

  let sections: string[];

  switch (templateKind) {
    case 'release_roundup':
      sections = [
        frontmatterBlock,
        ...introParagraphs,
        releaseRoundupJumpLink,
        buildWhenToBuySection(input),
        buildMidSection(input),
        releaseRoundupSetSpotlightListBlock,
        buildConclusionSection(input),
        buildSourceLine(input),
      ];
      break;
    case 'single_set':
    case 'deal':
      if (
        templateKind === 'single_set' &&
        (input.matching.articleType === 'single_set_news' ||
          input.matching.articleType === 'multi_set_announcement') &&
        singleSetTone === 'announcement'
      ) {
        sections = [
          frontmatterBlock,
          ...introParagraphs,
          featuredSetBlock,
          buildMidSection(input),
          buildWhenToBuySection(input),
          buildAnnouncementAudienceSection(input),
          ...(relatedSetRail ? [relatedSetRail] : []),
          buildConclusionSection(input),
          buildSourceLine(input),
        ];
        break;
      }

      sections = [
        frontmatterBlock,
        ...introParagraphs,
        featuredSetBlock,
        buildWhenToBuySection(input),
        buildMidSection(input),
        ...(relatedSetRail ? [buildAnnouncementAudienceSection(input)] : []),
        ...(relatedSetRail ? [relatedSetRail] : []),
        buildConclusionSection(input),
        buildSourceLine(input),
      ];
      break;
    case 'unknown':
    default:
      sections = [
        frontmatterBlock,
        ...introParagraphs,
        buildWhenToBuySection(input),
        buildMidSection(input),
        buildConclusionSection(input),
        buildSourceLine(input),
      ];
      break;
  }

  sections = sections
    .filter((section) => section.trim().length > 0)
    .map((section, index) =>
      index === 0 ? section : cleanPublicDraftCopy(section),
    );
  const mdx = `${sections.join('\n\n')}\n`.replace(
    /\bheeft de LEGO\b/gu,
    'heeft LEGO',
  );

  return {
    frontmatter: {
      ...frontmatter,
      description: cleanDescription,
    },
    mdx,
    primarySet: input.primarySet
      ? {
          name: input.primarySet.name,
          reason:
            input.primarySet.reason === 'title_match'
              ? 'Draagt de titel van dit artikel en is daarom de logische hoofdset.'
              : 'Dit is de sterkste exacte catalog match voor de hoofdhaak van het artikel.',
          setNumber: input.primarySet.setNumber,
        }
      : null,
    relatedSets: input.relatedCandidates.map(toSetPreview),
    warnings: generationWarnings,
  };
}
