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
    expect(getThemeToneCopy('Star Wars', 'announcement_intro')).toContain(
      'Helmet Collection',
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
      'Imperial Remnant AT-RT Driver Helmet onthuld',
    );
    expect(result.frontmatter.title.startsWith('LEGO Star Wars')).toBe(false);
    expect(result.frontmatter.title).not.toContain('75458');
    expect(result.mdx).toContain(
      'title: "Imperial Remnant AT-RT Driver Helmet onthuld"',
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

    expect(result.frontmatter.title).toBe('Star Trek U.S.S. Enterprise deal');
    expect(result.frontmatter.title).not.toContain('LEGO');
    expect(result.frontmatter.title).not.toContain('Icons');
    expect(result.frontmatter.title).not.toContain('10356');
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
      'SEGA Genesis Console is aangekondigd als LEGO-release voor 1 juni 2026.',
    );
    expect(result.mdx).toContain(
      'SEGA Genesis Console krijgt een LEGO-release op 1 juni 2026.',
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
      'SEGA Genesis (Mega Drive) is aangekondigd als LEGO-release voor 1 juni 2026.',
    );
    expect(result.mdx).toContain(
      'SEGA Genesis (Mega Drive) krijgt een LEGO-release op 1 juni 2026.',
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
    expect(result.mdx).toContain('leuk om te volgen');
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
    expect(result.mdx).not.toContain('object of deze wereld');
    expect(result.frontmatter.description).toContain('Star Wars-fans');
    expect(result.frontmatter.description).toContain('displaysets');
    expect(result.mdx).toContain('Helmet Collection');
    expect(result.mdx).toContain('Imperial/Rebel vibes');
    expect(result.mdx).toContain('als je deze lijn spaart');
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

    expect(result.frontmatter.description).toContain('Hogwarts-sfeer');
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
      'Mario Kart – Spiny Shell is aangekondigd als LEGO-release voor 2026-05-01. Vooral iets om rustig te volgen als dit thema, object of deze wereld je meteen iets doet.',
    );
    expect(result.mdx).toContain('werelden, objecten of licenties');
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
      'is vooral leuk als je de punten al hebt.',
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
      'Dit overzicht is vooral handig om te zien wat eraan komt en waar je aandacht direct naartoe gaat.',
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

    expect(withRail.mdx).toContain('<SetRail title=');
    expect(withRail.mdx).toContain('setIds="72050, 72037"');
    expect(withRail.mdx).not.toContain('setIds={[');
    expect(withoutRail.mdx).not.toContain('<SetRail title=');
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
