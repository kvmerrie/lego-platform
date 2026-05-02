import type { ArticleSetSpotlightItem } from './article-mdx-set-spotlight-types';

const POPULAR_THEMES = new Set([
  'Star Wars',
  'Disney',
  'Jurassic World',
  'Icons',
  'Technic',
]);

const FANDOM_ENTITY_PATTERN =
  /\b(starfighter|grogu|mandalorian|lotso|alien|ferrari|jurassic|zelda)\b/iu;
const ACCESSORY_PATTERN =
  /\b(reward|gwp|insiders|sleutelhanger|keychain|key chain|ornament|patch)\b/iu;
const TOY_STORY_PATTERN = /\b(toy story|lotso|woody|buzz|jessie)\b/iu;
const STAR_WARS_PATTERN =
  /\b(star wars|starfighter|mandalorian|grogu|x-wing|tie|jedi)\b/iu;
const SPORT_PATTERN =
  /\b(ferrari|formula\s?1|f1|football|soccer|u-s-soccer|racing)\b/iu;
const NAME_TOKEN_STOPWORDS = new Set([
  'lego',
  'the',
  'and',
  'with',
  'for',
  'set',
  'plus',
]);

export interface ArticleSetSpotlightHighlightContext {
  articleDescription?: string;
  articleTitle?: string;
}

export interface ArticleSetSpotlightSection {
  description?: string;
  highlightSetNumber?: string;
  id: string;
  items: readonly ArticleSetSpotlightItem[];
  layoutVariant: 'single' | 'pair' | 'trio' | 'cluster';
  title: string;
}

const GROUP_PRIORITY_RANK = new Map<string, number>([
  ['star-wars', 0],
  ['toy-story-disney', 1],
  ['sport-racing', 2],
  ['botanicals', 3],
  ['other', 99],
]);

function normalizeText(value?: string): string {
  return value?.trim().toLocaleLowerCase('nl-NL') ?? '';
}

function extractMeaningfulNameTokens(name: string): string[] {
  return name
    .toLocaleLowerCase('nl-NL')
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5 && !NAME_TOKEN_STOPWORDS.has(token));
}

function toKebabCase(value: string): string {
  return value
    .toLocaleLowerCase('nl-NL')
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function scoreTitleAndDescriptionMatch({
  articleContext,
  item,
}: {
  articleContext: ArticleSetSpotlightHighlightContext;
  item: ArticleSetSpotlightItem;
}): number {
  const sourceText = normalizeText(
    `${articleContext.articleTitle ?? ''} ${articleContext.articleDescription ?? ''}`,
  );

  if (!sourceText) {
    return 0;
  }

  if (sourceText.includes(item.setSummary.id.toLocaleLowerCase('nl-NL'))) {
    return 20;
  }

  const meaningfulTokens = extractMeaningfulNameTokens(item.setSummary.name);
  const matchedTokenCount = meaningfulTokens.filter((token) =>
    sourceText.includes(token),
  ).length;

  return matchedTokenCount >= 2 ? 20 : matchedTokenCount >= 1 ? 10 : 0;
}

function scorePieces({
  highestPieces,
  item,
}: {
  highestPieces: number;
  item: ArticleSetSpotlightItem;
}): number {
  if (typeof item.setSummary.pieces !== 'number' || highestPieces <= 0) {
    return 0;
  }

  if (item.setSummary.pieces >= highestPieces * 0.75) {
    return 10;
  }

  if (item.setSummary.pieces <= highestPieces * 0.25) {
    return -5;
  }

  return 0;
}

export function scoreSpotlightHighlightItem({
  articleContext,
  highestPieces,
  item,
}: {
  articleContext: ArticleSetSpotlightHighlightContext;
  highestPieces: number;
  item: ArticleSetSpotlightItem;
}): number {
  let score = 0;

  if (item.availabilityLabel || item.priceContext?.coverageLabel) {
    score += 20;
  }

  if (item.priceValue || item.priceContext?.currentPrice) {
    score += 10;
  }

  score += scorePieces({
    highestPieces,
    item,
  });

  if (item.setSummary.theme && POPULAR_THEMES.has(item.setSummary.theme)) {
    score += 8;
  }

  if (FANDOM_ENTITY_PATTERN.test(item.setSummary.name)) {
    score += 8;
  }

  score += scoreTitleAndDescriptionMatch({
    articleContext,
    item,
  });

  if (ACCESSORY_PATTERN.test(item.setSummary.name)) {
    score -= 10;
  }

  return score;
}

export function selectSpotlightHighlightSet(
  items: readonly ArticleSetSpotlightItem[],
  articleContext: ArticleSetSpotlightHighlightContext = {},
): ArticleSetSpotlightItem | null {
  if (!items.length) {
    return null;
  }

  const highestPieces = Math.max(
    0,
    ...items.map((item) => item.setSummary.pieces ?? 0),
  );
  let selectedItem = items[0];
  let selectedScore = scoreSpotlightHighlightItem({
    articleContext,
    highestPieces,
    item: items[0],
  });

  for (const item of items.slice(1)) {
    const itemScore = scoreSpotlightHighlightItem({
      articleContext,
      highestPieces,
      item,
    });

    if (itemScore > selectedScore) {
      selectedItem = item;
      selectedScore = itemScore;
    }
  }

  return selectedItem;
}

export function orderSpotlightItemsForEditorialShowcase(
  items: readonly ArticleSetSpotlightItem[],
  articleContext: ArticleSetSpotlightHighlightContext = {},
): ArticleSetSpotlightItem[] {
  const highlightItem = selectSpotlightHighlightSet(items, articleContext);

  if (!highlightItem) {
    return [];
  }

  return [
    highlightItem,
    ...items.filter(
      (item) => item.setSummary.id !== highlightItem.setSummary.id,
    ),
  ];
}

function getSpotlightSectionCopy({
  groupId,
  themeLabel,
}: {
  groupId: string;
  themeLabel?: string;
}): {
  description?: string;
  title: string;
} {
  if (groupId === 'star-wars') {
    return {
      description: 'Voor wie meteen naar de grote displaysets kijkt.',
      title: 'Star Wars',
    };
  }

  if (groupId === 'toy-story-disney') {
    return {
      description: 'Herkenbare builds met veel karakter.',
      title: 'Toy Story & Disney',
    };
  }

  if (groupId === 'sport-racing') {
    return {
      description: 'Voor fans die LEGO ook graag als displayobject neerzetten.',
      title: 'Sport en racing',
    };
  }

  if (groupId === 'botanicals') {
    return {
      description:
        'Lichtere builds die het vooral van kleur en displaycharme moeten hebben.',
      title: 'Botanicals',
    };
  }

  if (groupId === 'other') {
    return {
      description:
        'De sets die net buiten de grote thema’s vallen, maar wel leuk kunnen verrassen.',
      title: 'Overige releases',
    };
  }

  return {
    title: themeLabel ?? 'Overige releases',
  };
}

function resolveSpotlightGroupKey(item: ArticleSetSpotlightItem): {
  groupId: string;
  themeLabel?: string;
} {
  const name = normalizeText(item.setSummary.name);
  const theme = item.setSummary.theme?.trim();

  if (theme === 'Star Wars' || STAR_WARS_PATTERN.test(name)) {
    return {
      groupId: 'star-wars',
      themeLabel: 'Star Wars',
    };
  }

  if (theme === 'Disney' || TOY_STORY_PATTERN.test(name)) {
    return {
      groupId: 'toy-story-disney',
      themeLabel: 'Disney',
    };
  }

  if (theme === 'Botanicals') {
    return {
      groupId: 'botanicals',
      themeLabel: 'Botanicals',
    };
  }

  if (
    theme === 'Speed Champions' ||
    SPORT_PATTERN.test(name) ||
    normalizeText(theme).includes('racing') ||
    normalizeText(theme).includes('sport')
  ) {
    return {
      groupId: 'sport-racing',
      themeLabel: theme,
    };
  }

  if (!theme || normalizeText(theme) === 'multiple') {
    return {
      groupId: 'other',
    };
  }

  return {
    groupId: toKebabCase(theme),
    themeLabel: theme,
  };
}

function getSectionLayoutVariant(
  itemCount: number,
): ArticleSetSpotlightSection['layoutVariant'] {
  if (itemCount <= 1) {
    return 'single';
  }

  if (itemCount === 2) {
    return 'pair';
  }

  if (itemCount === 3) {
    return 'trio';
  }

  return 'cluster';
}

export function buildSpotlightSectionsForEditorialShowcase(
  items: readonly ArticleSetSpotlightItem[],
  articleContext: ArticleSetSpotlightHighlightContext = {},
): readonly ArticleSetSpotlightSection[] {
  if (!items.length) {
    return [];
  }

  const groups = new Map<
    string,
    {
      firstIndex: number;
      items: ArticleSetSpotlightItem[];
      themeLabel?: string;
    }
  >();

  items.forEach((item, index) => {
    const { groupId, themeLabel } = resolveSpotlightGroupKey(item);
    const existingGroup = groups.get(groupId);

    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    groups.set(groupId, {
      firstIndex: index,
      items: [item],
      themeLabel,
    });
  });

  return [...groups.entries()]
    .sort((left, right) => {
      const [leftId, leftGroup] = left;
      const [rightId, rightGroup] = right;
      const leftRank = GROUP_PRIORITY_RANK.get(leftId) ?? 50;
      const rightRank = GROUP_PRIORITY_RANK.get(rightId) ?? 50;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (leftGroup.items.length !== rightGroup.items.length) {
        return rightGroup.items.length - leftGroup.items.length;
      }

      return leftGroup.firstIndex - rightGroup.firstIndex;
    })
    .map(([groupId, group]) => {
      const highlightItem = selectSpotlightHighlightSet(
        group.items,
        articleContext,
      );
      const orderedItems = orderSpotlightItemsForEditorialShowcase(
        group.items,
        articleContext,
      );
      const sectionCopy = getSpotlightSectionCopy({
        groupId,
        themeLabel: group.themeLabel,
      });

      return {
        description: sectionCopy.description,
        highlightSetNumber: highlightItem?.setSummary.id,
        id: groupId,
        items: orderedItems,
        layoutVariant: getSectionLayoutVariant(orderedItems.length),
        title: sectionCopy.title,
      } satisfies ArticleSetSpotlightSection;
    });
}
