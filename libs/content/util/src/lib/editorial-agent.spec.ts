import { describe, expect, it } from 'vitest';
import {
  createEditorialAgentMockOutput,
  editorialAgentArticleComponentManifest,
  editorialAgentSetRailPropName,
  formatEditorialAgentSetIdsForMdx,
  formatSetRailSetIdsForMdx,
  formatSetSpotlightListSetIdsForMdx,
  editorialAgentWritingGuidelines,
} from './editorial-agent';

describe('editorial agent utilities', () => {
  it('includes FeaturedSet in the article component manifest', () => {
    expect(
      editorialAgentArticleComponentManifest.some(
        (item) => item.name === 'FeaturedSet',
      ),
    ).toBe(true);
  });

  it('keeps SetRail in the article component manifest', () => {
    expect(
      editorialAgentArticleComponentManifest.some(
        (item) => item.name === 'SetRail',
      ),
    ).toBe(true);
  });

  it('includes SetSpotlightList in the article component manifest', () => {
    const manifestItem = editorialAgentArticleComponentManifest.find(
      (item) => item.name === 'SetSpotlightList',
    );

    expect(manifestItem).toBeDefined();
    expect(manifestItem?.usage).toContain(`${editorialAgentSetRailPropName}="`);
    expect(manifestItem?.goal).toContain('ontdekken');
  });

  it('keeps manifest usage and mock MDX aligned on the SetRail prop name', () => {
    const manifestUsage = editorialAgentArticleComponentManifest.find(
      (item) => item.name === 'SetRail',
    )?.usage;
    const output = createEditorialAgentMockOutput();

    expect(manifestUsage).toContain(`${editorialAgentSetRailPropName}="`);
    expect(manifestUsage).not.toContain('setNumbers=');
    expect(manifestUsage).not.toContain(`${editorialAgentSetRailPropName}={[`);
    expect(output.mdx).toContain(
      `<SetRail title="Mario Kart-sets voor naast de Spiny Shell" ${editorialAgentSetRailPropName}="72050, 72037"`,
    );
    expect(output.mdx).not.toContain('setNumbers=');
    expect(output.mdx).not.toContain(`${editorialAgentSetRailPropName}={[`);
  });

  it('formats SetRail set ids for runtime-safe MDX strings', () => {
    expect(
      formatSetRailSetIdsForMdx([
        ' 72050 ',
        '72037',
        '',
        '72050',
        '72051',
        '72052',
        '72053',
        '72054',
        '72055',
      ]),
    ).toBe('72050, 72037, 72051, 72052, 72053, 72054');
  });

  it('formats SetSpotlightList set ids without introducing duplicates or empty values', () => {
    expect(
      formatSetSpotlightListSetIdsForMdx([
        ' 11506 ',
        '',
        '43301',
        '11506',
        '43304',
      ]),
    ).toBe('11506, 43301, 43304');
  });

  it('can format generic MDX set-id strings with or without a max item limit', () => {
    expect(
      formatEditorialAgentSetIdsForMdx(['11506', '43301', '43304'], {
        maxItems: 2,
      }),
    ).toBe('11506, 43301');
    expect(formatEditorialAgentSetIdsForMdx(['11506', '43301', '43304'])).toBe(
      '11506, 43301, 43304',
    );
  });

  it('exports anti-repetition writing guidance for future generation flows', () => {
    expect(
      editorialAgentWritingGuidelines.some(
        (guideline) => guideline.id === 'anti-repetition',
      ),
    ).toBe(true);
  });

  it('exports concrete buy-advice guidance for future generation flows', () => {
    expect(
      editorialAgentWritingGuidelines.some(
        (guideline) => guideline.id === 'concrete-buy-advice',
      ),
    ).toBe(true);
  });

  it('exports article-type tone guidance for future generation flows', () => {
    expect(
      editorialAgentWritingGuidelines.some(
        (guideline) => guideline.id === 'article-type-tone',
      ),
    ).toBe(true);
  });

  it('exports related SetRail guidance for future generation flows', () => {
    expect(
      editorialAgentWritingGuidelines.some(
        (guideline) => guideline.id === 'related-set-rail',
      ),
    ).toBe(true);
  });

  it('creates mock output with draft frontmatter and FeaturedSet MDX', () => {
    const output = createEditorialAgentMockOutput({
      sourceUrl: 'https://example.com/mario-kart',
    });
    const mdxBody = output.mdx.replace(/^---[\s\S]*?---\n\n/u, '');
    const [introParagraph = '', secondParagraph = ''] = mdxBody.split('\n\n');
    const firstVisibleSection = mdxBody.split('<FeaturedSet')[0] ?? '';
    const repeatedSetName = 'LEGO 40787 Mario Kart – Spiny Shell';

    expect(output.frontmatter.status).toBe('draft');
    expect(output.frontmatter.description).not.toBe(output.frontmatter.title);
    expect(output.frontmatter.description.startsWith(repeatedSetName)).toBe(
      false,
    );
    expect(introParagraph.startsWith(repeatedSetName)).toBe(false);
    expect(secondParagraph.length).toBeGreaterThan(0);
    expect(
      firstVisibleSection.match(/LEGO 40787 Mario Kart – Spiny Shell/gu)
        ?.length ?? 0,
    ).toBeLessThanOrEqual(1);
    expect(output.mdx).toContain('<FeaturedSet setNumber="40787" />');
    expect(output.mdx).toContain('## Wanneer kopen?');
    expect(output.mdx).toContain(
      'Heb je genoeg Insiders-punten en wil je de Spiny Shell echt hebben, pak hem dan nu.',
    );
    expect(output.mdx).toContain(
      'Moet je eerst nog punten sparen of extra aankopen doen om hem te krijgen? Dan zou ik hem laten lopen.',
    );
    expect(output.mdx).toContain('## Leuk voor erbij');
    expect(output.mdx).toContain('## Korte conclusie');
    expect(output.mdx).toContain(
      'Een Spiny Shell is leuk, maar hij wordt pas echt grappig als er ook een Mario of Luigi is om van de baan te kegelen.',
    );
    expect(output.mdx).toContain(
      '<SetRail title="Mario Kart-sets voor naast de Spiny Shell"',
    );
    expect(output.mdx).toContain('setIds="72050, 72037"');
    expect(output.mdx).not.toContain('setIds={[');
    expect(output.mdx).not.toContain('<SetRail title="Gerelateerde sets"');
    expect(
      output.mdx.indexOf('<FeaturedSet setNumber="40787" />'),
    ).toBeLessThan(output.mdx.indexOf('<SetRail title='));
    expect(output.relatedSets).toHaveLength(2);
    expect(output.relatedSets.length).toBeLessThanOrEqual(6);
    const setRailSetIdMatches = output.mdx.match(/\b\d{5}\b/gu) ?? [];
    const relatedRailIds = setRailSetIdMatches.filter((setId) =>
      ['72050', '72037'].includes(setId),
    );
    expect(relatedRailIds).toEqual(['72050', '72037']);
    expect(new Set(relatedRailIds).size).toBeLessThanOrEqual(6);
    expect(output.mdx).toContain('Bron: [LEGO Insiders rewardpagina]');
  });
});
