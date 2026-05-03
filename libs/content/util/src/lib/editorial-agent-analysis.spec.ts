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

  it('keeps LEGO Marvel 76339 headlines on single_set_news instead of release_roundup', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['LEGO Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
        setNumbers: ['76339', '76316'],
        summary:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
        theme: 'Multiple',
        title:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
      }),
      createDetected({
        dateSignals: ['augustus 2026'],
        keywords: ['LEGO Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
        setNumbers: ['76339', '76316'],
        themes: ['Marvel'],
      }),
      createSource({
        description:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld. Reed Richards verscheen eerder al als minifiguur in LEGO Marvel 76316 Fantastic Four vs. Galactus.',
        finalUrl:
          'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld-alles-wat-je-moet-weten/',
        inputUrl:
          'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld-alles-wat-je-moet-weten/',
        title:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
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

  it('detects a release roundup from many set numbers plus strong date grouping', () => {
    const articleType = detectArticleType(
      createFacts({
        setNumbers: [
          '75446',
          '75447',
          '75448',
          '75449',
          '75450',
          '75451',
          '75452',
        ],
      }),
      createDetected({
        dateSignals: ['mei 2026'],
        setNumbers: [
          '75446',
          '75447',
          '75448',
          '75449',
          '75450',
          '75451',
          '75452',
        ],
      }),
      createSource(),
    );

    expect(articleType).toBe('release_roundup');
  });

  it('detects Hogwarts first-images articles as multi_set_announcement', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Harry Potter', 'Hogwarts'],
        setNumbers: ['76450', '76451', '76452'],
        title: 'Eerste beelden LEGO Hogwarts sets voor 2026 opgedoken',
      }),
      createDetected({
        keywords: ['Harry Potter', 'Hogwarts'],
        setNumbers: ['76450', '76451', '76452'],
        themes: ['Harry Potter'],
      }),
      createSource({
        title: 'Eerste beelden LEGO Hogwarts sets voor 2026 opgedoken',
      }),
    );

    expect(articleType).toBe('multi_set_announcement');
  });

  it('detects F1 helmet reveal articles as multi_set_announcement', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['F1', 'Piastri', 'Norris'],
        setNumbers: ['42241', '42242'],
        title: 'LEGO F1 helmen van Piastri en Norris onthuld',
      }),
      createDetected({
        keywords: ['F1', 'Piastri', 'Norris'],
        setNumbers: ['42241', '42242'],
        themes: ['Technic'],
      }),
      createSource({
        title: 'LEGO F1 helmen van Piastri en Norris onthuld',
      }),
    );

    expect(articleType).toBe('multi_set_announcement');
  });

  it('detects approved Ideas project articles as multi_set_announcement without a title set', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Ideas'],
        setNumbers: ['21330', '99991', '99992'],
        summary:
          'LEGO Ideas heeft meerdere projecten goedgekeurd. Home Alone wordt alleen als eerdere Ideas-set genoemd.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
      createDetected({
        keywords: ['Ideas'],
        setNumbers: ['21330', '99991', '99992'],
        themes: ['Ideas'],
      }),
      createSource({
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
    );

    expect(articleType).toBe('multi_set_announcement');
  });

  it('detects Ideas approval articles as multi_set_announcement even when only context sets have numbers', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        summary:
          'Amsterdam Canal Houses en Edward Scissorhands zijn goedgekeurd. Dit ligt in lijn met het succes van LEGO Ideas 21330 Home Alone.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
      createDetected({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        themes: ['Ideas'],
      }),
      createSource({
        description:
          'National Lampoon’s Christmas Vacation Griswold House, Amsterdam Canal Houses en Edward Scissorhands zijn geselecteerd.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
    );

    expect(articleType).toBe('multi_set_announcement');
  });

  it('keeps normal single-set Ideas articles with a title set on single_set_news', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        title: 'LEGO Ideas 21330 Home Alone opnieuw verkrijgbaar',
      }),
      createDetected({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        themes: ['Ideas'],
      }),
      createSource({
        title: 'LEGO Ideas 21330 Home Alone opnieuw verkrijgbaar',
      }),
    );

    expect(articleType).toBe('single_set_news');
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

  it('detects Star Trek double points and discount articles as deals, not rewards', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Star Trek', 'dubbele Insiders-punten', '€60 korting'],
        setNames: ['Star Trek: U.S.S. Enterprise NCC-1701-D'],
        setNumbers: ['10356'],
        summary:
          'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D is tijdelijk verkrijgbaar met dubbele Insiders-punten of €60 korting.',
        theme: 'Icons',
        title:
          'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
      }),
      createDetected({
        keywords: ['dubbele Insiders-punten', 'korting', 'actie'],
        prices: ['€60 korting'],
        setNumbers: ['10356'],
        themes: ['Icons'],
      }),
      createSource({
        description:
          'De set krijgt tijdelijk dubbele Insiders-punten of €60 korting.',
        title:
          'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
      }),
    );

    expect(articleType).toBe('deal');
  });

  it('keeps reward center articles on gwp_reward', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['Insiders reward', 'reward center'],
        setNumbers: ['40787'],
        summary:
          'De Spiny Shell is opnieuw verkrijgbaar in het LEGO Insiders Reward Center en in te wisselen met punten.',
        title:
          'LEGO 40787 Mario Kart Spiny Shell opnieuw verkrijgbaar als Insiders reward',
      }),
      createDetected({
        keywords: ['reward center', 'inwisselen met punten'],
        setNumbers: ['40787'],
      }),
      createSource({
        title:
          'LEGO 40787 Mario Kart Spiny Shell opnieuw verkrijgbaar als Insiders reward',
      }),
    );

    expect(articleType).toBe('gwp_reward');
  });

  it('keeps May the 4th gift-with-purchase articles on gwp_reward', () => {
    const articleType = detectArticleType(
      createFacts({
        keywords: ['May the 4th', 'GWP', 'cadeau bij aankoop'],
        setNumbers: ['5009258'],
        summary:
          'LEGO Star Wars May the 4th heeft een gratis cadeau bij aankoop zolang de voorraad strekt.',
        theme: 'Star Wars',
        title:
          'LEGO Star Wars May the 4th GWP nu beschikbaar als cadeau bij aankoop',
      }),
      createDetected({
        keywords: ['GWP', 'cadeau bij aankoop'],
        setNumbers: ['5009258'],
        themes: ['Star Wars'],
      }),
      createSource({
        title:
          'LEGO Star Wars May the 4th GWP nu beschikbaar als cadeau bij aankoop',
      }),
    );

    expect(articleType).toBe('gwp_reward');
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

  it('does not promote an old body-mentioned Ideas set as primary for a multi-set announcement', () => {
    const primarySet = selectPrimarySet(
      'multi_set_announcement',
      [
        createMatchedSet('21330', {
          name: 'Home Alone',
          theme: 'Ideas',
        }),
      ],
      createFacts({
        keywords: ['Ideas'],
        setNumbers: ['21330', '99991', '99992'],
        summary:
          'LEGO Ideas heeft meerdere nieuwe projecten goedgekeurd. Home Alone wordt alleen als eerdere Ideas-set genoemd.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
      createDetected({
        keywords: ['Ideas'],
        setNumbers: ['21330', '99991', '99992'],
        themes: ['Ideas'],
      }),
      createSource({
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
    );
    const relatedCandidates = selectRelatedSetCandidates({
      articleType: 'multi_set_announcement',
      matchedSets: [
        createMatchedSet('21330', {
          name: 'Home Alone',
          theme: 'Ideas',
        }),
      ],
      primarySet,
    });

    expect(primarySet).toBeNull();
    expect(relatedCandidates).toEqual([]);
  });

  it('rejects context-mentioned Ideas catalog sets as primary in approval articles', () => {
    const primarySet = selectPrimarySet(
      'multi_set_announcement',
      [
        createMatchedSet('21330', {
          name: 'Home Alone',
          theme: 'Ideas',
        }),
      ],
      createFacts({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        summary:
          'Amsterdam Canal Houses en Edward Scissorhands zijn goedgekeurd. Dit is in lijn met het succes van LEGO Ideas 21330 Home Alone.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
      createDetected({
        keywords: ['Ideas'],
        setNumbers: ['21330'],
        themes: ['Ideas'],
      }),
      createSource({
        description:
          'National Lampoon’s Christmas Vacation Griswold House, Amsterdam Canal Houses en Edward Scissorhands zijn geselecteerd.',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      }),
    );

    expect(primarySet).toBeNull();
  });

  it('selects a title-mentioned set as primary for a multi-set announcement', () => {
    const primarySet = selectPrimarySet(
      'multi_set_announcement',
      [
        createMatchedSet('42241', {
          name: 'F1 Piastri Helmet',
          theme: 'Technic',
        }),
        createMatchedSet('42242', {
          name: 'F1 Norris Helmet',
          theme: 'Technic',
        }),
      ],
      createFacts({
        keywords: ['F1', 'Piastri', 'Norris'],
        setNumbers: ['42241', '42242'],
        title: 'LEGO F1 helmen van Piastri en Norris onthuld',
      }),
      createDetected({
        keywords: ['F1', 'Piastri', 'Norris'],
        setNumbers: ['42241', '42242'],
      }),
      createSource({
        title: 'LEGO F1 helmen van Piastri en Norris onthuld',
      }),
    );

    expect(primarySet).toEqual(
      expect.objectContaining({
        reason: 'title_match',
        setNumber: '42241',
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
