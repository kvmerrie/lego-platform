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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

  if (themeToneKey === 'star_wars') {
    return getStarWarsToneCopy(theme, context);
  }

  const copyByThemeAndContext: Partial<
    Record<
      NonNullable<ReturnType<typeof normalizeThemeToneKey>>,
      Record<ThemeToneCopyContext, string>
    >
  > = {
    harry_potter: {
      announcement_audience:
        'Voor Harry Potter-fans draait het om Hogwarts, scènes en kleine details voor op de plank.',
      announcement_conclusion:
        'Onthoud hem als Hogwarts, scènes en filmische details je collectie sterker maken.',
      announcement_description:
        'Voor Harry Potter-fans draait het om Hogwarts-uitstraling, scènes en een compact display.',
      announcement_intro:
        'Het draait om Hogwarts-uitstraling: scènes, kleine details en een diorama dat meteen aan de films doet denken.',
    },
    lord_of_the_rings: {
      announcement_audience:
        'Voor Lord of the Rings-fans draait dit om Middle-earth, sterke locaties en epische scènes die als display blijven werken.',
      announcement_conclusion:
        'Volg hem vooral als Middle-earth-locaties en epische scènes precies zijn wat je op de plank wilt zien.',
      announcement_description:
        'Voor Lord of the Rings-fans is dit vooral interessant door Middle-earth, sterke locaties en epische displaywaarde.',
      announcement_intro:
        'Het draait om Middle-earth: locaties, sfeer en epische scènes die als displaystuk werken.',
    },
  };

  return copyByThemeAndContext[themeToneKey]?.[context] ?? null;
}

type StarWarsToneSubtype =
  | 'buildable_figure'
  | 'generic_display'
  | 'helmet'
  | 'vehicle';

function getStarWarsToneSubtype(value: string): StarWarsToneSubtype {
  const normalizedValue = value.toLowerCase();
  const normalizedValueWithoutCollectionLabel = normalizedValue
    .replace(/\bhelmet collection\b/gu, '')
    .replace(/\bgeen\s+helm(?:en)?\b/gu, '');

  if (/\b(?:helmet|helm)\b/u.test(normalizedValueWithoutCollectionLabel)) {
    return 'helmet';
  }

  if (
    /\b(?:minifigure|figure|figuur|beeldfiguur|darth vader)\b/u.test(
      normalizedValue,
    )
  ) {
    return 'buildable_figure';
  }

  if (
    /\b(?:shuttle|starfighter|fighter|ship|vehicle|voertuig|speeder|x-wing|tie fighter|lambda-class|at-rt|falcon|transport|interceptor|cruiser)\b/u.test(
      normalizedValue,
    )
  ) {
    return 'vehicle';
  }

  return 'generic_display';
}

function getStarWarsToneCopy(
  themeAndContext: string,
  context: ThemeToneCopyContext,
): string {
  const copyBySubtype: Record<
    StarWarsToneSubtype,
    Record<ThemeToneCopyContext, string>
  > = {
    buildable_figure: {
      announcement_audience:
        'Voor Star Wars-fans is dit vooral leuk als je graag displayfiguren of duidelijke personages op een character shelf zet.',
      announcement_conclusion:
        'Onthoud hem als een displayfiguur van dit personage precies is wat je Star Wars-plank nog mist.',
      announcement_description:
        'Voor Star Wars-fans draait het om een displayfiguur en de uitstraling van het personage.',
      announcement_intro:
        'Het draait om personage-uitstraling: een bouwbare displayfiguur die meteen duidelijk maakt wie er op de plank staat.',
    },
    generic_display: {
      announcement_audience:
        'Voor Star Wars-fans is dit vooral leuk als je iets zoekt met duidelijke displaywaarde en Imperial of Rebel details.',
      announcement_conclusion:
        'Onthoud hem als Star Wars-vormen en displaywaarde precies zijn wat je collectie sterker maakt.',
      announcement_description:
        'Voor Star Wars-fans draait het om duidelijke details en stevige displaywaarde.',
      announcement_intro:
        'Het draait om strakke Star Wars-vormen en displaywaarde, zonder dat formaat of prijs alles bepalen.',
    },
    helmet: {
      announcement_audience:
        'Voor Star Wars-fans is dit vooral leuk als je de Helmet Collection spaart of iets hebt met Imperial, Rebel of trooper designs.',
      announcement_conclusion:
        'Onthoud hem als je de Helmet Collection spaart of graag Star Wars-helmen met duidelijke displaywaarde neerzet.',
      announcement_description:
        'Voor Star Wars-fans is dit vooral interessant als je de Helmet Collection spaart of iets hebt met displaysets, Imperial/Rebel-details of trooper designs.',
      announcement_intro:
        'Het draait om displaywaarde: Helmet Collection, strakke Star Wars-vormen en Imperial/Rebel details.',
    },
    vehicle: {
      announcement_audience:
        'Voor Star Wars-fans die iets hebben met Imperial ships, sterke vormen en duidelijke displaymodellen.',
      announcement_conclusion:
        'Onthoud hem als Star Wars-voertuigen en strakke silhouetten standaard tussen je sets staan.',
      announcement_description:
        'draait om dat herkenbare Star Wars-silhouet waar je je display op bouwt',
      announcement_intro:
        'Het draait hier om één ding: dat herkenbare silhouet. Strak, duidelijk en meteen Star Wars.',
    },
  };

  return copyBySubtype[getStarWarsToneSubtype(themeAndContext)][context];
}

function getSingleSetDescriptionHook(
  input: EditorialAgentDraftGenerationInput,
): string {
  const theme = resolveTheme(input);
  const context = `${theme} ${buildSingleSetDraftContext(input)} ${input.primarySet?.name ?? ''}`;
  const themeToneKey = normalizeThemeToneKey(theme, context);

  if (themeToneKey === 'star_wars') {
    switch (getStarWarsToneSubtype(context)) {
      case 'helmet':
        return 'richt zich duidelijk op Star Wars-fans die hun Helmet Collection willen uitbreiden';
      case 'vehicle':
        return 'draait om dat herkenbare Star Wars-silhouet waar je je display op bouwt';
      case 'buildable_figure':
        return 'draait om een bouwbare displayfiguur voor je Star Wars-character shelf';
      case 'generic_display':
      default:
        return 'leunt op strakke Star Wars-vormen en duidelijke displaywaarde';
    }
  }

  if (themeToneKey === 'harry_potter') {
    return 'draait om Hogwarts-uitstraling, scènes en een compact diorama';
  }

  if (themeToneKey === 'lord_of_the_rings') {
    return 'draait om Middle-earth, sterke locaties en epische displaywaarde';
  }

  if (isBotanicalsContext(input)) {
    return 'draait om plant, bloem, vorm en kleur voor op de plank';
  }

  const setType = [
    input.primarySet?.name,
    input.facts.title,
    input.source.title,
    ...input.facts.keywords,
  ]
    .filter(isNonEmptyString)
    .join(' ')
    .toLowerCase();

  if (/\b(?:helmet|helm)\b/u.test(setType)) {
    return 'draait om een displayhelm met duidelijke vorm op de plank';
  }

  if (
    /\b(?:shuttle|starfighter|vehicle|voertuig|ship|schip|auto|car)\b/u.test(
      setType,
    )
  ) {
    return 'zet vooral in op een voertuig met strak silhouet en displaywaarde';
  }

  return 'is vooral interessant als deze set al tussen je andere bouwwerken past';
}

function buildSingleSetAnnouncementDescription(
  input: EditorialAgentDraftGenerationInput,
  setName: string,
  releaseLabel: string,
): string {
  const hook = getSingleSetDescriptionHook(input);
  const formattedReleaseLabel = formatReleaseTimingLabel(releaseLabel);

  if (formattedReleaseLabel) {
    return `${setName} verschijnt ${formattedReleaseLabel} en ${hook}.`;
  }

  return `${setName} is aangekondigd en ${hook}.`;
}

function buildSingleSetDecisionDescription(setName: string): string {
  return `${setName} is relevant als je hem al volgde. Je ziet snel of je moet opletten of kunt afwachten.`;
}

function isBotanicalsContext(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  const context = normalizeWhitespace(
    [
      resolveTheme(input),
      input.primarySet?.name,
      input.facts.title,
      input.facts.summary,
      input.source.title,
      input.source.description,
      ...input.facts.keywords,
      ...input.detected.keywords,
      ...input.detected.themes,
    ]
      .filter(isNonEmptyString)
      .join(' '),
  ).toLowerCase();

  return /\b(?:botanicals?|botanical|plant|planten|bloem|bloemen)\b/u.test(
    context,
  );
}

function isVehicleContext(input: EditorialAgentDraftGenerationInput): boolean {
  const context = normalizeWhitespace(
    [
      input.primarySet?.name,
      input.facts.title,
      input.facts.summary,
      input.source.title,
      input.source.description,
      ...input.facts.keywords,
      ...input.detected.keywords,
    ]
      .filter(isNonEmptyString)
      .join(' '),
  ).toLowerCase();

  return /\b(?:shuttle|starfighter|fighter|ship|vehicle|voertuig|speeder|x-wing|tie fighter|lambda-class|falcon|transport|interceptor|cruiser|auto|car)\b/u.test(
    context,
  );
}

function getDomainAwareFocusPhrase(
  input: EditorialAgentDraftGenerationInput,
): string {
  if (isBotanicalsContext(input)) {
    return 'plant, bloem, vorm of kleur';
  }

  if (isVehicleContext(input)) {
    return 'voertuig, silhouet of vorm';
  }

  return 'vorm, scène of personage';
}

function getDomainAwareVisualPhrase(
  input: EditorialAgentDraftGenerationInput,
): string {
  if (isBotanicalsContext(input)) {
    return 'plantvormen, bloemen en kleuren';
  }

  if (isVehicleContext(input)) {
    return 'voertuigen, silhouetten en vormen';
  }

  return 'sterke scènes, displayvormen en details';
}

function replaceBotanicalsForbiddenVocabulary(
  input: EditorialAgentDraftGenerationInput,
  value: string,
): string {
  if (!isBotanicalsContext(input)) {
    return value;
  }

  return value
    .replace(/\bpersonages\b/giu, 'vormen')
    .replace(/\bpersonage\b/giu, 'vorm')
    .replace(/\bscènes\b/giu, 'bloemen')
    .replace(/\bscène\b/giu, 'bloem')
    .replace(/\bscene\b/giu, 'bloem')
    .replace(/\bscenes\b/giu, 'bloemen');
}

function replaceControlledVocabulary(
  input: EditorialAgentDraftGenerationInput,
  value: string,
): string {
  const theme = resolveTheme(input);
  const starWarsSubtype =
    normalizeThemeToneKey(theme) === 'star_wars'
      ? getStarWarsToneSubtype(
          `${theme} ${buildSingleSetDraftContext(input)} ${input.primarySet?.name ?? ''}`,
        )
      : null;

  return value
    .replace(
      /\bStar Wars-hoek\b/giu,
      'als Star Wars bij jou standaard tussen je sets staat',
    )
    .replace(/\bin de collectie-hoek\b/giu, 'in je collectie')
    .replace(/\bcollectie-hoek\b/giu, 'in je collectie')
    .replace(/\bDat gevoel\b/gu, 'Die uitstraling')
    .replace(/\bdat gevoel\b/gu, 'die uitstraling')
    .replace(/\bDit gevoel\b/gu, 'Deze uitstraling')
    .replace(/\bdit gevoel\b/gu, 'deze uitstraling')
    .replace(
      /\bHelmet Collection\b/gu,
      starWarsSubtype === 'helmet' ? 'Helmet Collection' : 'displaylijn',
    );
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

function formatReleaseTimingLabel(value: string): string {
  const signal = normalizeWhitespace(value);

  if (!signal) {
    return '';
  }

  const yearOnlyMatch = signal.match(/^20\d{2}$/u);

  if (yearOnlyMatch) {
    return `later in ${yearOnlyMatch[0]}`;
  }

  const isoMatch = signal.match(/\b(20\d{2})-(\d{2})(?:-(\d{2}))?\b/u);

  if (isoMatch) {
    const monthLabel = DUTCH_MONTH_LABELS.get(isoMatch[2]);
    const day = isoMatch[3] ? Number(isoMatch[3]) : 0;

    if (monthLabel && day > 1) {
      return `op ${day} ${monthLabel} ${isoMatch[1]}`;
    }

    if (monthLabel) {
      return `in ${monthLabel} ${isoMatch[1]}`;
    }
  }

  const dutchDateMatch = signal.match(
    /\b(?:(\d{1,2})\s+)?(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/iu,
  );

  if (dutchDateMatch) {
    const day = dutchDateMatch[1] ? Number(dutchDateMatch[1]) : 0;
    const month = dutchDateMatch[2].toLowerCase();
    const year = dutchDateMatch[3];

    return day > 0 ? `op ${day} ${month} ${year}` : `in ${month} ${year}`;
  }

  return signal.replace(/\bop\s+(20\d{2})\b/giu, 'later in $1');
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
      .filter(isNonEmptyString)
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
        .filter(isNonEmptyString)
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
    const uniqueThemes = [
      ...new Set(input.detected.themes.filter(isNonEmptyString)),
    ];

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
      const uniqueThemes = [
        ...new Set(input.detected.themes.filter(isNonEmptyString)),
      ];

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

  if (/\bniet meer te bestellen\b/iu.test(normalizedTitle)) {
    return 'niet meer te bestellen';
  }

  if (
    /\b(?:pre-?order|voorbestel|voorbestellen|pre-orderen)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return 'nu te pre-orderen';
  }

  if (
    /\b(?:weer op voorraad|back in stock|weer beschikbaar)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return 'weer op voorraad';
  }

  if (
    /\b(?:available|beschikbaar|verkrijgbaar|nu te koop|nu te bestellen|leverbaar|op voorraad|beperkte voorraad)\b/iu.test(
      normalizedTitle,
    )
  ) {
    return 'nu beschikbaar';
  }

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

function pickCuratedCopyVariant(
  variants: readonly string[],
  input: EditorialAgentDraftGenerationInput,
  context: string,
): string {
  const numericSetNumber = input.primarySet?.setNumber.match(/\d+/u)?.[0];

  if (numericSetNumber && variants.length > 0) {
    const lastDigit = Number(numericSetNumber.at(-1));

    return (
      variants[
        (Number.isFinite(lastDigit) ? lastDigit : Number(numericSetNumber)) %
          variants.length
      ] ??
      variants[0] ??
      ''
    );
  }

  const seed = `${context}|${input.primarySet?.setNumber ?? ''}|${input.primarySet?.name ?? ''}|${input.source.canonicalUrl || input.source.finalUrl || input.source.inputUrl}`;
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
    .filter(isNonEmptyString);

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
      .filter(isNonEmptyString)
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
      .filter(isNonEmptyString)
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

  if (isBotanicalsContext(input)) {
    return 'Voor Botanicals-fans draait het om plant, bloem, vorm en kleur.';
  }

  return theme === 'LEGO'
    ? ''
    : `Voor ${theme}-fans is dit iets om in de gaten te houden.`;
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
  return replaceAwkwardDatePhrases(
    replaceHypePublicPhrases(
      replaceRepetitivePublicPhrases(
        replaceVaguePublicWording(
          sentenceCaseParagraphStarts(value)
            .replace(/\bdeze sets trekt\b/giu, 'Deze sets trekken')
            .replace(/\bdeze sets laat\b/giu, 'Deze sets laten')
            .replace(
              /\bdeze aankondiging trekt\b/giu,
              'Deze aankondiging trekt',
            )
            .replace(/\bdeze aankondiging laat\b/giu, 'Deze aankondiging laat')
            .replace(
              /\bdit draft helpt je snel kiezen of je nu moet opletten of rustig kunt wachten\.?/giu,
              'Je ziet snel of je moet opletten of kunt afwachten.',
            )
            .replace(
              /\bdit artikel helpt je(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Je ziet snel of je moet opletten of kunt afwachten.',
            )
            .replace(
              /\bartikel helpt je(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Je ziet snel of je moet opletten of kunt afwachten.',
            )
            .replace(
              /\bgebruik deze draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Handig om te bepalen of deze set het onthouden waard is.',
            )
            .replace(
              /\bdeze draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Handig om te bepalen of deze set het onthouden waard is.',
            )
            .replace(
              /\bdit draft(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Je ziet snel of je moet opletten of kunt afwachten.',
            )
            .replace(
              /\bconceptdraft(?:\s+[^.!?\n]*)?[.!?]?/giu,
              'Handig om te bepalen of deze set het onthouden waard is.',
            )
            .replace(/\bconcept\b/giu, 'nieuws')
            .replace(/\bdraft\b/giu, 'nieuws'),
        ),
      ),
    ),
  );
}

function replaceVaguePublicWording(value: string): string {
  return value
    .replace(/\bde aantrekkingskracht zit in\b/giu, 'het draait om')
    .replace(/\bgeneric(?:e)? aantrekkingskracht\b/giu, 'uitstraling')
    .replace(/\btaferelen\b/giu, 'details')
    .replace(/\bgeneriek tafereel\b/giu, 'detail')
    .replace(/\bherkenbaarste detail\b/giu, 'sterkste detail')
    .replace(/\bmeest herkenbaar\b/giu, 'sterkste uitstraling')
    .replace(/\bvaag herkenbare details\b/giu, 'duidelijke details')
    .replace(/\bvaag herkenbare vormen\b/giu, 'duidelijke vormen')
    .replace(
      /\biets herkenbaars op de plank\b/giu,
      'vorm en detail op de plank',
    )
    .replace(
      /\bvoelt herkenbaar maar vaag\b/giu,
      'heeft duidelijke uitstraling',
    );
}

function replaceRepetitivePublicPhrases(value: string): string {
  const reducedGenericPhrases = value
    .replace(/\bop je radar zetten\b/giu, 'onthouden')
    .replace(/\bop je radar moet\b/giu, 'het onthouden waard is')
    .replace(/\brustig te volgen\b/giu, 'in de gaten te houden')
    .replace(/\brustig volgen\b/giu, 'in de gaten houden')
    .replace(/\bDit is vooral handig om\b/gu, 'Dit kun je gebruiken om')
    .replace(/\bdit is vooral handig om\b/gu, 'dit kun je gebruiken om')
    .replace(/\bDit is vooral nieuws om\b/gu, 'Dit is nieuws om')
    .replace(/\bdit is vooral nieuws om\b/gu, 'dit is nieuws om')
    .replace(
      /\bDit is vooral leuk om te volgen\b/gu,
      'Dit kun je later terugzien',
    )
    .replace(
      /\bdit is vooral leuk om te volgen\b/gu,
      'dit kun je later terugzien',
    )
    .replace(/\bDit is vooral leuk voor\b/gu, 'Dit past bij')
    .replace(/\bdit is vooral leuk voor\b/gu, 'dit past bij')
    .replace(
      /\bDit is vooral een set met gevoel\b/gu,
      'Deze set valt op door vorm en detail',
    )
    .replace(
      /\bdit is vooral een set met gevoel\b/gu,
      'deze set valt op door vorm en detail',
    );

  const matches = reducedGenericPhrases.match(/\bdit is vooral\b/giu) ?? [];

  if (matches.length <= 1) {
    return reducedGenericPhrases;
  }

  let seenCount = 0;

  return reducedGenericPhrases.replace(/\bdit is vooral\b/giu, (match) => {
    seenCount += 1;

    return seenCount === 1
      ? match
      : match.startsWith('D')
        ? 'Dit blijft'
        : 'dit blijft';
  });
}

function replaceHypePublicPhrases(value: string): string {
  return value
    .replace(
      /\bzo[’']?n\s+(?:update|nieuwtje|aankondiging)\s+waar\s+je\s+even\s+voor\s+gaat\s+zitten\b/giu,
      'een update om kort te bekijken',
    )
    .replace(/\bwaar je even voor gaat zitten\b/giu, 'om kort te bekijken')
    .replace(/\bje gaat hier voor zitten\b/giu, 'je kunt dit kort bekijken')
    .replace(/\btrekt de aandacht\b/giu, 'is relevant')
    .replace(/\bstaan samen in de schijnwerpers\b/giu, 'staan samen centraal')
    .replace(
      /\bwaar je even voor blijft hangen\b/giu,
      'waar je kort naar kijkt',
    )
    .replace(/\bblijft hangen\b/giu, 'relevant blijft')
    .replace(/\bblijven hangen\b/giu, 'relevant blijven')
    .replace(
      /\bwaar je spontaan even voor wilt doorklikken\b/giu,
      'die je later kunt bekijken',
    )
    .replace(
      /\bwaar je meteen energie van krijgt\b/giu,
      'die direct bij je collectie passen',
    )
    .replace(/\bmoet je zien\b/giu, 'kun je bekijken')
    .replace(/\bmis dit niet\b/giu, 'bekijk de details')
    .replace(/\bniet missen\b/giu, 'bekijken');
}

function replaceAwkwardDatePhrases(value: string): string {
  return value
    .replace(/\bverschijnt\s+op\s+(20\d{2})\b/giu, 'verschijnt later in $1')
    .replace(/\brelease\s+op\s+(20\d{2})\b/giu, 'release later in $1')
    .replace(/\bkomt\s+op\s+(20\d{2})\b/giu, 'komt later in $1')
    .replace(
      /\bverschijnt\s+op\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/giu,
      'verschijnt in $1 $2',
    )
    .replace(
      /\brelease\s+op\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})\b/giu,
      'release in $1 $2',
    );
}

function translateKnownEnglishSentence(sentence: string): string {
  const trimmedSentence = sentence.trim();

  if (
    /^(?:three|two|four|five|six|\d+)\s+beautiful\s+botanical\s+sets\s+revealed!?$/iu.test(
      trimmedSentence,
    )
  ) {
    return 'Nieuwe Botanicals-sets zijn onthuld.';
  }

  if (
    /^summer\s+lego\s+(.+?)\s+sets\s+(?:revealed|unveiled)!?$/iu.test(
      trimmedSentence,
    )
  ) {
    const theme =
      trimmedSentence.match(/^summer\s+lego\s+(.+?)\s+sets/iu)?.[1] ?? '';

    return `Nieuwe LEGO ${theme}-sets voor de zomer zijn onthuld.`;
  }

  if (/^(.+?)\s+sets\s+(?:revealed|unveiled)!?$/iu.test(trimmedSentence)) {
    const subject =
      trimmedSentence.match(
        /^(.+?)\s+sets\s+(?:revealed|unveiled)!?$/iu,
      )?.[1] ?? 'Nieuwe LEGO';

    return `${capitalizeSentenceStart(localizeEnglishTitleSubject(subject))}-sets zijn onthuld.`;
  }

  if (/^(.+?)\s+(?:revealed|unveiled|announced)!?$/iu.test(trimmedSentence)) {
    const subject =
      trimmedSentence.match(
        /^(.+?)\s+(?:revealed|unveiled|announced)!?$/iu,
      )?.[1] ?? 'Deze set';

    return `${capitalizeSentenceStart(localizeEnglishTitleSubject(subject))} is aangekondigd.`;
  }

  if (/^this set\b/iu.test(trimmedSentence)) {
    if (/\bofficial images\b/iu.test(trimmedSentence)) {
      return 'Deze set is met officiële beelden getoond.';
    }

    if (/\bnew images\b/iu.test(trimmedSentence)) {
      return 'Deze set is met nieuwe beelden getoond.';
    }

    if (/\brevealed\b/iu.test(trimmedSentence)) {
      return 'Deze set is onthuld.';
    }

    return 'Deze set staat centraal in dit nieuws.';
  }

  return '';
}

function looksLikeEnglishSentence(sentence: string): boolean {
  const normalizedSentence = normalizeWhitespace(sentence).toLowerCase();

  if (!/\p{L}/u.test(normalizedSentence)) {
    return false;
  }

  const englishSignals = [
    /\b(?:this|these|those)\s+(?:set|sets|model|models|release|releases)\b/iu,
    /\b(?:the set|the model)\s+(?:is|was|will|has|comes|includes)\b/iu,
    /\b(?:the source says|the article says|according to|we have|you can|will be|has been|have been)\b/iu,
    /\b(?:first look|quick look)\b/iu,
    /\bsets?\s+(?:revealed|unveiled|announced)\b/iu,
    /\b(?:revealed|unveiled|announced)\s+(?:today|with|for|as)\b/iu,
    /\b(?:includes|contains|features|comes with|priced at|costs)\b/iu,
    /\bwill\s+be\s+available\b/iu,
    /\bavailable\s+(?:now|from|on)\b/iu,
  ];

  if (englishSignals.some((signal) => signal.test(sentence))) {
    return true;
  }

  const englishWordCount =
    normalizedSentence.match(
      /\b(?:according|and|announced|article|available|can|contains|features|from|has|have|includes|model|revealed|says|set|sets|source|the|these|this|those|unveiled|was|were|will|with|you)\b/gu,
    )?.length ?? 0;
  const dutchWordCount =
    normalizedSentence.match(
      /\b(?:aangekondigd|beschikbaar|de|deze|dit|een|en|heeft|het|is|krijgt|met|niet|op|set|sets|van|voor|wordt|zijn)\b/gu,
    )?.length ?? 0;

  return englishWordCount >= 4 && englishWordCount > dutchWordCount;
}

function removeEnglishSentencesFromPublicCopy(value: string): string {
  return value
    .split('\n\n')
    .map((paragraph) => {
      if (
        paragraph.trimStart().startsWith('---') ||
        paragraph.trimStart().startsWith('<') ||
        paragraph.trimStart().startsWith('[') ||
        /^Bronnen:|^Via:/u.test(paragraph.trimStart())
      ) {
        return paragraph;
      }

      const sentenceParts = paragraph.match(/[^.!?]+[.!?]?/gu) ?? [paragraph];
      const translatedSentences = sentenceParts
        .map((sentence) => {
          if (!looksLikeEnglishSentence(sentence)) {
            return sentence.trim();
          }

          return translateKnownEnglishSentence(sentence);
        })
        .filter(isNonEmptyString);

      return translatedSentences.join(' ');
    })
    .filter(isNonEmptyString)
    .join('\n\n');
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
    [input.source.description, input.facts.summary]
      .filter(isNonEmptyString)
      .join(' '),
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
  const singleSetTone = getSingleSetDraftTone(input);
  const releaseLabel =
    input.facts.releaseDate || input.detected.dateSignals[0] || '';

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `${setName} werkt het best als je de punten al hebt. Moet je extra aankopen doen om hem vrij te spelen, dan kun je hem beter laten lopen.`;
    case 'release_roundup':
      return `Overzicht van de LEGO-sets uit ${resolveMonthLabel(input)} waar je vrolijk doorheen wilt bladeren. Van kleine blikvangers tot grotere thema-releases: genoeg om later terug te zien wat jou echt aanspreekt.`;
    case 'deal':
      if (hasAvailabilityDealSignal(input)) {
        return `${setName} draait nu om beschikbaarheid. Check waar hij leverbaar is en of dit het moment is om hem te pakken.`;
      }

      return `${setName} valt op door ${resolveDealHighlight(input)}. Check vooral of de prijs nu echt klopt voor jouw collectie.`;
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase && !input.primarySet) {
          return `${capitalizeSentenceStart(subjectPhrase)} staan centraal in deze LEGO-aankondiging. Houd vooral in de gaten hoe deze sets zich straks onderscheiden.`;
        }

        if (subjectPhrase && input.primarySet) {
          return `${capitalizeSentenceStart(subjectPhrase)} zetten samen de toon voor deze LEGO-aankondiging. ${input.primarySet.name} mag de blikvanger zijn, maar dit nieuws draait duidelijk om meer dan één set.`;
        }
      }

      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        const themeSentence = buildThemeFollowSentence(input);

        return themeSentence
          ? `Meerdere nieuwe LEGO-sets zijn opgedoken. ${themeSentence}`
          : 'Meerdere nieuwe LEGO-sets zijn opgedoken. Handig om kort te zien welke richting LEGO op beweegt.';
      }

      if (!input.primarySet && isIdeasApprovalDraft(input)) {
        const subjectLine = getIdeasApprovalSubjectLine(input);

        return subjectLine
          ? `${subjectLine} Houd ze in de gaten, want deze fanideeën kunnen straks een officiële LEGO Ideas-uitwerking krijgen.`
          : 'Deze goedgekeurde LEGO Ideas-projecten laten zien welke fanideeën straks officieel uitgewerkt kunnen worden.';
      }

      if (!input.primarySet) {
        return 'Deze aankondiging laat een richting zien voor meerdere nieuwe LEGO-sets. Houd in de gaten welke set straks echt blijft hangen.';
      }

      return `${getMultiSetAnnouncementDisplayName(input)} laat een opvallende richting zien voor meerdere nieuwe LEGO-sets. Houd in de gaten welke set er straks echt uitspringt.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        return buildSingleSetAnnouncementDescription(
          input,
          setName,
          releaseLabel,
        );
      }

      return buildSingleSetDecisionDescription(setName);
    case 'unknown':
    default:
      return 'Handig om te bepalen of deze set het onthouden waard is. Let op de details die straks echt het verschil maken.';
  }
}

function resolveDealHighlight(
  input: EditorialAgentDraftGenerationInput,
): string {
  const context = buildDealContext(input);
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

  if (/\bniet meer te bestellen\b/iu.test(context)) {
    return 'niet meer te bestellen';
  }

  if (
    /\b(?:weer op voorraad|back in stock|weer beschikbaar)\b/iu.test(context)
  ) {
    return 'weer op voorraad';
  }

  if (/\bbeperkte voorraad\b/iu.test(context)) {
    return 'beperkte voorraad';
  }

  if (
    /\b(?:op voorraad|beschikbaar|leverbaar|nu te bestellen|nu te koop|verkrijgbaar)\b/iu.test(
      context,
    )
  ) {
    return 'beschikbaarheid';
  }

  return 'een tijdelijke deal';
}

function buildDealContext(input: EditorialAgentDraftGenerationInput): string {
  return normalizeWhitespace(
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
      .filter(isNonEmptyString)
      .join(' '),
  );
}

function hasDiscountDealSignal(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  return /\b(?:deal|korting|actie|aanbieding|discount|temporarily cheaper|cheaper|sale|dubbele\s+insiders-punten|dubbele\s+insiders punten|€\s*\d+)/iu.test(
    buildDealContext(input),
  );
}

function hasAvailabilityDealSignal(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  if (hasDiscountDealSignal(input)) {
    return false;
  }

  return /\b(?:back in stock|beperkte voorraad|beschikbaar|leverbaar|niet meer te bestellen|nu te bestellen|nu te koop|op voorraad|verkrijgbaar|weer beschikbaar|weer op voorraad)\b/iu.test(
    buildDealContext(input),
  );
}

function hasPreorderSignal(input: EditorialAgentDraftGenerationInput): boolean {
  return /\b(?:pre-?order|voorbestel|voorbestellen|nu te pre-orderen|nu te reserveren)\b/iu.test(
    buildDealContext(input),
  );
}

function buildSingleSetAnnouncementFactLine(
  input: EditorialAgentDraftGenerationInput,
): string {
  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const setNumber = input.primarySet?.setNumber || input.facts.setNumbers[0];
  const theme = resolveTheme(input);
  const releaseLabel = formatReleaseTimingLabel(
    input.facts.releaseDate || input.detected.dateSignals[0] || '',
  );
  const priceLabel = input.facts.priceEUR || input.detected.prices[0] || '';
  const identity = normalizeWhitespace(
    [theme !== 'LEGO' ? `LEGO ${theme}` : 'LEGO', setNumber, setName]
      .filter(isNonEmptyString)
      .join(' '),
  );
  const releasePart = releaseLabel
    ? ` verschijnt ${releaseLabel}`
    : ' is aangekondigd';
  const pricePart = priceLabel ? ` voor ${priceLabel}` : '';
  const preorderPart = hasPreorderSignal(input)
    ? ' en is nu te pre-orderen'
    : '';

  return `${identity}${releasePart}${pricePart}${preorderPart}.`;
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
  eyebrow,
  intro,
  relatedCandidates,
  title,
}: {
  eyebrow?: string;
  intro: string;
  relatedCandidates: readonly EditorialAgentRelatedSetCandidate[];
  title: string;
}): string {
  const formattedSetIds = formatSetRailSetIdsForMdx(
    relatedCandidates.map((candidate) => candidate.setNumber),
  );

  if (formattedSetIds.split(',').filter(isNonEmptyString).length < 2) {
    return '';
  }

  const eyebrowProp = eyebrow
    ? ` eyebrow="${escapeFrontmatterValue(eyebrow)}"`
    : '';

  return `## Leuk voor erbij

${intro}

<SetRail${eyebrowProp} title="${escapeFrontmatterValue(title)}" ${editorialAgentSetRailPropName}="${formattedSetIds}" />`;
}

function hasHelmetContext(input: EditorialAgentDraftGenerationInput): boolean {
  return [
    input.primarySet?.name,
    ...input.relatedCandidates.map((candidate) => candidate.name),
    input.facts.title,
    input.source.title,
    ...input.facts.keywords,
    ...input.detected.keywords,
  ]
    .filter(isNonEmptyString)
    .some((value) => /\bhelmet(?:s)?\b/iu.test(value));
}

function hasDisplayContext(input: EditorialAgentDraftGenerationInput): boolean {
  return [
    input.primarySet?.name,
    input.facts.title,
    input.facts.summary,
    input.source.title,
    input.source.description,
    ...input.facts.keywords,
    ...input.detected.keywords,
  ]
    .filter(isNonEmptyString)
    .some((value) =>
      /\b(?:display|diorama|standbeeld|shelf|plank)\b/iu.test(value),
    );
}

function hasCollectionLineContext(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  return (
    hasHelmetContext(input) ||
    [
      input.facts.title,
      input.facts.summary,
      input.source.title,
      input.source.description,
      ...input.facts.keywords,
      ...input.detected.keywords,
    ]
      .filter(isNonEmptyString)
      .some((value) =>
        /\b(?:collection|collectie|lijn|serie|line)\b/iu.test(value),
      )
  );
}

type RelatedSetUseCase =
  | 'botanicals'
  | 'buildable_figure'
  | 'helmet'
  | 'unknown'
  | 'vehicle';

function classifyRelatedSetUseCase(value: string): RelatedSetUseCase {
  const normalizedValue = value.toLowerCase();

  if (
    /\b(?:botanical|botanicals|plant|plants|flower|flowers|bloem|bloemen|boeket|bouquet|orchid|roos|rose|succulent|bonsai|garden)\b/u.test(
      normalizedValue,
    )
  ) {
    return 'botanicals';
  }

  if (/\b(?:helmet|helm)\b/u.test(normalizedValue)) {
    return 'helmet';
  }

  if (
    /\b(?:minifigure|figure|figuur|beeldfiguur|buildable figure|darth vader|c-3po|r2-d2|chewbacca|grogu)\b/u.test(
      normalizedValue,
    )
  ) {
    return 'buildable_figure';
  }

  if (
    /\b(?:shuttle|starfighter|fighter|ship|vehicle|voertuig|speeder|x-wing|tie fighter|lambda-class|at-rt|falcon|tantive|enterprise|transport|interceptor|cruiser|concorde|space shuttle|spaceship|starship|vessel|kart|racer|car|auto|bolide|viper|ferrari|batmobile|tumbler|plane|vliegtuig|train|trein)\b/u.test(
      normalizedValue,
    )
  ) {
    return 'vehicle';
  }

  return 'unknown';
}

function getPrimaryRelatedSetUseCase(
  input: EditorialAgentDraftGenerationInput,
): RelatedSetUseCase {
  return classifyRelatedSetUseCase(
    normalizeWhitespace(
      [
        input.primarySet?.name,
        input.primarySet?.theme,
        resolveTheme(input),
        input.facts.title,
        input.source.title,
        ...input.facts.keywords,
        ...input.detected.keywords,
        ...input.detected.themes,
      ]
        .filter(isNonEmptyString)
        .join(' '),
    ),
  );
}

function getCandidateRelatedSetUseCase(
  candidate: EditorialAgentRelatedSetCandidate,
): RelatedSetUseCase {
  return classifyRelatedSetUseCase(`${candidate.theme} ${candidate.name}`);
}

function hasFutureReleaseContext(
  input: EditorialAgentDraftGenerationInput,
): boolean {
  const context = normalizeWhitespace(
    [
      input.facts.title,
      input.facts.summary,
      input.source.title,
      input.source.description,
      input.facts.releaseDate,
      ...input.detected.dateSignals,
    ]
      .filter(isNonEmptyString)
      .join(' '),
  );

  return (
    getSingleSetDraftTone(input) === 'announcement' ||
    /\b(?:verschijnt|pre-?order|voorbestel|release|aangekondigd|onthuld|revealed|unveiled|announced)\b/iu.test(
      context,
    )
  );
}

function buildRelatedSetRailCopy(input: EditorialAgentDraftGenerationInput): {
  eyebrow?: string;
  intro: string;
  title: string;
} {
  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );

  if (input.matching.articleType === 'deal') {
    return {
      eyebrow: 'Ook interessant',
      intro:
        'Twijfel je over deze deal? Vergelijk hem dan vooral met deze sets.',
      title: 'Meer sets om te vergelijken',
    };
  }

  if (hasFutureReleaseContext(input)) {
    return {
      eyebrow: 'Kun je niet wachten?',
      intro: `Kun je niet wachten tot ${setName} verschijnt? Dan zijn dit sterke alternatieven die je nu al kunt bouwen en neerzetten.`,
      title: hasHelmetContext(input)
        ? 'Andere helmets om nu te bouwen'
        : hasDisplayContext(input)
          ? 'Vergelijkbare displaysets'
          : 'Alternatieven om nu te bouwen',
    };
  }

  if (hasCollectionLineContext(input)) {
    return {
      eyebrow: 'In dezelfde lijn',
      intro:
        'Spaar je deze collectie, dan zijn dit de sets die logisch in hetzelfde rijtje passen.',
      title: 'Meer uit deze collectie',
    };
  }

  return {
    eyebrow: 'Ook interessant',
    intro: 'Twijfel je nog? Vergelijk deze set dan met een paar sterke buren.',
    title: 'Meer sets om te vergelijken',
  };
}

function getMeaningfulRelatedSetRailCandidates(
  input: EditorialAgentDraftGenerationInput,
): readonly EditorialAgentRelatedSetCandidate[] {
  if (!input.primarySet) {
    return [];
  }

  const primaryUseCase = getPrimaryRelatedSetUseCase(input);

  if (primaryUseCase === 'unknown') {
    return [];
  }

  const sameUseCaseCandidates = input.relatedCandidates.filter(
    (candidate) => getCandidateRelatedSetUseCase(candidate) === primaryUseCase,
  );

  if (input.matching.articleType !== 'deal') {
    return sameUseCaseCandidates;
  }

  const primaryTheme = input.primarySet.theme.toLowerCase();

  return sameUseCaseCandidates.filter(
    (candidate) => candidate.theme.toLowerCase() === primaryTheme,
  );
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
      if (hasAvailabilityDealSignal(input)) {
        return `## Wanneer kopen?

Is ${shortName} nu op voorraad bij een winkel die je vertrouwt, dan is nu kopen logisch. Bij restocks kan wachten betekenen dat je opnieuw achter het net vist.

Twijfel je nog over de set zelf? Check dan eerst prijs, levertijd en retourvoorwaarden. Beschikbaar zijn is handig, maar geen reden om een set te pakken die niet echt op je lijst stond.`;
      }

      return `## Wanneer kopen?

Zakt de prijs naar een niveau waar je ${shortName} al eerder voor wilde hebben, dan is dit je moment. Een deal werkt alleen als hij een set goedkoper maakt die je toch al serieus overwoog.

Moet je jezelf nog overtuigen dat je deze set eigenlijk wilt? Dan is korting alleen niet genoeg. Laat hem lopen en wacht op een set waar je meteen ja tegen zegt.`;
    case 'multi_set_announcement':
      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return `## Waarom volgen?

${buildThemeFollowSentence(input) || 'Dit kun je gebruiken om de richting in de gaten te houden.'} Wacht op betere beelden voordat je hier een koopmoment van maakt.`;
      }

      return `## Waarom volgen?

Dit is nieuws om in de gaten te houden. Eerste beelden en aankondigingen laten zien welke richting LEGO op wil.

Kijk ${input.primarySet ? 'welke set' : 'welk idee'} eruit springt door ${getDomainAwareFocusPhrase(input)}. Daarna kun je betere beelden, prijzen en de eerste winkelinformatie afwachten.`;
    case 'release_roundup':
      return `## Wanneer kopen?

Bij zo’n releasemaand hoef je niet alles meteen op dag één te kopen. Kijk welke sets je echt blij maken en welke je later nog eens terugpakt.

Zie je nu al één of twee dozen waar je meteen energie van krijgt, dan zijn dat de logische eerste keuzes. De rest mag best even blijven liggen tot je later voelt welke sets je alsnog naar je wishlist trekken.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const formattedReleaseLabel = formatReleaseTimingLabel(releaseLabel);

        return `## Wanneer verschijnt hij?

${formattedReleaseLabel ? `Volgens de huidige info verschijnt de set ${formattedReleaseLabel}.` : `${shortName} heeft nu vooral de status van een aangekondigde release.`} Gewoon een datum om te onthouden.

Tot die tijd is het vooral wachten op betere beelden en bevestigde details. Dan zie je pas echt hoe hij op je plank staat.`;
      }

      return `## Wanneer kopen?

Stond ${shortName} al op je lijst en klopt de prijs zodra hij live gaat, dan wil je vooral snel schakelen. Dit is geen artikel om eindeloos over te dubben, maar om te bepalen of dit jouw set is.

Twijfel je nog of deze set echt iets toevoegt aan je collectie? Wacht dan rustig tot er meer beelden, reviews of betere prijzen zijn.`;
    case 'unknown':
    default:
      return `## Wanneer kopen?

Handig om te bepalen of deze set het onthouden waard is. Kijk eerst naar de details die voor jouw collectie echt tellen.

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
  const announcementConclusionLine = pickCuratedCopyVariant(
    [
      `Geen set om vandaag al achteraan te gaan, maar wel eentje om te onthouden. De echte keuze komt zodra prijs en beelden duidelijker zijn.`,
      `${shortName} hoeft nog geen directe keuze te zijn. De echte afweging komt zodra prijs en beelden duidelijker zijn.`,
      `Wachten op betere beelden is prima. Dan zie je snel of ${shortName} op je plank past.`,
    ],
    input,
    'single_set_announcement_conclusion',
  );
  const decisionConclusionLine = pickCuratedCopyVariant(
    [
      `Als ${shortName} al op je lijst stond, heb je nu genoeg om te bepalen of je alert wilt blijven.`,
      `Volgde je ${shortName} al, dan weet je nu beter of dit een snelle ja of een rustige wacht is.`,
      `Voor verzamelaars die ${shortName} al wilden, draait dit om timing, prijs en plaats in de collectie.`,
    ],
    input,
    'single_set_decision_conclusion',
  );

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `## Korte conclusie

Heb je de punten al klaarstaan en zegt ${shortName} je meteen iets, dan is dit een makkelijke ja. Moet je er moeite voor doen, spaar je punten dan liever voor iets waar je langer naar blijft kijken.`;
    case 'deal':
      if (hasAvailabilityDealSignal(input)) {
        return `## Korte conclusie

Dit is een beschikbaarheidscheck. Wilde je ${shortName} al hebben en is hij nu leverbaar, dan wil je vooral snel kijken waar je hem veilig kunt kopen.`;
      }

      return `## Korte conclusie

Een deal is pas goed nieuws als hij op een set valt die je toch al wilde hebben. Gebruik deze daarom als koopmoment-check, niet als excuus om iets mee te pakken waar je morgen alweer over twijfelt.`;
    case 'multi_set_announcement':
      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return `## Korte conclusie

Kort afwachten is genoeg. Zodra er betere beelden of prijzen zijn, zie je vanzelf welke set blijft hangen.`;
      }

      if (!input.primarySet) {
        return `## Korte conclusie

Dit nieuws kun je later terugzien. De projecten geven alvast een eerste richting, maar de echte waarde zit in welk idee straks het sterkste displaymoment krijgt.`;
      }

      return `## Korte conclusie

Dit nieuws kun je later terugzien. ${capitalizeSentenceStart(getMultiSetAnnouncementDisplayName(input))} geeft alvast een eerste richting, maar de echte waarde zit in welk idee straks het sterkste displaymoment krijgt.`;
    case 'release_roundup':
      return `## Korte conclusie

${capitalizeSentenceStart(resolveMonthLabel(input))} is een leuke maand om door de nieuwe releases te bladeren. Niet alles hoeft meteen mee, maar er staan genoeg sets tussen waar je spontaan even voor wilt doorklikken.`;
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

${announcementConclusionLine} ${themeToneCopy}`;
        }

        return `## Korte conclusie

${announcementConclusionLine}`;
      }

      return `## Korte conclusie

${decisionConclusionLine} Zo niet, dan mag deze rustig langs je heen gaan zonder dat je iets mist.`;
    case 'unknown':
    default:
      return `## Korte conclusie

Je ziet snel of je moet opletten of kunt afwachten. Relevant als je deze set al volgde.`;
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
  const announcementDecisionLine = pickCuratedCopyVariant(
    [
      'Gewoon een release om even te onthouden.',
      'Wachten op betere beelden is hier geen slecht idee.',
      'De echte keuze komt pas zodra prijs en beelden duidelijker zijn.',
    ],
    input,
    'single_set_announcement_intro',
  );
  const decisionIntroLine = pickCuratedCopyVariant(
    [
      `Als je precies op ${setName} zat te wachten, is dit het moment om op te letten.`,
      `${setName} is nieuws voor verzamelaars die deze doos al in het vizier hadden.`,
      `Volgde je ${setName} al, dan wil je nu prijs, beelden en beschikbaarheid scherp krijgen.`,
    ],
    input,
    'single_set_decision_intro',
  );

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return [
        `${setName} duikt op als Insiders reward. Leuk als je al iets met ${theme} hebt, maar te mager om los punten voor te gaan najagen.`,
        `Heb je de punten al klaarstaan en wilde je deze reward toch al, dan is dit een snelle ja. Moet je eerst aankopen forceren om hem vrij te spelen, dan kun je hem beter laten schieten.`,
      ];
    case 'deal':
      if (hasAvailabilityDealSignal(input)) {
        return [
          `${setName} is nu beschikbaar of weer op voorraad. Dat maakt dit vooral relevant als je deze set al wilde hebben en eerder misgreep.`,
          'Check prijs, levertijd en winkelvoorwaarden voordat je klikt. Dit draait om beschikbaarheid en het juiste koopmoment.',
        ];
      }

      return [
        `${setName} valt nu op door ${resolveDealHighlight(input)}. Dit is geen artikel om een willekeurige korting te vieren, maar om te checken of het moment eindelijk klopt.`,
        `Wilde je deze set al en wordt de prijs of bonus nu sterk genoeg, dan moet je opletten. Was je nog niet overtuigd, dan verandert een deal daar meestal weinig aan.`,
      ];
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase && !input.primarySet) {
          return [
            `${capitalizeSentenceStart(subjectPhrase)} staan centraal in deze LEGO-aankondiging. Dat is concreter dan een gewone lijst nieuwe sets: je ziet meteen welke namen de aandacht trekken.`,
            'Let op de eerste beelden, duidelijke vormen en details die straks op een plank blijven hangen.',
          ];
        }

        if (subjectPhrase && input.primarySet) {
          return [
            `${capitalizeSentenceStart(subjectPhrase)} staan samen in de schijnwerpers. ${input.primarySet.name} mag de sterkste blikvanger zijn, maar deze aankondiging draait duidelijk om meerdere sets.`,
            `De vraag is nu welke doos straks het meest blijft hangen door ${getDomainAwareFocusPhrase(input)}. Eerste beelden maken die richting concreet.`,
          ];
        }
      }

      if (!input.primarySet && isBricksetWeakMultiSetDraft(input)) {
        return [
          'Er zijn meerdere nieuwe LEGO-sets opgedoken. Zie dit als korte eerste blik.',
          buildThemeFollowSentence(input) ||
            'Let op welke richting LEGO kiest en welke set later de meeste aandacht verdient.',
        ];
      }

      if (!input.primarySet && isIdeasApprovalDraft(input)) {
        const subjectLine = getIdeasApprovalSubjectLine(input);

        return [
          'Deze goedgekeurde LEGO Ideas-projecten trekken de aandacht omdat ze laten zien welke fanideeën LEGO nu serieus verder onderzoekt.',
          ...(subjectLine ? [subjectLine] : []),
          'Houd vooral de richting in de gaten: welke gebouwen, films of ideeën krijgen straks genoeg karakter om op een plank te blijven hangen?',
        ];
      }

      if (!input.primarySet) {
        return [
          'Deze aankondiging draait om meerdere nieuwe LEGO-sets. Het is een eerste blik op een richting om te onthouden.',
          `De vraag is nu welk idee eruit springt zodra er meer beelden zijn. Let op ${getDomainAwareVisualPhrase(input)} die straks op een plank blijven hangen.`,
        ];
      }

      return [
        `${getMultiSetAnnouncementDisplayName(input)} trekt de aandacht in een nieuwe LEGO-aankondiging met meerdere sets. Dat maakt dit geen release-overzicht, maar een eerste blik op een richting die leuk is om te volgen.`,
        `De vraag is nu ${input.primarySet ? 'welke set' : 'welk idee'} eruit springt zodra er meer beelden zijn. Let op ${getDomainAwareVisualPhrase(input)} die straks op een plank blijven hangen.`,
      ];
    case 'release_roundup':
      return [
        capitalizeSentenceStart(
          `${resolveMonthLabel(input)} wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen: van kleine planten tot Disney, Jurassic World en Star Wars. Niet alles hoeft meteen op je wishlist, maar er is genoeg om vrolijk doorheen te bladeren.`,
        ),
        `Dit overzicht laat zien wat eraan komt en waar je aandacht direct naartoe gaat. Sommige sets springen meteen naar voren, andere kun je later nog eens terugpakken.`,
      ].map(capitalizeSentenceStart);
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const formattedReleaseLabel = formatReleaseTimingLabel(releaseLabel);
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
              formattedReleaseLabel
                ? `${setName} komt ${formattedReleaseLabel} als LEGO-set.`
                : `${setName} is aangekondigd als nieuwe LEGO-set.`
            } ${themeToneCopy}`,
            `Dit is geen set waar je nu al iets mee hoeft. ${announcementDecisionLine} Zeker als ${theme === 'LEGO' ? 'deze bouwstijl' : theme} standaard tussen je sets staat.`,
          ];
        }

        return [
          `${
            formattedReleaseLabel
              ? `${setName} komt ${formattedReleaseLabel} als LEGO-set.`
              : `${setName} is aangekondigd als nieuwe LEGO-set.`
          } Het draait om vorm, detail en de plek die hij straks op de plank krijgt.`,
          `Dit is geen set waar je nu al iets mee hoeft. ${announcementDecisionLine} Zeker als ${theme === 'LEGO' ? 'deze bouwstijl' : theme} standaard tussen je sets staat.`,
        ];
      }

      return [
        `${setName} is opgedoken als nieuwe LEGO-set. ${decisionIntroLine} Niet iedere nieuwe doos hoeft meteen budget te claimen.`,
        `Stond hij al op je lijst, dan wil je nu weten of je hem in de gaten houdt of meteen pakt zodra hij live gaat. Twijfel je nog, dan is dit juist het moment om kritisch te blijven.`,
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

Tussen de grotere blikvangers staan vaak ook kleinere sets die pas op een tweede blik charmant worden. Dat maakt dit soort overzichten fijn om later nog eens terug te zien.`;
    case 'unknown':
      return `## Waar moet je op letten?

Kijk naar de details, de bouwvorm en de plek die deze set in je collectie zou krijgen. Als dat niet meteen iets doet, kun je meer informatie afwachten.`;
    case 'multi_set_announcement':
      {
        const subjectPhrase = getMultiSetAnnouncementSubjectPhrase(input);

        if (subjectPhrase) {
          return `## Wat is er aangekondigd?

${capitalizeSentenceStart(subjectPhrase)} vormen de kern van dit nieuws. Daardoor draait de eerste indruk niet om één losse favoriet, maar om vergelijken: welke set heeft de sterkste vorm, het scherpste detail of het beste displaymoment?

Kijk welke naam straks blijft hangen zodra er betere beelden, prijzen en officiële details zijn.`;
        }
      }

      if (!input.primarySet) {
        if (isBricksetWeakMultiSetDraft(input)) {
          return `## Wat valt op?

Het belangrijkste is de richting: meerdere sets, zonder dat één set alles draagt. Kijk naar kleuren, vormen en displaywaarde.`;
        }

        if (isIdeasApprovalDraft(input)) {
          const subjectLine = getIdeasApprovalSubjectLine(input);

          return `## Wat is er goedgekeurd?

${subjectLine || 'De bron draait om LEGO Ideas-projecten die als officiële set mogen worden uitgewerkt.'} De projecten zitten nog vroeg in het proces, dus het draait nu om de ideeën zelf.

Kijk naar wat er aangekondigd is: welke ideeën hebben een sterke scène, welk project heeft de duidelijkste uitstraling en welke richting maakt nieuwsgierig naar de uiteindelijke LEGO-uitwerking?`;
        }

        return `## Wat is er aangekondigd?

Deze aankondiging draait om meerdere nieuwe LEGO-sets, zonder dat één set alles draagt.

Kijk naar wat er aangekondigd is, welke richting LEGO kiest en welke sets straks opvallen zodra er betere beelden of officiële details zijn.`;
      }

      return `## Wat is er aangekondigd?

${input.facts.summary || `${getMultiSetAnnouncementDisplayName(input)} voert deze nieuwe LEGO-aankondiging aan.`}

Omdat het om meerdere sets gaat, draait het nu om richting en eerste indruk. Welke set heeft het sterkste beeld, welke heeft de beste uitstraling en welke blijft interessant als er straks meer details volgen?`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        const factLine = buildSingleSetAnnouncementFactLine(input);

        return `## Wat is er aangekondigd?

${factLine}

Op dit moment zegt dat vooral: hij komt eraan. De echte beoordeling volgt pas zodra beelden en details duidelijker zijn.`;
      }

      return `## Waarom dit opvalt

${input.facts.summary || 'Dit verhaal is interessant door de concrete setkoppeling en het duidelijke koopmoment.'}`;
    default:
      return `## Waarom dit opvalt

${input.facts.summary || 'Dit verhaal is interessant door de concrete setkoppeling en het duidelijke koopmoment.'}`;
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

Dit nieuws past bij fans van ${theme === 'LEGO' ? 'dit soort projecten' : theme} en verzamelaars die graag vroeg zien welke richting LEGO op beweegt.

Zonder duidelijke hoofdkeuze draait het nu om vergelijken: welke ideeën blijven hangen, welke beelden maken nieuwsgierig en welke projecten wil je later nog eens terugzien?`;
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

${themeToneCopy || `Deze aankondiging past bij fans van ${theme === 'LEGO' ? 'dit soort sets' : theme} en verzamelaars die graag vroeg zien welke nieuwe dozen eraan komen.`}

Zoek je sets die meteen vorm en detail op de plank zetten, dan is ${setName} precies het soort release waar je even voor blijft hangen.`;
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
  const meaningfulRelatedSetRailCandidates =
    getMeaningfulRelatedSetRailCandidates(input);
  const relatedSetRail =
    templateKind === 'single_set' || templateKind === 'deal'
      ? meaningfulRelatedSetRailCandidates.length >= 2 &&
        (input.matching.articleType !== 'multi_set_announcement' ||
          hasMultiSetAnnouncementPrimary(input))
        ? buildSetRailBlock({
            ...buildRelatedSetRailCopy(input),
            relatedCandidates: meaningfulRelatedSetRailCandidates,
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

  const cleanDescription = replaceBotanicalsForbiddenVocabulary(
    input,
    replaceControlledVocabulary(
      input,
      cleanPublicDraftCopy(frontmatter.description),
    ),
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
        ...(relatedSetRail && templateKind === 'single_set'
          ? [buildAnnouncementAudienceSection(input)]
          : []),
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
  const assembledMdx = `${sections.join('\n\n')}\n`.replace(
    /\bheeft de LEGO\b/gu,
    'heeft LEGO',
  );
  const mdx = removeEnglishSentencesFromPublicCopy(
    replaceBotanicalsForbiddenVocabulary(
      input,
      replaceControlledVocabulary(input, cleanPublicDraftCopy(assembledMdx)),
    ),
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
