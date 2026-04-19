import { describe, expect, test } from 'vitest';
import {
  assessCommerceGeneratedSeedCandidate,
  buildCommerceGeneratedSeedSearchUrl,
  buildGeneratedCommerceSeedCandidateNote,
  isGeneratedCommerceSeedNote,
} from './commerce-seed-generation-util';

describe('commerce seed generation util', () => {
  test('builds deterministic merchant search urls from the set id', () => {
    expect(
      buildCommerceGeneratedSeedSearchUrl({
        merchantSlug: 'intertoys',
        setId: '76437',
      }),
    ).toBe('https://www.intertoys.nl/search?searchTerm=76437');
    expect(
      buildCommerceGeneratedSeedSearchUrl({
        merchantSlug: 'proshop',
        setId: '76437',
      }),
    ).toBe('https://www.proshop.nl/?s=76437');
  });

  test('marks generator notes with a stable machine prefix', () => {
    const note = buildGeneratedCommerceSeedCandidateNote({
      merchantSlug: 'intertoys',
      setId: '76437',
    });

    expect(isGeneratedCommerceSeedNote(note)).toBe(true);
    expect(isGeneratedCommerceSeedNote('handmatig toegevoegd')).toBe(false);
  });

  test('validates a strong lego product match', () => {
    const assessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: '76437',
        setName: 'The Burrow – Collectors’ Edition',
        pieceCount: 2405,
      },
      url: 'https://www.intertoys.nl/the-burrow-collectors-edition-76437',
      contextText:
        'LEGO Harry Potter 76437 The Burrow Collectors Edition 2405 stukjes direct leverbaar',
    });

    expect(assessment.decision).toBe('valid');
    expect(assessment.signals.exactSetIdMatch).toBe(true);
    expect(assessment.signals.legoBrandSignal).toBe(true);
  });

  test('accepts a localized product title when set number and LEGO brand still match strongly', () => {
    const assessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: '76437',
        setName: 'The Burrow – Collectors’ Edition',
        pieceCount: 2405,
      },
      url: 'https://misterbricks.nl/lego-harry-potter-76437-het-nest-verzameleditie.html',
      contextText: 'LEGO Harry Potter 76437 Het Nest – Verzameleditie',
    });

    expect(assessment.decision).toBe('valid');
    expect(assessment.signals.exactSetIdMatch).toBe(true);
    expect(assessment.signals.legoBrandSignal).toBe(true);
    expect(assessment.signals.accessorySignal).toBe(false);
  });

  test('rejects obvious accessory or lighting-kit mismatches', () => {
    const assessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: '76437',
        setName: 'The Burrow – Collectors’ Edition',
        pieceCount: 2405,
      },
      url: 'https://www.example.com/led-lighting-kit-for-76437',
      contextText:
        'LED lighting kit for LEGO 76437 The Burrow Collectors Edition display case',
    });

    expect(assessment.decision).toBe('invalid');
    expect(assessment.signals.accessorySignal).toBe(true);
  });

  test('rejects pages that point at another set number instead', () => {
    const assessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: '76437',
        setName: 'The Burrow – Collectors’ Edition',
        pieceCount: 2405,
      },
      url: 'https://www.example.com/76435-hogwarts-castle',
      contextText: 'LEGO Harry Potter 76435 Hogwarts Castle Great Hall',
    });

    expect(assessment.decision).toBe('invalid');
    expect(assessment.signals.otherSetNumbers).toContain('76435');
  });
});
