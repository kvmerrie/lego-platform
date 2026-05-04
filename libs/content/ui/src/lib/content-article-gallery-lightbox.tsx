'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ImageGallery, type CarouselImage } from '@lego-platform/shared/ui';

type ArticleGalleryEntryKind = 'featured' | 'gallery';

interface ArticleGalleryEntry {
  id: string;
  images: readonly CarouselImage[];
  kind: ArticleGalleryEntryKind;
  order: number;
}

interface ArticleGalleryLightboxContextValue {
  openImage: (entryId: string, imageIndex: number) => void;
  registerImages: (
    entryId: string,
    kind: ArticleGalleryEntryKind,
    images: readonly CarouselImage[],
  ) => void;
}

const ArticleGalleryLightboxContext =
  createContext<ArticleGalleryLightboxContextValue | null>(null);

function getEntryPriority(entry: ArticleGalleryEntry): number {
  return entry.kind === 'featured' ? 0 : 1;
}

function getCleanImages(
  images: readonly CarouselImage[],
): readonly CarouselImage[] {
  return images.filter(
    (image): image is CarouselImage =>
      Boolean(image?.src?.trim()) && Boolean(image?.alt?.trim()),
  );
}

function areImagesEqual(
  leftImages: readonly CarouselImage[] | undefined,
  rightImages: readonly CarouselImage[],
): boolean {
  if (!leftImages || leftImages.length !== rightImages.length) {
    return false;
  }

  return leftImages.every((leftImage, imageIndex) => {
    const rightImage = rightImages[imageIndex];

    return (
      leftImage.alt === rightImage.alt &&
      leftImage.caption === rightImage.caption &&
      leftImage.ctaHref === rightImage.ctaHref &&
      leftImage.ctaLabel === rightImage.ctaLabel &&
      leftImage.src === rightImage.src
    );
  });
}

export function ContentArticleGalleryLightboxProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<Record<string, ArticleGalleryEntry>>(
    {},
  );
  const [lightboxRequest, setLightboxRequest] = useState<{
    index: number;
    key: number;
  } | null>(null);
  const nextOrder = useRef(0);
  const nextRequestKey = useRef(0);
  const imageIndexMapRef = useRef(new Map<string, number>());

  const orderedEntries = useMemo(
    () =>
      Object.values(entries).sort((leftEntry, rightEntry) => {
        const priorityDelta =
          getEntryPriority(leftEntry) - getEntryPriority(rightEntry);

        return priorityDelta || leftEntry.order - rightEntry.order;
      }),
    [entries],
  );

  const groupedImages = useMemo(
    () => orderedEntries.flatMap((entry) => entry.images),
    [orderedEntries],
  );

  const imageIndexMap = useMemo(() => {
    const nextImageIndexMap = new Map<string, number>();
    let globalIndex = 0;

    for (const entry of orderedEntries) {
      for (let imageIndex = 0; imageIndex < entry.images.length; imageIndex++) {
        nextImageIndexMap.set(`${entry.id}:${imageIndex}`, globalIndex);
        globalIndex += 1;
      }
    }

    return nextImageIndexMap;
  }, [orderedEntries]);
  imageIndexMapRef.current = imageIndexMap;

  const registerImages = useCallback(
    (
      entryId: string,
      kind: ArticleGalleryEntryKind,
      images: readonly CarouselImage[],
    ) => {
      const cleanImages = getCleanImages(images);

      setEntries((currentEntries) => {
        if (!cleanImages.length) {
          if (!currentEntries[entryId]) {
            return currentEntries;
          }

          const { [entryId]: _removedEntry, ...remainingEntries } =
            currentEntries;

          return remainingEntries;
        }

        const currentEntry = currentEntries[entryId];

        if (
          currentEntry?.kind === kind &&
          areImagesEqual(currentEntry.images, cleanImages)
        ) {
          return currentEntries;
        }

        return {
          ...currentEntries,
          [entryId]: {
            id: entryId,
            images: cleanImages,
            kind,
            order: currentEntry?.order ?? nextOrder.current++,
          },
        };
      });
    },
    [],
  );

  const openImage = useCallback((entryId: string, imageIndex: number) => {
    const globalIndex =
      imageIndexMapRef.current.get(`${entryId}:${imageIndex}`) ?? 0;

    nextRequestKey.current += 1;
    setLightboxRequest({
      index: globalIndex,
      key: nextRequestKey.current,
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      openImage,
      registerImages,
    }),
    [openImage, registerImages],
  );

  return (
    <ArticleGalleryLightboxContext.Provider value={contextValue}>
      {children}
      <ImageGallery
        ariaLabel="Artikelbeelden"
        images={groupedImages}
        lightboxRequest={lightboxRequest}
        presentation="lightbox-only"
        variant="article"
      />
    </ArticleGalleryLightboxContext.Provider>
  );
}

export function useContentArticleGalleryLightbox() {
  return useContext(ArticleGalleryLightboxContext);
}

export function useContentArticleGalleryRegistration({
  images,
  kind,
}: {
  images: readonly CarouselImage[];
  kind: ArticleGalleryEntryKind;
}) {
  const context = useContentArticleGalleryLightbox();
  const entryId = useId();
  const cleanImages = useMemo(() => getCleanImages(images), [images]);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    context.registerImages(entryId, kind, cleanImages);

    return () => {
      context.registerImages(entryId, kind, []);
    };
  }, [cleanImages, context, entryId, kind]);

  return {
    entryId,
    openImage: context?.openImage,
  };
}

export function ContentArticleGalleryLightboxWidget({
  ariaLabel = 'Artikelgalerij',
  className,
  images,
}: {
  ariaLabel?: string;
  className?: string;
  images: readonly CarouselImage[];
}) {
  const { entryId, openImage } = useContentArticleGalleryRegistration({
    images,
    kind: 'gallery',
  });

  return (
    <ImageGallery
      ariaLabel={ariaLabel}
      className={className}
      images={images}
      onImageClick={
        openImage
          ? (imageIndex) => {
              openImage(entryId, imageIndex);
            }
          : undefined
      }
      variant="article"
    />
  );
}
