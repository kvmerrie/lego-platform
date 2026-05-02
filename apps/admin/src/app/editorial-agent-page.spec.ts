import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ContentAdminEditorialAgentApiService,
  ContentAdminEditorialAgentPageComponent,
} from '@lego-platform/content/feature-admin';
import type {
  EditorialAgentDraftGenerationResult,
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

describe('Editorial agent admin page', () => {
  const editorialAgentApi = {
    extractSourceFacts: vi.fn(async () => createExtractionResult()),
    generateDraft: vi.fn(async () => createDraftResult()),
  };

  beforeEach(() => {
    editorialAgentApi.extractSourceFacts.mockResolvedValue(
      createExtractionResult(),
    );
    editorialAgentApi.generateDraft.mockResolvedValue(createDraftResult());
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    const generateButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Analyseer URL'),
      );

    generateButton?.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Analyse draait');

    await vi.waitFor(() => {
      fixture.detectChanges();

      const textarea = fixture.nativeElement.querySelector(
        'textarea',
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

    const analyseButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) =>
        (button.nativeElement.textContent as string).includes('Analyseer URL'),
      );

    analyseButton?.nativeElement.click();
    fixture.detectChanges();

    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Voer een geldige bron-URL in.',
    );
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
