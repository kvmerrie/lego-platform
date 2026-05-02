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

### single_set_news / deal / gwp_reward (decision)
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
  const normalizedRewrittenMdx = rewrittenMdx.trim();

  if (!normalizedRewrittenMdx) {
    return {
      reason: 'AI output was leeg.',
      valid: false,
    };
  }

  if (
    extractFrontmatterBlock(normalizedOriginalMdx) !==
    extractFrontmatterBlock(normalizedRewrittenMdx)
  ) {
    return {
      reason: 'De frontmatter veranderde tijdens de rewrite.',
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
  return {
    ...deterministicDraft,
    mdx: rewrittenMdx.endsWith('\n') ? rewrittenMdx : `${rewrittenMdx}\n`,
  };
}
