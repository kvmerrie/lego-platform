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

function resolveDraftDate(extractedAt: string): string {
  return /^\d{4}-\d{2}-\d{2}T/u.test(extractedAt)
    ? extractedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
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
  if (input.matching.articleType === 'single_set_news') {
    return getSingleSetDraftTone(input) === 'announcement'
      ? 'discovery'
      : 'decision';
  }

  return getEditorialToneForArticleType(input.matching.articleType);
}

function resolveTheme(input: EditorialAgentDraftGenerationInput): string {
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

  return (
    input.primarySet?.theme ||
    input.matching.matchedSets[0]?.theme ||
    input.facts.theme ||
    input.detected.themes[0] ||
    'LEGO'
  );
}

function resolveTitle(input: EditorialAgentDraftGenerationInput): string {
  const sourceTitle = normalizeWhitespace(input.source.title);
  const factsTitle = normalizeWhitespace(input.facts.title);
  const templateKind = resolveDraftTemplateKind(input.matching.articleType);

  if (templateKind === 'single_set' || templateKind === 'deal') {
    if (factsTitle.length > 0) {
      return factsTitle;
    }

    if (input.primarySet) {
      return `LEGO ${input.primarySet.setNumber} ${input.primarySet.name}`;
    }
  }

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  if (factsTitle.length > 0) {
    return factsTitle;
  }

  if (input.primarySet) {
    return `LEGO ${input.primarySet.setNumber} ${input.primarySet.name}`;
  }

  return 'LEGO nieuwsartikel';
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
      return `${setName} is vooral leuk als je de punten al hebt. Moet je extra aankopen doen om hem vrij te spelen, dan kun je hem beter laten lopen.`;
    case 'release_roundup':
      return `Overzicht van de LEGO-sets uit ${resolveMonthLabel(input)} waar je vrolijk doorheen wilt bladeren. Van kleine blikvangers tot grotere thema-releases: dit is vooral een maand om te ontdekken wat jou echt aanspreekt.`;
    case 'deal':
      return `${setName} is alleen interessant als de prijs nu echt scherp is. Hier zie je snel of dit een pak-moment is of niet.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        return releaseLabel
          ? `${setName} is aangekondigd als LEGO-release voor ${releaseLabel}. Vooral iets om rustig te volgen als dit thema, object of deze wereld je meteen iets doet.`
          : `${setName} is aangekondigd als nieuwe LEGO-set. Vooral iets om rustig te volgen als dit thema, object of deze wereld je meteen iets doet.`;
      }

      return `${setName} is vooral relevant als je hem al op je lijst had staan. Dit draft helpt je snel kiezen of je nu moet opletten of rustig kunt wachten.`;
    case 'unknown':
    default:
      return 'Conceptdraft op basis van extraction en exacte catalog matches. Controleer de bron en de setkoppelingen voordat je dit verder uitwerkt.';
  }
}

function buildFrontmatter(
  input: EditorialAgentDraftGenerationInput,
): EditorialAgentArticleFrontmatter {
  const title = resolveTitle(input);

  return {
    date: resolveDraftDate(input.source.extractedAt),
    description: buildDescription(input),
    heroImage: '',
    heroImageAlt: input.primarySet
      ? `LEGO ${input.primarySet.name} setbeeld`
      : title,
    slug: slugify(title),
    sourceUrl: resolveSourceUrl(input),
    status: 'draft',
    theme: resolveTheme(input),
    title,
  };
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

Gebruik deze draft nog niet als hard koopadvies. Controleer eerst of de belangrijkste setkoppelingen en claims uit de bron echt kloppen.

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

  switch (input.matching.articleType) {
    case 'gwp_reward':
      return `## Korte conclusie

Heb je de punten al klaarstaan en zegt ${shortName} je meteen iets, dan is dit een makkelijke ja. Moet je er moeite voor doen, spaar je punten dan liever voor iets waar je langer naar blijft kijken.`;
    case 'deal':
      return `## Korte conclusie

Een deal is pas goed nieuws als hij op een set valt die je toch al wilde hebben. Gebruik deze daarom als koopmoment-check, niet als excuus om iets mee te pakken waar je morgen alweer over twijfelt.`;
    case 'release_roundup':
      return `## Korte conclusie

${capitalizeSentenceStart(resolveMonthLabel(input))} is vooral een leuke maand om door de nieuwe releases te bladeren. Niet alles hoeft meteen mee, maar er staan genoeg sets tussen waar je spontaan even voor wilt doorklikken.`;
    case 'single_set_news':
      if (singleSetTone === 'announcement') {
        return `## Korte conclusie

${shortName} is vooral een leuke aankondiging om in de gaten te houden. Nog geen set waar je nu al iets op hoeft te forceren, wel eentje om te onthouden als deze wereld of dit object je meteen iets doet.`;
      }

      return `## Korte conclusie

Als ${shortName} al op je radar stond, heb je nu genoeg om te bepalen of je alert wilt blijven. Zo niet, dan mag deze rustig langs je heen gaan zonder dat je iets mist.`;
    case 'unknown':
    default:
      return `## Korte conclusie

De facts en catalog matches zijn hier bruikbaar, maar dit blijft een voorzichtige eerste draft. Check de bron nog even handmatig voordat je hier een publiceerbaar verhaal van maakt.`;
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
        `${setName} is alleen interessant als de prijs nu echt iets voor je oplost. Dit is geen artikel om een willekeurige korting te vieren, maar om te checken of het moment eindelijk klopt.`,
        `Wilde je deze set al en zakt hij nu scherp genoeg, dan moet je opletten. Was je nog niet overtuigd, dan verandert een deal daar meestal weinig aan.`,
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
        `De bron wijst op LEGO-nieuws, maar nog niet alles hangt strak genoeg aan betrouwbare catalog matches om er blind op te varen.`,
        `Gebruik deze draft daarom als snelle start, niet als af verhaal. De facts hieronder helpen je om te zien wat al hard genoeg is en wat nog controle nodig heeft.`,
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

Controleer eerst de setnummers, thema’s en claims die uit de bron kwamen. Als daar nog gaten in zitten, moet de draft eerst feitelijk strakker voordat je hem redactioneel gaat polijsten.`;
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
  const setName = getSetDisplayNameForDraft(
    input.primarySet,
    input.facts,
    input.source,
  );
  const theme = resolveTheme(input);

  return `## Voor wie is dit leuk?

Deze aankondiging is vooral leuk voor fans van ${theme === 'LEGO' ? 'dit soort sets' : theme} en voor verzamelaars die graag vroeg zien welke nieuwe dozen eraan komen.

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
  const sourceUrl = resolveSourceUrl(input);
  const sourceDomain = input.source.domain || 'bron';

  return `Bron: [${sourceDomain}](${sourceUrl})`;
}

export function generateEditorialMdxDraft(
  input: EditorialAgentDraftGenerationInput,
): EditorialAgentDraftOutput {
  const templateKind = resolveDraftTemplateKind(input.matching.articleType);
  const singleSetTone = getSingleSetDraftTone(input);
  const frontmatter = buildFrontmatter(input);
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
    templateKind === 'single_set' || templateKind === 'deal'
      ? input.relatedCandidates.length >= 2
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

  const frontmatterBlock = `---\ntitle: "${escapeFrontmatterValue(frontmatter.title)}"\nslug: "${frontmatter.slug}"\ndescription: "${escapeFrontmatterValue(frontmatter.description)}"\ndate: "${frontmatter.date}"\ntheme: "${escapeFrontmatterValue(frontmatter.theme)}"\nheroImage: "${frontmatter.heroImage}"\nheroImageAlt: "${escapeFrontmatterValue(frontmatter.heroImageAlt)}"\nstatus: "${frontmatter.status}"\nsourceUrl: "${frontmatter.sourceUrl}"\n---`;

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
        input.matching.articleType === 'single_set_news' &&
        singleSetTone === 'announcement'
      ) {
        sections = [
          frontmatterBlock,
          ...introParagraphs,
          featuredSetBlock,
          buildMidSection(input),
          buildWhenToBuySection(input),
          buildAnnouncementAudienceSection(input),
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

  sections = sections.filter((section) => section.trim().length > 0);

  return {
    frontmatter,
    mdx: `${sections.join('\n\n')}\n`,
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
