export interface EditorialAgentArticleComponentManifestItem {
  name:
    | 'ArticleCard'
    | 'Callout'
    | 'Faq'
    | 'FeaturedSet'
    | 'ImageGallery'
    | 'SetSpotlightList'
    | 'SetRail'
    | 'ThemeLink';
  goal?: string;
  usage: string;
  whenToUse: string;
}

export interface EditorialAgentWritingGuideline {
  id:
    | 'anti-repetition'
    | 'article-type-tone'
    | 'concrete-buy-advice'
    | 'critical-fan-tone'
    | 'fast-context'
    | 'first-two-paragraphs'
    | 'related-set-rail'
    | 'required-structure';
  instruction: string;
}

export interface EditorialAgentArticleFrontmatter {
  authorName: string;
  date: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
  heroImageCredit?: string;
  slug: string;
  signalSourceName?: string;
  sourceDisplayMode?: 'auto';
  sourceUrl: string;
  status: 'draft';
  theme: string;
  title: string;
}

export interface EditorialAgentArticleFacts {
  isRumor: boolean;
  keyPoints: readonly string[];
  keywords: readonly string[];
  setNames: readonly string[];
  setNumbers: readonly string[];
  summary: string;
  theme: string;
  title: string;
  uncertainClaims: readonly string[];
}

export interface EditorialAgentSetPreview {
  name: string;
  reason: string;
  setNumber: string;
}

export interface EditorialAgentDraftOutput {
  frontmatter: EditorialAgentArticleFrontmatter;
  mdx: string;
  primarySet: EditorialAgentSetPreview | null;
  relatedSets: readonly EditorialAgentSetPreview[];
  warnings: readonly string[];
}

export interface EditorialAgentAiRewriteStatus {
  applied: boolean;
  enabled: boolean;
  warnings: readonly string[];
}

export interface EditorialAgentCatalogImportStatus {
  attempted: boolean;
  attemptedSetNumbers: readonly string[];
  enabled: boolean;
  importedSets: readonly EditorialAgentCatalogMatch[];
  stillMissingSetNumbers: readonly string[];
  warnings: readonly string[];
}

export interface EditorialAgentDraftGenerationResult {
  catalogImport: EditorialAgentCatalogImportStatus;
  deterministicDraft: EditorialAgentDraftOutput;
  effectiveExtraction: EditorialAgentFactExtractionResult;
  output: EditorialAgentDraftOutput;
  rewrite: EditorialAgentAiRewriteStatus;
  rewrittenDraft: EditorialAgentDraftOutput | null;
}

export interface EditorialAgentMockOutput extends EditorialAgentDraftOutput {
  facts: EditorialAgentArticleFacts;
}

export interface EditorialAgentExtractedSource {
  byline: string;
  canonicalUrl: string;
  description: string;
  domain: string;
  extractedAt: string;
  finalUrl: string;
  inputUrl: string;
  language: string;
  publishedAt?: string;
  siteName: string;
  textLength: number;
  title: string;
}

export interface EditorialAgentDetectedSignals {
  dateSignals: readonly string[];
  keywords: readonly string[];
  prices: readonly string[];
  rumorSignals: readonly string[];
  setNumbers: readonly string[];
  themes: readonly string[];
}

export interface EditorialAgentExtractedFacts {
  isRumor: boolean;
  keyPoints: readonly string[];
  keywords: readonly string[];
  priceEUR: string;
  releaseDate: string;
  setNames: readonly string[];
  setNumbers: readonly string[];
  summary: string;
  theme: string;
  title: string;
  uncertainClaims: readonly string[];
}

export type EditorialAgentArticleType =
  | 'deal'
  | 'gwp_reward'
  | 'multi_set_announcement'
  | 'release_roundup'
  | 'single_set_news'
  | 'unknown';

export interface EditorialAgentCatalogMatch {
  id: string;
  name: string;
  setNumber: string;
  slug: string;
  theme: string;
}

export interface EditorialAgentMatchingSummary {
  articleType: EditorialAgentArticleType;
  matchedSets: readonly EditorialAgentCatalogMatch[];
  unmatchedSetNumbers: readonly string[];
}

export interface EditorialAgentPrimarySetSelection
  extends EditorialAgentCatalogMatch {
  reason: 'first_detected' | 'single_set' | 'title_match';
}

export interface EditorialAgentRelatedSetCandidate
  extends EditorialAgentCatalogMatch {
  reason: 'same_article';
}

export interface EditorialAgentEventFingerprint {
  key: string;
  type: EditorialAgentArticleType;
}

export interface EditorialAgentEventLookupResult {
  exists: boolean;
  fingerprint: EditorialAgentEventFingerprint;
}

export interface EditorialAgentFactExtractionResult {
  detected: EditorialAgentDetectedSignals;
  extractedText: string;
  extractedTextPreview: string;
  facts: EditorialAgentExtractedFacts;
  event: EditorialAgentEventLookupResult;
  matching: EditorialAgentMatchingSummary;
  primarySet: EditorialAgentPrimarySetSelection | null;
  relatedCandidates: readonly EditorialAgentRelatedSetCandidate[];
  source: EditorialAgentExtractedSource;
  warnings: readonly string[];
}

export interface EditorialAgentDraftGenerationInput {
  detected: EditorialAgentDetectedSignals;
  facts: EditorialAgentExtractedFacts;
  matching: EditorialAgentMatchingSummary;
  primarySet: EditorialAgentPrimarySetSelection | null;
  relatedCandidates: readonly EditorialAgentRelatedSetCandidate[];
  source: EditorialAgentExtractedSource;
  warnings: readonly string[];
}

export const editorialAgentSetRailPropName = 'setIds';

export function formatEditorialAgentSetIdsForMdx(
  setIds: readonly string[],
  {
    maxItems,
  }: {
    maxItems?: number;
  } = {},
): string {
  const normalizedSetIds = [
    ...new Set(
      setIds.map((setId) => setId.trim()).filter((setId) => setId.length > 0),
    ),
  ];

  return (
    typeof maxItems === 'number'
      ? normalizedSetIds.slice(0, maxItems)
      : normalizedSetIds
  ).join(', ');
}

export function formatSetRailSetIdsForMdx(setIds: readonly string[]): string {
  return formatEditorialAgentSetIdsForMdx(setIds, {
    maxItems: 20,
  });
}

export function formatSetSpotlightListSetIdsForMdx(
  setIds: readonly string[],
): string {
  return formatEditorialAgentSetIdsForMdx(setIds);
}

export const editorialAgentWritingGuidelines: readonly EditorialAgentWritingGuideline[] =
  [
    {
      id: 'anti-repetition',
      instruction:
        'Laat title, description en de eerste zin niet allemaal met exact dezelfde setnaam beginnen. Gebruik de volledige setnaam maximaal één keer in de eerste zichtbare sectie.',
    },
    {
      id: 'critical-fan-tone',
      instruction:
        'Schrijf als een kritische LEGO-fan die helpt kiezen. Fandom en herkenning mogen, hype en zakelijke producttaal niet.',
    },
    {
      id: 'article-type-tone',
      instruction:
        'Gebruik per articleType het juiste ritme. Single-set nieuws, deals en rewards mogen kritisch en koopgericht zijn. Release roundups en unknown-content mogen lichter, nieuwsgieriger en meer discovery-gedreven voelen.',
    },
    {
      id: 'concrete-buy-advice',
      instruction:
        'Maak "Wanneer kopen?" per articleType passend. Bij single-set nieuws, deals en rewards mag het concreet en beslissend zijn. Bij release roundups blijft de sectie bestaan, maar voelt die lichter en minder dwingend.',
    },
    {
      id: 'fast-context',
      instruction:
        'Kom snel tot de kern. De intro mag niet simpelweg de titel herhalen en moet meteen duidelijk maken wat er speelt.',
    },
    {
      id: 'first-two-paragraphs',
      instruction:
        'De eerste twee alinea’s plus FeaturedSet moeten genoeg zijn om te snappen wat het nieuws is, voor wie dit leuk is en of je nu moet kopen of beter wacht.',
    },
    {
      id: 'related-set-rail',
      instruction:
        'Gebruik een SetRail alleen wanneer er minimaal 2 betrouwbare related sets zijn. Leid die rail redactioneel in met fandom of koopcontext, gebruik maximaal 6 sets, zet direct genoemde sets eerst en vermijd saaie koppen zoals "Gerelateerde sets". Plaats SetRail na "Voor wie is dit leuk?" en vóór "Korte conclusie". Gebruik voor release roundups liever een SetSpotlightList als hoofdblok, en bewaar SetRail voor related of aanvullende keuzes.',
    },
    {
      id: 'required-structure',
      instruction:
        'Gebruik bij single-set nieuws, deals en rewards een FeaturedSet direct na de intro. Zet eventuele SetRail na "Voor wie is dit leuk?" en vóór "Korte conclusie". Gebruik bij release roundups een SetSpotlightList als hoofdblok voor de gematchte sets. Houd altijd een sectie "Wanneer kopen?", een korte conclusie en een bronvermelding aan, met de bronvermelding als laatste blok.',
    },
  ] as const;

export const editorialAgentArticleComponentManifest: readonly EditorialAgentArticleComponentManifestItem[] =
  [
    {
      name: 'FeaturedSet',
      usage: '<FeaturedSet setNumber="40787" />',
      whenToUse: 'Als een artikel om een enkele LEGO-set draait.',
    },
    {
      name: 'SetSpotlightList',
      usage: `<SetSpotlightList ${editorialAgentSetRailPropName}="11506, 43301" />`,
      whenToUse:
        'Voor release roundups waarin meerdere sets zelf het hoofdverhaal zijn.',
      goal: 'Laat gebruikers rustig nieuwe sets ontdekken en vergelijken.',
    },
    {
      name: 'SetRail',
      usage: `<SetRail eyebrow="Kun je niet wachten?" title="Sets om nu te volgen" subtitle="..." ${editorialAgentSetRailPropName}="75375, 75376" />`,
      whenToUse:
        'Als je meerdere genoemde of gerelateerde sets naast elkaar wilt tonen.',
      goal: 'Gebruik hem voor related sets, alternatieven en commerciële doorstroom.',
    },
    {
      name: 'Callout',
      usage: '<Callout title="Koopadvies">...</Callout>',
      whenToUse: 'Voor een korte waarschuwing, nuance of koopadviesblok.',
    },
    {
      name: 'Faq',
      usage:
        '<Faq title="Veelgestelde vragen" items="Vraag::Antwoord;;Vraag 2::Antwoord 2" />',
      whenToUse:
        'Als lezers na het hoofdverhaal nog een paar snelle antwoorden nodig hebben.',
    },
    {
      name: 'ImageGallery',
      usage:
        '<ImageGallery images="https://storage.example/article-images/example/one.webp::Alt tekst;;https://storage.example/article-images/example/two.webp::Nog een alt" />',
      whenToUse:
        'Voor meerdere beelden die je ook fullscreen wilt kunnen openen.',
    },
    {
      name: 'ThemeLink',
      usage: '<ThemeLink theme="Star Wars">Star Wars</ThemeLink>',
      whenToUse:
        'Als je vanuit lopende tekst naar een themapagina wilt verwijzen.',
    },
    {
      name: 'ArticleCard',
      usage:
        '<ArticleCard slug="star-wars-day-2026" title="..." description="..." date="2026-05-01" heroImage="https://storage.example/article-images/example/hero.webp" heroImageAlt="..." />',
      whenToUse:
        'Als je in een artikel naar een ander Brickhunt-artikel wilt doorverwijzen.',
    },
  ] as const;

function escapeFrontmatterValue(value: string): string {
  return value.replace(/"/gu, '\\"');
}

function buildEditorialAgentMockMdx({
  frontmatter,
  relatedSets,
}: {
  frontmatter: EditorialAgentArticleFrontmatter;
  relatedSets: readonly EditorialAgentSetPreview[];
}): string {
  const relatedSetIds = relatedSets.map((relatedSet) => relatedSet.setNumber);
  const formattedRelatedSetIds = formatSetRailSetIdsForMdx(relatedSetIds);
  const relatedSetRail =
    formattedRelatedSetIds.split(',').filter(Boolean).length >= 2
      ? `
## Leuk voor erbij

Een Spiny Shell is leuk, maar hij wordt pas echt grappig als er ook een Mario of Luigi is om van de baan te kegelen. Zoek je naast deze reward iets met meer bouw- en speelwaarde, dan zijn dit logischere sets om te checken.

<SetRail title="Mario Kart-sets voor naast de Spiny Shell" ${editorialAgentSetRailPropName}="${formattedRelatedSetIds}" />
`
      : '';

  return `---
title: "${escapeFrontmatterValue(frontmatter.title)}"
slug: "${frontmatter.slug}"
description: "${escapeFrontmatterValue(frontmatter.description)}"
date: "${frontmatter.date}"
theme: "${escapeFrontmatterValue(frontmatter.theme)}"
heroImage: "${frontmatter.heroImage}"
heroImageAlt: "${escapeFrontmatterValue(frontmatter.heroImageAlt)}"
status: "${frontmatter.status}"
sourceUrl: "${frontmatter.sourceUrl}"
---

De Spiny Shell is opnieuw opgedoken als LEGO Insiders Reward. Geen grote set en ook geen stuntdeal, maar wel zo'n Mario Kart-object dat meteen iets doet als je ooit in de laatste bocht door een blauw schild bent geraakt.

Heb je de punten al klaarstaan en wil je deze reward echt hebben, dan is dit het soort set dat je gewoon meteen pakt. Zoek je vooral veel bouw voor je punten, dan is de Spiny Shell te klein om daar speciaal op te wachten.

<FeaturedSet setNumber="40787" />

## Wanneer kopen?

Heb je genoeg Insiders-punten en wil je de Spiny Shell echt hebben, pak hem dan nu. Dit soort rewards kan zonder veel waarschuwing verdwijnen, dus wachten levert weinig op als hij al op je lijstje stond.

Moet je eerst nog punten sparen of extra aankopen doen om hem te krijgen? Dan zou ik hem laten lopen. De Spiny Shell is leuk voor Mario Kart-fans, maar niet sterk genoeg om speciaal voor te gaan bijbestellen.

## Waarom dit opvalt

Je krijgt hier geen set die een hele kast overneemt, maar wel een trofee-achtig displaystuk dat meteen herkenbaar is. Juist dat compacte maakt hem sterker dan veel kleine rewards die na een week alweer in de achtergrond verdwijnen.

## Voor wie is dit leuk?

Deze reward is vooral leuk voor Mario Kart-fans die zo'n klein displayobject grappig vinden naast de grotere karts. Zoek je vooral veel bouwtijd, dan zijn de sets hieronder interessanter om te vergelijken.
${relatedSetRail}

## Korte conclusie

Voor Mario Kart-fans met punten op voorraad is dit een snelle ja. Heb je niets met het blauwe schild, laat hem dan rustig lopen en bewaar je punten voor iets waar je langer naar blijft kijken.

Bron: [LEGO Insiders rewardpagina](${frontmatter.sourceUrl})
`;
}

export function createEditorialAgentMockOutput({
  sourceUrl = 'https://example.com/example',
}: {
  sourceUrl?: string;
} = {}): EditorialAgentMockOutput {
  const frontmatter: EditorialAgentArticleFrontmatter = {
    authorName: 'Kasper van Merrienboer',
    date: '2026-05-01',
    description:
      'Compacte Insiders reward voor Mario Kart-fans die vooral een herkenbaar displaystuk willen, niet per se de meeste bouw voor hun punten.',
    heroImage: '',
    heroImageAlt: 'LEGO Mario Kart Spiny Shell displaymodel',
    slug: 'lego-40787-mario-kart-spiny-shell-terug-als-insiders-reward',
    sourceUrl,
    status: 'draft',
    theme: 'Super Mario',
    title: 'LEGO 40787 Mario Kart – Spiny Shell is terug als Insiders Reward',
  };

  const relatedSets: readonly EditorialAgentSetPreview[] = [
    {
      name: 'Mario Kart - Baby Peach & Grand Prix Set',
      reason:
        'Meer bouw- en speelwaarde als je rond Mario Kart echt iets op de plank wilt zetten.',
      setNumber: '72050',
    },
    {
      name: 'Mario Kart - Mario & Standard Kart',
      reason:
        'Logische aanvulling als je naast de reward ook meteen een herkenbare racer wilt hebben.',
      setNumber: '72037',
    },
  ];

  return {
    facts: {
      isRumor: false,
      keyPoints: [],
      keywords: ['Mario Kart', 'Spiny Shell'],
      setNames: ['Mario Kart – Spiny Shell'],
      setNumbers: ['40787'],
      summary:
        'Kleine Mario Kart reward die vooral scoort op herkenning en displaywaarde, niet op veel bouw voor je punten.',
      theme: 'Super Mario',
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      uncertainClaims: [],
    },
    frontmatter,
    mdx: buildEditorialAgentMockMdx({
      frontmatter,
      relatedSets,
    }),
    primarySet: {
      name: 'Mario Kart – Spiny Shell',
      reason: 'Centrale set in het nieuwsartikel',
      setNumber: '40787',
    },
    relatedSets,
    warnings: [],
  };
}
