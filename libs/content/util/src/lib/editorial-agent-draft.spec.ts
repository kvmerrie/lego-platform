import { describe, expect, it, vi } from 'vitest';
import {
  generateEditorialMdxDraft,
  getEditorialToneForDraftInput,
  getSetDisplayNameForDraft,
  getEditorialToneForArticleType,
  getSingleSetDraftTone,
  getThemeToneCopy,
} from './editorial-agent-draft';
import type {
  EditorialAgentCatalogMatch,
  EditorialAgentDetectedSignals,
  EditorialAgentDraftGenerationInput,
  EditorialAgentExtractedFacts,
  EditorialAgentExtractedSource,
  EditorialAgentMatchingSummary,
  EditorialAgentPrimarySetSelection,
  EditorialAgentRelatedSetCandidate,
} from './editorial-agent';

function createSource(
  overrides: Partial<EditorialAgentExtractedSource> = {},
): EditorialAgentExtractedSource {
  return {
    byline: '',
    canonicalUrl: '',
    description: 'Bronbeschrijving.',
    domain: 'www.bricktastic.nl',
    extractedAt: '2026-05-02T09:00:00.000Z',
    finalUrl:
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    inputUrl:
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    language: 'nl',
    siteName: 'BrickTastic',
    textLength: 3200,
    title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
    ...overrides,
  };
}

function createFacts(
  overrides: Partial<EditorialAgentExtractedFacts> = {},
): EditorialAgentExtractedFacts {
  return {
    isRumor: false,
    keyPoints: [],
    keywords: ['Mario Kart'],
    priceEUR: '',
    releaseDate: '2026-05-01',
    setNames: ['Mario Kart – Spiny Shell'],
    setNumbers: ['40787'],
    summary: 'Korte samenvatting.',
    theme: 'Super Mario',
    title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
    uncertainClaims: [],
    ...overrides,
  };
}

function createDetected(
  overrides: Partial<EditorialAgentDetectedSignals> = {},
): EditorialAgentDetectedSignals {
  return {
    dateSignals: ['mei 2026'],
    keywords: ['Mario Kart', 'Spiny Shell'],
    prices: ['€9,99'],
    rumorSignals: [],
    setNumbers: ['40787'],
    themes: ['Super Mario'],
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

function createPrimarySet(
  overrides: Partial<EditorialAgentPrimarySetSelection> = {},
): EditorialAgentPrimarySetSelection {
  return {
    ...createMatchedSet('40787', {
      name: 'Mario Kart – Spiny Shell',
    }),
    reason: 'single_set',
    ...overrides,
  };
}

function createRelatedCandidate(
  setNumber: string,
  overrides: Partial<EditorialAgentRelatedSetCandidate> = {},
): EditorialAgentRelatedSetCandidate {
  return {
    ...createMatchedSet(setNumber, {
      name: `Related ${setNumber}`,
    }),
    reason: 'same_article',
    ...overrides,
  };
}

function createMatching(
  overrides: Partial<EditorialAgentMatchingSummary> = {},
): EditorialAgentMatchingSummary {
  return {
    articleType: 'gwp_reward',
    matchedSets: [createPrimarySet()],
    unmatchedSetNumbers: [],
    ...overrides,
  };
}

function createInput(
  overrides: Partial<EditorialAgentDraftGenerationInput> = {},
): EditorialAgentDraftGenerationInput {
  return {
    detected: createDetected(),
    facts: createFacts(),
    matching: createMatching(),
    primarySet: createPrimarySet(),
    relatedCandidates: [
      createRelatedCandidate('72050', {
        name: 'Mario Kart - Baby Peach & Grand Prix Set',
      }),
      createRelatedCandidate('72037', {
        name: 'Mario Kart - Mario & Standard Kart',
      }),
    ],
    source: createSource(),
    warnings: [],
    ...overrides,
  };
}

function expectFeaturedSetAtTop(mdx: string): void {
  const featuredSetIndex = mdx.indexOf('<FeaturedSet');
  const firstHeadingIndex = mdx.indexOf('\n## ');

  expect(featuredSetIndex).toBeGreaterThan(-1);
  expect(firstHeadingIndex).toBeGreaterThan(-1);
  expect(featuredSetIndex).toBeLessThan(firstHeadingIndex);
}

function expectSetRailAfterMainContent(mdx: string): void {
  const featuredSetIndex = mdx.indexOf('<FeaturedSet');
  const setRailIndex = mdx.indexOf('<SetRail');
  const audienceIndex = mdx.indexOf('## Voor wie is dit leuk?');
  const conclusionIndex = mdx.indexOf('## Korte conclusie');
  const sourceIndex = Math.max(
    mdx.lastIndexOf('Bronnen:'),
    mdx.lastIndexOf('Via:'),
  );

  expectFeaturedSetAtTop(mdx);
  expect(setRailIndex).toBeGreaterThan(featuredSetIndex);
  expect(audienceIndex).toBeGreaterThan(featuredSetIndex);
  expect(setRailIndex).toBeGreaterThan(audienceIndex);
  expect(setRailIndex).toBeLessThan(conclusionIndex);
  expect(sourceIndex).toBeGreaterThan(setRailIndex);
  expect(mdx.trim().endsWith(mdx.slice(sourceIndex).trim())).toBe(true);
  expect(mdx.slice(featuredSetIndex, conclusionIndex)).toContain('## ');
}

function expectConcisePublicDescription(description: string): void {
  const sentenceCountValue = description.replace(
    /\b(?:[A-Z]\.){2,}[A-Z]?/gu,
    (match) => match.replace(/\./gu, ''),
  );

  expect(description).not.toMatch(/\b(?:draft|concept|artikel)\b/iu);
  expect(
    sentenceCountValue.split(/[.!?]+/u).filter((sentence) => sentence.trim())
      .length,
  ).toBeLessThanOrEqual(2);
}

function getPublicMdxBody(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\n\n/u, '');
}

function getSourceLine(mdx: string): string {
  return (
    mdx
      .trim()
      .split('\n')
      .findLast(
        (line) => line.startsWith('Bronnen:') || line.startsWith('Via:'),
      ) ?? ''
  );
}

function getIntroAndConclusionText(mdx: string): string {
  const publicBody = getPublicMdxBody(mdx);
  const firstHeadingIndex = publicBody.indexOf('\n## ');
  const intro =
    firstHeadingIndex >= 0
      ? publicBody.slice(0, firstHeadingIndex)
      : publicBody;
  const conclusionIndex = publicBody.indexOf('## Korte conclusie');
  const sourceIndex = Math.max(
    publicBody.lastIndexOf('Bronnen:'),
    publicBody.lastIndexOf('Via:'),
  );
  const conclusion =
    conclusionIndex >= 0
      ? publicBody.slice(
          conclusionIndex,
          sourceIndex > conclusionIndex ? sourceIndex : undefined,
        )
      : '';

  return `${intro}\n${conclusion}`;
}

function expectSourceLineLast(mdx: string): void {
  const sourceLine = getSourceLine(mdx);

  expect(sourceLine).not.toBe('');
  expect(mdx.trim().endsWith(sourceLine)).toBe(true);
}

function summarizeGeneratedArticle(
  result: ReturnType<typeof generateEditorialMdxDraft>,
) {
  const componentLines = result.mdx
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('<FeaturedSet') ||
        line.startsWith('<SetRail') ||
        line.startsWith('<SetSpotlightList'),
    );

  return {
    components: componentLines,
    description: result.frontmatter.description,
    sourceLine: getSourceLine(result.mdx),
    title: result.frontmatter.title,
  };
}

function expectNoEnglishSentencesInFinalMdx(mdx: string): void {
  expect(mdx).not.toMatch(
    /\b(?:This set|These sets|The model|The source says|According to|We have|You can|has been revealed|have been revealed|will be available|with official images|display stand|sets revealed|includes two minifigures)\b/iu,
  );
}

function expectEditorialQualityGuards(
  result: ReturnType<typeof generateEditorialMdxDraft>,
): void {
  const publicBody = getPublicMdxBody(result.mdx);
  const introAndConclusion = getIntroAndConclusionText(result.mdx);
  const publicCopy = `${publicBody}\n${result.frontmatter.description}`;

  expect(publicBody).not.toMatch(/\b(?:draft|concept)\b/iu);
  expect(introAndConclusion).not.toMatch(/\b(?:onrustig|misschien)\b/iu);
  expect(publicCopy).not.toMatch(/\bhoek\b/iu);
  expect(publicCopy).not.toMatch(/\b(?:dat|dit) gevoel\b/iu);
  expect(publicCopy).not.toMatch(
    /\b(?:op je radar zetten|op je radar moet|rustig volgen|rustig te volgen)\b/iu,
  );
  expect(publicCopy).not.toMatch(
    /\b(?:voor gaat zitten|je gaat hier voor zitten|trekt de aandacht|schijnwerpers|spontaan even|meteen energie|moet je zien|mis dit niet|niet missen)\b/iu,
  );
  expect(
    publicCopy.match(/\bdit is vooral\b/giu)?.length ?? 0,
  ).toBeLessThanOrEqual(1);
  expectNoEnglishSentencesInFinalMdx(result.mdx);
  expectConcisePublicDescription(result.frontmatter.description);
  expectSourceLineLast(result.mdx);
}

describe('editorial agent draft generation', () => {
  it('maps release roundups and unknown articles to discovery tone', () => {
    expect(getEditorialToneForArticleType('release_roundup')).toBe('discovery');
    expect(getEditorialToneForArticleType('unknown')).toBe('discovery');
  });

  it('keeps single-set news, deals and rewards on decision tone', () => {
    expect(getEditorialToneForArticleType('single_set_news')).toBe('decision');
    expect(getEditorialToneForArticleType('gwp_reward')).toBe('decision');
    expect(getEditorialToneForArticleType('deal')).toBe('decision');
  });

  it('treats dated single-set announcements as discovery-toned announcements', () => {
    const input = createInput({
      matching: createMatching({
        articleType: 'single_set_news',
      }),
      facts: createFacts({
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
      source: createSource({
        title: 'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
      }),
    });

    expect(getSingleSetDraftTone(input)).toBe('announcement');
    expect(getEditorialToneForDraftInput(input)).toBe('discovery');
  });

  it('keeps gwp rewards and deals on the decision path', () => {
    expect(
      getSingleSetDraftTone(
        createInput({
          matching: createMatching({
            articleType: 'gwp_reward',
          }),
          source: createSource({
            title:
              'LEGO 40787 Mario Kart Spiny Shell opnieuw verkrijgbaar als Insiders reward',
          }),
        }),
      ),
    ).toBe('decision');

    expect(
      getEditorialToneForDraftInput(
        createInput({
          matching: createMatching({
            articleType: 'deal',
          }),
          source: createSource({
            title: 'LEGO 10316 Rivendell nu met flinke korting',
          }),
        }),
      ),
    ).toBe('decision');
  });

  it('returns theme tone copy only for high-impact fan themes', () => {
    expect(
      getThemeToneCopy('Star Wars AT-AT Driver Helmet', 'announcement_intro'),
    ).toContain('Helmet Collection');
    expect(getThemeToneCopy('Star Wars', 'announcement_intro')).toContain(
      'Star Wars-vormen',
    );
    expect(getThemeToneCopy('Harry Potter', 'announcement_intro')).toContain(
      'Hogwarts',
    );
    expect(
      getThemeToneCopy('Lord of the Rings™', 'announcement_intro'),
    ).toContain('Middle-earth');
    expect(getThemeToneCopy('Super Mario', 'announcement_intro')).toBeNull();
  });

  it('always generates draft frontmatter and keeps the source url', () => {
    const result = generateEditorialMdxDraft(createInput());

    expect(result.frontmatter.authorName).toBe('Kasper van Merrienboer');
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.sourceUrl).toBe(
      'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
    );
  });

  it('formats single-set Star Wars titles around the set name without catalog context', () => {
    const primarySet = createPrimarySet({
      name: 'Imperial Remnant AT-RT Driver Helmet',
      setNumber: '75458',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          setNumbers: ['75458'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          setNames: ['Imperial Remnant AT-RT Driver Helmet'],
          setNumbers: ['75458'],
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet onthuld',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        source: createSource({
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet onthuld',
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(
      'Imperial Remnant AT-RT Driver Helmet aangekondigd',
    );
    expect(result.frontmatter.title.startsWith('LEGO Star Wars')).toBe(false);
    expect(result.frontmatter.title).not.toContain('75458');
    expect(result.mdx).toContain(
      'title: "Imperial Remnant AT-RT Driver Helmet aangekondigd"',
    );
  });

  it('formats deal titles without repeating LEGO, theme or set number', () => {
    const primarySet = createPrimarySet({
      name: 'Star Trek: U.S.S. Enterprise NCC-1701-D',
      setNumber: '10356',
      theme: 'LEGO® Icons',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          setNumbers: ['10356'],
          themes: ['LEGO® Icons'],
        }),
        facts: createFacts({
          setNames: ['Star Trek: U.S.S. Enterprise NCC-1701-D'],
          setNumbers: ['10356'],
          theme: 'LEGO® Icons',
          title:
            'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
        }),
        matching: createMatching({
          articleType: 'deal',
          matchedSets: [primarySet],
        }),
        primarySet,
        source: createSource({
          title:
            'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(
      'Star Trek U.S.S. Enterprise met korting',
    );
    expect(result.frontmatter.title).not.toContain('LEGO');
    expect(result.frontmatter.title).not.toContain('Icons');
    expect(result.frontmatter.title).not.toContain('10356');
  });

  it('varies reveal title verbs deterministically across single-set articles', () => {
    const helmetSet = createPrimarySet({
      name: 'Imperial Remnant AT-RT Driver Helmet',
      setNumber: '75458',
      theme: 'Star Wars',
    });
    const vaderSet = createPrimarySet({
      name: 'Up-Scaled Darth Vader Minifigure',
      setNumber: '75461',
      theme: 'Star Wars',
    });
    const shuttleSet = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75460',
      theme: 'Star Wars',
    });
    const buildRevealDraftTitle = (
      primarySet: EditorialAgentPrimarySetSelection,
    ) =>
      generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            setNumbers: [primarySet.setNumber],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            setNames: [primarySet.name],
            setNumbers: [primarySet.setNumber],
            theme: 'Star Wars',
            title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} revealed`,
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [primarySet],
          }),
          primarySet,
          source: createSource({
            canonicalUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            finalUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            inputUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} revealed`,
          }),
        }),
      ).frontmatter.title;

    const titles = [
      buildRevealDraftTitle(helmetSet),
      buildRevealDraftTitle(vaderSet),
      buildRevealDraftTitle(shuttleSet),
    ];

    expect(
      new Set(titles.map((title) => title.split(' ').at(-1))).size,
    ).toBeGreaterThan(1);
    expect(titles.every((title) => !title.endsWith('onthuld'))).toBe(true);
    expect(titles.every((title) => !/^LEGO Star Wars/u.test(title))).toBe(true);
    expect(titles.every((title) => !/\b754\d{2}\b/u.test(title))).toBe(true);
  });

  it('varies single-set intro and conclusion patterns without changing facts', () => {
    const sets = [
      createPrimarySet({
        name: 'Imperial Remnant AT-RT Driver Helmet',
        setNumber: '75458',
        theme: 'Star Wars',
      }),
      createPrimarySet({
        name: 'Up-Scaled Darth Vader Minifigure',
        setNumber: '75461',
        theme: 'Star Wars',
      }),
      createPrimarySet({
        name: 'Imperial Lambda-Class Shuttle',
        setNumber: '75460',
        theme: 'Star Wars',
      }),
    ];
    const drafts = sets.map((primarySet) =>
      generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            keywords: ['Star Wars', 'Helmet Collection'],
            setNumbers: [primarySet.setNumber],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            releaseDate: '1 juni 2026',
            setNames: [primarySet.name],
            setNumbers: [primarySet.setNumber],
            summary: `${primarySet.name} is onthuld als nieuwe Star Wars displayset.`,
            theme: 'Star Wars',
            title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} revealed`,
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [primarySet],
          }),
          primarySet,
          source: createSource({
            canonicalUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            finalUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            inputUrl: `https://brickset.com/article/${primarySet.setNumber}`,
            title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} revealed`,
          }),
        }),
      ),
    );
    const introPatterns = drafts.map((draft) =>
      draft.mdx.includes('Gewoon een release om even te onthouden')
        ? 'onthouden'
        : draft.mdx.includes('Wachten op betere beelden')
          ? 'beelden'
          : draft.mdx.includes('De echte keuze')
            ? 'keuze'
            : draft.mdx.includes('precies op')
              ? 'precies-op'
              : draft.mdx.includes('in het vizier')
                ? 'vizier'
                : 'prijs-beelden',
    );
    const conclusionSections = drafts.map((draft) =>
      draft.mdx.slice(
        draft.mdx.indexOf('## Korte conclusie'),
        draft.mdx.indexOf('Bronnen:'),
      ),
    );
    const conclusionPatterns = conclusionSections.map((conclusion) =>
      conclusion.includes('hoeft nog geen directe keuze')
        ? 'directe-keuze'
        : conclusion.includes('Geen set om vandaag')
          ? 'niet-jagen'
          : conclusion.includes('Wachten op betere beelden')
            ? 'betere-beelden'
            : conclusion.includes('al op je lijst')
              ? 'lijst'
              : conclusion.includes('snelle ja of een rustige wacht')
                ? 'snelle-ja'
                : 'timing-prijs',
    );
    expect(new Set(introPatterns).size).toBeGreaterThan(1);
    expect(new Set(conclusionPatterns).size).toBeGreaterThan(1);
    drafts.forEach((draft, index) => {
      expect(draft.mdx).toContain(
        `<FeaturedSet setNumber="${sets[index].setNumber}" />`,
      );
      expect(draft.mdx).toContain(sets[index].name);
      expect(draft.mdx).toContain('Star Wars');
      expect(draft.mdx).not.toContain(
        'Dit is geen artikel waarbij je meteen hoeft te beslissen',
      );
      expect(draft.mdx).not.toContain('Zie het vooral');
    });
  });

  it('writes concise varied descriptions with concrete hooks', () => {
    const cases = [
      createPrimarySet({
        name: 'Imperial Remnant AT-RT Driver Helmet',
        setNumber: '75458',
        theme: 'Star Wars',
      }),
      createPrimarySet({
        name: 'Up-Scaled Darth Vader Minifigure',
        setNumber: '75461',
        theme: 'Star Wars',
      }),
      createPrimarySet({
        name: 'Imperial Lambda-Class Shuttle',
        setNumber: '75460',
        theme: 'Star Wars',
      }),
    ].map(
      (primarySet) =>
        generateEditorialMdxDraft(
          createInput({
            detected: createDetected({
              setNumbers: [primarySet.setNumber],
              themes: ['Star Wars'],
            }),
            facts: createFacts({
              releaseDate: '1 juni 2026',
              setNames: [primarySet.name],
              setNumbers: [primarySet.setNumber],
              summary: `${primarySet.name} is aangekondigd als nieuwe Star Wars-set.`,
              theme: 'Star Wars',
              title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} aangekondigd`,
            }),
            matching: createMatching({
              articleType: 'single_set_news',
              matchedSets: [primarySet],
            }),
            primarySet,
            source: createSource({
              title: `LEGO Star Wars ${primarySet.setNumber} ${primarySet.name} aangekondigd`,
            }),
          }),
        ).frontmatter.description,
    );

    cases.forEach((description) => {
      expectConcisePublicDescription(description);
      expect(description).toContain('1 juni 2026');
      expect(description).not.toContain('Voor Star Wars-fans is dit vooral');
    });
    expect(new Set(cases).size).toBe(cases.length);
    expect(cases.join(' ')).toContain('Helmet Collection');
    expect(cases.join(' ')).toContain('displayfiguur');
    expect(cases.join(' ')).toContain('display');
    expect(cases.join(' ')).toContain('silhouet');
  });

  it('uses availability and rumor wording when those signals are present', () => {
    const shuttleSet = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75460',
      theme: 'Star Wars',
    });
    const preorderTitle = generateEditorialMdxDraft(
      createInput({
        facts: createFacts({
          setNames: [shuttleSet.name],
          setNumbers: [shuttleSet.setNumber],
          theme: 'Star Wars',
          title: 'LEGO Star Wars Imperial Lambda-Class Shuttle pre-order open',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [shuttleSet],
        }),
        primarySet: shuttleSet,
        source: createSource({
          title: 'LEGO Star Wars Imperial Lambda-Class Shuttle pre-order open',
        }),
      }),
    ).frontmatter.title;
    const rumorTitle = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          rumorSignals: ['rumor'],
          setNumbers: [shuttleSet.setNumber],
        }),
        facts: createFacts({
          isRumor: true,
          setNames: [shuttleSet.name],
          setNumbers: [shuttleSet.setNumber],
          theme: 'Star Wars',
          title: 'LEGO Star Wars Imperial Lambda-Class Shuttle rumor',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [shuttleSet],
        }),
        primarySet: shuttleSet,
        source: createSource({
          title: 'LEGO Star Wars Imperial Lambda-Class Shuttle rumor',
        }),
      }),
    ).frontmatter.title;

    expect(preorderTitle).toBe(
      'Imperial Lambda-Class Shuttle nu te pre-orderen',
    );
    expect(rumorTitle).toMatch(
      /^Imperial Lambda-Class Shuttle (?:gelekt|mogelijk onthuld|eerste info opgedoken)$/u,
    );
  });

  it('formats vague release dates as natural Dutch timing', () => {
    const yearOnlySet = createPrimarySet({
      name: 'Tintin Moon Rocket',
      setNumber: '21360',
      theme: 'Ideas',
    });
    const yearOnlyResult = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['2026'],
          setNumbers: [yearOnlySet.setNumber],
          themes: ['Ideas'],
        }),
        facts: createFacts({
          releaseDate: '2026',
          setNames: [yearOnlySet.name],
          setNumbers: [yearOnlySet.setNumber],
          summary: 'Tintin Moon Rocket verschijnt in 2026.',
          theme: 'Ideas',
          title: 'LEGO Ideas 21360 Tintin Moon Rocket verschijnt in 2026',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [yearOnlySet],
        }),
        primarySet: yearOnlySet,
        source: createSource({
          title: 'LEGO Ideas 21360 Tintin Moon Rocket verschijnt in 2026',
        }),
      }),
    );
    const monthResult = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['juni 2026'],
          setNumbers: [yearOnlySet.setNumber],
          themes: ['Ideas'],
        }),
        facts: createFacts({
          releaseDate: '',
          setNames: [yearOnlySet.name],
          setNumbers: [yearOnlySet.setNumber],
          summary: 'Tintin Moon Rocket verschijnt in juni 2026.',
          theme: 'Ideas',
          title: 'LEGO Ideas 21360 Tintin Moon Rocket verschijnt in juni 2026',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [yearOnlySet],
        }),
        primarySet: yearOnlySet,
        source: createSource({
          title: 'LEGO Ideas 21360 Tintin Moon Rocket verschijnt in juni 2026',
        }),
      }),
    );

    expect(yearOnlyResult.mdx).not.toContain('op 2026');
    expect(yearOnlyResult.frontmatter.description).not.toContain('op 2026');
    expect(yearOnlyResult.mdx).toContain('later in 2026');
    expect(yearOnlyResult.frontmatter.description).toContain('later in 2026');
    expect(monthResult.mdx).not.toContain('op juni 2026');
    expect(monthResult.frontmatter.description).toContain('in juni 2026');
  });

  it('keeps existing multi-set titles unchanged', () => {
    const title = 'Nieuwe LEGO Star Wars-sets juni 2026';
    const result = generateEditorialMdxDraft(
      createInput({
        facts: createFacts({
          title,
          theme: 'Star Wars',
        }),
        matching: createMatching({
          articleType: 'multi_set_announcement',
        }),
        primarySet: null,
        source: createSource({
          title,
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(title);
  });

  it('uses the source published date as article date when available', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 augustus 2026'],
        }),
        source: createSource({
          publishedAt: '2026-05-01T07:30:00.000Z',
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 augustus 2026',
        }),
      }),
    );

    expect(result.frontmatter.date).toBe('2026-05-01');
  });

  it('uses a clear title/body date when no source published date is available', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 augustus 2026'],
        }),
        source: createSource({
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 augustus 2026',
        }),
      }),
    );

    expect(result.frontmatter.date).toBe('2026-08-01');
  });

  it('falls back to today and warns when no article date can be resolved', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T08:00:00.000Z'));

    try {
      const result = generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            dateSignals: [],
          }),
          facts: createFacts({
            releaseDate: '',
          }),
          source: createSource({
            publishedAt: undefined,
            title: 'LEGO nieuws zonder datum',
          }),
        }),
      );

      expect(result.frontmatter.date).toBe('2026-05-03');
      expect(result.warnings).toContain(
        'Geen bronpublicatiedatum of duidelijke artikeldatum gevonden; frontmatter.date is teruggevallen op vandaag.',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses FeaturedSet for single-set style drafts with a primary set', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
      }),
    );

    expect(result.mdx).toContain('<FeaturedSet setNumber="40787" />');
    expectFeaturedSetAtTop(result.mdx);
    expectSetRailAfterMainContent(result.mdx);
  });

  it('matches the gold-standard calm single-set announcement structure', () => {
    const shuttle = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75459',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 juli 2026'],
          keywords: ['Star Wars', 'Imperial', 'Shuttle', 'pre-order'],
          prices: ['€149,99'],
          setNumbers: ['75459'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          priceEUR: '€149,99',
          releaseDate: '1 juli 2026',
          setNames: ['Imperial Lambda-Class Shuttle'],
          setNumbers: ['75459'],
          summary:
            'LEGO Star Wars 75459 Imperial Lambda-Class Shuttle verschijnt op 1 juli 2026 voor €149,99 en is nu te pre-orderen.',
          theme: 'Star Wars',
          title: 'Imperial Lambda-Class Shuttle nu te pre-orderen',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [shuttle],
        }),
        primarySet: shuttle,
        relatedCandidates: [
          createRelatedCandidate('75406', {
            name: 'Kylo Ren Command Shuttle',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75447', {
            name: 'TIE Fighter',
            theme: 'Star Wars',
          }),
        ],
        source: createSource({
          title:
            'LEGO Star Wars 75459 Imperial Lambda-Class Shuttle officieel onthuld',
          description:
            'De set verschijnt op 1 juli 2026 voor €149,99 en is nu te pre-orderen.',
        }),
      }),
    );
    const publicBody = getPublicMdxBody(result.mdx);

    expect(result.frontmatter.title).toBe(
      'Imperial Lambda-Class Shuttle nu te pre-orderen',
    );
    expect(result.frontmatter.description).toBe(
      'Imperial Lambda-Class Shuttle verschijnt op 1 juli 2026 en draait om dat herkenbare Star Wars-silhouet waar je je display op bouwt.',
    );
    expect(publicBody).toContain(
      'Imperial Lambda-Class Shuttle komt op 1 juli 2026 als LEGO-set.',
    );
    expect(publicBody).toContain(
      'Het draait hier om één ding: dat herkenbare silhouet.',
    );
    expect(publicBody).toContain('<FeaturedSet setNumber="75459" />');
    expect(publicBody).toContain('## Wat is er aangekondigd?');
    expect(publicBody).toContain(
      'LEGO Star Wars 75459 Imperial Lambda-Class Shuttle verschijnt op 1 juli 2026 voor €149,99 en is nu te pre-orderen.',
    );
    expect(publicBody).toContain('## Wanneer verschijnt hij?');
    expect(publicBody).toContain(
      'Volgens de huidige info verschijnt de set op 1 juli 2026.',
    );
    expect(publicBody).toContain('## Voor wie is dit leuk?');
    expect(publicBody).toContain(
      'Voor Star Wars-fans die iets hebben met Imperial ships, sterke vormen en duidelijke displaymodellen.',
    );
    expectSetRailAfterMainContent(result.mdx);
    expectSourceLineLast(result.mdx);
    expectEditorialQualityGuards(result);
    expect(publicBody).not.toMatch(/\b(?:hoek|onrustig|misschien)\b/iu);
  });

  it('keeps single-set public copy free of internal draft wording', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        facts: createFacts({
          summary:
            'Dit draft helpt je snel kiezen of je nu moet opletten of rustig kunt wachten.',
        }),
        source: createSource({
          description:
            'Dit artikel helpt je bepalen of deze set op je radar moet.',
          title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        }),
      }),
    );
    const publicBody = result.mdx.split('---\n\n').at(1) ?? result.mdx;
    const forbiddenPublicWording =
      /\b(?:draft|concept|artikel helpt|deze draft)\b/iu;

    expect(result.frontmatter.description).not.toMatch(forbiddenPublicWording);
    expect(publicBody).not.toMatch(forbiddenPublicWording);
    expect(result.frontmatter.description).toContain(
      'Je ziet snel of je moet opletten of kunt afwachten.',
    );
    expect(publicBody).toContain(
      'Stond hij al op je lijst, dan wil je nu weten',
    );
  });

  it('rewrites fallback body copy to reader-facing language', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'unknown',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [],
      }),
    );
    const publicBody = result.mdx.split('---\n\n').at(1) ?? result.mdx;

    expect(result.frontmatter.description).not.toMatch(
      /\b(?:draft|concept|artikel helpt|deze draft)\b/iu,
    );
    expect(publicBody).not.toMatch(
      /\b(?:draft|concept|artikel helpt|deze draft)\b/iu,
    );
    expect(publicBody).toContain(
      'Handig om te bepalen of deze set het onthouden waard is.',
    );
  });

  it('keeps natural specific wording while reducing repetitive generic phrases', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        facts: createFacts({
          summary:
            'Dat herkenbare Imperial gevoel zit hier in de helm, de kleur en de details.',
        }),
        source: createSource({
          description:
            'Dit is vooral een set met gevoel. Dit is vooral leuk voor fans. Dit is vooral handig om even te checken.',
          title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        }),
      }),
    );
    const publicCopy = `${getPublicMdxBody(result.mdx)}\n${result.frontmatter.description}`;

    expect(publicCopy).toContain('Dat herkenbare Imperial gevoel');
    expect(publicCopy).not.toContain('Dit is vooral een set met gevoel');
    expect(
      publicCopy.match(/\bdit is vooral\b/giu)?.length ?? 0,
    ).toBeLessThanOrEqual(1);
  });

  it('replaces banned hoek wording and vague feeling while keeping specific feeling', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        facts: createFacts({
          summary:
            'Dat herkenbare Imperial gevoel blijft overeind. Dit gevoel past niet in de collectie-hoek. Als dit normaal jouw Star Wars-hoek is, kijk dan naar de kleur en details.',
        }),
        source: createSource({
          description: 'Dit is extra context.',
          title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        }),
      }),
    );
    const publicCopy = `${getPublicMdxBody(result.mdx)}\n${result.frontmatter.description}`;

    expect(publicCopy).toContain('Dat herkenbare Imperial gevoel');
    expect(publicCopy).toContain(
      'als Star Wars bij jou standaard tussen je sets staat',
    );
    expect(publicCopy).toContain('in je collectie');
    expect(publicCopy).not.toMatch(/\bhoek\b/iu);
    expect(publicCopy).not.toContain('Dit gevoel');
  });

  it('removes hype phrasing from final public copy', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        facts: createFacts({
          summary:
            'Dit is zo’n update waar je even voor gaat zitten. Deze set trekt de aandacht en moet je zien.',
        }),
        source: createSource({
          description:
            'Je gaat hier voor zitten, want deze aankondiging staat in de schijnwerpers.',
          title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        }),
      }),
    );
    const publicCopy = `${getPublicMdxBody(result.mdx)}\n${result.frontmatter.description}`;

    expect(publicCopy).not.toMatch(
      /\b(?:voor gaat zitten|je gaat hier voor zitten|trekt de aandacht|schijnwerpers|moet je zien)\b/iu,
    );
    expect(publicCopy).toContain('kort te bekijken');
  });

  it('prefers the catalog set name as draft display name when a primary set exists', () => {
    expect(
      getSetDisplayNameForDraft(
        createPrimarySet({
          name: 'SEGA Genesis (Mega Drive)',
          setNumber: '40926',
        }),
        createFacts({
          setNames: [
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
          ],
        }),
        createSource({
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
      ),
    ).toBe('SEGA Genesis (Mega Drive)');
  });

  it('localizes English Brickset article titles to natural Dutch', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          keywords: ['Botanicals'],
          setNumbers: [],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          keywords: ['Botanicals'],
          setNames: [],
          setNumbers: [],
          summary: 'Three beautiful botanical sets revealed!',
          theme: 'Botanicals',
          title: 'Three beautiful botanical sets revealed!',
        }),
        source: createSource({
          description: 'Three beautiful botanical sets revealed!',
          domain: 'brickset.com',
          language: 'en',
          siteName: 'Brickset',
          title: 'Three beautiful botanical sets revealed!',
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(
      'Drie nieuwe Botanicals-sets onthuld',
    );
    expect(result.frontmatter.title).not.toContain('revealed');
    expect(result.frontmatter.title).not.toContain('!');
    expect(result.mdx).toContain(
      'title: "Drie nieuwe Botanicals-sets onthuld"',
    );
  });

  it('localizes common English article title patterns without literal translation', () => {
    const summerResult = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        facts: createFacts({
          setNames: [],
          setNumbers: [],
          summary: 'Summer LEGO Harry Potter sets revealed',
          theme: 'Harry Potter',
          title: 'Summer LEGO Harry Potter sets revealed',
        }),
        source: createSource({
          domain: 'brickset.com',
          language: 'en',
          title: 'Summer LEGO Harry Potter sets revealed',
        }),
      }),
    );
    const quickLookResult = generateEditorialMdxDraft(
      createInput({
        facts: createFacts({
          title: 'Quick Look: 43022 Lewis Hamilton Helmet',
        }),
        source: createSource({
          domain: 'brickset.com',
          language: 'en',
          title: 'Quick Look: 43022 Lewis Hamilton Helmet',
        }),
      }),
    );

    expect(summerResult.frontmatter.title).toBe(
      'Nieuwe LEGO Harry Potter-sets voor de zomer onthuld',
    );
    expect(quickLookResult.frontmatter.title).toBe(
      'Korte blik: 43022 Lewis Hamilton Helmet',
    );
  });

  it('localizes expanded English feed title patterns to Dutch', () => {
    const createEnglishTitleDraft = (title: string) =>
      generateEditorialMdxDraft(
        createInput({
          matching: createMatching({
            articleType: 'multi_set_announcement',
            matchedSets: [],
            unmatchedSetNumbers: [],
          }),
          primarySet: null,
          facts: createFacts({
            setNames: [],
            setNumbers: [],
            summary: title,
            theme: 'LEGO',
            title,
          }),
          source: createSource({
            domain: 'brickset.com',
            language: 'en',
            title,
          }),
        }),
      );

    expect(
      createEnglishTitleDraft('New decorative LEGO Creator sets unveiled')
        .frontmatter.title,
    ).toBe('Nieuwe decoratieve LEGO Creator-sets onthuld');
    expect(
      createEnglishTitleDraft('Summer LEGO City sets unveiled').frontmatter
        .title,
    ).toBe('Nieuwe LEGO City-sets voor de zomer onthuld');
    expect(
      createEnglishTitleDraft('Summer LEGO Minecraft sets revealed').frontmatter
        .title,
    ).toBe('Nieuwe LEGO Minecraft-sets voor de zomer onthuld');
    expect(
      createEnglishTitleDraft('Six magical LEGO Disney sets revealed!')
        .frontmatter.title,
    ).toBe('Zes nieuwe LEGO Disney-sets onthuld');
  });

  it('keeps Dutch BrickTastic titles unchanged', () => {
    const title =
      'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten';
    const result = generateEditorialMdxDraft(
      createInput({
        facts: createFacts({
          title,
        }),
        source: createSource({
          domain: 'www.bricktastic.nl',
          language: 'nl',
          title,
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(title);
  });

  it('cleans extracted set names and headline fallbacks before using them in a draft', () => {
    expect(
      getSetDisplayNameForDraft(
        null,
        createFacts({
          setNames: [
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
          ],
        }),
        createSource({
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
      ),
    ).toBe('SEGA Genesis (Mega Drive)');

    expect(
      getSetDisplayNameForDraft(
        null,
        createFacts({
          setNames: [''],
        }),
        createSource({
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) opnieuw verkrijgbaar als Insiders reward',
        }),
      ),
    ).toBe('SEGA Genesis (Mega Drive)');
  });

  it('keeps dated single-set announcements on the single-set template', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 juni 2026'],
          prices: ['€39,99'],
          rumorSignals: ['waarschijnlijk'],
          setNumbers: ['40926', '40769'],
          themes: ['Sonic The Hedgehog'],
        }),
        facts: createFacts({
          priceEUR: '€39,99',
          releaseDate: '1 juni 2026',
          setNames: ['SEGA Genesis Console'],
          setNumbers: ['40926', '40769'],
          summary:
            'LEGO 40926 SEGA Genesis Console komt op 1 juni 2026 voor €39,99.',
          theme: 'Overig',
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('40926', {
              name: 'SEGA Genesis Console',
              theme: 'Sonic The Hedgehog',
            }),
            createMatchedSet('40769', {
              name: 'SEGA Genesis Controller',
              theme: 'Sonic The Hedgehog',
            }),
          ],
        }),
        primarySet: {
          ...createMatchedSet('40926', {
            name: 'SEGA Genesis Console',
            theme: 'Sonic The Hedgehog',
          }),
          reason: 'title_match',
        },
        relatedCandidates: [
          createRelatedCandidate('40769', {
            name: 'SEGA Genesis Controller',
            theme: 'Sonic The Hedgehog',
          }),
        ],
        source: createSource({
          description:
            'LEGO 40926 SEGA Genesis Console komt op 1 juni 2026 voor €39,99. Bekijk hier de eerste beelden van de aankomende set.',
          finalUrl:
            'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
          inputUrl:
            'https://www.bricktastic.nl/lego/lego-40926-sega-genesis-mega-drive-verschijnt-op-1-juni-2026/',
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Sonic The Hedgehog');
    expect(result.frontmatter.theme).not.toBe('Multiple');
    expect(result.frontmatter.description).not.toContain(
      'Overzicht van de LEGO-sets uit juni',
    );
    expect(result.mdx).toContain('<FeaturedSet setNumber="40926" />');
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).not.toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
    expect(result.mdx).not.toContain(
      'wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen',
    );
    expect(result.frontmatter.description).toContain(
      'SEGA Genesis Console verschijnt op 1 juni 2026',
    );
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).toContain(
      'SEGA Genesis Console komt op 1 juni 2026 als LEGO-set.',
    );
    expect(result.mdx).toContain('## Wat is er aangekondigd?');
    expect(result.mdx).toContain('## Wanneer verschijnt hij?');
    expect(result.mdx).toContain('## Voor wie is dit leuk?');
    expectFeaturedSetAtTop(result.mdx);
    expect(result.mdx).not.toContain('budget');
    expect(result.mdx).not.toContain('snel schakelen');
    expect(result.mdx).not.toContain('betere prijzen');
  });

  it('uses cleaned fallback names in single-set copy when extracted set names include release wording', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [],
          unmatchedSetNumbers: ['40926'],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          dateSignals: ['1 juni 2026'],
          setNumbers: ['40926'],
          themes: ['Sonic The Hedgehog'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: [
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
          ],
          setNumbers: ['40926'],
          theme: 'Sonic The Hedgehog',
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
        source: createSource({
          title:
            'LEGO 40926 SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
        }),
      }),
    );

    expect(result.frontmatter.description).toContain(
      'SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026',
    );
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).toContain(
      'SEGA Genesis (Mega Drive) komt op 1 juni 2026 als LEGO-set.',
    );
    expect(result.mdx).not.toContain(
      'SEGA Genesis (Mega Drive) verschijnt op 1 juni 2026 is',
    );
  });

  it('keeps Marvel single-set announcements out of the roundup template', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('76339', {
              name: 'The Fantastic Four H.E.R.B.I.E.',
              theme: 'Marvel',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('76339', {
            name: 'The Fantastic Four H.E.R.B.I.E.',
            theme: 'Marvel',
          }),
          reason: 'title_match',
        },
        relatedCandidates: [],
        detected: createDetected({
          dateSignals: ['augustus 2026'],
          keywords: ['LEGO Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
          setNumbers: ['76339', '76316'],
          themes: ['Marvel'],
        }),
        facts: createFacts({
          releaseDate: 'augustus 2026',
          setNames: ['The Fantastic Four H.E.R.B.I.E.'],
          setNumbers: ['76339', '76316'],
          summary:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
          theme: 'Multiple',
          title:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
        }),
        source: createSource({
          description:
            'Alles wat je moet weten over LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E.',
          finalUrl:
            'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-herbie-onthuld-alles-wat-je-moet-weten/',
          inputUrl:
            'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-herbie-onthuld-alles-wat-je-moet-weten/',
          title:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Marvel');
    expect(result.frontmatter.theme).not.toBe('Multiple');
    expect(result.frontmatter.description).not.toContain(
      'Overzicht van de LEGO-sets uit augustus',
    );
    expect(result.mdx).toContain('<FeaturedSet setNumber="76339" />');
    expectFeaturedSetAtTop(result.mdx);
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).not.toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
    expect(result.mdx).not.toContain(
      'wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen',
    );
  });

  it('uses single-set Marvel copy without faking FeaturedSet when the set is unmatched', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [],
          unmatchedSetNumbers: ['76339'],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          dateSignals: ['augustus 2026'],
          keywords: ['LEGO Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
          setNumbers: ['76339'],
          themes: [],
        }),
        facts: createFacts({
          releaseDate: 'augustus 2026',
          setNames: ['The Fantastic Four H.E.R.B.I.E.'],
          setNumbers: ['76339'],
          summary:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
          theme: 'Multiple',
          title:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
        }),
        source: createSource({
          description:
            'Alles wat je moet weten over LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E.',
          title:
            'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Marvel');
    expect(result.frontmatter.theme).not.toBe('Multiple');
    expect(result.mdx).not.toContain('<FeaturedSet');
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).toContain('## Wat is er aangekondigd?');
  });

  it('renders multi-set announcements with FeaturedSet and without roundup blocks', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [
            createMatchedSet('42241', {
              name: 'F1 Piastri Helmet',
              theme: 'Technic',
            }),
            createMatchedSet('42242', {
              name: 'F1 Norris Helmet',
              theme: 'Technic',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('42241', {
            name: 'F1 Piastri Helmet',
            theme: 'Technic',
          }),
          reason: 'first_detected',
        },
        relatedCandidates: [
          createRelatedCandidate('42242', {
            name: 'F1 Norris Helmet',
            theme: 'Technic',
          }),
        ],
        detected: createDetected({
          keywords: ['F1', 'Piastri', 'Norris'],
          setNumbers: ['42241', '42242'],
          themes: ['Technic'],
        }),
        facts: createFacts({
          setNames: ['F1 Piastri Helmet', 'F1 Norris Helmet'],
          setNumbers: ['42241', '42242'],
          summary: 'LEGO F1 helmen van Piastri en Norris zijn onthuld.',
          theme: 'Technic',
          title: 'LEGO F1 helmen van Piastri en Norris onthuld',
        }),
        source: createSource({
          title: 'LEGO F1 helmen van Piastri en Norris onthuld',
        }),
      }),
    );

    expect(result.mdx).toContain('<FeaturedSet setNumber="42241" />');
    expect(
      result.mdx.match(/LEGO F1 helmen van Piastri en Norris onthuld/gu),
    ).toHaveLength(1);
    expect(result.frontmatter.description).toContain(
      'Piastri en Norris-helmen',
    );
    expect(result.frontmatter.description).toContain('meer dan één set');
    expect(result.mdx).toContain('Piastri en Norris-helmen');
    expect(result.mdx).toContain('meerdere sets');
    expect(result.mdx).toContain('in de gaten te houden');
    expect(result.mdx).toContain('welke set eruit springt');
    expect(result.mdx).toContain('## Wat is er aangekondigd?');
    expectFeaturedSetAtTop(result.mdx);
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).not.toContain('releasegolf');
    expect(result.mdx).not.toContain('logische eerste keuze');
    expect(result.mdx).not.toContain('krampachtig');
    expect(result.mdx).not.toContain('moet je kopen');
    expect(result.mdx).not.toContain('budget');
    expect(result.mdx).not.toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
  });

  it('uses title subjects for no-primary F1 helmet announcements', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          keywords: ['F1', 'Piastri', 'Norris'],
          setNumbers: [],
          themes: ['Technic'],
        }),
        facts: createFacts({
          setNames: [],
          setNumbers: [],
          summary:
            'Eerste foto’s van LEGO F1-helmen Piastri en Norris zijn opgedoken.',
          theme: 'Technic',
          title:
            'Eerste foto’s LEGO F1-helmen Piastri en Norris verklappen mogelijk nieuwe sets',
        }),
        source: createSource({
          title:
            'Eerste foto’s LEGO F1-helmen Piastri en Norris verklappen mogelijk nieuwe sets',
        }),
      }),
    );

    expect(result.frontmatter.description).toContain(
      'Piastri en Norris-helmen',
    );
    expect(result.mdx).toContain('Piastri en Norris-helmen');
    expect(result.mdx).not.toContain('<FeaturedSet');
    expect(result.mdx).not.toContain('meerdere nieuwe LEGO-sets');
    expect(result.mdx).not.toContain('deze sets trekt');
    expect(result.mdx).not.toContain('deze sets laat');
  });

  it('acknowledges both named sets when a multi-set announcement has a FeaturedSet', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [
            createMatchedSet('80120', {
              name: 'Prosperity Carp Leaping',
              theme: 'Seasonal',
            }),
            createMatchedSet('80121', {
              name: 'Ancient Moon-Gazing Inn',
              theme: 'Seasonal',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('80120', {
            name: 'Prosperity Carp Leaping',
            theme: 'Seasonal',
          }),
          reason: 'title_match',
        },
        relatedCandidates: [
          createRelatedCandidate('80121', {
            name: 'Ancient Moon-Gazing Inn',
            theme: 'Seasonal',
          }),
        ],
        facts: createFacts({
          setNames: ['Prosperity Carp Leaping', 'Ancient Moon-Gazing Inn'],
          setNumbers: ['80120', '80121'],
          summary:
            'Prosperity Carp Leaping en Ancient Moon-Gazing Inn zijn onthuld.',
          theme: 'Seasonal',
          title:
            'LEGO 80120 Prosperity Carp Leaping en 80121 Ancient Moon-Gazing Inn onthuld',
        }),
        source: createSource({
          title:
            'LEGO 80120 Prosperity Carp Leaping en 80121 Ancient Moon-Gazing Inn onthuld',
        }),
      }),
    );

    expect(result.mdx).toContain('<FeaturedSet setNumber="80120" />');
    expectFeaturedSetAtTop(result.mdx);
    expect(result.frontmatter.description).toContain('Prosperity Carp Leaping');
    expect(result.frontmatter.description).toContain('Ancient Moon-Gazing Inn');
    expect(result.frontmatter.description).toContain('meer dan één set');
    expect(result.mdx).toContain('Prosperity Carp Leaping');
    expect(result.mdx).toContain('Ancient Moon-Gazing Inn');
  });

  it('acknowledges all title sets in Star Wars multi-set announcements', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [
            createMatchedSet('75461', {
              name: 'Up-Scaled Darth Vader',
              theme: 'Star Wars',
            }),
            createMatchedSet('75462', {
              name: 'AT-RT Driver',
              theme: 'Star Wars',
            }),
            createMatchedSet('75463', {
              name: 'Lambda-Class Shuttle',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75461', {
            name: 'Up-Scaled Darth Vader',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        relatedCandidates: [
          createRelatedCandidate('75462', {
            name: 'AT-RT Driver',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75463', {
            name: 'Lambda-Class Shuttle',
            theme: 'Star Wars',
          }),
        ],
        facts: createFacts({
          setNames: [
            'Up-Scaled Darth Vader',
            'AT-RT Driver',
            'Lambda-Class Shuttle',
          ],
          setNumbers: ['75461', '75462', '75463'],
          summary:
            'Up-Scaled Darth Vader, AT-RT Driver en Lambda-Class Shuttle zijn onthuld.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars juni: Up-Scaled Darth Vader, AT-RT Driver en Lambda-Class Shuttle onthuld',
        }),
        source: createSource({
          title:
            'LEGO Star Wars juni: Up-Scaled Darth Vader, AT-RT Driver en Lambda-Class Shuttle onthuld',
        }),
      }),
    );

    expect(result.mdx).toContain('<FeaturedSet setNumber="75461" />');
    expect(result.frontmatter.description).toContain('Up-Scaled Darth Vader');
    expect(result.frontmatter.description).toContain('AT-RT Driver');
    expect(result.frontmatter.description).toContain('Lambda-Class Shuttle');
    expect(result.frontmatter.description).toContain('meer dan één set');
  });

  it('turns Brickset 131538 into a concrete Star Wars draft instead of fallback copy', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Wars'],
          setNumbers: ['75461', '75458'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          keywords: ['Star Wars'],
          setNames: [],
          setNumbers: ['75461', '75458'],
          summary:
            '75461 Up-Scaled Darth Vader Minifigure en 75458 Imperial Remnant AT-RT Driver Helmet zijn onthuld.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!',
        }),
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [
            createMatchedSet('75461', {
              name: 'Up-Scaled Darth Vader Minifigure',
              theme: 'Star Wars',
            }),
            createMatchedSet('75458', {
              name: 'Imperial Remnant AT-RT Driver Helmet',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75461', {
            name: 'Up-Scaled Darth Vader Minifigure',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        relatedCandidates: [
          createRelatedCandidate('75458', {
            name: 'Imperial Remnant AT-RT Driver Helmet',
            theme: 'Star Wars',
          }),
        ],
        source: createSource({
          description:
            'A new up-scaled LEGO minifigure format debuted in 2021 and has since been applied to various characters, now including Darth Vader.',
          domain: 'brickset.com',
          finalUrl: 'https://brickset.com/article/131538',
          inputUrl: 'https://brickset.com/article/131538',
          language: 'en',
          siteName: 'Brickset.com',
          title:
            'LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!',
        }),
      }),
    );

    expect(result.mdx).not.toContain('Conceptdraft');
    expect(result.mdx).not.toContain('Gebruik deze draft');
    expect(result.mdx).toContain('<FeaturedSet setNumber="75461" />');
    expect(result.frontmatter.theme).toBe('Star Wars');
    expect(result.frontmatter.description).toContain(
      'Up-Scaled Darth Vader Minifigure',
    );
    expect(result.frontmatter.description).toContain(
      'Imperial Remnant AT-RT Driver Helmet',
    );
    expect(result.mdx).toContain('Imperial, Rebel of trooper');
  });

  it('adds Star Wars fan tone to single-set announcements without generic object wording', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('75429', {
              name: 'AT-AT Driver Helmet',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75429', {
            name: 'AT-AT Driver Helmet',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Star Wars', 'Helmet Collection', 'trooper'],
          setNumbers: ['75429'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['AT-AT Driver Helmet'],
          setNumbers: ['75429'],
          summary:
            'De AT-AT Driver Helmet is onthuld als nieuwe Star Wars displayset.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75429 AT-AT Driver Helmet onthuld voor juni 2026',
        }),
        source: createSource({
          title:
            'LEGO Star Wars 75429 AT-AT Driver Helmet onthuld voor juni 2026',
        }),
      }),
    );

    expect(result.frontmatter.description).not.toContain(
      'object of deze wereld',
    );
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).not.toContain('object of deze wereld');
    expect(result.frontmatter.description).toContain('Star Wars-fans');
    expect(result.frontmatter.description).toContain('Helmet Collection');
    expect(result.mdx).toContain('Helmet Collection');
    expect(result.mdx).toContain('Imperial/Rebel details');
    expect(result.mdx).toContain('als je de Helmet Collection spaart');
  });

  it('uses vehicle Star Wars tone for shuttles without Helmet Collection wording', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('75460', {
              name: 'Imperial Lambda-Class Shuttle',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75460', {
            name: 'Imperial Lambda-Class Shuttle',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Star Wars', 'Imperial', 'Shuttle'],
          setNumbers: ['75460'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Imperial Lambda-Class Shuttle'],
          setNumbers: ['75460'],
          summary:
            'Imperial Lambda-Class Shuttle is aangekondigd als nieuwe LEGO Star Wars-set voor fans van de Helmet Collection.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75460 Imperial Lambda-Class Shuttle aangekondigd',
        }),
        source: createSource({
          description:
            'De shuttle wordt soms naast de Helmet Collection genoemd, maar is geen helm.',
          title:
            'LEGO Star Wars 75460 Imperial Lambda-Class Shuttle aangekondigd',
        }),
      }),
    );

    expect(result.mdx).not.toContain('Helmet Collection');
    expect(result.frontmatter.description).not.toContain('Helmet Collection');
    expect(result.mdx).not.toContain('fans van de Helmet Collection');
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).toContain('voertuig');
    expect(result.mdx).toContain('silhouet');
    expect(result.mdx).toContain('vorm');
  });

  it('uses buildable figure Star Wars tone without Helmet Collection wording', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('75461', {
              name: 'Up-Scaled Darth Vader Minifigure',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75461', {
            name: 'Up-Scaled Darth Vader Minifigure',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Star Wars', 'Darth Vader', 'Minifigure'],
          setNumbers: ['75461'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Up-Scaled Darth Vader Minifigure'],
          setNumbers: ['75461'],
          summary:
            'Up-Scaled Darth Vader Minifigure is aangekondigd als nieuwe LEGO Star Wars-set.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75461 Up-Scaled Darth Vader Minifigure aangekondigd',
        }),
        source: createSource({
          title:
            'LEGO Star Wars 75461 Up-Scaled Darth Vader Minifigure aangekondigd',
        }),
      }),
    );

    expect(result.mdx).not.toContain('Helmet Collection');
    expect(result.frontmatter.description).not.toContain('Helmet Collection');
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).toContain('displayfiguur');
    expect(result.mdx).toContain('character shelf');
  });

  it('uses Botanicals vocabulary without scene or character language', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          keywords: ['Botanicals', 'plant', 'bloem'],
          setNumbers: [],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          keywords: ['Botanicals'],
          releaseDate: '',
          setNames: [],
          setNumbers: [],
          summary:
            'Deze Botanicals-set heeft een scène met een personage tussen de bloemen.',
          theme: 'Botanicals',
          title: 'Three beautiful botanical sets revealed!',
        }),
        source: createSource({
          description:
            'Deze Botanicals-release noemt een scène en een personage, maar het artikel moet over plant, bloem, vorm en kleur gaan.',
          domain: 'brickset.com',
          finalUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          inputUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          siteName: 'Brickset',
          title: 'Three beautiful botanical sets revealed!',
        }),
      }),
    );
    const publicBody = getPublicMdxBody(result.mdx);

    expect(publicBody).toContain('plant');
    expect(publicBody).toContain('bloem');
    expect(publicBody).toContain('vorm');
    expect(publicBody).toContain('kleur');
    expect(`${publicBody}\n${result.frontmatter.description}`).not.toMatch(
      /\b(?:sc[eè]ne|sc[eè]nes|personage|personages)\b/iu,
    );
  });

  it('adds Harry Potter fan tone to announcement copy', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('76450', {
              name: 'Hogwarts Castle Tower',
              theme: 'Harry Potter',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('76450', {
            name: 'Hogwarts Castle Tower',
            theme: 'Harry Potter',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Harry Potter', 'Hogwarts'],
          setNumbers: ['76450'],
          themes: ['Harry Potter'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Hogwarts Castle Tower'],
          setNumbers: ['76450'],
          summary:
            'Hogwarts Castle Tower is aangekondigd als nieuwe LEGO Harry Potter-set.',
          theme: 'Harry Potter',
          title: 'LEGO Harry Potter 76450 Hogwarts Castle Tower aangekondigd',
        }),
        source: createSource({
          title: 'LEGO Harry Potter 76450 Hogwarts Castle Tower aangekondigd',
        }),
      }),
    );

    expect(result.frontmatter.description).toContain('Hogwarts-uitstraling');
    expect(result.mdx).toContain('Hogwarts');
    expect(result.mdx).toContain('scènes');
    expect(result.mdx).toContain('diorama');
  });

  it('keeps non-target theme announcement copy unchanged', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        facts: createFacts({
          title: 'LEGO Super Mario 72050 verschijnt op 1 juni 2026',
        }),
        source: createSource({
          title: 'LEGO Super Mario 72050 verschijnt op 1 juni 2026',
        }),
      }),
    );

    expect(result.frontmatter.description).toBe(
      'Mario Kart – Spiny Shell verschijnt in mei 2026 en is vooral interessant als deze set al tussen je andere bouwwerken past.',
    );
    expectConcisePublicDescription(result.frontmatter.description);
    expect(result.mdx).toContain(
      'Het draait om vorm, detail en de plek die hij straks op de plank krijgt.',
    );
    expect(result.mdx).not.toContain('Helmet Collection');
    expect(result.mdx).not.toContain('Hogwarts');
    expect(result.mdx).not.toContain('Middle-earth');
  });

  it('does not use Other in frontmatter when Lewis Hamilton helmet metadata gives a better theme', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('42244', {
              name: 'Lewis Hamilton Helmet',
              theme: 'Other',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('42244', {
            name: 'Lewis Hamilton Helmet',
            theme: 'Other',
          }),
          reason: 'single_set',
        },
        detected: createDetected({
          keywords: ['F1', 'Lewis Hamilton', 'helmet'],
          setNumbers: ['42244'],
          themes: ['Other'],
        }),
        facts: createFacts({
          setNames: ['Lewis Hamilton Helmet'],
          setNumbers: ['42244'],
          summary: 'LEGO F1 Lewis Hamilton Helmet is onthuld.',
          theme: 'Other',
          title: 'LEGO Lewis Hamilton Helmet onthuld',
        }),
        source: createSource({
          description: 'Eerste beelden van de LEGO F1 Lewis Hamilton Helmet.',
          title: 'LEGO Lewis Hamilton Helmet onthuld',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Speed Champions');
    expect(result.frontmatter.theme).not.toBe('Other');
    expect(result.mdx).not.toContain('theme: "Other"');
  });

  it('keeps weak Brickset multi-set drafts compact, neutral and publish-safe', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [],
        detected: createDetected({
          keywords: ['Botanicals'],
          setNumbers: [],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          keywords: ['Botanicals'],
          setNames: [],
          setNumbers: [],
          summary: 'Three beautiful botanical sets revealed!',
          theme: 'Botanicals',
          title: 'Three beautiful botanical sets revealed!',
        }),
        source: createSource({
          description: 'Three beautiful botanical sets revealed!',
          domain: 'brickset.com',
          finalUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          inputUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          siteName: 'Brickset',
          title: 'Three beautiful botanical sets revealed!',
        }),
      }),
    );
    const publicBody = result.mdx.split('---\n\n').at(1) ?? result.mdx;

    expect(result.frontmatter.description.charAt(0)).toMatch(/[A-Z]/u);
    expect(result.frontmatter.description).toContain('Botanicals-fans');
    expect(publicBody).toContain(
      'Er zijn meerdere nieuwe LEGO-sets opgedoken.',
    );
    expect(publicBody).toContain('## Wat valt op?');
    expect(publicBody).toContain('## Waarom volgen?');
    expect(publicBody).toContain('## Korte conclusie');
    expect(publicBody).toContain('Via: Brickset');
    expect(publicBody).not.toContain('deze sets trekt');
    expect(publicBody).not.toContain('deze sets laat');
    expect(publicBody).not.toContain('deze aankondiging trekt');
    expect(publicBody).not.toContain('bron wijst');
    expect(publicBody).not.toContain('betrouwbare hoofdset');
    expect(publicBody).not.toContain('release-overzicht');
    expect(publicBody).not.toContain('draft');
    expect(publicBody).not.toContain('catalog');
    expect(publicBody).not.toContain(
      'Three beautiful botanical sets revealed!',
    );
    expect(publicBody.length).toBeLessThan(950);
    publicBody
      .split('\n\n')
      .filter((paragraph) => paragraph.trim().length > 0)
      .forEach((paragraph) => {
        const firstCharacter = paragraph.trim().charAt(0);

        expect(firstCharacter).not.toMatch(/[a-z]/u);
      });
  });

  it('removes English sentences from the public MDX body', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('75458', {
              name: 'Imperial Remnant AT-RT Driver Helmet',
              theme: 'Star Wars',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('75458', {
            name: 'Imperial Remnant AT-RT Driver Helmet',
            theme: 'Star Wars',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Star Wars', 'Helmet'],
          setNumbers: ['75458'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          setNames: ['Imperial Remnant AT-RT Driver Helmet'],
          setNumbers: ['75458'],
          summary:
            'This set has been revealed with official images. The model includes a display stand.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed',
        }),
        source: createSource({
          description:
            'This set has been revealed with official images. The model includes a display stand.',
          domain: 'brickset.com',
          finalUrl: 'https://brickset.com/article/131538',
          inputUrl: 'https://brickset.com/article/131538',
          language: 'en',
          siteName: 'Brickset',
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed',
        }),
      }),
    );
    const publicBody = getPublicMdxBody(result.mdx);

    expect(publicBody).not.toMatch(
      /\b(?:This set|The model|has been revealed|with official images|display stand)\b/iu,
    );
    expect(publicBody).toContain('Imperial Remnant AT-RT Driver Helmet');
    expect(publicBody).toContain('## Waarom dit opvalt');
  });

  it('cleans English sentences from the final MDX for every article type', () => {
    const articleTypes = [
      'deal',
      'gwp_reward',
      'multi_set_announcement',
      'release_roundup',
      'single_set_news',
      'unknown',
    ] as const;

    articleTypes.forEach((articleType) => {
      const hasPrimarySet =
        articleType !== 'release_roundup' && articleType !== 'unknown';
      const primarySet = hasPrimarySet
        ? {
            ...createMatchedSet('75458', {
              name: 'Imperial Remnant AT-RT Driver Helmet',
              theme: 'Star Wars',
            }),
            reason: 'title_match' as const,
          }
        : null;
      const result = generateEditorialMdxDraft(
        createInput({
          matching: createMatching({
            articleType,
            matchedSets: primarySet
              ? [primarySet]
              : [
                  createMatchedSet('75458', {
                    name: 'Imperial Remnant AT-RT Driver Helmet',
                    theme: 'Star Wars',
                  }),
                ],
            unmatchedSetNumbers: [],
          }),
          primarySet,
          detected: createDetected({
            keywords: ['Star Wars', 'Helmet'],
            setNumbers: ['75458'],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            keyPoints: [
              'These sets have been revealed with official images.',
              'The source says the model includes two minifigures and will be available from June.',
            ],
            setNames: ['Imperial Remnant AT-RT Driver Helmet'],
            setNumbers: ['75458'],
            summary:
              'This set has been revealed with official images. The source says the model includes two minifigures and will be available from June.',
            theme: 'Star Wars',
            title:
              'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed',
          }),
          source: createSource({
            description:
              'According to the article, the set features a display stand and will be available from June.',
            domain: 'brickset.com',
            finalUrl: 'https://brickset.com/article/131538',
            inputUrl: 'https://brickset.com/article/131538',
            language: 'en',
            siteName: 'Brickset',
            title:
              'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed',
          }),
        }),
      );

      expectNoEnglishSentencesInFinalMdx(result.mdx);
      expect(result.mdx).not.toContain(
        'The source says the model includes two minifigures',
      );
      expect(result.mdx).not.toContain('According to the article');
    });
  });

  it('translates known English reveal sentences instead of keeping English paragraphs', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [
            createMatchedSet('10345', {
              name: 'Flower Arrangement',
              theme: 'Botanicals',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: {
          ...createMatchedSet('10345', {
            name: 'Flower Arrangement',
            theme: 'Botanicals',
          }),
          reason: 'title_match',
        },
        detected: createDetected({
          keywords: ['Botanicals', 'plant', 'bloem'],
          setNumbers: ['10345'],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          setNames: ['Flower Arrangement'],
          setNumbers: ['10345'],
          summary: 'Three beautiful botanical sets revealed!',
          theme: 'Botanicals',
          title: 'Three beautiful botanical sets revealed!',
        }),
        source: createSource({
          description: 'Three beautiful botanical sets revealed!',
          domain: 'brickset.com',
          finalUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          inputUrl:
            'https://brickset.com/article/123456/three-beautiful-botanical-sets-revealed',
          language: 'en',
          siteName: 'Brickset',
          title: 'Three beautiful botanical sets revealed!',
        }),
      }),
    );
    const publicBody = getPublicMdxBody(result.mdx);

    expect(publicBody).toContain('Nieuwe Botanicals-sets zijn onthuld.');
    expect(publicBody).not.toContain('Three beautiful botanical sets revealed');
  });

  it('omits FeaturedSet for multi-set announcements without a reliable primary new set', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'multi_set_announcement',
          matchedSets: [
            createMatchedSet('21330', {
              name: 'Home Alone',
              theme: 'Ideas',
            }),
          ],
          unmatchedSetNumbers: [],
        }),
        primarySet: null,
        relatedCandidates: [
          createRelatedCandidate('21330', {
            name: 'Home Alone',
            theme: 'Ideas',
          }),
          createRelatedCandidate('21331', {
            name: 'Sonic the Hedgehog - Green Hill Zone',
            theme: 'Ideas',
          }),
        ],
        detected: createDetected({
          keywords: ['Ideas'],
          setNumbers: ['21330', '99991', '99992'],
          themes: ['Ideas'],
        }),
        facts: createFacts({
          setNames: ['Home Alone'],
          setNumbers: ['21330', '99991', '99992'],
          summary:
            'National Lampoon’s Christmas Vacation Griswold House, Amsterdam Canal Houses en Edward Scissorhands zijn goedgekeurd. Home Alone wordt alleen als eerdere Ideas-set genoemd.',
          theme: 'Ideas',
          title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
        }),
        source: createSource({
          description:
            'Amsterdam Canal Houses en Edward Scissorhands zijn geselecteerd in de LEGO Ideas reviewronde.',
          title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
        }),
      }),
    );
    const publicBody = result.mdx.split('---\n\n').at(1) ?? result.mdx;

    expect(result.frontmatter.description).not.toContain('Home Alone');
    expect(publicBody).not.toContain('<FeaturedSet');
    expect(publicBody).not.toContain('<SetRail');
    expect(publicBody).not.toContain('Home Alone');
    expect(publicBody).not.toContain('Sonic the Hedgehog');
    expect(publicBody).toContain('goedgekeurde LEGO Ideas-projecten');
    expect(publicBody).toContain('wat er aangekondigd is');
    expect(publicBody).toContain('Amsterdam Canal Houses');
    expect(publicBody).toContain('Edward Scissorhands');
    expect(publicBody).not.toContain('deze set');
    expect(publicBody).not.toContain('koopbeslissing');
    expect(publicBody).not.toContain('Wanneer kopen?');
    expect(publicBody).not.toContain('budget');
    expect(publicBody).not.toContain('draft');
    expect(publicBody).not.toContain('FeaturedSet');
    expect(publicBody).not.toContain('catalogusset');
    expect(publicBody).not.toContain('component');
    expect(publicBody).not.toContain('generator');
    expect(publicBody).not.toContain('extraction');
    expect(publicBody).not.toContain('deze aankondiging geeft');
    publicBody
      .split('\n\n')
      .filter((paragraph) => paragraph.trim().length > 0)
      .forEach((paragraph) => {
        const firstCharacter = paragraph.trim().charAt(0);

        expect(firstCharacter).not.toMatch(/[a-z]/u);
      });
  });

  it('keeps single-set templates strictly separate from release roundup copy and structure', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'single_set_news',
        }),
        source: createSource({
          title: 'Algemene bronkop die niet leidend mag zijn',
        }),
      }),
    );

    expect(result.frontmatter.title).toBe('Mario Kart – Spiny Shell terug');
    expect(result.frontmatter.description).not.toContain(
      'Overzicht van de LEGO-sets uit',
    );
    expect(result.frontmatter.theme).toBe('Super Mario');
    expect(result.frontmatter.theme).not.toBe('Multiple');
    expect(result.mdx).toContain('<FeaturedSet setNumber="40787" />');
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).not.toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
    expect(result.mdx).not.toContain(
      '<h2 id="nieuwe-sets-die-opvallen">Nieuwe sets die opvallen</h2>',
    );
    expect(result.mdx).not.toContain(
      'wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen',
    );
    expect(result.mdx).not.toContain(
      'er zit genoeg om vrolijk doorheen te bladeren',
    );
    expect(result.mdx).not.toContain('## Waar moet je op letten?');
    expect(result.mdx).toContain('## Waarom dit opvalt');
  });

  it('keeps gwp_reward drafts on the single-set template without roundup leakage', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'gwp_reward',
        }),
        facts: createFacts({
          theme: 'Mario Kart',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Super Mario');
    expect(result.frontmatter.description).toContain(
      'werkt het best als je de punten al hebt.',
    );
    expect(result.mdx).toContain('<FeaturedSet setNumber="40787" />');
    expect(result.mdx).not.toContain('<SetSpotlightList');
    expect(result.mdx).not.toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
    expect(result.mdx).not.toContain('Mei 2026');
    expect(result.mdx).not.toContain('## Wat is er aangekondigd?');
  });

  it('writes Star Trek double-points discount articles as deal copy, not reward copy', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['dubbele Insiders-punten', 'korting', 'actie'],
          prices: ['€60 korting'],
          setNumbers: ['10356'],
          themes: ['LEGO® Icons'],
        }),
        facts: createFacts({
          keywords: ['dubbele Insiders-punten', '€60 korting'],
          priceEUR: '€60 korting',
          setNames: ['Star Trek: U.S.S. Enterprise NCC-1701-D'],
          setNumbers: ['10356'],
          summary:
            'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D is tijdelijk verkrijgbaar met dubbele Insiders-punten of €60 korting.',
          theme: 'LEGO® Icons',
          title:
            'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
        }),
        matching: createMatching({
          articleType: 'deal',
          matchedSets: [
            createMatchedSet('10356', {
              name: 'Star Trek: U.S.S. Enterprise NCC-1701-D',
              slug: 'star-trek-uss-enterprise-ncc-1701-d-10356',
              theme: 'LEGO® Icons',
            }),
            createMatchedSet('21355', {
              name: 'The Evolution of STEM',
              theme: 'Ideas',
            }),
            createMatchedSet('42179', {
              name: 'Planet Earth and Moon in Orbit',
              theme: 'Technic',
            }),
          ],
        }),
        primarySet: createPrimarySet({
          id: '10356',
          name: 'Star Trek: U.S.S. Enterprise NCC-1701-D',
          setNumber: '10356',
          slug: 'star-trek-uss-enterprise-ncc-1701-d-10356',
          theme: 'LEGO® Icons',
        }),
        relatedCandidates: [
          createRelatedCandidate('21355', {
            name: 'The Evolution of STEM',
            theme: 'Ideas',
          }),
          createRelatedCandidate('42179', {
            name: 'Planet Earth and Moon in Orbit',
            theme: 'Technic',
          }),
        ],
        source: createSource({
          description:
            'De set krijgt tijdelijk dubbele Insiders-punten of €60 korting.',
          title:
            'LEGO Icons 10356 Star Trek: U.S.S. Enterprise NCC-1701-D nu met dubbele Insiders-punten of €60 korting',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('LEGO® Icons');
    expect(result.frontmatter.description).toContain('prijs');
    expect(result.mdx).toContain('<FeaturedSet setNumber="10356" />');
    expectFeaturedSetAtTop(result.mdx);
    expect(result.mdx).toContain('dubbele Insiders-punten of €60 korting');
    expect(result.mdx).not.toContain('<SetRail');
    expect(result.mdx).not.toContain('The Evolution of STEM');
    expect(result.mdx).not.toContain('Planet Earth and Moon in Orbit');
    expect(result.mdx).not.toContain('vrijspelen');
    expect(result.mdx).not.toContain('punten al hebt');
    expect(result.mdx).not.toContain('Insiders reward');
    expect(result.mdx).not.toContain('aankopen forceren');
    expect(result.mdx).not.toContain('heeft de LEGO');
  });

  it('writes restock availability articles with decision copy instead of announcement copy', () => {
    const tintinSet = createPrimarySet({
      id: '21360',
      name: 'Tintin Moon Rocket',
      setNumber: '21360',
      slug: 'tintin-moon-rocket-21360',
      theme: 'Ideas',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['weer op voorraad', 'nu te bestellen'],
          setNumbers: ['21360'],
          themes: ['Ideas'],
        }),
        facts: createFacts({
          keywords: ['op voorraad', 'beschikbaar'],
          setNames: ['Tintin Moon Rocket'],
          setNumbers: ['21360'],
          summary:
            'LEGO Ideas 21360 Tintin Moon Rocket is weer op voorraad en nu te bestellen.',
          theme: 'Ideas',
          title: 'LEGO Ideas 21360 Tintin Moon Rocket weer op voorraad',
        }),
        matching: createMatching({
          articleType: 'deal',
          matchedSets: [tintinSet],
        }),
        primarySet: tintinSet,
        relatedCandidates: [],
        source: createSource({
          description:
            'De Tintin Moon Rocket is weer beschikbaar met beperkte voorraad.',
          title: 'LEGO Ideas 21360 Tintin Moon Rocket weer op voorraad',
        }),
      }),
    );

    expect(result.frontmatter.title).toBe(
      'Tintin Moon Rocket weer op voorraad',
    );
    expect(result.frontmatter.description).toContain('beschikbaarheid');
    expect(result.mdx).toContain('nu kopen');
    expect(result.mdx).toContain('nu op voorraad');
    expect(result.mdx).toContain('waar je hem veilig kunt kopen');
    expect(result.mdx).not.toContain('eerste aankondiging');
    expect(result.mdx).not.toContain('## Wat is er aangekondigd?');
    expect(result.mdx).not.toContain('Wacht op betere beelden');
  });

  it('writes Architecture 21066 pre-order announcements as announcement copy', () => {
    const architectureSet = createPrimarySet({
      id: '21066',
      name: 'Architecture 21066',
      setNumber: '21066',
      slug: 'architecture-21066',
      theme: 'Architecture',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 juni 2026'],
          keywords: ['onthuld', 'nu te pre-orderen', 'op voorraad'],
          prices: [],
          setNumbers: ['21066'],
          themes: ['Architecture'],
        }),
        facts: createFacts({
          keyPoints: [
            'The set has a black apple-shaped background and a skyline with the Empire State Building, One World Trade Center and Brooklyn Bridge.',
            'The model has 1,465 pieces and measures 29 cm high, 28 cm wide and 12 cm deep.',
          ],
          keywords: ['onthuld', 'nu te pre-orderen'],
          releaseDate: '1 juni 2026',
          setNames: ['Architecture 21066'],
          setNumbers: ['21066'],
          summary:
            'LEGO Architecture 21066 is onthuld, verschijnt op 1 juni 2026 en is nu te pre-orderen.',
          theme: 'Architecture',
          title:
            'LEGO Architecture 21066 onthuld: verschijnt op 1 juni 2026 en nu te pre-orderen',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [architectureSet],
        }),
        primarySet: architectureSet,
        relatedCandidates: [],
        source: createSource({
          description:
            'The new LEGO Architecture set has a black apple-shaped background. The skyline includes the Empire State Building, One World Trade Center and Brooklyn Bridge. It has 1,465 pieces and measures 29 cm high, 28 cm wide and 12 cm deep.',
          title:
            'LEGO Architecture 21066 onthuld: verschijnt op 1 juni 2026 en nu te pre-orderen',
        }),
      }),
    );

    expect(result.mdx).toContain('## Wat is er aangekondigd?');
    expect(result.mdx).toContain('verschijnt op 1 juni 2026');
    expect(result.mdx).toContain('nu te pre-orderen');
    expect(result.mdx).toMatch(
      /zwarte appelvormige achtergrond|Empire State Building|1\.465 stenen|29 cm hoog/u,
    );
    expect(result.mdx).not.toContain(
      'Het draait om vorm, detail en de plek die hij straks op de plank krijgt.\n\n## Wat is er aangekondigd?',
    );
    expect(result.mdx).not.toContain('weer te krijgen');
    expect(result.mdx).not.toContain('nu kopen');
    expect(result.mdx).not.toContain('beschikbaarheidscheck');
    expect(result.mdx).not.toContain('weer op voorraad');
    expect(result.mdx).not.toContain('## Wanneer kopen?');
  });

  it('uses concrete source details in single-set announcement copy', () => {
    const flowerSet = createPrimarySet({
      id: '10399',
      name: 'Pretty Pink Flower Bouquet',
      setNumber: '10399',
      slug: 'pretty-pink-flower-bouquet-10399',
      theme: 'Botanicals',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          dateSignals: ['1 juni 2026'],
          keywords: ['Botanicals', 'onthuld'],
          prices: [],
          setNumbers: ['10399'],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          keyPoints: [
            'De set heeft een appelvormige achtergrond achter het boeket.',
          ],
          releaseDate: '1 juni 2026',
          setNames: ['Pretty Pink Flower Bouquet'],
          setNumbers: ['10399'],
          summary:
            'Pretty Pink Flower Bouquet is onthuld als nieuwe LEGO Botanicals-set.',
          theme: 'Botanicals',
          title: 'Pretty Pink Flower Bouquet onthuld',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [flowerSet],
        }),
        primarySet: flowerSet,
        relatedCandidates: [],
        source: createSource({
          description:
            'De set heeft een appelvormige achtergrond achter het boeket. Ook zitten er roze bloemen en groene bladeren in.',
          title: 'Pretty Pink Flower Bouquet onthuld',
        }),
      }),
    );

    expect(result.mdx).toContain('## Wat is er aangekondigd?');
    expect(result.mdx).toContain('appelvormige achtergrond');
    expect(result.mdx).not.toContain(
      'Het draait om vorm, detail en de plek die hij straks op de plank krijgt.\n\n## Wat is er aangekondigd?',
    );
  });

  it('varies concrete source details between similar articles', () => {
    const cases = [
      {
        detail: 'De set heeft een appelvormige achtergrond achter het boeket.',
        name: 'Pretty Pink Flower Bouquet',
        setNumber: '10399',
      },
      {
        detail: 'De set komt met een bouwbare vaas en drie losse bloemen.',
        name: 'Spring Table Bouquet',
        setNumber: '10400',
      },
    ].map(({ detail, name, setNumber }) => {
      const primarySet = createPrimarySet({
        id: setNumber,
        name,
        setNumber,
        slug: `${setNumber}-${name.toLowerCase().replace(/\s+/gu, '-')}`,
        theme: 'Botanicals',
      });

      return generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            dateSignals: ['1 juni 2026'],
            keywords: ['Botanicals', 'onthuld'],
            prices: [],
            setNumbers: [setNumber],
            themes: ['Botanicals'],
          }),
          facts: createFacts({
            keyPoints: [detail],
            releaseDate: '1 juni 2026',
            setNames: [name],
            setNumbers: [setNumber],
            summary: `${name} is onthuld als nieuwe LEGO Botanicals-set.`,
            theme: 'Botanicals',
            title: `${name} onthuld`,
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [primarySet],
          }),
          primarySet,
          relatedCandidates: [],
          source: createSource({
            description: detail,
            title: `${name} onthuld`,
          }),
        }),
      ).mdx;
    });

    expect(cases[0]).toContain('appelvormige achtergrond');
    expect(cases[1]).toContain('bouwbare vaas');
    expect(cases[0]).not.toBe(cases[1]);
    expect(cases[0]).not.toContain('bouwbare vaas');
    expect(cases[1]).not.toContain('appelvormige achtergrond');
  });

  it('skips FeaturedSet for release roundups without a primary set', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'release_roundup',
          matchedSets: [
            createMatchedSet('75446', {
              name: 'Grogu and Hover Pram',
              theme: 'Star Wars',
            }),
            createMatchedSet('75447', {
              name: 'X-Wing Pilot Helmet',
              theme: 'Star Wars',
            }),
          ],
        }),
        primarySet: null,
        relatedCandidates: [
          createRelatedCandidate('75446', {
            name: 'Grogu and Hover Pram',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75447', {
            name: 'X-Wing Pilot Helmet',
            theme: 'Star Wars',
          }),
        ],
        facts: createFacts({
          setNames: ['Grogu and Hover Pram', 'X-Wing Pilot Helmet'],
          setNumbers: ['75446', '75447'],
          summary: 'Star Wars releasegolf.',
          theme: 'Star Wars',
          title: 'Nieuwe Star Wars-sets voor mei 2026',
        }),
        detected: createDetected({
          dateSignals: ['mei 2026'],
          setNumbers: ['75446', '75447'],
          themes: ['Star Wars'],
        }),
        source: createSource({
          title: 'Nieuwe Star Wars-sets voor mei 2026',
        }),
      }),
    );

    expect(result.mdx).not.toContain('<FeaturedSet');
    expect(result.mdx).toContain('## Waar moet je op letten?');
    expect(result.mdx).toContain('<SetSpotlightList setIds="75446, 75447" />');
  });

  it('gives release roundups a lighter discovery tone and sets theme to Multiple when several themes show up', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'release_roundup',
          matchedSets: [
            createMatchedSet('11506', {
              name: 'Rocking Plants',
              theme: 'Botanicals',
            }),
            createMatchedSet('75442', {
              name: "The Mandalorian's N-1 Starfighter",
              theme: 'Star Wars',
            }),
          ],
        }),
        primarySet: null,
        relatedCandidates: [
          createRelatedCandidate('11506', {
            name: 'Rocking Plants',
            theme: 'Botanicals',
          }),
          createRelatedCandidate('75442', {
            name: "The Mandalorian's N-1 Starfighter",
            theme: 'Star Wars',
          }),
        ],
        facts: createFacts({
          setNames: ['Rocking Plants', "The Mandalorian's N-1 Starfighter"],
          setNumbers: ['11506', '75442'],
          summary: 'Nieuwe sets voor mei 2026.',
          theme: 'Star Wars',
          title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
        }),
        detected: createDetected({
          dateSignals: ['mei 2026'],
          setNumbers: ['11506', '75442'],
          themes: ['Botanicals', 'Star Wars'],
        }),
        source: createSource({
          title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
        }),
      }),
    );

    expect(result.frontmatter.theme).toBe('Multiple');
    expect(result.mdx).toContain(
      'Mei 2026 wordt zo’n maand waarin je ineens veel nieuwe LEGO-dozen ziet langskomen',
    );
    expect(result.mdx).toContain(
      'Niet alles hoeft meteen op je wishlist, maar er is genoeg om vrolijk doorheen te bladeren.',
    );
    expect(result.mdx).toContain(
      'Dit overzicht laat zien wat eraan komt en waar je aandacht direct naartoe gaat.',
    );
    expect(result.mdx.match(/er zit van alles tussen/gu) ?? []).toHaveLength(0);
    expect(result.mdx.match(/blijft hangen/gu) ?? []).toHaveLength(0);
    expect(result.mdx).not.toContain('shortlist');
    expect(result.mdx).not.toContain('ruis');
    expect(result.mdx).not.toContain('optimaliseren');
    expect(result.mdx).not.toContain('strategie');
    expect(result.mdx).not.toContain('budgetdiscipline');
    expect(result.mdx).toContain(
      'Bij zo’n releasemaand hoef je niet alles meteen op dag één te kopen.',
    );
    expect(result.mdx).toContain(
      '[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)',
    );
    expect(result.mdx).toContain(
      '<h2 id="nieuwe-sets-die-opvallen">Nieuwe sets die opvallen</h2>',
    );
    expect(result.mdx).toContain(
      'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
    );
    expect(result.mdx).toContain('<SetSpotlightList setIds="11506, 75442" />');
    expect(result.mdx).not.toContain('<SetRail title=');
  });

  it('uses all matched sets in SetSpotlightList for release roundups without hiding them behind rails', () => {
    const matchedSets = [
      createMatchedSet('11506', {
        name: 'Rocking Plants',
        theme: 'Botanicals',
      }),
      createMatchedSet('43263', {
        name: 'Beauty and the Beast Castle',
        theme: 'Disney',
      }),
      createMatchedSet('76976', {
        name: 'Spinosaurus',
        theme: 'Jurassic World',
      }),
      createMatchedSet('75442', {
        name: "The Mandalorian's N-1 Starfighter",
        theme: 'Star Wars',
      }),
      createMatchedSet('10367', { name: 'Fountain Garden', theme: 'Icons' }),
      createMatchedSet('31166', { name: 'Majestic Tiger', theme: 'Creator' }),
      createMatchedSet('76316', {
        name: 'Fantastic Four vs. Galactus',
        theme: 'Marvel',
      }),
      createMatchedSet('71845', {
        name: 'Thunderfang Dragon of Chaos',
        theme: 'Ninjago',
      }),
    ];
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'release_roundup',
          matchedSets,
        }),
        primarySet: null,
        relatedCandidates: [],
        facts: createFacts({
          setNames: matchedSets.map((set) => set.name),
          setNumbers: matchedSets.map((set) => set.setNumber),
          summary: 'Veel nieuwe sets voor mei 2026.',
          theme: 'Star Wars',
          title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
        }),
        detected: createDetected({
          dateSignals: ['mei 2026'],
          setNumbers: matchedSets.map((set) => set.setNumber),
          themes: ['Botanicals', 'Disney', 'Jurassic World', 'Star Wars'],
        }),
      }),
    );
    expect(result.mdx).toContain(
      '<SetSpotlightList setIds="11506, 43263, 76976, 75442, 10367, 31166, 76316, 71845" />',
    );
    expect(result.mdx).toContain(
      '<h2 id="nieuwe-sets-die-opvallen">Nieuwe sets die opvallen</h2>',
    );
    expect(result.mdx).not.toContain('<SetRail title=');
  });

  it('only adds SetRail when at least two reliable related candidates exist', () => {
    const withRail = generateEditorialMdxDraft(createInput());
    const withoutRail = generateEditorialMdxDraft(
      createInput({
        relatedCandidates: [
          createRelatedCandidate('72050', {
            name: 'Mario Kart - Baby Peach & Grand Prix Set',
          }),
        ],
      }),
    );

    expect(withRail.mdx).toContain('<SetRail');
    expect(withRail.mdx).toContain('setIds="72050, 72037"');
    expect(withRail.mdx).not.toContain('setIds={[');
    expect(withoutRail.mdx).not.toContain('<SetRail');
  });

  it('selects only vehicle related sets for vehicle articles', () => {
    const primarySet = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75459',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Wars', 'Shuttle'],
          setNumbers: ['75459'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juli 2026',
          setNames: ['Imperial Lambda-Class Shuttle'],
          setNumbers: ['75459'],
          theme: 'Star Wars',
          title: 'Imperial Lambda-Class Shuttle nu te pre-orderen',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('75406', {
            name: 'Kylo Ren Command Shuttle',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75376', {
            name: 'Tantive IV',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('40483', {
            name: 'Luke Skywalker Lightsaber',
            theme: 'Star Wars',
          }),
        ],
      }),
    );

    expect(result.mdx).toContain('setIds="75406, 75376"');
    expect(result.mdx).not.toContain('40483');
  });

  it('selects only helmet related sets for helmet articles', () => {
    const primarySet = createPrimarySet({
      name: 'Imperial Remnant AT-RT Driver Helmet',
      setNumber: '75458',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Wars', 'Helmet Collection'],
          setNumbers: ['75458'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Imperial Remnant AT-RT Driver Helmet'],
          setNumbers: ['75458'],
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet onthuld',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('75349', {
            name: 'Captain Rex Helmet',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75350', {
            name: 'Clone Commander Cody Helmet',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75376', {
            name: 'Tantive IV',
            theme: 'Star Wars',
          }),
        ],
      }),
    );

    expect(result.mdx).toContain('setIds="75349, 75350"');
    expect(result.mdx).not.toContain('75376');
  });

  it('selects only plant and flower related sets for Botanicals articles', () => {
    const primarySet = createPrimarySet({
      name: 'Pretty Pink Flower Bouquet',
      setNumber: '10342',
      theme: 'Botanicals',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Botanicals', 'bloem', 'plant'],
          setNumbers: ['10342'],
          themes: ['Botanicals'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Pretty Pink Flower Bouquet'],
          setNumbers: ['10342'],
          theme: 'Botanicals',
          title: 'Pretty Pink Flower Bouquet onthuld',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('10311', {
            name: 'Orchid',
            theme: 'Botanicals',
          }),
          createRelatedCandidate('10280', {
            name: 'Flower Bouquet',
            theme: 'Botanicals',
          }),
          createRelatedCandidate('10305', {
            name: 'Lion Knights Castle',
            theme: 'Icons',
          }),
        ],
      }),
    );

    expect(result.mdx).toContain('setIds="10311, 10280"');
    expect(result.mdx).not.toContain('10305');
  });

  it('hides SetRail when related candidates mix categories without enough matches', () => {
    const primarySet = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75459',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Wars', 'Shuttle'],
          setNumbers: ['75459'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juli 2026',
          setNames: ['Imperial Lambda-Class Shuttle'],
          setNumbers: ['75459'],
          theme: 'Star Wars',
          title: 'Imperial Lambda-Class Shuttle nu te pre-orderen',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('75406', {
            name: 'Kylo Ren Command Shuttle',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('40483', {
            name: 'Luke Skywalker Lightsaber',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75349', {
            name: 'Captain Rex Helmet',
            theme: 'Star Wars',
          }),
        ],
      }),
    );

    expect(result.mdx).not.toContain('<SetRail');
  });

  it('uses wait-friendly SetRail copy for future Star Wars helmet releases', () => {
    const primarySet = createPrimarySet({
      name: 'Imperial Remnant AT-RT Driver Helmet',
      setNumber: '75458',
      theme: 'Star Wars',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Wars', 'Helmet Collection'],
          setNumbers: ['75458'],
          themes: ['Star Wars'],
        }),
        facts: createFacts({
          releaseDate: '1 juni 2026',
          setNames: ['Imperial Remnant AT-RT Driver Helmet'],
          setNumbers: ['75458'],
          summary:
            'Imperial Remnant AT-RT Driver Helmet is onthuld als toekomstige Star Wars-release.',
          theme: 'Star Wars',
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet onthuld',
        }),
        matching: createMatching({
          articleType: 'single_set_news',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('75349', {
            name: 'Captain Rex Helmet',
            theme: 'Star Wars',
          }),
          createRelatedCandidate('75350', {
            name: 'Clone Commander Cody Helmet',
            theme: 'Star Wars',
          }),
        ],
        source: createSource({
          title:
            'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet onthuld',
        }),
      }),
    );

    expect(result.mdx).toContain('eyebrow="Kun je niet wachten?"');
    expect(result.mdx).toContain('title="Andere helmets om nu te bouwen"');
    expect(result.mdx).toContain(
      'Dan zijn dit sterke alternatieven die je nu al kunt bouwen en neerzetten.',
    );
    expect(result.mdx).not.toContain(
      'Star Wars-sets voor naast Imperial Remnant AT-RT Driver Helmet',
    );
    expect(result.mdx).not.toContain('Zoek je naast');
  });

  it('uses comparison SetRail copy for deal articles', () => {
    const primarySet = createPrimarySet({
      name: 'Star Trek U.S.S. Enterprise',
      setNumber: '10356',
      theme: 'LEGO® Icons',
    });
    const result = generateEditorialMdxDraft(
      createInput({
        detected: createDetected({
          keywords: ['Star Trek', 'korting'],
          prices: ['€60 korting'],
          setNumbers: ['10356'],
          themes: ['Icons'],
        }),
        facts: createFacts({
          priceEUR: '€60 korting',
          setNames: ['Star Trek U.S.S. Enterprise'],
          setNumbers: ['10356'],
          summary:
            'Star Trek U.S.S. Enterprise is tijdelijk goedkoper met korting.',
          theme: 'Icons',
          title: 'LEGO Icons 10356 Star Trek U.S.S. Enterprise nu met korting',
        }),
        matching: createMatching({
          articleType: 'deal',
          matchedSets: [primarySet],
        }),
        primarySet,
        relatedCandidates: [
          createRelatedCandidate('10307', {
            name: 'NASA Space Shuttle Discovery',
            theme: 'LEGO® Icons',
          }),
          createRelatedCandidate('10316', {
            name: 'Concorde',
            theme: 'LEGO® Icons',
          }),
        ],
        source: createSource({
          title: 'LEGO Icons 10356 Star Trek U.S.S. Enterprise nu met korting',
        }),
      }),
    );

    expect(result.mdx).toContain('eyebrow="Ook interessant"');
    expect(result.mdx).toContain('title="Meer sets om te vergelijken"');
    expect(result.mdx).toContain(
      'Twijfel je over deze deal? Vergelijk hem dan vooral met deze sets.',
    );
    expect(result.mdx).not.toContain('sets voor naast');
  });

  it('keeps final generated MDX examples within editorial quality guards', () => {
    const starWarsHelmet = createPrimarySet({
      name: 'Imperial Remnant AT-RT Driver Helmet',
      setNumber: '75458',
      theme: 'Star Wars',
    });
    const starWarsShuttle = createPrimarySet({
      name: 'Imperial Lambda-Class Shuttle',
      setNumber: '75460',
      theme: 'Star Wars',
    });
    const darthVaderFigure = createPrimarySet({
      name: 'Up-Scaled Darth Vader Minifigure',
      setNumber: '75461',
      theme: 'Star Wars',
    });
    const starTrekDeal = createPrimarySet({
      name: 'Star Trek U.S.S. Enterprise',
      setNumber: '10356',
      theme: 'LEGO® Icons',
    });
    const examples = {
      buildableDarthVaderFigure: generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            keywords: ['Star Wars', 'Darth Vader', 'Minifigure'],
            setNumbers: ['75461'],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            releaseDate: '1 juni 2026',
            setNames: ['Up-Scaled Darth Vader Minifigure'],
            setNumbers: ['75461'],
            summary:
              'Up-Scaled Darth Vader Minifigure is aangekondigd als nieuwe LEGO Star Wars-set.',
            theme: 'Star Wars',
            title:
              'LEGO Star Wars 75461 Up-Scaled Darth Vader Minifigure aangekondigd',
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [darthVaderFigure],
          }),
          primarySet: darthVaderFigure,
          relatedCandidates: [
            createRelatedCandidate('75398', {
              name: 'C-3PO',
              theme: 'Star Wars',
            }),
            createRelatedCandidate('75371', {
              name: 'Chewbacca',
              theme: 'Star Wars',
            }),
          ],
          source: createSource({
            title:
              'LEGO Star Wars 75461 Up-Scaled Darth Vader Minifigure aangekondigd',
          }),
        }),
      ),
      broadReleaseRoundup: generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            dateSignals: ['juni 2026'],
            setNumbers: ['75458', '75460', '72050'],
            themes: ['Star Wars', 'Super Mario'],
          }),
          facts: createFacts({
            keywords: ['juni 2026', 'release'],
            releaseDate: '',
            setNames: [
              'Imperial Remnant AT-RT Driver Helmet',
              'Imperial Lambda-Class Shuttle',
              'Mario Kart - Standard Kart',
            ],
            setNumbers: ['75458', '75460', '72050'],
            summary: 'Meerdere nieuwe LEGO-sets verschijnen in juni 2026.',
            theme: 'Multiple',
            title: 'Deze nieuwe LEGO-sets verschijnen in juni 2026',
          }),
          matching: createMatching({
            articleType: 'release_roundup',
            matchedSets: [
              starWarsHelmet,
              starWarsShuttle,
              createMatchedSet('72050', {
                name: 'Mario Kart - Standard Kart',
                theme: 'Super Mario',
              }),
            ],
          }),
          primarySet: null,
          relatedCandidates: [],
          source: createSource({
            title: 'Deze nieuwe LEGO-sets verschijnen in juni 2026',
          }),
        }),
      ),
      dealArticle: generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            keywords: ['Star Trek', 'korting'],
            prices: ['€60 korting'],
            setNumbers: ['10356'],
            themes: ['Icons'],
          }),
          facts: createFacts({
            priceEUR: '€60 korting',
            setNames: ['Star Trek U.S.S. Enterprise'],
            setNumbers: ['10356'],
            summary:
              'Star Trek U.S.S. Enterprise is tijdelijk goedkoper met korting.',
            theme: 'Icons',
            title:
              'LEGO Icons 10356 Star Trek U.S.S. Enterprise nu met korting',
          }),
          matching: createMatching({
            articleType: 'deal',
            matchedSets: [starTrekDeal],
          }),
          primarySet: starTrekDeal,
          relatedCandidates: [
            createRelatedCandidate('10307', {
              name: 'NASA Space Shuttle Discovery',
              theme: 'LEGO® Icons',
            }),
            createRelatedCandidate('10316', {
              name: 'Concorde',
              theme: 'LEGO® Icons',
            }),
          ],
          source: createSource({
            title:
              'LEGO Icons 10356 Star Trek U.S.S. Enterprise nu met korting',
          }),
        }),
      ),
      starWarsHelmetAnnouncement: generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            keywords: ['Star Wars', 'Helmet Collection'],
            setNumbers: ['75458'],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            releaseDate: '1 juni 2026',
            setNames: ['Imperial Remnant AT-RT Driver Helmet'],
            setNumbers: ['75458'],
            summary:
              'Imperial Remnant AT-RT Driver Helmet is aangekondigd als nieuwe LEGO Star Wars-helmet.',
            theme: 'Star Wars',
            title:
              'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet aangekondigd',
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [starWarsHelmet],
          }),
          primarySet: starWarsHelmet,
          relatedCandidates: [
            createRelatedCandidate('75349', {
              name: 'Captain Rex Helmet',
              theme: 'Star Wars',
            }),
            createRelatedCandidate('75350', {
              name: 'Clone Commander Cody Helmet',
              theme: 'Star Wars',
            }),
          ],
          source: createSource({
            title:
              'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet aangekondigd',
          }),
        }),
      ),
      starWarsShuttleAnnouncement: generateEditorialMdxDraft(
        createInput({
          detected: createDetected({
            keywords: ['Star Wars', 'Imperial', 'Shuttle'],
            setNumbers: ['75460'],
            themes: ['Star Wars'],
          }),
          facts: createFacts({
            releaseDate: '1 juni 2026',
            setNames: ['Imperial Lambda-Class Shuttle'],
            setNumbers: ['75460'],
            summary:
              'Imperial Lambda-Class Shuttle is aangekondigd als nieuwe LEGO Star Wars-set.',
            theme: 'Star Wars',
            title:
              'LEGO Star Wars 75460 Imperial Lambda-Class Shuttle aangekondigd',
          }),
          matching: createMatching({
            articleType: 'single_set_news',
            matchedSets: [starWarsShuttle],
          }),
          primarySet: starWarsShuttle,
          relatedCandidates: [
            createRelatedCandidate('75376', {
              name: 'Tantive IV',
              theme: 'Star Wars',
            }),
            createRelatedCandidate('75375', {
              name: 'Millennium Falcon',
              theme: 'Star Wars',
            }),
          ],
          source: createSource({
            title:
              'LEGO Star Wars 75460 Imperial Lambda-Class Shuttle aangekondigd',
          }),
        }),
      ),
    };

    Object.values(examples).forEach(expectEditorialQualityGuards);
    expect(examples.starWarsHelmetAnnouncement.mdx).toContain(
      'Helmet Collection',
    );
    expect(examples.starWarsShuttleAnnouncement.mdx).not.toContain(
      'Helmet Collection',
    );
    expect(examples.buildableDarthVaderFigure.mdx).not.toContain(
      'Helmet Collection',
    );
    expect(examples.starWarsHelmetAnnouncement.mdx).toContain(
      'eyebrow="Kun je niet wachten?"',
    );
    expect(examples.dealArticle.mdx).toContain('eyebrow="Ook interessant"');
    expect(examples.starWarsHelmetAnnouncement.mdx).not.toContain(
      'title="Imperial Remnant AT-RT Driver Helmet',
    );
    expect(examples.starWarsShuttleAnnouncement.mdx).not.toContain(
      'title="Imperial Lambda-Class Shuttle',
    );

    expect(
      Object.fromEntries(
        Object.entries(examples).map(([key, result]) => [
          key,
          summarizeGeneratedArticle(result),
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "broadReleaseRoundup": {
          "components": [
            "<SetSpotlightList setIds="75458, 75460, 72050" />",
          ],
          "description": "Overzicht van de LEGO-sets uit juni 2026 waar je vrolijk doorheen wilt bladeren. Van kleine blikvangers tot grotere thema-releases: genoeg om later terug te zien wat jou echt aanspreekt.",
          "sourceLine": "Bronnen: officiële setinformatie en openbare berichtgeving.",
          "title": "Deze nieuwe LEGO-sets verschijnen in juni 2026",
        },
        "buildableDarthVaderFigure": {
          "components": [
            "<FeaturedSet setNumber="75461" />",
            "<SetRail eyebrow="Kun je niet wachten?" title="Alternatieven om nu te bouwen" setIds="75398, 75371" />",
          ],
          "description": "Up-Scaled Darth Vader Minifigure verschijnt op 1 juni 2026 en draait om een bouwbare displayfiguur voor je Star Wars-character shelf.",
          "sourceLine": "Bronnen: officiële setinformatie en openbare berichtgeving.",
          "title": "Up-Scaled Darth Vader Minifigure aangekondigd",
        },
        "dealArticle": {
          "components": [
            "<FeaturedSet setNumber="10356" />",
            "<SetRail eyebrow="Ook interessant" title="Meer sets om te vergelijken" setIds="10307, 10316" />",
          ],
          "description": "Star Trek U.S.S. Enterprise valt op door €60 korting. Check vooral of de prijs nu echt klopt voor jouw collectie.",
          "sourceLine": "Bronnen: officiële setinformatie en openbare berichtgeving.",
          "title": "Star Trek U.S.S. Enterprise met korting",
        },
        "starWarsHelmetAnnouncement": {
          "components": [
            "<FeaturedSet setNumber="75458" />",
            "<SetRail eyebrow="Kun je niet wachten?" title="Andere helmets om nu te bouwen" setIds="75349, 75350" />",
          ],
          "description": "Imperial Remnant AT-RT Driver Helmet verschijnt op 1 juni 2026 en richt zich duidelijk op Star Wars-fans die hun Helmet Collection willen uitbreiden.",
          "sourceLine": "Bronnen: officiële setinformatie en openbare berichtgeving.",
          "title": "Imperial Remnant AT-RT Driver Helmet aangekondigd",
        },
        "starWarsShuttleAnnouncement": {
          "components": [
            "<FeaturedSet setNumber="75460" />",
            "<SetRail eyebrow="Kun je niet wachten?" title="Alternatieven om nu te bouwen" setIds="75376, 75375" />",
          ],
          "description": "Imperial Lambda-Class Shuttle verschijnt op 1 juni 2026 en draait om dat herkenbare Star Wars-silhouet waar je je display op bouwt.",
          "sourceLine": "Bronnen: officiële setinformatie en openbare berichtgeving.",
          "title": "Imperial Lambda-Class Shuttle nu zichtbaar",
        },
      }
    `);
  });

  it('never uses unmatched set numbers inside FeaturedSet, SetRail or SetSpotlightList', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          unmatchedSetNumbers: ['99999', '88888'],
        }),
      }),
    );

    expect(result.mdx).not.toContain('99999');
    expect(result.mdx).not.toContain('88888');
  });

  it('keeps unknown articles cautious and without embeds', () => {
    const result = generateEditorialMdxDraft(
      createInput({
        matching: createMatching({
          articleType: 'unknown',
          matchedSets: [],
          unmatchedSetNumbers: ['40787'],
        }),
        primarySet: null,
        relatedCandidates: [],
      }),
    );

    expect(result.mdx).not.toContain('<FeaturedSet');
    expect(result.mdx).not.toContain('<SetRail');
    expect(result.warnings).toContain(
      'Article type bleef onbekend; de draft houdt het daarom bewust voorzichtig.',
    );
  });

  it('includes concrete buy advice, a conclusion, subtle sources and a stable slug', () => {
    const input = createInput();
    const first = generateEditorialMdxDraft(input);
    const second = generateEditorialMdxDraft(input);

    expect(first.mdx).toContain('## Wanneer kopen?');
    expect(first.mdx).toContain('## Korte conclusie');
    expect(first.mdx).toContain(
      'Bronnen: officiële setinformatie en openbare berichtgeving.',
    );
    expect(first.mdx).toContain('sourceDisplayMode: "auto"');
    expect(first.mdx).toContain('signalSourceName: "BrickTastic"');
    expect(first.frontmatter.slug).toBe(second.frontmatter.slug);
  });
});
