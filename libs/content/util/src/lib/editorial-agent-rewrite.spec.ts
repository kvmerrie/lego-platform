import { describe, expect, it } from 'vitest';
import {
  buildEditorialRewritePrompt,
  createRewrittenDraftOutput,
  validateEditorialRewriteOutput,
} from './editorial-agent-rewrite';
import { generateEditorialMdxDraft } from './editorial-agent-draft';
import type {
  EditorialAgentDraftGenerationInput,
  EditorialAgentExtractedFacts,
  EditorialAgentExtractedSource,
} from './editorial-agent';

function createInput(): EditorialAgentDraftGenerationInput {
  const source: EditorialAgentExtractedSource = {
    byline: '',
    canonicalUrl:
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    description: 'Bekijk welke LEGO-sets in mei 2026 verschijnen.',
    domain: 'www.bricktastic.nl',
    extractedAt: '2026-05-02T09:00:00.000Z',
    finalUrl:
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    inputUrl:
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    language: 'nl',
    siteName: 'BrickTastic',
    textLength: 2400,
    title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
  };
  const facts: EditorialAgentExtractedFacts = {
    isRumor: false,
    keyPoints: [],
    keywords: ['Toy Story', 'Star Wars'],
    priceEUR: '',
    releaseDate: '2026-05-01',
    setNames: [
      'Alien with Pizza Planet Rocket',
      'The Mandalorian’s N-1 Starfighter',
    ],
    setNumbers: ['43287', '75442'],
    summary: 'Mei 2026 brengt meerdere LEGO-thema’s samen.',
    theme: 'Multiple',
    title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
    uncertainClaims: [],
  };

  return {
    detected: {
      dateSignals: ['mei 2026'],
      keywords: ['Toy Story', 'Star Wars'],
      prices: [],
      rumorSignals: [],
      setNumbers: ['43287', '75442'],
      themes: ['Disney', 'Star Wars'],
    },
    facts,
    matching: {
      articleType: 'release_roundup',
      matchedSets: [
        {
          id: '43287',
          name: 'Alien with Pizza Planet Rocket',
          setNumber: '43287',
          slug: 'alien-with-pizza-planet-rocket-43287',
          theme: 'Disney',
        },
        {
          id: '75442',
          name: "The Mandalorian's N-1 Starfighter",
          setNumber: '75442',
          slug: 'the-mandalorians-n-1-starfighter-75442',
          theme: 'Star Wars',
        },
      ],
      unmatchedSetNumbers: [],
    },
    primarySet: null,
    relatedCandidates: [],
    source,
    warnings: [],
  };
}

describe('editorial agent rewrite helpers', () => {
  it('builds a rewrite prompt that keeps the structure frozen', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const prompt = buildEditorialRewritePrompt({
      articleType: input.matching.articleType,
      detected: input.detected,
      deterministicMdx: draft.mdx,
      facts: input.facts,
    });

    expect(prompt).toContain('Verander GEEN headings');
    expect(prompt).toContain('<SetSpotlightList />');
    expect(prompt).toContain('release_roundup');
    expect(prompt).toContain(draft.mdx);
  });

  it('accepts rewritten mdx when headings, components and setnummers stay intact', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const rewrittenMdx = draft.mdx.replace(
      'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
      'Dit zijn de sets uit deze releasegolf waar je nu meteen even doorheen wilt scrollen.',
    );

    expect(rewrittenMdx).not.toBe(draft.mdx);
    expect(
      validateEditorialRewriteOutput({
        originalMdx: draft.mdx,
        rewrittenMdx,
      }),
    ).toEqual({ valid: true });
  });

  it('rejects rewritten mdx when component setIds change', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const invalidRewrite = draft.mdx.replace(
      'setIds="43287, 75442"',
      'setIds="43287, 99999"',
    );

    expect(
      validateEditorialRewriteOutput({
        originalMdx: draft.mdx,
        rewrittenMdx: invalidRewrite,
      }),
    ).toEqual({
      reason:
        'MDX componenten of componentprops veranderden tijdens de rewrite.',
      valid: false,
    });
  });

  it('creates a rewritten draft without changing metadata around it', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const rewrittenDraft = createRewrittenDraftOutput({
      deterministicDraft: draft,
      rewrittenMdx: draft.mdx.replace(
        'Bij zo’n releasemaand hoef je niet alles meteen op dag één te kopen.',
        'Bij zo’n releasemaand hoef je echt niet alles meteen op dag één mee te pakken.',
      ),
    });

    expect(rewrittenDraft.frontmatter).toEqual(draft.frontmatter);
    expect(rewrittenDraft.mdx).not.toBe(draft.mdx);
    expect(rewrittenDraft.primarySet).toEqual(draft.primarySet);
  });
});
