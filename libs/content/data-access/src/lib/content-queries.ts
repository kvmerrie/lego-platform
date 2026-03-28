import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';
import { cloneEditorialPage } from '@lego-platform/content/util';
import {
  editorialPages,
  homepageEditorialPage,
  previewPanel,
} from './content-mock-data';
import {
  type ContentQueryMode,
  fetchContentfulEditorialPages,
  isContentfulModeEnabled,
  shouldUseMockPreviewContent,
} from './contentful-client';
import { mapContentfulEditorialPages } from './contentful-mappers';

export interface ContentQueryOptions {
  mode?: ContentQueryMode;
}

function resolveContentQueryMode(
  options?: ContentQueryOptions,
): ContentQueryMode {
  return options?.mode ?? 'delivery';
}

async function loadEditorialPages(searchParams: {
  pageType?: 'homepage' | 'page';
  slug?: string;
}, options?: ContentQueryOptions): Promise<EditorialPage[] | null> {
  const mode = resolveContentQueryMode(options);

  if (!isContentfulModeEnabled(mode)) {
    if (mode === 'preview' && !shouldUseMockPreviewContent()) {
      throw new Error('Contentful preview credentials are not configured.');
    }

    return null;
  }

  const contentfulPages = await fetchContentfulEditorialPages(searchParams, {
    mode,
  });

  if (!contentfulPages) {
    return null;
  }

  return mapContentfulEditorialPages(contentfulPages);
}

async function tryLoadDeliveryEditorialPages(searchParams: {
  pageType?: 'homepage' | 'page';
  slug?: string;
}): Promise<EditorialPage[] | null> {
  try {
    return await loadEditorialPages(searchParams, {
      mode: 'delivery',
    });
  } catch {
    return null;
  }
}

function getMockEditorialPageBySlug(slug: string): EditorialPage | null {
  const editorialPage = editorialPages.find(
    (mockEditorialPage) => mockEditorialPage.slug === slug,
  );

  return editorialPage ? cloneEditorialPage(editorialPage) : null;
}

function listMockEditorialPageSlugs(): string[] {
  return editorialPages.flatMap((editorialPage) =>
    editorialPage.slug ? [editorialPage.slug] : [],
  );
}

export async function getHomepagePage(
  options?: ContentQueryOptions,
): Promise<EditorialPage> {
  const mode = resolveContentQueryMode(options);

  if (mode === 'preview' && shouldUseMockPreviewContent()) {
    return cloneEditorialPage(homepageEditorialPage);
  }

  const contentfulPages =
    mode === 'preview'
      ? await loadEditorialPages(
          {
            pageType: 'homepage',
          },
          { mode },
        )
      : await tryLoadDeliveryEditorialPages({
          pageType: 'homepage',
        });

  if (contentfulPages?.[0]) {
    return cloneEditorialPage(contentfulPages[0]);
  }

  if (mode === 'preview') {
    throw new Error('Unable to load homepage preview content.');
  }

  return cloneEditorialPage(homepageEditorialPage);
}

export async function getEditorialPageBySlug(
  slug: string,
  options?: ContentQueryOptions,
): Promise<EditorialPage | null> {
  const mode = resolveContentQueryMode(options);

  if (mode === 'preview' && shouldUseMockPreviewContent()) {
    return getMockEditorialPageBySlug(slug);
  }

  const contentfulPages =
    mode === 'preview'
      ? await loadEditorialPages(
          {
            slug,
          },
          { mode },
        )
      : await tryLoadDeliveryEditorialPages({
          slug,
        });

  const contentfulPage = contentfulPages?.find(
    (editorialPage) => editorialPage.slug === slug,
  );

  if (contentfulPage) {
    return cloneEditorialPage(contentfulPage);
  }

  return mode === 'preview' ? null : getMockEditorialPageBySlug(slug);
}

export async function listEditorialPageSlugs(
  options?: ContentQueryOptions,
): Promise<string[]> {
  const mode = resolveContentQueryMode(options);

  if (mode === 'preview' && shouldUseMockPreviewContent()) {
    return listMockEditorialPageSlugs();
  }

  const contentfulPages =
    mode === 'preview'
      ? await loadEditorialPages(
          {
            pageType: 'page',
          },
          { mode },
        )
      : await tryLoadDeliveryEditorialPages({
          pageType: 'page',
        });

  if (contentfulPages?.length) {
    return contentfulPages.flatMap((editorialPage) =>
      editorialPage.slug ? [editorialPage.slug] : [],
    );
  }

  return mode === 'preview' ? [] : listMockEditorialPageSlugs();
}

export function getPreviewPanel(): PreviewPanel {
  return {
    ...previewPanel,
  };
}
