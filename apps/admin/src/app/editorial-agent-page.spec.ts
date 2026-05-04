import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ContentAdminArticlePublishError,
  ContentAdminEditorialAgentApiService,
  ContentAdminEditorialAgentPageComponent,
} from '@lego-platform/content/feature-admin';
import type {
  EditorialAgentDraftGenerationResult,
  EditorialFeedItem,
  EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createExtractionResult(): EditorialAgentFactExtractionResult {
  return {
    detected: {
      dateSignals: ['1 mei 2026'],
      keywords: ['Mario Kart', 'Spiny Shell'],
      prices: ['€9,99'],
      rumorSignals: [],
      setNumbers: ['40787'],
      themes: ['Mario Kart', 'Super Mario'],
    },
    extractedText:
      'De Spiny Shell is opnieuw beschikbaar als LEGO Insiders Reward.',
    extractedTextPreview:
      'De Spiny Shell is opnieuw beschikbaar als LEGO Insiders Reward.',
    event: {
      exists: false,
      fingerprint: {
        key: '40787',
        type: 'gwp_reward',
      },
    },
    facts: {
      isRumor: false,
      keyPoints: [],
      keywords: ['Mario Kart', 'Spiny Shell'],
      priceEUR: '€9,99',
      releaseDate: '1 mei 2026',
      setNames: ['Mario Kart – Spiny Shell'],
      setNumbers: ['40787'],
      summary:
        'De Spiny Shell is opnieuw beschikbaar als LEGO Insiders Reward.',
      theme: 'Super Mario',
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      uncertainClaims: [],
    },
    matching: {
      articleType: 'gwp_reward',
      matchedSets: [
        {
          id: '40787',
          name: 'Mario Kart – Spiny Shell',
          setNumber: '40787',
          slug: 'mario-kart-spiny-shell-40787',
          theme: 'Super Mario',
        },
      ],
      unmatchedSetNumbers: ['72050'],
    },
    primarySet: {
      id: '40787',
      name: 'Mario Kart – Spiny Shell',
      reason: 'single_set',
      setNumber: '40787',
      slug: 'mario-kart-spiny-shell-40787',
      theme: 'Super Mario',
    },
    relatedCandidates: [
      {
        id: '72037',
        name: 'Mario Kart - Mario & Standard Kart',
        reason: 'same_article',
        setNumber: '72037',
        slug: 'mario-standard-kart-72037',
        theme: 'Super Mario',
      },
      {
        id: '72050',
        name: 'Mario Kart - Baby Peach & Grand Prix Set',
        reason: 'same_article',
        setNumber: '72050',
        slug: 'baby-peach-grand-prix-72050',
        theme: 'Super Mario',
      },
    ],
    source: {
      byline: '',
      canonicalUrl: 'https://example.com/example',
      description: 'Korte samenvatting.',
      domain: 'example.com',
      extractedAt: '2026-05-01T08:00:00.000Z',
      finalUrl: 'https://example.com/example',
      inputUrl: 'https://example.com/example',
      language: 'nl',
      siteName: 'Brick Example',
      textLength: 1200,
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
    },
    warnings: [
      'De bruikbare tekst is kort; controleer of de bron genoeg artikelinhoud bevat.',
    ],
  };
}

function createDraftResult(): EditorialAgentDraftGenerationResult {
  return {
    catalogImport: {
      attempted: true,
      attemptedSetNumbers: ['72050'],
      enabled: true,
      importedSets: [
        {
          id: '72050',
          name: 'Mario Kart - Baby Peach & Grand Prix Set',
          setNumber: '72050',
          slug: 'baby-peach-grand-prix-72050',
          theme: 'Super Mario',
        },
      ],
      stillMissingSetNumbers: [],
      warnings: [],
    },
    deterministicDraft: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte samenvatting.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/example',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\nstatus: "draft"\n---\n\n## Wanneer kopen?\n\nDeterministic versie.\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [
        {
          name: 'Mario Kart - Mario & Standard Kart',
          reason: 'Zelfde artikel.',
          setNumber: '72037',
        },
      ],
      warnings: [],
    },
    effectiveExtraction: {
      ...createExtractionResult(),
      matching: {
        ...createExtractionResult().matching,
        unmatchedSetNumbers: [],
      },
      warnings: [...createExtractionResult().warnings],
    },
    output: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte samenvatting.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/example',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\nstatus: "draft"\n---\n\n## Wanneer kopen?\n\nPak hem nu als je de punten al hebt.\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [
        {
          name: 'Mario Kart - Mario & Standard Kart',
          reason: 'Zelfde artikel.',
          setNumber: '72037',
        },
      ],
      warnings: [],
    },
    rewrite: {
      applied: true,
      enabled: true,
      warnings: [],
    },
    rewrittenDraft: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte samenvatting.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/example',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\nstatus: "draft"\n---\n\n## Wanneer kopen?\n\nPak hem nu als je de punten al hebt.\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [
        {
          name: 'Mario Kart - Mario & Standard Kart',
          reason: 'Zelfde artikel.',
          setNumber: '72037',
        },
      ],
      warnings: [],
    },
  };
}

function createDraftResultForSource({
  sourceUrl,
  title,
}: {
  sourceUrl: string;
  title: string;
}): EditorialAgentDraftGenerationResult {
  const draftResult = createDraftResult();
  const mdx = [
    '---',
    `title: "${title}"`,
    `sourceUrl: "${sourceUrl}"`,
    'status: "draft"',
    '---',
    '',
    '## Wat is er aangekondigd?',
    '',
    `${title}.`,
  ].join('\n');

  draftResult.output = {
    ...draftResult.output,
    frontmatter: {
      ...draftResult.output.frontmatter,
      sourceUrl,
      title,
    },
    mdx,
  };
  draftResult.deterministicDraft = {
    ...draftResult.deterministicDraft,
    frontmatter: {
      ...draftResult.deterministicDraft.frontmatter,
      sourceUrl,
      title,
    },
    mdx,
  };
  draftResult.rewrittenDraft = draftResult.rewrittenDraft
    ? {
        ...draftResult.rewrittenDraft,
        frontmatter: {
          ...draftResult.rewrittenDraft.frontmatter,
          sourceUrl,
          title,
        },
        mdx,
      }
    : null;
  draftResult.effectiveExtraction = {
    ...draftResult.effectiveExtraction,
    source: {
      ...draftResult.effectiveExtraction.source,
      canonicalUrl: sourceUrl,
      finalUrl: sourceUrl,
      inputUrl: sourceUrl,
      title,
    },
  };

  return draftResult;
}

function createBricksetFeedItem(): EditorialFeedItem {
  return {
    createdAt: '2026-05-03T10:00:00.000Z',
    feedName: 'Brickset',
    id: 'feed-item-brickset-131538',
    sourceUrl: 'https://brickset.com/article/131538',
    status: 'new',
    title:
      'LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!',
    updatedAt: '2026-05-03T10:00:00.000Z',
  };
}

function clickButtonContaining(
  fixture: ComponentFixture<ContentAdminEditorialAgentPageComponent>,
  label: string,
): void {
  const button = fixture.debugElement
    .queryAll(By.css('button'))
    .find((nextButton) =>
      (nextButton.nativeElement.textContent || '').includes(label),
    );

  button?.nativeElement.click();
  fixture.detectChanges();
}

function expectElementAfter(
  laterElement: Element | null | undefined,
  earlierElement: Element | null | undefined,
): void {
  expect(laterElement).not.toBeNull();
  expect(earlierElement).not.toBeNull();
  if (!laterElement || !earlierElement) {
    return;
  }
  expect(
    Boolean(
      earlierElement.compareDocumentPosition(laterElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBe(true);
}

describe('Editorial agent admin page', () => {
  const editorialAgentApi = {
    extractSourceFacts: vi.fn(async () => createExtractionResult()),
    createArticlePreview: vi.fn(async () => ({
      previewId: '00000000-0000-4000-8000-000000000001',
      previewUrl:
        'http://localhost:3000/artikelen/preview/00000000-0000-4000-8000-000000000001',
    })),
    getPublishedArticle: vi.fn(async () => ({
      date: '2026-05-01',
      description: 'Een korte beschrijving.',
      frontmatter: {
        date: '2026-05-01',
        description: 'Een korte beschrijving.',
        heroImage: '',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      heroImage: '',
      mdx: '## Wanneer kiezen?\n\nPak hem als je de punten al hebt.',
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      status: 'published',
      theme: 'Super Mario',
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      updatedAt: '2026-05-03T10:00:00.000Z',
    })),
    deletePublishedArticle: vi.fn(async () => ({
      clearedFeedItems: 1,
      deletedArticle: true,
      deletedEvents: 2,
      deletedPreviews: 1,
      deletedStorageObjects: 3,
    })),
    generateDraftForFeedItem: vi.fn(async () => ({
      draftResult: createDraftResult(),
      feedItem: {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brick Example',
        id: 'feed-item-1',
        sourceUrl: 'https://example.com/example',
        status: 'drafted',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    })),
    generateDraft: vi.fn(async () => createDraftResult()),
    getRuntimeConfig: vi.fn(async () => ({
      articlePreviewEnabled: false,
    })),
    ignoreFeedItem: vi.fn(),
    listFeedItems: vi.fn(async (): Promise<readonly EditorialFeedItem[]> => []),
    listPublishedArticles: vi.fn(async () => [
      {
        date: '2026-05-01',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]),
    publishArticle: vi.fn(async () => ({
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    })),
    syncFeed: vi.fn(async () => ({
      inserted: 0,
      items: [],
      skipped: 0,
      total: 0,
    })),
    updatePublishedArticle: vi.fn(async () => ({
      date: '2026-05-02',
      description: 'Nieuwe beschrijving.',
      frontmatter: {
        date: '2026-05-02',
        description: 'Nieuwe beschrijving.',
        heroImage:
          'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        theme: 'Super Mario',
        title: 'Nieuwe titel',
      },
      heroImage:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
      mdx: '## Nieuwe heading\n\nNieuwe copy.',
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      status: 'published',
      theme: 'Super Mario',
      title: 'Nieuwe titel',
      updatedAt: '2026-05-03T11:00:00.000Z',
    })),
    uploadHeroImage: vi.fn(async () => ({
      publicUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
    })),
    uploadArticleImage: vi.fn(async () => ({
      imageCredit: 'Beeld: © The LEGO Group',
      imageUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp',
      publicUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp',
    })),
    importHeroImageFromUrl: vi.fn(async () => ({
      heroImage:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
      heroImageCredit: 'Beeld: © The LEGO Group',
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    editorialAgentApi.createArticlePreview.mockResolvedValue({
      previewId: '00000000-0000-4000-8000-000000000001',
      previewUrl:
        'http://localhost:3000/artikelen/preview/00000000-0000-4000-8000-000000000001',
    });
    editorialAgentApi.getRuntimeConfig.mockResolvedValue({
      articlePreviewEnabled: false,
    });
    editorialAgentApi.extractSourceFacts.mockResolvedValue(
      createExtractionResult(),
    );
    editorialAgentApi.getPublishedArticle.mockResolvedValue({
      date: '2026-05-01',
      description: 'Een korte beschrijving.',
      frontmatter: {
        date: '2026-05-01',
        description: 'Een korte beschrijving.',
        heroImage: '',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      heroImage: '',
      mdx: '## Wanneer kiezen?\n\nPak hem als je de punten al hebt.',
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      status: 'published',
      theme: 'Super Mario',
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      updatedAt: '2026-05-03T10:00:00.000Z',
    });
    editorialAgentApi.deletePublishedArticle.mockResolvedValue({
      clearedFeedItems: 1,
      deletedArticle: true,
      deletedEvents: 2,
      deletedPreviews: 1,
      deletedStorageObjects: 3,
    });
    editorialAgentApi.generateDraft.mockResolvedValue(createDraftResult());
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValue({
      draftResult: createDraftResult(),
      feedItem: {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brick Example',
        id: 'feed-item-1',
        sourceUrl: 'https://example.com/example',
        status: 'drafted',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    });
    editorialAgentApi.listFeedItems.mockResolvedValue([]);
    editorialAgentApi.listPublishedArticles.mockResolvedValue([
      {
        date: '2026-05-01',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);
    editorialAgentApi.publishArticle.mockResolvedValue({
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });
    editorialAgentApi.syncFeed.mockResolvedValue({
      inserted: 0,
      items: [],
      skipped: 0,
      total: 0,
    });
    editorialAgentApi.updatePublishedArticle.mockResolvedValue({
      date: '2026-05-02',
      description: 'Nieuwe beschrijving.',
      frontmatter: {
        date: '2026-05-02',
        description: 'Nieuwe beschrijving.',
        heroImage:
          'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        status: 'published',
        theme: 'Super Mario',
        title: 'Nieuwe titel',
      },
      heroImage:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
      mdx: '## Nieuwe heading\n\nNieuwe copy.',
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      status: 'published',
      theme: 'Super Mario',
      title: 'Nieuwe titel',
      updatedAt: '2026-05-03T11:00:00.000Z',
    });
    editorialAgentApi.uploadHeroImage.mockResolvedValue({
      publicUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
    });
    editorialAgentApi.uploadArticleImage.mockResolvedValue({
      imageCredit: 'Beeld: © The LEGO Group',
      imageUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp',
      publicUrl:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp',
    });
    editorialAgentApi.importHeroImageFromUrl.mockResolvedValue({
      heroImage:
        'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
      heroImageCredit: 'Beeld: © The LEGO Group',
    });
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders tabs and switches between admin workflows', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nieuwe feed items');
    expect(fixture.nativeElement.textContent).toContain('Geen feed items');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Bron en extractie',
    );

    clickButtonContaining(fixture, 'Handmatig artikel maken');

    expect(fixture.nativeElement.textContent).toContain('Bron en extractie');
    expect(fixture.nativeElement.textContent).not.toContain('Geen feed items');

    clickButtonContaining(fixture, 'Gepubliceerde artikelen');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Published articles');
    });
  });

  it('analyses a url and shows extracted source facts while keeping draft mdx output', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    fixture.detectChanges();
    clickButtonContaining(fixture, 'Handmatig artikel maken');
    fixture.componentInstance.sourceUrl.set('https://example.com/example');
    fixture.detectChanges();
    clickButtonContaining(fixture, 'Analyseer URL');

    expect(fixture.nativeElement.textContent).toContain('Analyse draait');

    await vi.waitFor(() => {
      fixture.detectChanges();

      const textarea = fixture.nativeElement.querySelector(
        '[role="dialog"] textarea',
      ) as HTMLTextAreaElement | null;

      expect(textarea?.value).toContain('status: "draft"');
      expect(textarea?.value).toContain('Pak hem nu als je de punten al hebt.');
    });

    expect(fixture.nativeElement.textContent).toContain(
      'LEGO 40787 Mario Kart – Spiny Shell is terug',
    );
    expect(fixture.nativeElement.textContent).toContain('gwp_reward');
    expect(fixture.nativeElement.textContent).toContain(
      'Mario Kart – Spiny Shell',
    );
    expect(fixture.nativeElement.textContent).toContain('72050');

    clickButtonContaining(fixture, 'Debug');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Generation warnings');
    expect(fixture.nativeElement.textContent).toContain('AI polish');
    expect(fixture.nativeElement.textContent).toContain('Rewrite toegepast');
    expect(fixture.nativeElement.textContent).toContain(
      'Deterministic origineel',
    );
    expect(fixture.nativeElement.textContent).toContain('AI-polished versie');
    expect(fixture.nativeElement.textContent).toContain(
      'De bruikbare tekst is kort; controleer of de bron genoeg artikelinhoud bevat.',
    );
    expect(editorialAgentApi.extractSourceFacts).toHaveBeenCalledWith(
      'https://example.com/example',
    );
    expect(editorialAgentApi.generateDraft).toHaveBeenCalledWith(
      createExtractionResult(),
      true,
      true,
    );

    clickButtonContaining(fixture, 'Sets');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Importstatus');
    expect(fixture.nativeElement.textContent).toContain(
      'Mario Kart - Baby Peach & Grand Prix Set',
    );
  });

  it('shows a safe error state when extraction fails', async () => {
    editorialAgentApi.extractSourceFacts.mockRejectedValueOnce(
      new Error('Voer een geldige bron-URL in.'),
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    fixture.detectChanges();
    clickButtonContaining(fixture, 'Handmatig artikel maken');
    clickButtonContaining(fixture, 'Analyseer URL');

    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Voer een geldige bron-URL in.',
    );
  });

  it('shows feed items and generates a draft manually', async () => {
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brick Example',
        id: 'feed-item-1',
        sourceUrl: 'https://example.com/example',
        status: 'new',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'LEGO 40787 Mario Kart – Spiny Shell is terug',
      );
    });

    const draftButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Genereer draft'),
      );

    draftButton?.nativeElement.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const textarea = fixture.nativeElement.querySelector(
        '[role="dialog"] textarea',
      ) as HTMLTextAreaElement | null;

      expect(textarea?.value).toContain('Pak hem nu als je de punten al hebt.');
    });

    expect(editorialAgentApi.generateDraftForFeedItem).toHaveBeenCalledWith(
      'feed-item-1',
      true,
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('Draft preview');

    const closeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Sluit draft preview"]',
    ) as HTMLButtonElement | null;

    closeButton?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows Editorial Fit scores in the feed inbox without generating drafts', async () => {
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'feed-item-star-wars',
        sourceUrl: 'https://brickset.com/article/75458',
        status: 'new',
        title:
          'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed!',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Fit');
    });

    const fitSummary = fixture.nativeElement.querySelector(
      '.editorial-agent__fit-score--good summary',
    ) as HTMLElement | null;

    expect(fitSummary?.textContent).toContain('100');
    expect(fixture.nativeElement.textContent).toContain(
      'Imperial Remnant AT-RT Driver Helmet',
    );
    expect(editorialAgentApi.generateDraftForFeedItem).not.toHaveBeenCalled();
    expect(editorialAgentApi.generateDraft).not.toHaveBeenCalled();
  });

  it('scores a strong single-set Star Wars reveal high', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const score = fixture.componentInstance.getEditorialFitScore({
      createdAt: '2026-05-03T10:00:00.000Z',
      feedName: 'Brickset',
      id: 'feed-item-star-wars',
      sourceUrl: 'https://brickset.com/article/75458',
      status: 'new',
      title:
        'LEGO Star Wars 75458 Imperial Remnant AT-RT Driver Helmet revealed!',
      updatedAt: '2026-05-03T10:00:00.000Z',
    });

    expect(score.score).toBeGreaterThanOrEqual(80);
    expect(score.tone).toBe('good');
    expect(score.positiveReasons).toContain('Exact setnummer gevonden');
    expect(score.positiveReasons).toContain(
      'Sterke single-set aankondiging of deal',
    );
  });

  it('scores low-value recurring feed posts low', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const score = fixture.componentInstance.getEditorialFitScore({
      createdAt: '2026-05-03T10:00:00.000Z',
      feedName: 'Brickset',
      id: 'feed-item-hot',
      sourceUrl: 'https://brickset.com/article/hot',
      status: 'low_value',
      title: "What's hot this week",
      updatedAt: '2026-05-03T10:00:00.000Z',
    });

    expect(score.score).toBeLessThan(50);
    expect(score.tone).toBe('weak');
    expect(score.negativeReasons).toContain(
      'Terugkerende community- of overzichtspost',
    );
    expect(score.negativeReasons).toContain('Gemarkeerd als lage waarde');
  });

  it('applies an overlap penalty to duplicate-ish feed items', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const feedItem = {
      createdAt: '2026-05-03T10:00:00.000Z',
      feedName: 'Brickset',
      id: 'feed-item-vader',
      sourcePublishedAt: '2026-05-03T08:00:00.000Z',
      sourceUrl: 'https://brickset.com/article/vader',
      status: 'new' as const,
      title: 'LEGO Star Wars 75461 Up-Scaled Darth Vader revealed',
      updatedAt: '2026-05-03T10:00:00.000Z',
    };

    component.feedItems.set([
      feedItem,
      {
        ...feedItem,
        id: 'feed-item-vader-other',
        sourceUrl: 'https://bricktastic.nl/vader',
        title: 'LEGO Star Wars 75461 Up-Scaled Darth Vader onthuld',
      },
    ]);

    const score = component.getEditorialFitScore(feedItem);

    expect(score.negativeReasons).toContain(
      'Mogelijke overlap met bestaand nieuws',
    );
    expect(score.score).toBeLessThan(100);
  });

  it('scores broad roundups as medium fit', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const score = fixture.componentInstance.getEditorialFitScore({
      createdAt: '2026-05-03T10:00:00.000Z',
      feedName: 'Brickset',
      id: 'feed-item-city-summer',
      sourceUrl: 'https://brickset.com/article/city-summer',
      status: 'new',
      title: 'Summer LEGO City sets unveiled',
      updatedAt: '2026-05-03T10:00:00.000Z',
    });

    expect(score.score).toBeGreaterThanOrEqual(50);
    expect(score.score).toBeLessThan(80);
    expect(score.tone).toBe('maybe');
    expect(score.negativeReasons).toContain(
      'Breed overzicht zonder duidelijke setfocus',
    );
  });

  it('opens a saved drafted feed item without generating again', async () => {
    const draftResult = createDraftResult();

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        draftFrontmatter: draftResult.output.frontmatter,
        draftMdx: draftResult.output.mdx,
        draftedAt: '2026-05-03T11:00:00.000Z',
        feedName: 'Brick Example',
        id: 'feed-item-1',
        sourceUrl: 'https://example.com/example',
        status: 'drafted',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T11:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Open concept');
    });

    clickButtonContaining(fixture, 'Open concept');

    const textarea = fixture.nativeElement.querySelector(
      '[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    expect(editorialAgentApi.generateDraftForFeedItem).not.toHaveBeenCalled();
    expect(textarea?.value).toContain('Pak hem nu als je de punten al hebt.');
    expect(fixture.nativeElement.textContent).toContain('Opnieuw genereren');
  });

  it('confirms before regenerating a saved drafted feed item', async () => {
    const draftResult = createDraftResult();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        draftFrontmatter: draftResult.output.frontmatter,
        draftMdx: draftResult.output.mdx,
        draftedAt: '2026-05-03T11:00:00.000Z',
        feedName: 'Brick Example',
        id: 'feed-item-1',
        sourceUrl: 'https://example.com/example',
        status: 'drafted',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
        updatedAt: '2026-05-03T11:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Open concept');
    });

    clickButtonContaining(fixture, 'Opnieuw genereren');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(editorialAgentApi.generateDraftForFeedItem).toHaveBeenCalledWith(
        'feed-item-1',
        true,
        true,
      );
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      'Dit maakt een nieuwe draft en gebruikt opnieuw AI polish.',
    );

    confirmSpy.mockRestore();
  });

  it('sorts feed inbox by source date and hides ignored items by default', async () => {
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'older-feed-item',
        sourcePublishedAt: '2026-05-01T08:00:00.000Z',
        sourceUrl: 'https://brickset.com/article/older',
        status: 'drafted',
        title: 'Older drafted article',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
      {
        createdAt: '2026-05-04T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'ignored-feed-item',
        sourcePublishedAt: '2026-05-04T08:00:00.000Z',
        sourceUrl: 'https://brickset.com/article/ignored',
        status: 'ignored',
        title: 'Ignored article',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        createdAt: '2026-05-02T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'newer-feed-item',
        sourcePublishedAt: '2026-05-02T08:00:00.000Z',
        sourceUrl: 'https://brickset.com/article/newer',
        status: 'new',
        title: 'Newer inbox article',
        updatedAt: '2026-05-02T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Newer inbox article',
      );
    });

    const text = fixture.nativeElement.textContent as string;

    expect(text.indexOf('Newer inbox article')).toBeLessThan(
      text.indexOf('Older drafted article'),
    );
    expect(text).not.toContain('Ignored article');
    expect(
      fixture.nativeElement.querySelector(
        '.editorial-agent__feed-item--new .editorial-agent__feed-unread-indicator',
      ),
    ).not.toBeNull();
    expect(text).toContain('Concept klaar');

    clickButtonContaining(fixture, 'Ignored');

    expect(fixture.nativeElement.textContent).toContain('Ignored article');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Newer inbox article',
    );
  });

  it('removes ignored feed items from the inbox after the ignore action', async () => {
    const feedItem = {
      ...createBricksetFeedItem(),
      sourcePublishedAt: '2026-05-03T08:00:00.000Z',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([feedItem]);
    editorialAgentApi.ignoreFeedItem.mockResolvedValueOnce({
      ...feedItem,
      status: 'ignored',
    });
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        ...feedItem,
        status: 'ignored',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(feedItem.title);
    });

    clickButtonContaining(fixture, 'Negeer');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(feedItem.title);
    });

    expect(editorialAgentApi.ignoreFeedItem).toHaveBeenCalledWith(feedItem.id);
    expect(fixture.nativeElement.textContent).toContain('Geen feed items');
  });

  it('suggests overlapping Star Wars feed items without blocking draft generation', async () => {
    const bricksetFeedItem = {
      ...createBricksetFeedItem(),
      sourcePublishedAt: '2026-05-03T10:00:00.000Z',
    };
    const bricktasticFeedItem: EditorialFeedItem = {
      createdAt: '2026-05-03T09:00:00.000Z',
      feedName: 'BrickTastic',
      id: 'feed-item-bricktastic-star-wars',
      sourcePublishedAt: '2026-05-03T09:00:00.000Z',
      sourceUrl:
        'https://www.bricktastic.nl/lego/lego-star-wars-75461-up-scaled-darth-vader-75458-at-rt-driver-helmet-onthuld/',
      status: 'new',
      title:
        'LEGO Star Wars 75461 Up-Scaled Darth Vader en 75458 AT-RT Driver Helmet onthuld',
      updatedAt: '2026-05-03T09:00:00.000Z',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      bricksetFeedItem,
      bricktasticFeedItem,
    ]);
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValueOnce({
      draftResult: createDraftResultForSource({
        sourceUrl: bricksetFeedItem.sourceUrl,
        title: bricksetFeedItem.title,
      }),
      feedItem: {
        ...bricksetFeedItem,
        status: 'drafted',
      },
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Mogelijk hetzelfde nieuws als',
      );
      expect(fixture.nativeElement.textContent).toContain(
        bricktasticFeedItem.title,
      );
    });

    clickButtonContaining(fixture, 'Genereer toch draft');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(editorialAgentApi.generateDraftForFeedItem).toHaveBeenCalledWith(
        bricksetFeedItem.id,
        true,
        true,
      );
    });
  });

  it('shows a stronger overlap warning when a published SEGA article exists', async () => {
    const segaFeedItem: EditorialFeedItem = {
      createdAt: '2026-05-03T10:00:00.000Z',
      feedName: 'Brickset',
      id: 'feed-item-brickset-sega',
      sourcePublishedAt: '2026-05-03T10:00:00.000Z',
      sourceUrl: 'https://brickset.com/article/131600',
      status: 'new',
      title: 'LEGO Ideas SEGA Genesis set announced',
      updatedAt: '2026-05-03T10:00:00.000Z',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([segaFeedItem]);
    editorialAgentApi.listPublishedArticles.mockResolvedValueOnce([
      {
        date: '2026-05-02',
        slug: 'lego-ideas-sega-genesis-officieel-aangekondigd',
        status: 'published',
        title: 'LEGO Ideas SEGA Genesis officieel aangekondigd',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Er bestaat al een artikel over dit nieuws',
      );
      expect(fixture.nativeElement.textContent).toContain(
        'LEGO Ideas SEGA Genesis officieel aangekondigd',
      );
      expect(fixture.nativeElement.textContent).toContain('Gebruik bestaande');
    });

    clickButtonContaining(fixture, 'Gebruik bestaande');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(editorialAgentApi.getPublishedArticle).toHaveBeenCalledWith(
        'lego-ideas-sega-genesis-officieel-aangekondigd',
      );
    });
  });

  it('opens the existing drafted overlap when using the existing suggestion', async () => {
    const currentFeedItem: EditorialFeedItem = {
      ...createBricksetFeedItem(),
      id: 'feed-item-current-star-wars',
      sourcePublishedAt: '2026-05-03T10:00:00.000Z',
    };
    const draftedFeedItem: EditorialFeedItem = {
      createdAt: '2026-05-03T09:00:00.000Z',
      feedName: 'BrickTastic',
      id: 'feed-item-drafted-star-wars',
      sourcePublishedAt: '2026-05-03T09:00:00.000Z',
      sourceUrl:
        'https://www.bricktastic.nl/lego/lego-star-wars-75461-darth-vader-75458-at-rt-driver-helmet/',
      status: 'drafted',
      title:
        'LEGO Star Wars 75461 Darth Vader en 75458 AT-RT Driver Helmet onthuld',
      updatedAt: '2026-05-03T09:00:00.000Z',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      currentFeedItem,
      draftedFeedItem,
    ]);
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValueOnce({
      draftResult: createDraftResultForSource({
        sourceUrl: draftedFeedItem.sourceUrl,
        title: draftedFeedItem.title,
      }),
      feedItem: draftedFeedItem,
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Er is al een concept voor vergelijkbaar nieuws',
      );
      expect(fixture.nativeElement.textContent).toContain('Gebruik bestaande');
    });

    clickButtonContaining(fixture, 'Gebruik bestaande');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(editorialAgentApi.generateDraftForFeedItem).toHaveBeenCalledWith(
        draftedFeedItem.id,
        true,
        true,
      );
      expect(fixture.nativeElement.textContent).toContain('Draft preview');
    });
  });

  it('ignores the overlapping feed item while keeping the current item available', async () => {
    const currentFeedItem: EditorialFeedItem = {
      ...createBricksetFeedItem(),
      id: 'feed-item-current-star-wars',
      sourcePublishedAt: '2026-05-03T10:00:00.000Z',
    };
    const overlapFeedItem: EditorialFeedItem = {
      createdAt: '2026-05-03T09:00:00.000Z',
      feedName: 'BrickTastic',
      id: 'feed-item-overlap-star-wars',
      sourcePublishedAt: '2026-05-03T09:00:00.000Z',
      sourceUrl:
        'https://www.bricktastic.nl/lego/lego-star-wars-75461-darth-vader-75458-at-rt-driver-helmet/',
      status: 'new',
      title:
        'LEGO Star Wars 75461 Darth Vader en 75458 AT-RT Driver Helmet onthuld',
      updatedAt: '2026-05-03T09:00:00.000Z',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      currentFeedItem,
      overlapFeedItem,
    ]);
    editorialAgentApi.ignoreFeedItem.mockResolvedValueOnce({
      ...overlapFeedItem,
      status: 'ignored',
    });
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      currentFeedItem,
      {
        ...overlapFeedItem,
        status: 'ignored',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        currentFeedItem.title,
      );
      expect(fixture.nativeElement.textContent).toContain(
        overlapFeedItem.title,
      );
    });

    clickButtonContaining(fixture, 'Negeer andere');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(editorialAgentApi.ignoreFeedItem).toHaveBeenCalledWith(
        overlapFeedItem.id,
      );
      expect(fixture.nativeElement.textContent).toContain(
        currentFeedItem.title,
      );
      expect(fixture.nativeElement.textContent).not.toContain(
        overlapFeedItem.title,
      );
    });
  });

  it('does not show overlap suggestions for unrelated feed items', async () => {
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'feed-item-unrelated-city',
        sourcePublishedAt: '2026-05-03T10:00:00.000Z',
        sourceUrl: 'https://brickset.com/article/131700',
        status: 'new',
        title: 'New LEGO City train station revealed',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'New LEGO City train station revealed',
      );
    });

    expect(fixture.nativeElement.textContent).not.toContain(
      'Mogelijk hetzelfde nieuws als',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Er bestaat al een artikel over dit nieuws',
    );
  });

  it('opens a feed draft modal without showing the hardcoded example draft', async () => {
    const bricksetFeedItem = createBricksetFeedItem();
    let resolveDraft!: (
      value: Awaited<
        ReturnType<typeof editorialAgentApi.generateDraftForFeedItem>
      >,
    ) => void;
    const pendingDraft = new Promise<
      Awaited<ReturnType<typeof editorialAgentApi.generateDraftForFeedItem>>
    >((resolve) => {
      resolveDraft = resolve;
    });

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockReturnValueOnce(
      pendingDraft,
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    const draftButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Genereer draft'),
      );

    draftButton?.nativeElement.click();
    fixture.detectChanges();

    expect(component.activeFeedItemId()).toBe(bricksetFeedItem.id);
    expect(component.sourceUrl()).toBe(bricksetFeedItem.sourceUrl);
    expect(component.draftResult()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Draft wordt gemaakt');
    expect(fixture.nativeElement.textContent).not.toContain(
      'https://example.com/example',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'LEGO 40787 Mario Kart',
    );

    resolveDraft({
      draftResult: createDraftResultForSource({
        sourceUrl: bricksetFeedItem.sourceUrl,
        title: bricksetFeedItem.title,
      }),
      feedItem: {
        ...bricksetFeedItem,
        status: 'drafted',
      },
    });

    await vi.waitFor(() => {
      fixture.detectChanges();

      const textarea = fixture.nativeElement.querySelector(
        '[role="dialog"] textarea',
      ) as HTMLTextAreaElement | null;

      expect(textarea?.value).toContain(bricksetFeedItem.sourceUrl);
      expect(textarea?.value).not.toContain('https://example.com/example');
    });
  });

  it('renders draft editor tabs and keeps edits while switching tabs', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.draftTitle.set('Aangepaste titel');
    component.draftDescription.set('Aangepaste beschrijving.');
    component.draftTheme.set('Star Wars');
    component.draftDate.set('2026-05-04');
    component.draftMdx.set('## Aangepaste MDX\n\nNieuwe tekst.');
    component.isDraftModalOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Inhoud');
    expect(fixture.nativeElement.textContent).toContain('Sets');
    expect(fixture.nativeElement.textContent).toContain('Beeld');
    expect(fixture.nativeElement.textContent).toContain('Publicatie');
    expect(fixture.nativeElement.textContent).toContain('Debug');
    expect(component.draftModalTab()).toBe('inhoud');
    expect(fixture.nativeElement.textContent).toContain('Artikelinhoud');
    expect(fixture.nativeElement.textContent).toContain('Publish article');
    expect(fixture.nativeElement.textContent).toContain('Hero afbeelding');
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__modal-header'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__modal-actions'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__draft-tabs'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__draft-content'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.editorial-agent__draft-editor')
        ?.firstElementChild?.classList.contains('editorial-agent__draft-tabs'),
    ).toBe(true);
    expect(
      fixture.nativeElement
        .querySelector('.editorial-agent__content-top')
        ?.firstElementChild?.classList.contains('editorial-agent__hero-thumb'),
    ).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain(
      'PrimarySet preview',
    );

    const heroThumbnail = fixture.nativeElement.querySelector(
      '.editorial-agent__hero-thumb',
    ) as HTMLButtonElement | null;

    heroThumbnail?.click();
    fixture.detectChanges();

    expect(component.draftModalTab()).toBe('beeld');

    clickButtonContaining(fixture, 'Inhoud');
    fixture.detectChanges();

    clickButtonContaining(fixture, 'Beeld');
    fixture.detectChanges();

    expect(component.draftModalTab()).toBe('beeld');
    expect(fixture.nativeElement.textContent).toContain('Hero');
    expect(fixture.nativeElement.textContent).toContain('Upload bestand');
    expect(fixture.nativeElement.textContent).toContain('Importeer afbeelding');
    expect(fixture.nativeElement.textContent).toContain('Beeldcredit');
    expect(fixture.nativeElement.textContent).toContain('Publish article');
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__hero-row'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__image-actions'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.editorial-agent__image-import'),
    ).not.toBeNull();
    const imageSectionStack = fixture.nativeElement.querySelector(
      '.editorial-agent__image-section-stack',
    ) as HTMLElement | null;
    const imageSections = Array.from(
      imageSectionStack?.children ?? [],
    ) as HTMLElement[];

    expect(imageSectionStack).not.toBeNull();
    expect(imageSections[0]?.classList).toContain(
      'editorial-agent__image-section--hero',
    );
    expect(imageSections[1]?.classList).toContain(
      'editorial-agent__image-section--gallery',
    );
    expect(imageSections[0]?.textContent).toContain('Beeldcredit');
    expect(imageSections[0]?.textContent).not.toContain('Gallery afbeeldingen');
    expect(fixture.nativeElement.textContent).not.toContain('Artikelinhoud');
    expect(
      fixture.nativeElement.querySelector('[role="dialog"] textarea'),
    ).toBeNull();

    clickButtonContaining(fixture, 'Sets');
    fixture.detectChanges();

    expect(component.draftModalTab()).toBe('sets');
    expect(fixture.nativeElement.textContent).toContain('PrimarySet preview');
    expect(fixture.nativeElement.textContent).not.toContain('Upload bestand');

    clickButtonContaining(fixture, 'Inhoud');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector(
      '[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    expect(component.draftTitle()).toBe('Aangepaste titel');
    expect(component.draftDescription()).toBe('Aangepaste beschrijving.');
    expect(component.draftTheme()).toBe('Star Wars');
    expect(component.draftDate()).toBe('2026-05-04');
    expect(textarea?.value).toContain('## Aangepaste MDX');
  });

  it('shows official LEGO product page shortcuts for a FeaturedSet in the Beeld tab', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draftResult = createDraftResult();

    draftResult.output.primarySet = {
      name: 'Imperial Remnant AT-RT Driver Helmet',
      reason: 'Primary set uit headline.',
      setNumber: '75458-1',
    };
    draftResult.output.relatedSets = [];
    component.draftResult.set(draftResult);
    component.draftMdx.set('## Wat is er aangekondigd?\n\nHelmet nieuws.');
    component.isDraftModalOpen.set(true);
    component.draftModalTab.set('beeld');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Officiële LEGO beelden zoeken',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Open LEGO productpagina voor 75458',
    );
    expect(
      fixture.nativeElement.querySelector(
        'a[href="https://www.lego.com/nl-nl/product/75458"]',
      ),
    ).not.toBeNull();

    const helper = fixture.nativeElement.querySelector(
      '.editorial-agent__suggested-links',
    ) as HTMLElement | null;
    const creditInput = fixture.nativeElement.querySelector(
      'input[placeholder="Beeld: © The LEGO Group"]',
    ) as HTMLInputElement | null;
    const urlInput = fixture.nativeElement.querySelector(
      'input[placeholder="https://www.lego.com/cdn/..."]',
    ) as HTMLInputElement | null;

    expect(helper?.closest('.editorial-agent__hero-row')).toBeNull();
    expect(helper?.parentElement?.classList).toContain(
      'editorial-agent__image-section--hero',
    );
    expectElementAfter(helper, urlInput);
    expectElementAfter(helper, creditInput);
  });

  it('shows up to three official LEGO product page shortcuts from SetSpotlightList', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draftResult = createDraftResult();

    draftResult.output.primarySet = null;
    draftResult.output.relatedSets = [];
    component.draftResult.set(draftResult);
    component.draftMdx.set(
      '<SetSpotlightList setIds="75458, 75461, 75398, 10316" />',
    );
    component.isDraftModalOpen.set(true);
    component.draftModalTab.set('beeld');
    fixture.detectChanges();

    const productLinks = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a[href^="https://www.lego.com/nl-nl/product/"]',
      ),
    ) as HTMLAnchorElement[];

    expect(productLinks.map((link) => link.href)).toEqual([
      'https://www.lego.com/nl-nl/product/75458',
      'https://www.lego.com/nl-nl/product/75461',
      'https://www.lego.com/nl-nl/product/75398',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Open LEGO productpagina voor 10316',
    );
  });

  it('renders two official LEGO product shortcuts without horizontal hero-row nesting', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draftResult = createDraftResult();

    draftResult.output.primarySet = null;
    draftResult.output.relatedSets = [];
    component.draftResult.set(draftResult);
    component.draftMdx.set('<SetSpotlightList setIds="75458,75461" />');
    component.isDraftModalOpen.set(true);
    component.draftModalTab.set('beeld');
    fixture.detectChanges();

    const helper = fixture.nativeElement.querySelector(
      '.editorial-agent__suggested-links',
    ) as HTMLElement | null;
    const productLinks = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a[href^="https://www.lego.com/nl-nl/product/"]',
      ),
    ) as HTMLAnchorElement[];

    expect(productLinks).toHaveLength(2);
    expect(helper?.closest('.editorial-agent__hero-row')).toBeNull();
    expect(helper?.parentElement?.classList).toContain(
      'editorial-agent__image-section--hero',
    );
  });

  it('does not show official LEGO product shortcuts without set numbers', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draftResult = createDraftResult();

    draftResult.output.primarySet = null;
    draftResult.output.relatedSets = [];
    component.draftResult.set(draftResult);
    component.draftMdx.set('## Wat is er aangekondigd?\n\nZonder setnummer.');
    component.isDraftModalOpen.set(true);
    component.draftModalTab.set('beeld');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Officiële LEGO beelden zoeken',
    );
    expect(
      fixture.nativeElement.querySelector(
        'a[href^="https://www.lego.com/nl-nl/product/"]',
      ),
    ).toBeNull();
  });

  it('closes the draft modal with the icon button and escape key', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.isDraftModalOpen.set(true);
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Sluit draft preview"]',
    ) as HTMLButtonElement | null;

    closeButton?.click();
    fixture.detectChanges();

    expect(component.isDraftModalOpen()).toBe(false);

    component.isDraftModalOpen.set(true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isDraftModalOpen()).toBe(false);
  });

  it('does not show stale draft output when feed draft generation fails', async () => {
    const bricksetFeedItem = createBricksetFeedItem();

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockRejectedValueOnce(
      new Error('Draft generatie gaf geen output.'),
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    const draftButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Genereer draft'),
      );

    draftButton?.nativeElement.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Draft generatie gaf geen output.',
      );
    });

    const textarea = fixture.nativeElement.querySelector(
      '[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    expect(component.draftResult()).toBeNull();
    expect(textarea).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      'https://example.com/example',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'LEGO 40787 Mario Kart',
    );
  });

  it('shows a coupling error and exits loading when a stale feed draft response arrives', async () => {
    const bricksetFeedItem = createBricksetFeedItem();
    let resolveDraft!: (
      value: Awaited<
        ReturnType<typeof editorialAgentApi.generateDraftForFeedItem>
      >,
    ) => void;
    const pendingDraft = new Promise<
      Awaited<ReturnType<typeof editorialAgentApi.generateDraftForFeedItem>>
    >((resolve) => {
      resolveDraft = resolve;
    });

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockReturnValueOnce(
      pendingDraft,
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    const draftButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Genereer draft'),
      );

    draftButton?.nativeElement.click();
    component.activeFeedItemId.set('different-pending-feed-item');

    resolveDraft({
      draftResult: createDraftResult(),
      feedItem: {
        ...bricksetFeedItem,
        sourceUrl: 'https://example.com/example',
      },
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Draft ontvangen maar kon niet gekoppeld worden',
      );
    });

    const textarea = fixture.nativeElement.querySelector(
      '[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    expect(textarea).toBeNull();
    expect(component.isGenerating()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Draft wordt gemaakt',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'https://example.com/example',
    );
  });

  it('shows a received draft for the active feed request even when source URLs differ', async () => {
    const bricksetFeedItem = createBricksetFeedItem();

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValueOnce({
      draftResult: createDraftResultForSource({
        sourceUrl: 'https://example.com/different',
        title: bricksetFeedItem.title,
      }),
      feedItem: {
        ...bricksetFeedItem,
        sourceUrl: 'https://example.com/different',
        status: 'drafted',
      },
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    await component.generateDraftForFeedItem(bricksetFeedItem);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector(
      '[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    expect(component.isGenerating()).toBe(false);
    expect(component.draftResult()).not.toBeNull();
    expect(textarea?.value).toContain('https://example.com/different');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Draft wordt gemaakt',
    );
  });

  it('accepts Brickset feed draft responses when http and https normalize to the same source', async () => {
    const bricksetFeedItem: EditorialFeedItem = {
      ...createBricksetFeedItem(),
      sourceUrl: 'http://brickset.com/article/131538',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValueOnce({
      draftResult: createDraftResultForSource({
        sourceUrl: 'https://brickset.com/article/131538',
        title: bricksetFeedItem.title,
      }),
      feedItem: {
        ...bricksetFeedItem,
        sourceUrl: 'https://brickset.com/article/131538/',
        status: 'drafted',
      },
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    await component.generateDraftForFeedItem(bricksetFeedItem);

    expect(component.draftResult()).not.toBeNull();
    expect(component.errorMessage()).toBeNull();
    expect(component.sourceUrl()).toBe('https://brickset.com/article/131538/');
  });

  it('accepts feed draft responses when tracking params, hash, and trailing slashes differ', async () => {
    const bricksetFeedItem: EditorialFeedItem = {
      ...createBricksetFeedItem(),
      sourceUrl: 'http://brickset.com/article/131538/?utm_source=rss#comments',
    };

    editorialAgentApi.listFeedItems.mockResolvedValueOnce([bricksetFeedItem]);
    editorialAgentApi.generateDraftForFeedItem.mockResolvedValueOnce({
      draftResult: createDraftResultForSource({
        sourceUrl: 'https://brickset.com/article/131538',
        title: bricksetFeedItem.title,
      }),
      feedItem: {
        ...bricksetFeedItem,
        sourceUrl: 'https://brickset.com/article/131538/',
        status: 'drafted',
      },
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        bricksetFeedItem.title,
      );
    });

    await component.generateDraftForFeedItem(bricksetFeedItem);

    expect(component.draftResult()).not.toBeNull();
    expect(component.errorMessage()).toBeNull();
    expect(component.isGenerating()).toBe(false);
  });

  it('lists published articles and loads one for editing', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    fixture.detectChanges();
    clickButtonContaining(fixture, 'Gepubliceerde artikelen');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Published articles');
      expect(fixture.nativeElement.textContent).toContain(
        'LEGO 40787 Mario Kart – Spiny Shell is terug',
      );
    });

    const editButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Bewerken'),
      );

    editButton?.nativeElement.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[role="dialog"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Artikel aanpassen');
      expect(
        fixture.nativeElement.querySelector(
          '.editorial-agent__article-editor-modal',
        ),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('.editorial-agent__modal-header'),
      ).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Preview openen');
      expect(fixture.nativeElement.textContent).toContain('Opslaan');
      expect(fixture.nativeElement.textContent).toContain('Inhoud');
      expect(fixture.nativeElement.textContent).toContain('Beeld');
      expect(fixture.nativeElement.textContent).toContain('Publicatie');
      expect(
        fixture.nativeElement
          .querySelector('.editorial-agent__content-top')
          ?.firstElementChild?.classList.contains(
            'editorial-agent__hero-thumb',
          ),
      ).toBe(true);
      expect(
        (
          fixture.nativeElement.querySelector(
            'textarea:not([readonly])',
          ) as HTMLTextAreaElement | null
        )?.value,
      ).toContain('## Wanneer kiezen?');
    });

    const component = fixture.componentInstance;
    const heroThumbnail = fixture.nativeElement.querySelector(
      '.editorial-agent__hero-thumb',
    ) as HTMLButtonElement | null;

    component.articleEditTitle.set('Titel blijft staan');
    heroThumbnail?.click();
    fixture.detectChanges();

    expect(component.articleEditModalTab()).toBe('beeld');
    expect(fixture.nativeElement.textContent).toContain('Importeer afbeelding');
    const editImageSectionStack = fixture.nativeElement.querySelector(
      '.editorial-agent__image-section-stack',
    ) as HTMLElement | null;
    const editImageSections = Array.from(
      editImageSectionStack?.children ?? [],
    ) as HTMLElement[];

    expect(editImageSectionStack).not.toBeNull();
    expect(editImageSections[0]?.classList).toContain(
      'editorial-agent__image-section--hero',
    );
    expect(editImageSections[1]?.classList).toContain(
      'editorial-agent__image-section--gallery',
    );
    expect(editImageSections[0]?.textContent).toContain('Beeldcredit');
    expect(editImageSections[0]?.textContent).not.toContain(
      'Gallery afbeeldingen',
    );
    expect(
      fixture.nativeElement.querySelector('[role="dialog"] textarea'),
    ).toBeNull();

    clickButtonContaining(fixture, 'Inhoud');
    fixture.detectChanges();

    expect(component.articleEditTitle()).toBe('Titel blijft staan');

    expect(editorialAgentApi.getPublishedArticle).toHaveBeenCalledWith(
      'lego-40787-mario-kart-spiny-shell-is-terug',
    );
  });

  it('saves published article basics and mdx without changing the slug', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.articleEditSlug.set('lego-40787-mario-kart-spiny-shell-is-terug');
    component.activeTab.set('published');
    component.isArticleEditModalOpen.set(true);
    component.articleEditTitle.set('Nieuwe titel');
    component.articleEditDescription.set('Nieuwe beschrijving.');
    component.articleEditDate.set('2026-05-02');
    component.articleEditTheme.set('Super Mario');
    component.articleEditHeroImage.set('');
    component.articleEditMdx.set('## Nieuwe heading\n\nNieuwe copy.');

    await component.savePublishedArticleEdit();
    fixture.detectChanges();

    expect(editorialAgentApi.updatePublishedArticle).toHaveBeenCalledWith(
      'lego-40787-mario-kart-spiny-shell-is-terug',
      {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          heroImage: '',
          slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
          status: 'published',
          theme: 'Super Mario',
          title: 'Nieuwe titel',
        },
        mdx: '## Nieuwe heading\n\nNieuwe copy.',
      },
    );
    expect(fixture.nativeElement.textContent).toContain('Artikel opgeslagen.');
  });

  it('requires exact slug confirmation before deleting a published article', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.articleEditSlug.set('spiny-shell');
    component.isArticleEditModalOpen.set(true);

    await component.deletePublishedArticleEdit();
    fixture.detectChanges();

    expect(editorialAgentApi.deletePublishedArticle).not.toHaveBeenCalled();
    expect(component.articleEditErrorMessage()).toBe(
      'Typ de exacte slug om dit artikel te verwijderen.',
    );
  });

  it('deletes a published article after slug confirmation and refreshes admin lists', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.articleEditSlug.set('spiny-shell');
    component.isArticleEditModalOpen.set(true);
    component.articleEditDeleteConfirmationSlug.set('spiny-shell');

    await component.deletePublishedArticleEdit();
    fixture.detectChanges();

    expect(editorialAgentApi.deletePublishedArticle).toHaveBeenCalledWith(
      'spiny-shell',
    );
    expect(component.isArticleEditModalOpen()).toBe(false);
    expect(component.publishedArticlesSuccessMessage()).toBe(
      'Artikel verwijderd.',
    );
    expect(editorialAgentApi.listPublishedArticles).toHaveBeenCalled();
    expect(editorialAgentApi.listFeedItems).toHaveBeenCalled();
  });

  it('renders the article delete danger zone with disabled delete until slug matches', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.activeTab.set('published');
    component.articleEditSlug.set('spiny-shell');
    component.isArticleEditModalOpen.set(true);
    component.articleEditModalTab.set('publicatie');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Dit verwijdert artikel, hero en gallery afbeeldingen permanent.',
    );
    const deleteButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) =>
      (button as HTMLButtonElement).textContent?.includes(
        'Artikel verwijderen',
      ),
    ) as HTMLButtonElement | undefined;

    expect(deleteButton?.disabled).toBe(true);

    component.articleEditDeleteConfirmationSlug.set('spiny-shell');
    fixture.detectChanges();

    expect(deleteButton?.disabled).toBe(false);
  });

  it('uploads and removes a hero image while editing a published article', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const file = new File(['fake image'], 'hero.png', {
      type: 'image/png',
    });
    const input = document.createElement('input');

    component.articleEditSlug.set('lego-40787-mario-kart-spiny-shell-is-terug');
    component.activeTab.set('published');
    component.isArticleEditModalOpen.set(true);
    vi.spyOn(
      component as unknown as {
        optimizeHeroImageFile: (nextFile: File) => Promise<{
          base64Data: string;
          contentType: 'image/webp';
          fileName: 'hero.webp';
        }>;
      },
      'optimizeHeroImageFile',
    ).mockResolvedValue({
      base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
      contentType: 'image/webp',
      fileName: 'hero.webp',
    });
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    await component.uploadArticleEditHeroImageFromInput({
      target: input,
    } as unknown as Event);

    expect(editorialAgentApi.uploadHeroImage).toHaveBeenCalledWith({
      base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
      contentType: 'image/webp',
      fileName: 'hero.webp',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });
    expect(component.articleEditHeroImage()).toContain('/hero.webp');

    component.removeArticleEditHeroImage();

    expect(component.articleEditHeroImage()).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Hero afbeelding verwijderd.',
    );
  });

  it('shows low-value feed items without allowing automatic draft generation', async () => {
    editorialAgentApi.listFeedItems.mockResolvedValueOnce([
      {
        createdAt: '2026-05-03T10:00:00.000Z',
        feedName: 'Brickset',
        id: 'feed-item-low-value',
        sourceUrl: 'https://brickset.com/article/random-figure',
        status: 'low_value',
        title: 'Random figure of the day: coltlnm17',
        updatedAt: '2026-05-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.setFeedFilter('low_value');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Random figure of the day: coltlnm17',
      );
    });

    const draftButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Genereer draft'),
      );

    expect(fixture.nativeElement.textContent).toContain('Lage waarde');
    expect(draftButton?.nativeElement.disabled).toBe(true);
  });

  it('shows a clear publish error for low-confidence drafts', async () => {
    editorialAgentApi.publishArticle.mockRejectedValueOnce(
      new Error('Dit artikel is nog niet klaar voor publicatie.'),
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const lowConfidenceDraft = createDraftResult();

    lowConfidenceDraft.output = {
      ...lowConfidenceDraft.output,
      frontmatter: {
        ...lowConfidenceDraft.output.frontmatter,
        description:
          'Conceptdraft op basis van extraction en exacte catalog matches.',
        title: 'LEGO Technic Bugatti Tourbillon',
      },
      mdx: [
        '---',
        'title: "LEGO Technic Bugatti Tourbillon"',
        '---',
        '',
        'Conceptdraft.',
        '',
        'Controleer de bron, want nog niet alles hangt strak genoeg.',
        'Gebruik deze draft niet als af verhaal.',
      ].join('\n'),
    };

    component.draftResult.set(lowConfidenceDraft);
    component.isDraftModalOpen.set(true);
    await component.publishArticle();
    fixture.detectChanges();

    expect(editorialAgentApi.publishArticle).toHaveBeenCalledWith({
      feedItemId: undefined,
      frontmatter: {
        ...lowConfidenceDraft.output.frontmatter,
        status: 'published',
      },
      mdx: lowConfidenceDraft.output.mdx,
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Dit artikel is nog niet klaar voor publicatie.',
    );
  });

  it('uploads a manual hero image and publishes it in frontmatter', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();
    const file = new File(['fake image'], 'hero.webp', {
      type: 'image/webp',
    });
    const input = document.createElement('input');

    component.draftResult.set(draft);
    component.isDraftModalOpen.set(true);
    vi.spyOn(
      component as unknown as {
        optimizeHeroImageFile: (nextFile: File) => Promise<{
          base64Data: string;
          contentType: 'image/webp';
          fileName: 'hero.webp';
        }>;
      },
      'optimizeHeroImageFile',
    ).mockResolvedValue({
      base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
      contentType: 'image/webp',
      fileName: 'hero.webp',
    });
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    await component.uploadHeroImageFromInput({
      target: input,
    } as unknown as Event);
    await component.publishArticle();

    expect(editorialAgentApi.uploadHeroImage).toHaveBeenCalledWith({
      base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
      contentType: 'image/webp',
      fileName: 'hero.webp',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });
    expect(editorialAgentApi.publishArticle).toHaveBeenCalledWith({
      feedItemId: undefined,
      frontmatter: {
        ...draft.output.frontmatter,
        heroImage:
          'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
        status: 'published',
      },
      mdx: draft.output.mdx,
    });
  });

  it('imports a LEGO hero image URL and publishes the image credit', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();

    component.draftResult.set(draft);
    component.heroImageUrlInput.set(
      'https://www.lego.com/cdn/product-assets/hero.jpg',
    );

    await component.importHeroImageFromUrl();
    await component.publishArticle();

    expect(editorialAgentApi.importHeroImageFromUrl).toHaveBeenCalledWith({
      imageUrl: 'https://www.lego.com/cdn/product-assets/hero.jpg',
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });
    expect(editorialAgentApi.publishArticle).toHaveBeenCalledWith({
      feedItemId: undefined,
      frontmatter: {
        ...draft.output.frontmatter,
        heroImage:
          'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
        heroImageCredit: 'Beeld: © The LEGO Group',
        status: 'published',
      },
      mdx: draft.output.mdx,
    });
  });

  it('adds gallery images and copies an ImageGallery snippet', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: clipboardWrite,
      },
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();
    const file = new File(['fake image'], 'gallery.webp', {
      type: 'image/webp',
    });
    const input = document.createElement('input');

    component.draftResult.set(draft);
    component.draftTitle.set('Spiny Shell artikel');
    vi.spyOn(
      component as unknown as {
        optimizeHeroImageFile: (nextFile: File) => Promise<{
          base64Data: string;
          contentType: 'image/webp';
          fileName: 'hero.webp';
        }>;
      },
      'optimizeHeroImageFile',
    ).mockResolvedValue({
      base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
      contentType: 'image/webp',
      fileName: 'hero.webp',
    });
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    await component.uploadGalleryImageFromInput({
      target: input,
    } as unknown as Event);
    component.updateGalleryImageAlt(
      component.galleryImages()[0]?.id ?? '',
      'Spiny Shell gallerybeeld',
    );
    await component.copyImageGallerySnippet();
    fixture.detectChanges();

    expect(editorialAgentApi.uploadArticleImage).toHaveBeenCalledWith(
      expect.objectContaining({
        base64Data: 'data:image/webp;base64,b3B0aW1pemVk',
        contentType: 'image/webp',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        type: 'gallery',
      }),
    );
    expect(component.imageGallerySnippet()).toBe(
      '<ImageGallery images="https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp::Spiny Shell gallerybeeld" />',
    );
    expect(clipboardWrite).toHaveBeenCalledWith(
      component.imageGallerySnippet(),
    );

    component.galleryImages.update((images) => [
      ...images,
      {
        alt: 'Tweede gallerybeeld',
        id: 'gallery-two',
        url: 'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-two.webp',
      },
    ]);
    component.isDraftModalOpen.set(true);
    component.setDraftModalTab('beeld');
    fixture.detectChanges();

    const gallerySection = fixture.nativeElement.querySelector(
      '.editorial-agent__image-section--gallery',
    ) as HTMLElement | null;

    expect(gallerySection?.textContent).toContain('Gallery afbeeldingen');
    expect(gallerySection?.querySelectorAll('img').length).toBe(2);

    component.removeGalleryImage(component.galleryImages()[0]?.id ?? '');

    expect(component.imageGallerySnippet()).toContain('Tweede gallerybeeld');
  });

  it('imports a LEGO gallery image URL with image credit', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.galleryImageUrlInput.set(
      'https://www.lego.com/cdn/product-assets/gallery.jpg',
    );

    await component.importGalleryImageFromUrl();

    expect(editorialAgentApi.uploadArticleImage).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://www.lego.com/cdn/product-assets/gallery.jpg',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        type: 'gallery',
      }),
    );
    expect(component.galleryImages()[0]).toMatchObject({
      credit: 'Beeld: © The LEGO Group',
      url: 'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/gallery/gallery-one.webp',
    });
  });

  it('creates a preview from the draft modal with current mdx and frontmatter', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();

    component.articlePreviewEnabled.set(true);
    component.draftResult.set(draft);
    component.draftTitle.set('Aangepaste preview titel');
    component.draftDescription.set('Aangepaste preview beschrijving.');
    component.draftTheme.set('Star Wars');
    component.draftDate.set('2026-05-04');
    component.draftMdx.set('## Preview heading\n\nPreview copy.');
    component.heroImageOverride.set('https://storage.example/hero.webp');
    component.isDraftModalOpen.set(true);

    await component.openDraftPreview();

    expect(editorialAgentApi.createArticlePreview).toHaveBeenCalledWith({
      frontmatter: {
        ...draft.output.frontmatter,
        date: '2026-05-04',
        description: 'Aangepaste preview beschrijving.',
        heroImage: 'https://storage.example/hero.webp',
        theme: 'Star Wars',
        title: 'Aangepaste preview titel',
      },
      mdx: '## Preview heading\n\nPreview copy.',
    });
    expect(openSpy).toHaveBeenCalledWith(
      'http://localhost:3000/artikelen/preview/00000000-0000-4000-8000-000000000001',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('creates a preview from unsaved published article edits', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.articlePreviewEnabled.set(true);
    component.articleEditSlug.set('spiny-shell');
    component.articleEditTitle.set('Onopgeslagen titel');
    component.articleEditDescription.set('Onopgeslagen beschrijving.');
    component.articleEditDate.set('2026-05-04');
    component.articleEditTheme.set('Super Mario');
    component.articleEditHeroImage.set(
      'https://storage.example/edit-hero.webp',
    );
    component.articleEditMdx.set('## Onopgeslagen heading\n\nNieuwe copy.');

    await component.openArticleEditPreview();

    expect(editorialAgentApi.createArticlePreview).toHaveBeenCalledWith({
      frontmatter: {
        date: '2026-05-04',
        description: 'Onopgeslagen beschrijving.',
        heroImage: 'https://storage.example/edit-hero.webp',
        slug: 'spiny-shell',
        status: 'draft',
        theme: 'Super Mario',
        title: 'Onopgeslagen titel',
      },
      mdx: '## Onopgeslagen heading\n\nNieuwe copy.',
    });
    expect(openSpy).toHaveBeenCalled();
  });

  it('keeps preview disabled when article preview is not enabled', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.articlePreviewEnabled.set(false);
    component.draftResult.set(createDraftResult());
    component.isDraftModalOpen.set(true);
    fixture.detectChanges();

    const previewButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Preview openen'),
      );

    expect(previewButton?.nativeElement.disabled).toBe(true);

    await component.openDraftPreview();

    expect(editorialAgentApi.createArticlePreview).not.toHaveBeenCalled();
    expect(component.articlePreviewErrorMessage()).toBe(
      'Preview is alleen beschikbaar op staging/local.',
    );
  });

  it('enables preview from admin runtime config when configured', async () => {
    editorialAgentApi.getRuntimeConfig.mockResolvedValue({
      articlePreviewEnabled: true,
    });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.isDraftModalOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const previewButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Preview openen'),
      );

    expect(editorialAgentApi.getRuntimeConfig).toHaveBeenCalled();
    expect(component.articlePreviewEnabled()).toBe(true);
    expect(previewButton?.nativeElement.disabled).toBe(false);
  });

  it('keeps preview disabled when admin runtime config is unavailable', async () => {
    editorialAgentApi.getRuntimeConfig.mockRejectedValue(
      new Error('Runtime config unavailable'),
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.isDraftModalOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const previewButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Preview openen'),
      );

    expect(component.articlePreviewEnabled()).toBe(false);
    expect(previewButton?.nativeElement.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Preview is alleen beschikbaar op staging/local.',
    );
  });

  it('removes a manual hero image so publish falls back to catalog imagery', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();

    component.draftResult.set(draft);
    component.heroImageOverride.set(
      'https://storage.example/article-images/articles/lego-40787-mario-kart-spiny-shell-is-terug/hero.webp',
    );
    component.removeHeroImage();
    await component.publishArticle();

    expect(editorialAgentApi.publishArticle).toHaveBeenCalledWith({
      feedItemId: undefined,
      frontmatter: {
        ...draft.output.frontmatter,
        heroImage: '',
        status: 'published',
      },
      mdx: draft.output.mdx,
    });
  });

  it('shows a useful duplicate source publish error with a link to the existing article', async () => {
    editorialAgentApi.publishArticle.mockRejectedValueOnce(
      new ContentAdminArticlePublishError(
        'Dit bronartikel is al gepubliceerd.',
        'bestaand-artikel',
      ),
    );

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;

    component.draftResult.set(createDraftResult());
    component.isDraftModalOpen.set(true);
    await component.publishArticle();
    fixture.detectChanges();

    const link = fixture.debugElement.query(
      By.css('a[href$="/artikelen/super-mario/bestaand-artikel"]'),
    );

    expect(fixture.nativeElement.textContent).toContain(
      'Dit bronartikel is al gepubliceerd.',
    );
    expect(fixture.nativeElement.textContent).toContain('Bestaand artikel');
    expect(link?.nativeElement.textContent).toContain('Open artikel');
  });

  it('shows near duplicate matches and can force publish on second click', async () => {
    editorialAgentApi.publishArticle
      .mockRejectedValueOnce(
        new ContentAdminArticlePublishError(
          'Mogelijk overlappend artikel gevonden.',
          undefined,
          'near_duplicate',
          [
            {
              reason: 'Zelfde uitgelichte set 75461',
              slug: 'up-scaled-darth-vader',
              title: 'LEGO Star Wars 75461 Up-Scaled Darth Vader onthuld',
            },
          ],
        ),
      )
      .mockResolvedValueOnce({
        slug: 'star-wars-juni',
      });

    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );
    const component = fixture.componentInstance;
    const draft = createDraftResult();

    component.draftResult.set(draft);
    component.isDraftModalOpen.set(true);
    await component.publishArticle();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Mogelijk overlappend artikel gevonden',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'LEGO Star Wars 75461 Up-Scaled Darth Vader onthuld',
    );

    const forceButton = fixture.debugElement.query(
      By.css('button.admin-button--primary'),
    );

    await component.publishArticle({ force: true });

    expect(editorialAgentApi.publishArticle).toHaveBeenLastCalledWith({
      feedItemId: undefined,
      force: true,
      frontmatter: {
        ...draft.output.frontmatter,
        heroImage: '',
        status: 'published',
      },
      mdx: draft.output.mdx,
    });
    expect(forceButton).not.toBeNull();
  });

  it('copies the generated mdx to the clipboard', async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminEditorialAgentPageComponent],
      providers: [
        {
          provide: ContentAdminEditorialAgentApiService,
          useValue: editorialAgentApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      ContentAdminEditorialAgentPageComponent,
    );

    fixture.detectChanges();
    fixture.componentInstance.draftResult.set(createDraftResult());
    fixture.componentInstance.isDraftModalOpen.set(true);
    fixture.detectChanges();

    const copyButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Copy MDX'),
      );

    copyButton?.nativeElement.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Gekopieerd');
  });
});
