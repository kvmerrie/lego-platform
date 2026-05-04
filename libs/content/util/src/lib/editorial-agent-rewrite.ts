import {
  editorialAgentWritingGuidelines,
  type EditorialAgentDetectedSignals,
  type EditorialAgentDraftGenerationInput,
  type EditorialAgentDraftOutput,
  type EditorialAgentExtractedFacts,
} from './editorial-agent';

export interface EditorialAgentRewritePromptInput {
  articleType: EditorialAgentDraftGenerationInput['matching']['articleType'];
  detected: EditorialAgentDetectedSignals;
  deterministicMdx: string;
  facts: EditorialAgentExtractedFacts;
}

export interface EditorialAgentRewriteValidationResult {
  reason?: string;
  valid: boolean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function extractFrontmatterBlock(mdx: string): string {
  const match = mdx.match(/^---\n[\s\S]*?\n---/u);

  return match?.[0] ?? '';
}

function extractBodyWithoutFrontmatter(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\s*/u, '').trim();
}

export function restoreOriginalFrontmatterForRewrite({
  originalMdx,
  rewrittenMdx,
}: {
  originalMdx: string;
  rewrittenMdx: string;
}): string {
  const originalFrontmatter = extractFrontmatterBlock(originalMdx);
  const rewrittenBody = extractBodyWithoutFrontmatter(rewrittenMdx);

  if (!originalFrontmatter) {
    return rewrittenBody.endsWith('\n') ? rewrittenBody : `${rewrittenBody}\n`;
  }

  return `${originalFrontmatter}\n\n${rewrittenBody}\n`;
}

function extractHeadingLines(mdx: string): string[] {
  return mdx
    .split('\n')
    .map((line) => line.trim())
    .filter((line) =>
      /^(?:#{1,6}\s.+|<h[1-6]\b[^>]*>[^<]+<\/h[1-6]>)$/u.test(line),
    );
}

function extractComponentTags(mdx: string): string[] {
  return [...mdx.matchAll(/<\/?[A-Z][A-Za-z0-9]+\b[^>]*>/gu)].map((match) =>
    normalizeWhitespace(match[0]),
  );
}

function extractOrderedUniqueSetNumbers(mdx: string): string[] {
  const seenSetNumbers = new Set<string>();

  return [...mdx.matchAll(/\b(\d{5})(?:-1)?\b/gu)]
    .map((match) => match[1])
    .filter((setNumber) => {
      if (seenSetNumbers.has(setNumber)) {
        return false;
      }

      seenSetNumbers.add(setNumber);
      return true;
    });
}

function extractOrderedUniqueSourceUrls(mdx: string): string[] {
  const seenSourceUrls = new Set<string>();

  return [...mdx.matchAll(/\bhttps?:\/\/[^\s"'<>)]*/giu)]
    .map((match) => match[0].replace(/[.,;:]+$/gu, ''))
    .filter((sourceUrl) => {
      if (seenSourceUrls.has(sourceUrl)) {
        return false;
      }

      seenSourceUrls.add(sourceUrl);
      return true;
    });
}

function findSourceAttributionIndex(mdx: string): number {
  const sourceMatches = [
    ...mdx.matchAll(/(?:^|\n)(?:Bronnen:|Bron:|Via:)\s+/gu),
  ];
  const lastSourceMatch = sourceMatches.at(-1);

  return typeof lastSourceMatch?.index === 'number'
    ? lastSourceMatch.index
    : -1;
}

function getLastBodyBlock(mdx: string): string {
  const body = extractBodyWithoutFrontmatter(mdx);
  const blocks = body
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.at(-1) ?? '';
}

function hasSourceAttributionLast(mdx: string): boolean {
  return /^(?:Bronnen:|Bron:|Via:)\s+/u.test(getLastBodyBlock(mdx));
}

function validateSetRailAndSourcePlacement({
  originalMdx,
  rewrittenMdx,
}: {
  originalMdx: string;
  rewrittenMdx: string;
}): EditorialAgentRewriteValidationResult {
  const originalSetRailIndex = originalMdx.indexOf('<SetRail');
  const rewrittenSetRailIndex = rewrittenMdx.indexOf('<SetRail');
  const rewrittenConclusionIndex = rewrittenMdx.indexOf('## Korte conclusie');
  const rewrittenSourceIndex = findSourceAttributionIndex(rewrittenMdx);

  if (originalSetRailIndex >= 0) {
    if (rewrittenConclusionIndex < 0) {
      return {
        reason: 'De conclusie ontbreekt na de rewrite.',
        valid: false,
      };
    }

    const rewrittenAudienceIndex = rewrittenMdx.indexOf(
      '## Voor wie is dit leuk?',
    );

    if (rewrittenAudienceIndex < 0) {
      return {
        reason: 'De SetRail mist de sectie "Voor wie is dit leuk?" ervoor.',
        valid: false,
      };
    }

    if (rewrittenSetRailIndex < rewrittenAudienceIndex) {
      return {
        reason: 'SetRail werd vóór "Voor wie is dit leuk?" geplaatst.',
        valid: false,
      };
    }

    if (rewrittenSetRailIndex > rewrittenConclusionIndex) {
      return {
        reason: 'SetRail werd na de conclusie geplaatst.',
        valid: false,
      };
    }

    if (
      rewrittenSourceIndex >= 0 &&
      rewrittenSetRailIndex > rewrittenSourceIndex
    ) {
      return {
        reason: 'SetRail werd na de bronvermelding geplaatst.',
        valid: false,
      };
    }
  }

  if (
    hasSourceAttributionLast(originalMdx) &&
    !hasSourceAttributionLast(rewrittenMdx)
  ) {
    return {
      reason: 'De bronvermelding staat niet meer als laatste blok.',
      valid: false,
    };
  }

  return {
    valid: true,
  };
}

function hasStarWarsRewriteContext({
  detected,
  facts,
}: Pick<EditorialAgentRewritePromptInput, 'detected' | 'facts'>): boolean {
  const context = [
    facts.theme,
    facts.title,
    ...facts.keywords,
    ...facts.setNames,
    ...detected.themes,
    ...detected.keywords,
  ]
    .join(' ')
    .toLowerCase();

  return (
    context.includes('star wars') ||
    context.includes('darth vader') ||
    context.includes('helmet collection') ||
    context.includes('imperial') ||
    context.includes('rebel')
  );
}

function buildFandomToneInstructions({
  detected,
  facts,
}: Pick<EditorialAgentRewritePromptInput, 'detected' | 'facts'>): string {
  if (!hasStarWarsRewriteContext({ detected, facts })) {
    return [
      '7. SUBTIELE FANDOM',
      '- voeg alleen fandom toe als het natuurlijk uit de facts komt',
      '- geen jokes, geen geforceerde fanservice, geen extra claims',
      '- als er geen herkenbaar fanmoment is: doe niets',
    ].join('\n');
  }

  return [
    '7. SUBTIELE FANDOM',
    '- voeg alleen subtiele fandom toe in intro, 1-2 bodyzinnen en conclusie',
    '- mik op maximaal 1 kleine fanzin per sectie, niet in elke zin',
    '- gebruik concrete, visuele Star Wars-referenties waar ze natuurlijk passen:',
    '  - Darth Vader',
    '  - Helmet Collection',
    '  - display shelf / plank',
    '  - Imperial/Rebel feel',
    '- voorbeeldrichting: “past deze in jouw Helmet Collection rijtje?” of “staat deze straks naast Darth Vader op jouw plank?”',
    '- verzin geen canon, scènes, personages of claims die niet in de facts zitten',
    '- geen grappen, geen luide fanservice, geen hype',
  ].join('\n');
}

export function buildEditorialRewritePrompt({
  articleType,
  detected,
  deterministicMdx,
  facts,
}: EditorialAgentRewritePromptInput): string {
  const writingGuidelines = editorialAgentWritingGuidelines
    .map((guideline) => `- ${guideline.instruction}`)
    .join('\n');
  const knownFacts = [
    `- articleType: ${articleType}`,
    `- title: ${facts.title || 'Onbekend'}`,
    `- theme: ${facts.theme || 'Onbekend'}`,
    `- setNumbers: ${facts.setNumbers.join(', ') || 'Geen'}`,
    `- setNames: ${facts.setNames.join(' | ') || 'Geen'}`,
    `- keywords: ${facts.keywords.join(', ') || 'Geen'}`,
    `- detectedThemes: ${detected.themes.join(', ') || 'Geen'}`,
  ].join('\n');
  const fandomToneInstructions = buildFandomToneInstructions({
    detected,
    facts,
  });

  return `Je bent een LEGO-fan die schrijft voor Brickhunt.

Je krijgt een bestaand artikel in MDX.

Jouw taak:
- herschrijf de tekst zodat deze natuurlijker, vloeiender en leuker leest
- voeg meer gevoel, herkenning en enthousiasme toe
- behoud de structuur en alle componenten exact

Regels:

1. STRUCTUUR
- Verander GEEN headings
- Verwijder GEEN secties
- Voeg GEEN nieuwe secties toe
- Laat alle MDX componenten exact staan:
  - <FeaturedSet />
  - <SetSpotlightList />
  - <SetRail />
- Verander GEEN setIds
- Laat FeaturedSet bovenin staan, direct na de intro
- Laat SetRail na "Voor wie is dit leuk?" staan en vóór "Korte conclusie"
- De bronvermelding blijft het laatste blok

2. FEITEN
- Verander GEEN feiten
- Verzin GEEN nieuwe informatie
- Verander GEEN setnummers, prijzen of data

3. TONE
Pas tone aan op articleType:

### release_roundup (discovery)
- luchtig, enthousiast, fan-gevoel
- niet elke zin hoeft koopadvies te zijn
- maak het leuk om door te scrollen
- vermijd woorden zoals:
  - shortlist
  - optimaliseren
  - strategie
  - budget
- gebruik:
  - “er zit genoeg tussen om…”
  - “je blijft hier en daar hangen”
  - “dit is zo’n maand waarin…”

### single_set_news / multi_set_announcement / deal / gwp_reward (decision)
- kritisch en duidelijk
- concreet koopadvies
- direct en eerlijk

4. STIJL
- kort en duidelijk
- geen lange zinnen
- geen marketingtaal
- geen hype (“must-have”, “episch”)
- schrijf als een ervaren LEGO-fan

5. DUPLICATIE
- vermijd herhaling van dezelfde zinnen
- gebruik variatie in formulering

6. OUTPUT
- geldige MDX
- geen markdown code fences
- geen extra uitleg

${fandomToneInstructions}

Bestaande Brickhunt writing guidelines:
${writingGuidelines}

Bekende facts die je niet mag veranderen:
${knownFacts}

Input:
${deterministicMdx}

Output:
(alleen herschreven MDX)`;
}

export function validateEditorialRewriteOutput({
  originalMdx,
  rewrittenMdx,
}: {
  originalMdx: string;
  rewrittenMdx: string;
}): EditorialAgentRewriteValidationResult {
  const normalizedOriginalMdx = originalMdx.trim();
  const normalizedRewrittenMdx = restoreOriginalFrontmatterForRewrite({
    originalMdx,
    rewrittenMdx,
  }).trim();

  if (!extractBodyWithoutFrontmatter(rewrittenMdx)) {
    return {
      reason: 'AI output was leeg.',
      valid: false,
    };
  }

  if (
    JSON.stringify(extractHeadingLines(normalizedOriginalMdx)) !==
    JSON.stringify(extractHeadingLines(normalizedRewrittenMdx))
  ) {
    return {
      reason: 'De headings veranderden tijdens de rewrite.',
      valid: false,
    };
  }

  if (
    JSON.stringify(extractComponentTags(normalizedOriginalMdx)) !==
    JSON.stringify(extractComponentTags(normalizedRewrittenMdx))
  ) {
    return {
      reason:
        'MDX componenten of componentprops veranderden tijdens de rewrite.',
      valid: false,
    };
  }

  if (
    JSON.stringify(extractOrderedUniqueSetNumbers(normalizedOriginalMdx)) !==
    JSON.stringify(extractOrderedUniqueSetNumbers(normalizedRewrittenMdx))
  ) {
    return {
      reason: 'Setnummers veranderden tijdens de rewrite.',
      valid: false,
    };
  }

  if (
    JSON.stringify(extractOrderedUniqueSourceUrls(normalizedOriginalMdx)) !==
    JSON.stringify(extractOrderedUniqueSourceUrls(normalizedRewrittenMdx))
  ) {
    return {
      reason: 'SourceUrl veranderde tijdens de rewrite.',
      valid: false,
    };
  }

  const placementValidation = validateSetRailAndSourcePlacement({
    originalMdx: normalizedOriginalMdx,
    rewrittenMdx: normalizedRewrittenMdx,
  });

  if (!placementValidation.valid) {
    return placementValidation;
  }

  return {
    valid: true,
  };
}

export function createRewrittenDraftOutput({
  deterministicDraft,
  rewrittenMdx,
}: {
  deterministicDraft: EditorialAgentDraftOutput;
  rewrittenMdx: string;
}): EditorialAgentDraftOutput {
  const mdx = restoreOriginalFrontmatterForRewrite({
    originalMdx: deterministicDraft.mdx,
    rewrittenMdx,
  });

  return {
    ...deterministicDraft,
    mdx,
  };
}
