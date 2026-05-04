import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEditorialAgentFacts,
  detectEditorialAgentSignals,
  extractEditorialAgentArticleSource,
  extractEditorialAgentFactsFromUrl,
  findExistingEvent,
  generateEditorialAgentDraftResult,
  matchSetsToCatalog,
  prepareEditorialAgentExtractionForDraft,
  rememberEditorialAgentEvent,
  resetEditorialAgentEventStoreForTests,
  rewriteDraftWithAI,
  validateEditorialAgentSourceUrl,
  EditorialAgentUrlValidationError,
} from './content-data-access-server';
import { generateEditorialMdxDraft } from '@lego-platform/content/util';

describe('content data access server', () => {
  beforeEach(() => {
    resetEditorialAgentEventStoreForTests();
  });

  function createDraftExtractionResult() {
    return {
      detected: {
        dateSignals: ['mei 2026'],
        keywords: ['Toy Story', 'Star Wars'],
        prices: [],
        rumorSignals: [],
        setNumbers: ['43287', '75442'],
        themes: ['Disney', 'Star Wars'],
      },
      extractedText:
        'Mei 2026 wordt een volle releasemaand met Disney en Star Wars.',
      extractedTextPreview:
        'Mei 2026 wordt een volle releasemaand met Disney en Star Wars.',
      event: {
        exists: false,
        fingerprint: {
          key: '2026-05',
          type: 'release_roundup' as const,
        },
      },
      facts: {
        isRumor: false,
        keyPoints: [],
        keywords: ['Toy Story', 'Star Wars'],
        priceEUR: '',
        releaseDate: '2026-05-01',
        setNames: [
          'Alien with Pizza Planet Rocket',
          "The Mandalorian's N-1 Starfighter",
        ],
        setNumbers: ['43287', '75442'],
        summary: 'Nieuwe LEGO-sets voor mei 2026.',
        theme: 'Multiple',
        title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
        uncertainClaims: [],
      },
      matching: {
        articleType: 'release_roundup' as const,
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
      source: {
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
        textLength: 1800,
        title: 'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
      },
      warnings: [],
    };
  }

  describe('validateEditorialAgentSourceUrl', () => {
    it('accepts https URLs', () => {
      expect(
        validateEditorialAgentSourceUrl('https://www.lego.com/nl-nl')
          .normalizedUrl,
      ).toBe('https://www.lego.com/nl-nl');
    });

    it('accepts http URLs', () => {
      expect(
        validateEditorialAgentSourceUrl('http://example.com/news')
          .normalizedUrl,
      ).toBe('http://example.com/news');
    });

    it('upgrades Brickset article URLs to https', () => {
      expect(
        validateEditorialAgentSourceUrl('http://brickset.com/article/131538')
          .normalizedUrl,
      ).toBe('https://brickset.com/article/131538');
    });

    it('rejects empty URLs', () => {
      expect(() => validateEditorialAgentSourceUrl('   ')).toThrow(
        EditorialAgentUrlValidationError,
      );
    });

    it('rejects unsupported protocols', () => {
      expect(() =>
        validateEditorialAgentSourceUrl('javascript:alert(1)'),
      ).toThrow('Alleen http- en https-URL’s zijn toegestaan.');
      expect(() =>
        validateEditorialAgentSourceUrl('data:text/plain,hi'),
      ).toThrow('Alleen http- en https-URL’s zijn toegestaan.');
      expect(() =>
        validateEditorialAgentSourceUrl('file:///tmp/test.txt'),
      ).toThrow('Alleen http- en https-URL’s zijn toegestaan.');
    });

    it('rejects localhost and private IP ranges', () => {
      expect(() =>
        validateEditorialAgentSourceUrl('https://localhost:3000'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
      expect(() =>
        validateEditorialAgentSourceUrl('https://127.0.0.1/article'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
      expect(() =>
        validateEditorialAgentSourceUrl('https://10.0.0.5/article'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
      expect(() =>
        validateEditorialAgentSourceUrl('https://192.168.0.5/article'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
    });

    it('rejects private IPv6 ranges', () => {
      expect(() =>
        validateEditorialAgentSourceUrl('https://[::1]/article'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
      expect(() =>
        validateEditorialAgentSourceUrl('https://[fd00::1]/article'),
      ).toThrow(
        'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
      );
    });
  });

  describe('extractEditorialAgentArticleSource', () => {
    it('extracts title, meta description and readable text from html', () => {
      const result = extractEditorialAgentArticleSource({
        finalUrl: 'https://example.com/mario-kart',
        html: `<!doctype html>
          <html lang="nl">
            <head>
              <title>LEGO 40787 Mario Kart – Spiny Shell is terug</title>
              <meta name="description" content="Korte samenvatting voor verzamelaars." />
              <meta property="article:published_time" content="2026-04-30T08:15:00+02:00" />
              <meta property="og:site_name" content="Brick Example" />
            </head>
            <body>
              <main>
                <article>
                  <h1>LEGO 40787 Mario Kart – Spiny Shell is terug</h1>
                  <p>De blauwe chaosbrenger is terug als Insiders reward en staat weer op de radar van Mario Kart-fans.</p>
                  <p>Prijsinformatie ontbreekt, maar de reward lijkt opnieuw beschikbaar.</p>
                </article>
              </main>
            </body>
          </html>`,
      });

      expect(result.source.title).toContain('LEGO 40787 Mario Kart');
      expect(result.source.description).toBe(
        'Korte samenvatting voor verzamelaars.',
      );
      expect(result.source.siteName).toBe('Brick Example');
      expect(result.source.language).toBe('nl');
      expect(result.source.publishedAt).toBe('2026-04-30T08:15:00+02:00');
      expect(result.extractedText).toContain('De blauwe chaosbrenger is terug');
    });

    it('falls back to document metadata and body text when readability does not find an article', () => {
      const result = extractEditorialAgentArticleSource({
        finalUrl: 'https://example.com/plain-page',
        html: `<!doctype html>
          <html lang="en">
            <head>
              <title>Plain page</title>
              <meta property="og:description" content="Fallback description." />
            </head>
            <body>
              <div>First fallback text.</div>
              <div>Second fallback text.</div>
            </body>
          </html>`,
      });

      expect(result.source.title).toBe('Plain page');
      expect(result.source.description).toBe('Fallback description.');
      expect(result.extractedText).toContain('First fallback text.');
    });

    it('extracts source published date from JSON-LD when meta tags are missing', () => {
      const result = extractEditorialAgentArticleSource({
        finalUrl: 'https://example.com/json-ld-date',
        html: `<!doctype html>
          <html lang="nl">
            <head>
              <title>LEGO nieuws met JSON-LD datum</title>
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  "headline": "LEGO nieuws met JSON-LD datum",
                  "datePublished": "2026-05-01T06:00:00.000Z"
                }
              </script>
            </head>
            <body>
              <article>
                <p>LEGO 40787 Mario Kart Spiny Shell is terug voor verzamelaars.</p>
              </article>
            </body>
          </html>`,
      });

      expect(result.source.publishedAt).toBe('2026-05-01T06:00:00.000Z');
    });

    it('adds a warning for short text and caps extracted text length', () => {
      const longParagraph = 'Mario Kart '.repeat(3_000);
      const result = extractEditorialAgentArticleSource({
        finalUrl: 'https://example.com/long-page',
        html: `<!doctype html>
          <html>
            <head><title>Long page</title></head>
            <body><article><p>${longParagraph}</p></article></body>
          </html>`,
      });

      expect(result.extractedText.length).toBeLessThanOrEqual(16_000);
      expect(result.warnings).toContain(
        'De brontekst is ingekort voordat de fact extraction erop draaide.',
      );
    });

    it('keeps BrickTastic-like long html readable without crashing', () => {
      const longArticleText = `${'LEGO 75446 Grogu and Hover Pram komt in mei 2026 uit. '.repeat(250)}
        ${'LEGO 75447 X-Wing Pilot Helmet volgt in dezelfde maand. '.repeat(180)}`;
      const result = extractEditorialAgentArticleSource({
        finalUrl:
          'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
        html: `<!doctype html>
          <html lang="nl-NL">
            <head>
              <title>Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht • BrickTastic</title>
              <meta name="description" content="Bekijk hier alle nieuwe LEGO-sets die in mei 2026 verschijnen." />
              <meta property="og:site_name" content="BrickTastic" />
              <style>
                :root{--demo:1}.broken{color:red;;;}
              </style>
            </head>
            <body>
              <main>
                <article>
                  <h1>Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht</h1>
                  <p>${longArticleText}</p>
                </article>
              </main>
            </body>
          </html>`,
      });

      expect(result.source.title).toContain(
        'Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht',
      );
      expect(result.source.siteName).toBe('BrickTastic');
      expect(result.extractedText.length).toBeLessThanOrEqual(16_000);
      expect(result.warnings).toContain(
        'De brontekst is ingekort voordat de fact extraction erop draaide.',
      );
    });
  });

  describe('detectEditorialAgentSignals', () => {
    it('detects and dedupes set numbers, themes, rumor signals and euro prices', () => {
      const detected = detectEditorialAgentSignals({
        description: 'De prijs lijkt rond €9,99 te liggen.',
        text: 'LEGO 40787 Mario Kart – Spiny Shell is reportedly terug. 40787 duikt opnieuw op en volgens leaked screenshots kost hij 9,99 euro.',
        title: 'LEGO 40787 Mario Kart – Spiny Shell',
      });

      expect(detected.setNumbers).toEqual(['40787']);
      expect(detected.themes).toContain('Mario Kart');
      expect(detected.keywords).toContain('Spiny Shell');
      expect(detected.rumorSignals).toEqual(
        expect.arrayContaining(['reportedly', 'leaked']),
      );
      expect(detected.prices).toEqual(
        expect.arrayContaining(['€9,99', '9,99 euro']),
      );
    });

    it('does not invent set numbers from non-matching values', () => {
      const detected = detectEditorialAgentSignals({
        description: '',
        text: 'Deze release draait om mei 2026 en een prijszone rond 999 eurocent.',
        title: 'Nieuws zonder setnummer',
      });

      expect(detected.setNumbers).toEqual([]);
    });
  });

  describe('extractEditorialAgentFactsFromUrl', () => {
    it('returns the full contract shape for a fetched article', async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            `<!doctype html>
            <html lang="nl">
              <head>
                <title>LEGO 40787 Mario Kart – Spiny Shell is terug</title>
                <meta name="description" content="Korte samenvatting." />
              </head>
              <body>
                <article>
                  <p>LEGO 40787 Mario Kart – Spiny Shell is terug en kost €9,99.</p>
                </article>
              </body>
            </html>`,
            {
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
              status: 200,
            },
          ),
      );

      const result = await extractEditorialAgentFactsFromUrl({
        fetchImpl: fetchImpl as typeof fetch,
        inputUrl: 'https://example.com/spiny-shell',
      });

      expect(result).toEqual(
        expect.objectContaining({
          detected: expect.any(Object),
          extractedText: expect.any(String),
          extractedTextPreview: expect.any(String),
          facts: expect.any(Object),
          source: expect.any(Object),
          warnings: expect.any(Array),
        }),
      );
      expect(result.source.domain).toBe('example.com');
      expect(result.facts.title).toContain('LEGO 40787 Mario Kart');
      expect(result.facts.setNumbers).toEqual(['40787']);
      expect(result.facts.priceEUR).toBe('€9,99');
      expect(result.matching.articleType).toBe('single_set_news');
      expect(result.matching.matchedSets).toEqual([]);
      expect(result.matching.unmatchedSetNumbers).toEqual(['40787']);
      expect(result.primarySet).toBeNull();
      expect(result.relatedCandidates).toEqual([]);
    });

    it('extracts Brickset 131538 as a real Star Wars multi-set announcement', async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            `<!doctype html>
            <html lang="en">
              <head>
                <title>LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed! | Brickset</title>
                <meta name="description" content="A new up-scaled LEGO minifigure format debuted in 2021 and has since been applied to various characters, now including Darth Vader! 75461 Up-Scaled Darth Vader Minifigure feels overdue, but its execution looks excellent on the whole." />
                <meta property="og:title" content="LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!" />
                <meta property="og:description" content="A new up-scaled LEGO minifigure format debuted in 2021 and has since been applied to various characters, now including Darth Vader! 75461 Up-Scaled Darth Vader Minifigure feels overdue, but its execution looks excellent on the whole." />
                <meta property="og:site_name" content="Brickset.com" />
              </head>
              <body>
                <article>
                  <header>
                    <h1><a href="/article/131538/lego-star-wars-up-scaled-darth-vader-and-at-rt-driver-helmet-revealed!">LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!</a></h1>
                    <small><time datetime="2026-05-03 09:00">03 May 2026 09:00</time></small>
                  </header>
                  <p>A new up-scaled LEGO minifigure format debuted in 2021 and has since been applied to various characters, now including Darth Vader! <a href="https://brickset.com/sets/75461-1/Up-Scaled-Darth-Vader-Minifigure">75461</a> Up-Scaled Darth Vader Minifigure feels overdue, but its execution looks excellent on the whole.</p>
                  <p>In addition, the Helmet Collection endures with <a href="https://brickset.com/sets/75458-1/Imperial-Remnant-AT-RT-Driver-Helmet">75458</a> Imperial Remnant AT-RT Driver Helmet. I am surprised to see the series continue following the introduction of Star Wars busts.</p>
                  <h3><a href="https://brickset.com/sets/75458-1/Imperial-Remnant-AT-RT-Driver-Helmet">75458</a> Imperial Remnant AT-RT Driver Helmet</h3>
                  <h3><a href="https://brickset.com/sets/75461-1/Up-Scaled-Darth-Vader-Minifigure">75461</a> Up-Scaled Darth Vader Minifigure</h3>
                  <section id="comments">
                    <p>A commenter mentions <a href="https://brickset.com/sets/76393-1">76393</a>, but this is not part of the article subject.</p>
                  </section>
                </article>
              </body>
            </html>`,
            {
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
              status: 200,
            },
          ),
      );
      const catalog = new Map([
        [
          '75461',
          {
            id: '75461',
            name: 'Up-Scaled Darth Vader Minifigure',
            slug: 'up-scaled-darth-vader-minifigure-75461',
            theme: 'Star Wars',
          },
        ],
        [
          '75458',
          {
            id: '75458',
            name: 'Imperial Remnant AT-RT Driver Helmet',
            slug: 'imperial-remnant-at-rt-driver-helmet-75458',
            theme: 'Star Wars',
          },
        ],
      ]);

      const result = await extractEditorialAgentFactsFromUrl({
        fetchImpl: fetchImpl as typeof fetch,
        findCatalogSetSummaryById: vi.fn(async (setId: string) =>
          catalog.get(setId),
        ),
        inputUrl: 'http://brickset.com/article/131538',
      });

      expect(fetchImpl).toHaveBeenCalledWith(
        'https://brickset.com/article/131538',
        expect.any(Object),
      );
      expect(result.detected.setNumbers).toEqual(['75461', '75458']);
      expect(result.matching.matchedSets.map((set) => set.setNumber)).toEqual([
        '75461',
        '75458',
      ]);
      expect(result.matching.articleType).toBe('multi_set_announcement');
      expect(result.primarySet?.setNumber).toBe('75461');
      expect(result.relatedCandidates.map((set) => set.setNumber)).toEqual([
        '75458',
      ]);

      const draftResult = await generateEditorialAgentDraftResult({
        extraction: result,
        useAiRewrite: false,
      });

      expect(draftResult.output.mdx).not.toContain('Conceptdraft');
      expect(draftResult.output.mdx).not.toContain('Gebruik deze draft');
      expect(draftResult.output.mdx).toContain(
        '<FeaturedSet setNumber="75461" />',
      );
      expect(draftResult.output.frontmatter.theme).toBe('Star Wars');
      expect(draftResult.output.frontmatter.description).toContain(
        'Up-Scaled Darth Vader Minifigure',
      );
      expect(draftResult.output.frontmatter.description).toContain(
        'Imperial Remnant AT-RT Driver Helmet',
      );
      expect(draftResult.output.mdx).toContain('Imperial, Rebel of trooper');
      expect(draftResult.output.mdx).not.toMatch(
        /\b(?:We have|This set|The model|In addition|I am surprised)\b/u,
      );
    });

    it('keeps extraction alive when catalog matching throws', async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            `<!doctype html>
            <html lang="nl">
              <head>
                <title>Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht</title>
                <meta name="description" content="Release-overzicht voor mei 2026." />
              </head>
              <body>
                <article>
                  <p>LEGO 75446 Grogu and Hover Pram en LEGO 75447 X-Wing Pilot Helmet verschijnen in mei 2026.</p>
                </article>
              </body>
            </html>`,
            {
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
              status: 200,
            },
          ),
      );

      const result = await extractEditorialAgentFactsFromUrl({
        fetchImpl: fetchImpl as typeof fetch,
        findCatalogSetSummaryById: vi.fn(async () => {
          throw new Error('Catalog offline');
        }),
        inputUrl:
          'https://www.bricktastic.nl/lego/deze-nieuwe-lego-sets-worden-in-mei-2026-uitgebracht/',
      });

      expect(result.matching.matchedSets).toEqual([]);
      expect(result.matching.unmatchedSetNumbers).toEqual(['75446', '75447']);
      expect(result.warnings).toContain(
        'Catalog matching kon niet volledig worden uitgevoerd; deze analyse gebruikt alleen de extraction-signalen.',
      );
    });

    it('builds uncertain claims from detected rumor signals', () => {
      const facts = buildEditorialAgentFacts({
        description: '',
        detected: {
          dateSignals: [],
          keywords: ['Mario Kart'],
          prices: [],
          rumorSignals: ['rumor'],
          setNumbers: ['40787'],
          themes: ['Mario Kart'],
        },
        extractedText:
          'Volgens rumor posts zou LEGO 40787 opnieuw beschikbaar komen. Dat blijft voorlopig speculatie.',
        title: 'LEGO 40787 Mario Kart – Spiny Shell',
      });

      expect(facts.isRumor).toBe(true);
      expect(facts.uncertainClaims[0]).toContain('rumor');
    });

    it('keeps dotted abbreviation set names intact when extracting facts', () => {
      const facts = buildEditorialAgentFacts({
        description:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld. De robot verschijnt later.',
        detected: {
          dateSignals: [],
          keywords: ['Marvel'],
          prices: [],
          rumorSignals: [],
          setNumbers: ['76339'],
          themes: ['Marvel'],
        },
        extractedText:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
        title:
          'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
      });

      expect(facts.setNames).toEqual(['The Fantastic Four H.E.R.B.I.E.']);
      expect(facts.summary).toBe(
        'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
      );
    });

    it('keeps droid names with digits and hyphens intact when extracting facts', () => {
      const facts = buildEditorialAgentFacts({
        description:
          'LEGO Star Wars 75379 R2-D2 verschijnt opnieuw. De set krijgt een displayplaatje.',
        detected: {
          dateSignals: [],
          keywords: ['Star Wars'],
          prices: [],
          rumorSignals: [],
          setNumbers: ['75379'],
          themes: ['Star Wars'],
        },
        extractedText: 'LEGO Star Wars 75379 R2-D2 verschijnt opnieuw.',
        title: 'LEGO Star Wars 75379 R2-D2 verschijnt opnieuw',
      });

      expect(facts.setNames).toEqual(['R2-D2']);
      expect(facts.summary).toBe(
        'LEGO Star Wars 75379 R2-D2 verschijnt opnieuw.',
      );
    });

    it('still extracts the first regular sentence for normal copy', () => {
      const facts = buildEditorialAgentFacts({
        description:
          'LEGO 40787 Mario Kart Spiny Shell is terug. Pak hem als je punten hebt.',
        detected: {
          dateSignals: [],
          keywords: ['Mario Kart'],
          prices: [],
          rumorSignals: [],
          setNumbers: ['40787'],
          themes: ['Mario Kart'],
        },
        extractedText: 'LEGO 40787 Mario Kart Spiny Shell is terug.',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
      });

      expect(facts.summary).toBe('LEGO 40787 Mario Kart Spiny Shell is terug.');
    });
  });

  describe('AI rewrite draft generation', () => {
    it('keeps the deterministic draft when ai rewrite is disabled', async () => {
      const extraction = createDraftExtractionResult();
      const result = await generateEditorialAgentDraftResult({
        extraction,
        useAiRewrite: false,
      });

      expect(result.rewrite.enabled).toBe(false);
      expect(result.rewrite.applied).toBe(false);
      expect(result.rewrittenDraft).toBeNull();
      expect(result.output.mdx).toBe(result.deterministicDraft.mdx);
    });

    it('applies ai rewrite when the returned mdx changes text but keeps structure intact', async () => {
      const extraction = createDraftExtractionResult();
      const deterministicDraft = generateEditorialMdxDraft(extraction);
      const rewrittenMdx = deterministicDraft.mdx.replace(
        'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
        'Dit zijn de sets uit deze releasegolf waar je nu meteen even doorheen wilt scrollen.',
      );
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              output_text: rewrittenMdx,
            }),
            {
              headers: {
                'content-type': 'application/json',
              },
              status: 200,
            },
          ),
      );

      const result = await rewriteDraftWithAI({
        apiKey: 'test-key',
        deterministicDraft,
        fetchImpl: fetchImpl as typeof fetch,
        input: extraction,
        useAiRewrite: true,
      });

      expect(result.rewrite.enabled).toBe(true);
      expect(result.rewrite.applied).toBe(true);
      expect(result.rewrittenDraft?.mdx).toBe(
        rewrittenMdx.endsWith('\n') ? rewrittenMdx : `${rewrittenMdx}\n`,
      );
      expect(result.output.mdx).toContain(
        'waar je nu meteen even doorheen wilt scrollen',
      );
    });

    it('cleans English prose from deterministic fallback output', async () => {
      const extraction = createDraftExtractionResult();
      const deterministicDraft = {
        ...generateEditorialMdxDraft(extraction),
        mdx: generateEditorialMdxDraft(extraction).mdx.replace(
          'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
          'We have already seen Darth Vader and Imperial Lambda-Class Shuttle this week. This set features Darth Vader.',
        ),
      };

      const result = await rewriteDraftWithAI({
        deterministicDraft,
        input: extraction,
        useAiRewrite: false,
      });

      expect(result.output.mdx).toContain(
        'We zagen de afgelopen dagen al meerdere interessante LEGO Star Wars-onthullingen langskomen.',
      );
      expect(result.output.mdx).not.toMatch(/\b(?:We have|This set)\b/u);
      expect(result.output.mdx).not.toContain('Donkere Vader');
      expect(result.output.warnings).toContain(
        'Engelse bronzinnen zijn automatisch naar Nederlands opgeschoond.',
      );
    });

    it('cleans English prose from accepted AI rewrite output', async () => {
      const extraction = createDraftExtractionResult();
      const deterministicDraft = generateEditorialMdxDraft(extraction);
      const rewrittenMdx = deterministicDraft.mdx.replace(
        'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
        'We have already seen Darth Vader and Imperial Lambda-Class Shuttle this week. The model includes display value.',
      );
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              output_text: rewrittenMdx,
            }),
            {
              headers: {
                'content-type': 'application/json',
              },
              status: 200,
            },
          ),
      );

      const result = await rewriteDraftWithAI({
        apiKey: 'test-key',
        deterministicDraft,
        fetchImpl: fetchImpl as typeof fetch,
        input: extraction,
        useAiRewrite: true,
      });

      expect(result.rewrite.applied).toBe(true);
      expect(result.output.mdx).toContain(
        'We zagen de afgelopen dagen al meerdere interessante LEGO Star Wars-onthullingen langskomen.',
      );
      expect(result.output.mdx).not.toMatch(/\b(?:We have|The model)\b/u);
      expect(result.output.mdx).not.toContain('Donkere Vader');
      expect(result.rewrite.warnings).toContain(
        'Engelse AI-zinnen zijn automatisch naar Nederlands opgeschoond.',
      );
    });

    it('applies ai rewrite when only harmless frontmatter fields change', async () => {
      const extraction = createDraftExtractionResult();
      const deterministicDraft = generateEditorialMdxDraft(extraction);
      const rewrittenMdx = deterministicDraft.mdx
        .replace(
          'title: "Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht"',
          'title: "AI probeerde een andere titel"',
        )
        .replace('theme: "Multiple"', 'theme: "Star Wars"')
        .replace(
          'Dit zijn de sets uit deze releasegolf die nu al leuk genoeg zijn om even rustig doorheen te klikken.',
          'Dit zijn de sets uit deze releasegolf waar je als fan even voor blijft hangen.',
        );
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              output_text: rewrittenMdx,
            }),
            {
              headers: {
                'content-type': 'application/json',
              },
              status: 200,
            },
          ),
      );

      const result = await rewriteDraftWithAI({
        apiKey: 'test-key',
        deterministicDraft,
        fetchImpl: fetchImpl as typeof fetch,
        input: extraction,
        useAiRewrite: true,
      });

      expect(result.rewrite.enabled).toBe(true);
      expect(result.rewrite.applied).toBe(true);
      expect(result.rewrittenDraft?.frontmatter).toEqual(
        deterministicDraft.frontmatter,
      );
      expect(result.output.mdx).toContain(
        'title: "Deze nieuwe LEGO-sets worden in mei 2026 uitgebracht"',
      );
      expect(result.output.mdx).toContain('theme: "Multiple"');
      expect(result.output.mdx).toContain(
        'waar je als fan even voor blijft hangen',
      );
      expect(result.output.mdx).not.toContain('AI probeerde een andere titel');
    });

    it('falls back to the deterministic draft when ai output changes component setIds', async () => {
      const extraction = createDraftExtractionResult();
      const deterministicDraft = generateEditorialMdxDraft(extraction);
      const invalidRewrite = deterministicDraft.mdx.replace(
        'setIds="43287, 75442"',
        'setIds="43287, 99999"',
      );
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              output_text: invalidRewrite,
            }),
            {
              headers: {
                'content-type': 'application/json',
              },
              status: 200,
            },
          ),
      );

      const result = await generateEditorialAgentDraftResult({
        apiKey: 'test-key',
        extraction,
        fetchImpl: fetchImpl as typeof fetch,
        useAiRewrite: true,
      });

      expect(result.rewrite.enabled).toBe(true);
      expect(result.rewrite.applied).toBe(false);
      expect(result.rewrittenDraft).toBeNull();
      expect(result.output.mdx).toBe(deterministicDraft.mdx);
      expect(result.output.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('AI polish werd afgekeurd'),
        ]),
      );
    });
  });

  describe('targeted catalog import before draft generation', () => {
    it('imports a missing set and rematches it before draft generation', async () => {
      const extraction = {
        ...createDraftExtractionResult(),
        detected: {
          ...createDraftExtractionResult().detected,
          setNumbers: ['40926'],
        },
        facts: {
          ...createDraftExtractionResult().facts,
          setNumbers: ['40926'],
          theme: 'LEGO',
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 juni 2026',
        },
        matching: {
          articleType: 'single_set_news' as const,
          matchedSets: [],
          unmatchedSetNumbers: ['40926'],
        },
        primarySet: null,
        relatedCandidates: [],
        source: {
          ...createDraftExtractionResult().source,
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 juni 2026',
        },
      };
      const importedCatalogSummary = {
        id: '40926',
        name: 'SEGA Genesis (Mega Drive)',
        slug: 'sega-genesis-mega-drive-40926',
        theme: 'Sonic The Hedgehog',
      };
      let imported = false;
      const findCatalogSetSummaryById = vi.fn(async () =>
        imported ? importedCatalogSummary : undefined,
      );

      const prepared = await prepareEditorialAgentExtractionForDraft({
        extraction,
        findCatalogSetSummaryById,
        importCatalogSetByNumber: vi.fn(async () => {
          imported = true;

          return importedCatalogSummary;
        }),
        importMissingSets: true,
      });
      const draftResult = await generateEditorialAgentDraftResult({
        catalogImport: prepared.catalogImport,
        extraction: prepared.extraction,
        useAiRewrite: false,
      });

      expect(prepared.catalogImport.importedSets).toEqual([
        expect.objectContaining({
          setNumber: '40926',
          theme: 'Sonic The Hedgehog',
        }),
      ]);
      expect(prepared.extraction.primarySet).toEqual(
        expect.objectContaining({
          setNumber: '40926',
        }),
      );
      expect(draftResult.deterministicDraft.mdx).toContain(
        '<FeaturedSet setNumber="40926" />',
      );
    });

    it('rebuilds stale multi-set analysis before drafting so context sets are not primary', async () => {
      const extraction = {
        ...createDraftExtractionResult(),
        detected: {
          ...createDraftExtractionResult().detected,
          keywords: ['Ideas'],
          setNumbers: ['21330', '99991', '99992'],
          themes: ['Ideas'],
        },
        facts: {
          ...createDraftExtractionResult().facts,
          keywords: ['Ideas'],
          setNames: ['Home Alone'],
          setNumbers: ['21330', '99991', '99992'],
          summary:
            'LEGO Ideas heeft meerdere projecten goedgekeurd. Home Alone wordt alleen als eerdere Ideas-set genoemd.',
          theme: 'Ideas',
          title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
        },
        matching: {
          articleType: 'multi_set_announcement' as const,
          matchedSets: [
            {
              id: '21330',
              name: 'Home Alone',
              setNumber: '21330',
              slug: 'home-alone-21330',
              theme: 'Ideas',
            },
          ],
          unmatchedSetNumbers: [],
        },
        primarySet: {
          id: '21330',
          name: 'Home Alone',
          reason: 'first_detected' as const,
          setNumber: '21330',
          slug: 'home-alone-21330',
          theme: 'Ideas',
        },
        relatedCandidates: [],
        source: {
          ...createDraftExtractionResult().source,
          description:
            'Home Alone wordt genoemd als voorbeeld van een eerder verschenen LEGO Ideas-set.',
          title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
        },
      };

      const prepared = await prepareEditorialAgentExtractionForDraft({
        extraction,
        findCatalogSetSummaryById: vi.fn(async (setId: string) =>
          setId === '21330'
            ? {
                id: '21330',
                name: 'Home Alone',
                slug: 'home-alone-21330',
                theme: 'Ideas',
              }
            : undefined,
        ),
        importMissingSets: true,
      });
      const draftResult = await generateEditorialAgentDraftResult({
        catalogImport: prepared.catalogImport,
        extraction: prepared.extraction,
        useAiRewrite: false,
      });

      expect(prepared.extraction.matching.articleType).toBe(
        'multi_set_announcement',
      );
      expect(prepared.extraction.primarySet).toBeNull();
      expect(draftResult.output.frontmatter.theme).toBe('Ideas');
      expect(draftResult.output.frontmatter.description).not.toContain(
        'Home Alone',
      );
      expect(draftResult.output.mdx).not.toContain('Home Alone');
      expect(draftResult.output.mdx).not.toContain('<FeaturedSet');
    });

    it('keeps a missing set out of the draft and returns a warning when import fails', async () => {
      const extraction = {
        ...createDraftExtractionResult(),
        detected: {
          ...createDraftExtractionResult().detected,
          setNumbers: ['40926'],
        },
        facts: {
          ...createDraftExtractionResult().facts,
          setNumbers: ['40926'],
          theme: 'LEGO',
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 juni 2026',
        },
        matching: {
          articleType: 'single_set_news' as const,
          matchedSets: [],
          unmatchedSetNumbers: ['40926'],
        },
        primarySet: null,
        relatedCandidates: [],
        source: {
          ...createDraftExtractionResult().source,
          title: 'LEGO 40926 SEGA Genesis verschijnt op 1 juni 2026',
        },
      };

      const prepared = await prepareEditorialAgentExtractionForDraft({
        extraction,
        findCatalogSetSummaryById: vi.fn(async () => undefined),
        importCatalogSetByNumber: vi.fn(async () => {
          throw new Error('not found');
        }),
        importMissingSets: true,
      });
      const draftResult = await generateEditorialAgentDraftResult({
        catalogImport: prepared.catalogImport,
        extraction: prepared.extraction,
        useAiRewrite: false,
      });

      expect(prepared.catalogImport.warnings).toContain(
        'Set 40926 is genoemd in de bron, maar staat nog niet in de catalogus.',
      );
      expect(prepared.extraction.primarySet).toBeNull();
      expect(draftResult.deterministicDraft.mdx).not.toContain(
        '<FeaturedSet setNumber="40926" />',
      );
      expect(draftResult.deterministicDraft.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('40926')]),
      );
    });
  });

  describe('matching and event helpers', () => {
    it('matches exact set numbers and keeps unmatched values separate', async () => {
      const result = await matchSetsToCatalog({
        detectedSetNumbers: ['40787', '72050', '40787'],
        findCatalogSetSummaryById: vi.fn(async (setId: string) =>
          setId === '40787'
            ? {
                id: '40787',
                name: 'Mario Kart – Spiny Shell',
                slug: 'mario-kart-spiny-shell-40787',
                theme: 'Super Mario',
              }
            : undefined,
        ),
      });

      expect(result.matched).toEqual([
        expect.objectContaining({
          name: 'Mario Kart – Spiny Shell',
          setNumber: '40787',
        }),
      ]);
      expect(result.unmatched).toEqual(['72050']);
    });

    it('finds existing events from the in-memory store', () => {
      const fingerprint = {
        key: '40787',
        type: 'gwp_reward' as const,
      };

      expect(findExistingEvent(fingerprint)).toBe(false);
      rememberEditorialAgentEvent(fingerprint);
      expect(findExistingEvent(fingerprint)).toBe(true);
    });
  });
});
