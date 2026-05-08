import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCatalogSearchMatches = vi.fn();
const listCatalogSearchSuggestionSetCards = vi.fn();
const listCatalogThemeDirectoryItems = vi.fn();

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  listCatalogSearchMatches,
  listCatalogSearchSuggestionSetCards,
  listCatalogThemeDirectoryItems,
}));

const mercedesSetCard = {
  id: '42177',
  imageUrl: 'https://cdn.example.test/42177.jpg',
  name: 'Mercedes-Benz G 500 Professional Line',
  pieces: 2891,
  releaseYear: 2024,
  slug: 'mercedes-benz-g-500-professional-line-42177',
  theme: 'Technic',
};

const c3poSetCard = {
  id: '75398',
  imageUrl: 'https://cdn.example.test/75398.jpg',
  name: 'C-3PO',
  pieces: 1138,
  releaseYear: 2024,
  slug: 'c-3po-75398',
  theme: 'Star Wars',
};

const atAtSetCard = {
  id: '75440',
  imageUrl: 'https://cdn.example.test/75440.jpg',
  name: 'AT-AT',
  pieces: 525,
  releaseYear: 2025,
  slug: 'at-at-75440',
  theme: 'Star Wars',
};

describe('catalog search suggestions route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listCatalogThemeDirectoryItems.mockResolvedValue([]);
    listCatalogSearchSuggestionSetCards.mockResolvedValue([]);
    listCatalogSearchMatches.mockImplementation(
      ({ query }: { query: string }) => {
        if (
          [
            '42177',
            'Mercedes-Benz G 500',
            'mercedes-benz-g-500-professional-line-42177',
          ].includes(query)
        ) {
          return Promise.resolve([{ score: 0, setCard: mercedesSetCard }]);
        }

        if (['75398', 'C-3PO'].includes(query)) {
          return Promise.resolve([{ score: 0, setCard: c3poSetCard }]);
        }

        if (['75440', 'AT-AT'].includes(query)) {
          return Promise.resolve([{ score: 0, setCard: atAtSetCard }]);
        }

        return Promise.resolve([]);
      },
    );
  });

  it.each([
    ['42177', mercedesSetCard],
    ['75398', c3poSetCard],
    ['75440', atAtSetCard],
    ['Mercedes-Benz G 500', mercedesSetCard],
    ['C-3PO', c3poSetCard],
    ['AT-AT', atAtSetCard],
    ['mercedes-benz-g-500-professional-line-42177', mercedesSetCard],
  ])(
    'uses direct bounded catalog search for autosuggest query %s',
    async (query, expectedSetCard) => {
      const { GET } = await import('./route');

      const response = await GET(
        new Request(
          `https://brickhunt.test/api/catalog/search-suggestions?q=${encodeURIComponent(
            query,
          )}`,
        ),
      );

      await expect(response.json()).resolves.toEqual({
        query,
        sets: [expectedSetCard],
        themes: [],
      });
      expect(listCatalogSearchMatches).toHaveBeenCalledWith({
        limit: 6,
        query,
      });
      expect(listCatalogSearchSuggestionSetCards).not.toHaveBeenCalled();
    },
  );

  it('keeps empty-query preload bounded without direct search', async () => {
    listCatalogSearchSuggestionSetCards.mockResolvedValue([mercedesSetCard]);
    const { GET } = await import('./route');

    const response = await GET(
      new Request('https://brickhunt.test/api/catalog/search-suggestions'),
    );

    await expect(response.json()).resolves.toEqual({
      query: '',
      sets: [mercedesSetCard],
      themes: [],
    });
    expect(listCatalogSearchSuggestionSetCards).toHaveBeenCalledWith({
      limit: 24,
    });
    expect(listCatalogSearchMatches).not.toHaveBeenCalled();
  });
});
