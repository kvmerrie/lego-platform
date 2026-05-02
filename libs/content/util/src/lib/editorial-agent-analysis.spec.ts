import { describe, expect, it } from 'vitest';
import {
  buildEventFingerprint,
  detectArticleType,
  selectPrimarySet,
  selectRelatedSetCandidates,
} from './editorial-agent-analysis';
import type {
  EditorialAgentCatalogMatch,
  EditorialAgentDetectedSignals,
  EditorialAgentExtractedFacts,
  EditorialAgentExtractedSource,
} from './editorial-agent';

function createFacts(
  overrides: Partial<EditorialAgentExtractedFacts> = {},
): EditorialAgentExtractedFacts {
  return {
    isRumor: false,
    keyPoints: [],
    keywords: [],
    priceEUR: '',
    releaseDate: '',
    setNames: [],
    setNumbers: [],
    summary: 'Korte samenvatting.',
    theme: '',
    title: 'LEGO nieuws',
    uncertainClaims: [],
    ...overrides,
  };
}

function createDetected(
  overrides: Partial<EditorialAgentDetectedSignals> = {},
): EditorialAgentDetectedSignals {
  return {
    dateSignals: [],
    keywords: [],
    prices: [],
    rumorSignals: [],
    setNumbers: [],
    themes: [],
    ...overrides,
  };
}

function createSource(
  overrides: Partial<EditorialAgentExtractedSource> = {},
): EditorialAgentExtractedSource {
  return {
    byline: '',
    canonicalUrl: '',
    description: '',
    domain: 'example.com',
    extractedAt: '2026-05-02T08:00:00.000Z',
    finalUrl: 'https://example.com/article',
    inputUrl: 'https://example.com/article',
    language: 'nl',
    siteName: 'Example',
    textLength: 1200,
    title: 'Voorbeeldartikel',
    ...overrides,
  };
}

function createMatchedSet(
  setNumber: string,
  overrides: Partial<EditorialAgentCatalogMatch> = {},
): EditorialAgentCatalogMatch {
  return {
    id: setNumber,
    name: `Set ${setNumber}`,
    setNumber,
    slug: `set-${setNumber}`,
    theme: 'Super Mario',
    ...overrides,
  };
}

describe('editorial agent analysis helpers', () => {
  it('detects a single set news article', () => {
    const articleType = detectArticleType(
      createFacts({
        setNumbers: ['40787'],
      }),
      createDetected({
        setNumbers: ['40787'],
      }),
      createSource(),
    );

    expect(articleType).toBe('single_set_news');
  });

  it('keeps a dated single-set headline on single_set_news even when another set appears in the body', () => {
    const articleType = detectArticleType(
      createFacts({
        setNumbers: ['40926', '40769'],
        setNames: ['SEGA Genesis (Mega Drive)'],
        summary:
          'LEGO 40926 SEGA Genesis Console komt op 1 juni 2026 voor €39,99.',
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
      createDetected({
        dateSignals: ['1 juni 2026'],
        prices: ['€39,99'],
        rumorSignals: ['waarschijnlijk'],
        setNumbers: ['40926', '40769'],
      }),
      createSource({
        description:
          'LEGO 40926 SEGA Genesis Console komt op 1 juni 2026 voor €39,99. Bekijk hier de eerste beelden van de aankomende set.',
        finalUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        inputUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
    );

    expect(articleType).toBe('single_set_news');
  });

  it('detects a gwp reward article before generic single-set logic', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Insiders', 'Reward'],
        setNumbers: ['40787'],
      }),
      createDetected({
        keywords: ['Insiders'],
        setNumbers: ['40787'],
      }),
      createSource({
        title: 'LEGO Insiders reward is terug',
      }),
    );

    expect(articleType).toBe('gwp_reward');
  });

  it('keeps a single-set reward article on gwp_reward even when related set numbers appear in the body', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Mario Kart', 'Insiders Reward'],
        setNumbers: ['40787', '72037', '72050'],
        summary:
          'LEGO 40787 Mario Kart – Spiny Shell is opnieuw verkrijgbaar als Insiders Reward.',
        theme: 'Mario Kart',
        title:
          'LEGO 40787 Mario Kart – Spiny Shell opnieuw verkrijgbaar als Insiders Reward (uitverkocht)',
      }),
      createDetected({
        dateSignals: ['15 mei 2025'],
        keywords: ['Mario Kart', 'Spiny Shell'],
        setNumbers: ['40787', '72037', '72050'],
        themes: ['Mario Kart', 'Super Mario'],
      }),
      createSource({
        description:
          'LEGO heeft vandaag LEGO 40787 Mario Kart – Spiny Shell opnieuw beschikbaar gemaakt in het Insiders Rewards Center.',
        title:
          'LEGO 40787 Mario Kart – Spiny Shell opnieuw verkrijgbaar als Insiders Reward (uitverkocht)',
      }),
    );

    expect(articleType).toBe('gwp_reward');
  });

  it('detects a release roundup from multiple set numbers plus dates', () => {
    const articleType = detectArticleType(
      createFacts({
        setNumbers: ['75446', '75447'],
      }),
      createDetected({
        dateSignals: ['mei 2026'],
        setNumbers: ['75446', '75447'],
      }),
      createSource(),
    );

    expect(articleType).toBe('release_roundup');
  });

  it('keeps explicit roundup headlines on release_roundup', () => {
    const articleType = detectArticleType(
      createFacts({
        setNumbers: ['75446', '75447'],
        title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
      }),
      createDetected({
        dateSignals: ['mei 2026'],
        setNumbers: ['75446', '75447'],
      }),
      createSource({
        title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
      }),
    );

    expect(articleType).toBe('release_roundup');
  });

  it('keeps release roundups above incidental gwp language when many sets and dates are present', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['GWP', 'Insiders'],
        setNumbers: ['75446', '75447', '75448'],
        summary: 'Mei 2026 brengt nieuwe sets en een paar rewards mee.',
      }),
      createDetected({
        dateSignals: ['mei 2026'],
        keywords: ['reward'],
        setNumbers: ['75446', '75447', '75448'],
      }),
      createSource({
        title: 'Nieuwe LEGO-sets voor mei 2026',
      }),
    );

    expect(articleType).toBe('release_roundup');
  });

  it('detects a deal article from discount keywords', () => {
    const articleType = detectArticleType(
      createFacts({
        summary: 'Deze deal zakt tijdelijk in prijs.',
      }),
      createDetected({
        keywords: ['deal'],
      }),
      createSource({
        title: 'LEGO deal op C-3PO',
      }),
    );

    expect(articleType).toBe('deal');
  });

  it('keeps release roundups without a primary set by default', () => {
    const primarySet = selectPrimarySet(
      'release_roundup',
      [createMatchedSet('75446'), createMatchedSet('75447')],
      createFacts({
        title: 'Nieuwe Star Wars sets voor mei 2026',
      }),
      createDetected({
        setNumbers: ['75446', '75447'],
      }),
      createSource({
        title: 'Nieuwe Star Wars sets voor mei 2026',
      }),
    );

    expect(primarySet).toBeNull();
  });

  it('selects a title-matching primary set for a roundup when one set is clearly dominant', () => {
    const primarySet = selectPrimarySet(
      'release_roundup',
      [
        createMatchedSet('75446', {
          name: 'Grogu and Hover Pram',
        }),
        createMatchedSet('75447', {
          name: 'X-Wing Pilot Helmet',
        }),
      ],
      createFacts({
        title:
          'LEGO 75447 X-Wing Pilot Helmet springt eruit tussen de nieuwe sets',
      }),
      createDetected({
        setNumbers: ['75446', '75447'],
      }),
      createSource({
        title:
          'LEGO 75447 X-Wing Pilot Helmet springt eruit tussen de nieuwe sets',
      }),
    );

    expect(primarySet).toEqual(
      expect.objectContaining({
        reason: 'title_match',
        setNumber: '75447',
      }),
    );
  });

  it('selects the first matched set for a single-set article', () => {
    const primarySet = selectPrimarySet(
      'single_set_news',
      [createMatchedSet('40787')],
      createFacts({
        setNumbers: ['40787'],
      }),
      createDetected({
        setNumbers: ['40787'],
      }),
      createSource(),
    );

    expect(primarySet).toEqual(
      expect.objectContaining({
        reason: 'single_set',
        setNumber: '40787',
      }),
    );
  });

  it('selects the headline set as primary for a dated single-set article', () => {
    const primarySet = selectPrimarySet(
      'single_set_news',
      [
        createMatchedSet('40926', {
          name: 'SEGA Genesis Console',
          theme: 'Sonic The Hedgehog',
        }),
        createMatchedSet('40769', {
          name: 'SEGA Genesis Controller',
          theme: 'Sonic The Hedgehog',
        }),
      ],
      createFacts({
        setNumbers: ['40926', '40769'],
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
      createDetected({
        dateSignals: ['1 juni 2026'],
        setNumbers: ['40926', '40769'],
      }),
      createSource({
        finalUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        inputUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
    );

    expect(primarySet).toEqual(
      expect.objectContaining({
        reason: 'title_match',
        setNumber: '40926',
      }),
    );
  });

  it('does not promote a related matched set to primary when the headline set itself is unmatched', () => {
    const primarySet = selectPrimarySet(
      'single_set_news',
      [
        createMatchedSet('40769', {
          name: 'SEGA Genesis Controller',
          theme: 'Sonic The Hedgehog',
        }),
      ],
      createFacts({
        setNumbers: ['40926', '40769'],
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
      createDetected({
        dateSignals: ['1 juni 2026'],
        setNumbers: ['40926', '40769'],
      }),
      createSource({
        finalUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        inputUrl:
          'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
    );

    expect(primarySet).toBeNull();
  });

  it('keeps unknown articles without a primary set', () => {
    const primarySet = selectPrimarySet(
      'unknown',
      [createMatchedSet('40787')],
      createFacts({
        setNumbers: ['40787'],
      }),
      createDetected({
        setNumbers: ['40787'],
      }),
      createSource(),
    );

    expect(primarySet).toBeNull();
  });

  it('limits related candidates to six and excludes the primary set', () => {
    const primarySet = {
      ...createMatchedSet('72050'),
      reason: 'single_set' as const,
    };
    const relatedCandidates = selectRelatedSetCandidates({
      articleType: 'release_roundup',
      matchedSets: [
        createMatchedSet('72050'),
        createMatchedSet('72037'),
        createMatchedSet('72051'),
        createMatchedSet('72052'),
        createMatchedSet('72053'),
        createMatchedSet('72054'),
        createMatchedSet('72055'),
      ],
      primarySet,
    });

    expect(relatedCandidates).toHaveLength(6);
    expect(
      relatedCandidates.map((candidate) => candidate.setNumber),
    ).not.toContain('72050');
  });

  it('keeps deal related candidates empty', () => {
    const relatedCandidates = selectRelatedSetCandidates({
      articleType: 'deal',
      matchedSets: [createMatchedSet('10316')],
      primarySet: {
        ...createMatchedSet('10316'),
        reason: 'single_set',
      },
    });

    expect(relatedCandidates).toEqual([]);
  });

  it('keeps unknown related candidates empty', () => {
    const relatedCandidates = selectRelatedSetCandidates({
      articleType: 'unknown',
      matchedSets: [createMatchedSet('10316'), createMatchedSet('10317')],
      primarySet: null,
    });

    expect(relatedCandidates).toEqual([]);
  });

  it('builds a single-set fingerprint from the primary set number', () => {
    const fingerprint = buildEventFingerprint(
      'single_set_news',
      {
        ...createMatchedSet('40787'),
        reason: 'single_set',
      },
      createFacts(),
      createSource(),
      createDetected(),
    );

    expect(fingerprint).toEqual({
      key: '40787',
      type: 'single_set_news',
    });
  });

  it('builds a release roundup fingerprint from the detected month', () => {
    const fingerprint = buildEventFingerprint(
      'release_roundup',
      null,
      createFacts(),
      createSource({
        title: 'Nieuwe LEGO releases',
      }),
      createDetected({
        dateSignals: ['mei 2026'],
      }),
    );

    expect(fingerprint).toEqual({
      key: '2026-05',
      type: 'release_roundup',
    });
  });
});
