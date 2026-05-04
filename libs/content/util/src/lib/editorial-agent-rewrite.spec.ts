import { describe, expect, it } from 'vitest';
import {
  buildEditorialRewritePrompt,
  createRewrittenDraftOutput,
  restoreOriginalFrontmatterForRewrite,
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
    expect(prompt).toContain('Laat SetRail na "Voor wie is dit leuk?" staan');
    expect(prompt).toContain('De bronvermelding blijft het laatste blok');
    expect(prompt).toContain('release_roundup');
    expect(prompt).toContain(draft.mdx);
  });

  it('adds subtle Star Wars fandom guidance without inviting forced humor', () => {
    const input = createInput();
    const starWarsFacts: EditorialAgentExtractedFacts = {
      ...input.facts,
      keywords: ['Star Wars', 'Darth Vader', 'Helmet Collection'],
      setNames: ['Imperial Remnant AT-RT Driver Helmet'],
      setNumbers: ['75458'],
      theme: 'Star Wars',
      title:
        'Imperial Remnant AT-RT Driver Helmet onthuld (LEGO Star Wars 75458)',
    };
    const prompt = buildEditorialRewritePrompt({
      articleType: 'single_set_news',
      detected: {
        ...input.detected,
        keywords: ['Star Wars', 'Darth Vader', 'Imperial'],
        setNumbers: ['75458'],
        themes: ['Star Wars'],
      },
      deterministicMdx: generateEditorialMdxDraft({
        ...input,
        facts: starWarsFacts,
        matching: {
          articleType: 'single_set_news',
          matchedSets: [
            {
              id: '75458',
              name: 'Imperial Remnant AT-RT Driver Helmet',
              setNumber: '75458',
              slug: 'imperial-remnant-at-rt-driver-helmet-75458',
              theme: 'Star Wars',
            },
          ],
          unmatchedSetNumbers: [],
        },
        primarySet: {
          id: '75458',
          name: 'Imperial Remnant AT-RT Driver Helmet',
          reason: 'title_match',
          setNumber: '75458',
          slug: 'imperial-remnant-at-rt-driver-helmet-75458',
          theme: 'Star Wars',
        },
      }).mdx,
      facts: starWarsFacts,
    });

    expect(prompt).toContain('Darth Vader');
    expect(prompt).toContain('Helmet Collection');
    expect(prompt).toContain(
      'staat deze straks naast Darth Vader op jouw plank',
    );
    expect(prompt).toContain('maximaal 1 kleine fanzin per sectie');
    expect(prompt).toContain('geen grappen');
  });

  it('keeps non-target theme rewrite guidance neutral', () => {
    const input = createInput();
    const prompt = buildEditorialRewritePrompt({
      articleType: 'multi_set_announcement',
      detected: {
        ...input.detected,
        keywords: ['Botanicals'],
        themes: ['Botanicals'],
      },
      deterministicMdx: generateEditorialMdxDraft(input).mdx,
      facts: {
        ...input.facts,
        keywords: ['Botanicals'],
        setNames: ['Beautiful Botanical Set'],
        theme: 'Botanicals',
        title: 'Drie nieuwe Botanicals-sets onthuld',
      },
    });

    expect(prompt).not.toContain('Darth Vader');
    expect(prompt).not.toContain('Helmet Collection');
    expect(prompt).toContain('als er geen herkenbaar fanmoment is: doe niets');
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

  it('accepts harmless frontmatter changes by restoring deterministic frontmatter', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const rewrittenMdx = draft.mdx
      .replace(
        'title: "Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht"',
        'title: "AI maakte deze titel anders"',
      )
      .replace('theme: "Multiple"', 'theme: "Star Wars"')
      .replace(
        'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
        'Dit zijn de sets uit deze releasegolf waar je als fan even voor blijft hangen.',
      );

    expect(
      validateEditorialRewriteOutput({
        originalMdx: draft.mdx,
        rewrittenMdx,
      }),
    ).toEqual({ valid: true });

    const rewrittenDraft = createRewrittenDraftOutput({
      deterministicDraft: draft,
      rewrittenMdx,
    });

    expect(rewrittenDraft.frontmatter).toEqual(draft.frontmatter);
    expect(rewrittenDraft.mdx).toContain(
      'title: "Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht"',
    );
    expect(rewrittenDraft.mdx).toContain('theme: "Multiple"');
    expect(rewrittenDraft.mdx).toContain(
      'waar je als fan even voor blijft hangen',
    );
    expect(rewrittenDraft.mdx).not.toContain('AI maakte deze titel anders');
  });

  it('restores original frontmatter while keeping the rewritten body', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const rewrittenMdx = draft.mdx.replace(
      /^---\n[\s\S]*?\n---/u,
      `---\ntitle: "Andere titel"\nsourceUrl: "https://example.com/ander-artikel"\n---`,
    );
    const restoredMdx = restoreOriginalFrontmatterForRewrite({
      originalMdx: draft.mdx,
      rewrittenMdx,
    });

    expect(restoredMdx).toContain(draft.mdx.match(/^---\n[\s\S]*?\n---/u)?.[0]);
    expect(restoredMdx).not.toContain('https://example.com/ander-artikel');
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

  it('rejects rewritten mdx when body source urls change', () => {
    const input = createInput();
    const draft = generateEditorialMdxDraft(input);
    const originalMdx = `${draft.mdx.trimEnd()}\n\nVia: ${input.source.finalUrl}\n`;
    const invalidRewrite = originalMdx.replace(
      `Via: ${input.source.finalUrl}`,
      'https://example.com/ander-artikel',
    );

    expect(
      validateEditorialRewriteOutput({
        originalMdx,
        rewrittenMdx: invalidRewrite,
      }),
    ).toEqual({
      reason: 'SourceUrl veranderde tijdens de rewrite.',
      valid: false,
    });
  });

  it('rejects rewritten mdx when SetRail moves after the conclusion', () => {
    const originalMdx = `---
title: "Mario Kart reward"
sourceUrl: "https://example.com/mario-kart"
---

Intro.

<FeaturedSet setNumber="40787" />

## Wanneer kopen?

Koop alleen als hij al op je lijst stond.

## Voor wie is dit leuk?

Voor Mario Kart-fans.

<SetRail title="Mario Kart-sets voor erbij" setIds="72050, 72037" />

## Korte conclusie

Dit is vooral leuk voor Mario Kart-fans.

Bronnen: officiële setinformatie.
`;
    const invalidRewrite = `---
title: "Mario Kart reward"
sourceUrl: "https://example.com/mario-kart"
---

Intro.

<FeaturedSet setNumber="40787" />

## Wanneer kopen?

Koop alleen als hij al op je lijst stond.

## Voor wie is dit leuk?

Voor Mario Kart-fans.

## Korte conclusie

Dit is vooral leuk voor Mario Kart-fans.

<SetRail title="Mario Kart-sets voor erbij" setIds="72050, 72037" />

Bronnen: officiële setinformatie.
`;

    expect(
      validateEditorialRewriteOutput({
        originalMdx,
        rewrittenMdx: invalidRewrite,
      }),
    ).toEqual({
      reason: 'SetRail werd na de conclusie geplaatst.',
      valid: false,
    });
  });

  it('rejects rewritten mdx when SetRail moves before the audience section', () => {
    const originalMdx = `---
title: "Mario Kart reward"
sourceUrl: "https://example.com/mario-kart"
---

Intro.

## Voor wie is dit leuk?

Voor Mario Kart-fans.

<SetRail title="Mario Kart-sets voor erbij" setIds="72050, 72037" />

## Korte conclusie

Dit is vooral leuk voor Mario Kart-fans.

Bronnen: officiële setinformatie.
`;
    const invalidRewrite = `---
title: "Mario Kart reward"
sourceUrl: "https://example.com/mario-kart"
---

Intro.

<SetRail title="Mario Kart-sets voor erbij" setIds="72050, 72037" />

## Voor wie is dit leuk?

Voor Mario Kart-fans.

## Korte conclusie

Dit is vooral leuk voor Mario Kart-fans.

Bronnen: officiële setinformatie.
`;

    expect(
      validateEditorialRewriteOutput({
        originalMdx,
        rewrittenMdx: invalidRewrite,
      }),
    ).toEqual({
      reason: 'SetRail werd vóór "Voor wie is dit leuk?" geplaatst.',
      valid: false,
    });
  });

  it('rejects rewritten mdx when the source footer is no longer last', () => {
    const originalMdx = `---
title: "Mario Kart reward"
sourceUrl: "https://example.com/mario-kart"
---

Intro.

## Voor wie is dit leuk?

Voor Mario Kart-fans.

<SetRail title="Mario Kart-sets voor erbij" setIds="72050, 72037" />

## Korte conclusie

Dit is vooral leuk voor Mario Kart-fans.

Bronnen: officiële setinformatie.
`;
    const invalidRewrite = `${originalMdx.trimEnd()}

Nog een losse alinea na de bron.
`;

    expect(
      validateEditorialRewriteOutput({
        originalMdx,
        rewrittenMdx: invalidRewrite,
      }),
    ).toEqual({
      reason: 'De bronvermelding staat niet meer als laatste blok.',
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
