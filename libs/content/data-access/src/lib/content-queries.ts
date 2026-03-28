import { cloneEditorialPage, EditorialPage, PreviewPanel } from '@lego-platform/content/util';
import {
  editorialPages,
  homepageEditorialPage,
  previewPanel,
} from './content-mock-data';
import {
  fetchContentfulEditorialPages,
  isContentfulDeliveryEnabled,
} from './contentful-client';
import { mapContentfulEditorialPages } from './contentful-mappers';

async function loadEditorialPages(searchParams: {
  pageType?: 'homepage' | 'page';
  slug?: string;
}): Promise<EditorialPage[] | null> {
  if (!isContentfulDeliveryEnabled()) {
    return null;
  }

  const contentfulPages = await fetchContentfulEditorialPages(searchParams);

  if (!contentfulPages) {
    return null;
  }

  return mapContentfulEditorialPages(contentfulPages);
}

async function tryLoadEditorialPages(searchParams: {
  pageType?: 'homepage' | 'page';
  slug?: string;
}): Promise<EditorialPage[] | null> {
  try {
    return await loadEditorialPages(searchParams);
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

export async function getHomepagePage(): Promise<EditorialPage> {
  const contentfulPages = await tryLoadEditorialPages({
    pageType: 'homepage',
  });

  if (contentfulPages?.[0]) {
    return cloneEditorialPage(contentfulPages[0]);
  }

  return cloneEditorialPage(homepageEditorialPage);
}

export async function getEditorialPageBySlug(
  slug: string,
): Promise<EditorialPage | null> {
  const contentfulPages = await tryLoadEditorialPages({
    slug,
  });

  const contentfulPage = contentfulPages?.find(
    (editorialPage) => editorialPage.slug === slug,
  );

  if (contentfulPage) {
    return cloneEditorialPage(contentfulPage);
  }

  return getMockEditorialPageBySlug(slug);
}

export async function listEditorialPageSlugs(): Promise<string[]> {
  const contentfulPages = await tryLoadEditorialPages({
    pageType: 'page',
  });

  if (contentfulPages?.length) {
    return contentfulPages.flatMap((editorialPage) =>
      editorialPage.slug ? [editorialPage.slug] : [],
    );
  }

  return listMockEditorialPageSlugs();
}

export function getPreviewPanel(): PreviewPanel {
  return {
    ...previewPanel,
  };
}
