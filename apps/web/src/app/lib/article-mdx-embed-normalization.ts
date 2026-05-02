import type { CarouselImage } from '@lego-platform/shared/ui';
import { getCanonicalCatalogSetId } from '@lego-platform/catalog/util';
import type { ContentArticleFaqItem } from '@lego-platform/content/ui';

function splitCommaSeparatedValues(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseJsonArrayInput(input: string): unknown[] | undefined {
  const trimmedInput = input.trim();

  if (!trimmedInput.startsWith('[')) {
    return undefined;
  }

  try {
    const parsedInput = JSON.parse(trimmedInput);

    return Array.isArray(parsedInput) ? parsedInput : undefined;
  } catch {
    return undefined;
  }
}

function parseStructuredImageString(input: string): CarouselImage[] {
  if (!input.includes('::') && !input.includes(';;')) {
    return [];
  }

  return input
    .split(';;')
    .map((imageEntry) => imageEntry.trim())
    .filter(Boolean)
    .flatMap((imageEntry, imageIndex) => {
      const [src = '', alt = '', caption = ''] = imageEntry
        .split('::')
        .map((imagePart) => imagePart.trim());

      if (!src) {
        return [];
      }

      return [
        {
          alt: alt || `Artikelafbeelding ${imageIndex + 1}`,
          caption: caption || undefined,
          src,
        },
      ];
    });
}

export function normalizeSetRailIds(
  setIds?:
    | readonly string[]
    | Record<string, readonly string[] | string | number | undefined>
    | string,
): string[] {
  if (!setIds) {
    return [];
  }

  const resolvedSetIds = normalizeSetRailIdEntry(setIds);

  return [
    ...new Set(
      resolvedSetIds
        .map((setId) => getCanonicalCatalogSetId(setId.trim()))
        .filter(Boolean),
    ),
  ];
}

function normalizeSetRailIdEntry(
  setIdEntry:
    | readonly string[]
    | Record<string, readonly string[] | string | number | undefined>
    | string
    | number
    | undefined,
): string[] {
  if (typeof setIdEntry === 'string') {
    return (
      parseJsonArrayInput(setIdEntry)?.flatMap((setId) =>
        typeof setId === 'string' || typeof setId === 'number'
          ? splitCommaSeparatedValues(String(setId))
          : [],
      ) ?? splitCommaSeparatedValues(setIdEntry)
    );
  }

  if (typeof setIdEntry === 'number') {
    return [String(setIdEntry)];
  }

  if (Array.isArray(setIdEntry)) {
    return setIdEntry.flatMap((setId) =>
      splitCommaSeparatedValues(String(setId)),
    );
  }

  if (typeof setIdEntry === 'object' && setIdEntry !== null) {
    return Object.values(setIdEntry).flatMap((value) =>
      normalizeSetRailIdEntry(value),
    );
  }

  return [];
}

export function normalizeFeaturedSetId(setNumber?: string): string | undefined {
  if (typeof setNumber !== 'string' || setNumber.trim().length === 0) {
    return undefined;
  }

  const canonicalId = getCanonicalCatalogSetId(setNumber.trim());

  return canonicalId || undefined;
}

function normalizeImageEntry(imageEntry: unknown): CarouselImage[] {
  if (typeof imageEntry === 'string') {
    const jsonImages = parseJsonArrayInput(imageEntry);

    if (jsonImages) {
      return jsonImages.flatMap((jsonImage) =>
        normalizeImageEntry(jsonImage as CarouselImage | string),
      );
    }

    const structuredImages = parseStructuredImageString(imageEntry);

    if (structuredImages.length) {
      return structuredImages;
    }

    return splitCommaSeparatedValues(imageEntry).map(
      (imageSrc, imageIndex) => ({
        alt: `Artikelafbeelding ${imageIndex + 1}`,
        src: imageSrc,
      }),
    );
  }

  if (Array.isArray(imageEntry)) {
    return imageEntry.flatMap((entry) =>
      normalizeImageEntry(entry as CarouselImage | string),
    );
  }

  if (
    typeof imageEntry === 'object' &&
    imageEntry !== null &&
    'src' in imageEntry &&
    typeof imageEntry.src === 'string'
  ) {
    const normalizedImageEntry = imageEntry as {
      alt?: unknown;
      caption?: unknown;
      src: string;
    };

    if (normalizedImageEntry.src.includes(';;')) {
      return normalizeImageEntry(normalizedImageEntry.src);
    }

    const normalizedAlt =
      typeof normalizedImageEntry.alt === 'string' &&
      normalizedImageEntry.alt.trim().length > 0
        ? normalizedImageEntry.alt.trim()
        : 'Artikelafbeelding';

    return [
      {
        alt: normalizedAlt,
        caption:
          typeof normalizedImageEntry.caption === 'string' &&
          normalizedImageEntry.caption.trim()
            ? normalizedImageEntry.caption.trim()
            : undefined,
        src: normalizedImageEntry.src.trim(),
      },
    ];
  }

  if (typeof imageEntry === 'object' && imageEntry !== null) {
    return Object.values(imageEntry).flatMap((entry) =>
      normalizeImageEntry(entry),
    );
  }

  return [];
}

export function normalizeImageCarouselImages(
  images?: readonly CarouselImage[] | Record<string, CarouselImage> | string,
): CarouselImage[] {
  if (!images) {
    return [];
  }

  return normalizeImageEntry(images).filter(
    (image): image is CarouselImage =>
      Boolean(image?.src?.trim()) && Boolean(image?.alt?.trim()),
  );
}

function parseStructuredFaqString(input: string): ContentArticleFaqItem[] {
  if (!input.includes('::') && !input.includes(';;')) {
    return [];
  }

  return input
    .split(';;')
    .map((faqEntry) => faqEntry.trim())
    .filter(Boolean)
    .flatMap((faqEntry) => {
      const [question = '', ...answerParts] = faqEntry
        .split('::')
        .map((faqPart) => faqPart.trim());
      const answer = answerParts.join('::').trim();

      if (!question || !answer) {
        return [];
      }

      return [
        {
          answer,
          question,
        },
      ];
    });
}

function normalizeFaqEntry(faqEntry: unknown): ContentArticleFaqItem[] {
  if (typeof faqEntry === 'string') {
    const jsonItems = parseJsonArrayInput(faqEntry);

    if (jsonItems) {
      return jsonItems.flatMap((jsonItem) => normalizeFaqEntry(jsonItem));
    }

    return parseStructuredFaqString(faqEntry);
  }

  if (Array.isArray(faqEntry)) {
    return faqEntry.flatMap((entry) => normalizeFaqEntry(entry));
  }

  if (
    typeof faqEntry === 'object' &&
    faqEntry !== null &&
    'question' in faqEntry &&
    'answer' in faqEntry
  ) {
    const normalizedFaqEntry = faqEntry as {
      answer?: unknown;
      question?: unknown;
    };
    const question =
      typeof normalizedFaqEntry.question === 'string'
        ? normalizedFaqEntry.question.trim()
        : '';
    const answer =
      typeof normalizedFaqEntry.answer === 'string'
        ? normalizedFaqEntry.answer.trim()
        : '';

    return question && answer
      ? [
          {
            answer,
            question,
          },
        ]
      : [];
  }

  if (typeof faqEntry === 'object' && faqEntry !== null) {
    return Object.values(faqEntry).flatMap((entry) => normalizeFaqEntry(entry));
  }

  return [];
}

export function normalizeFaqItems(
  items?:
    | readonly ContentArticleFaqItem[]
    | Record<string, ContentArticleFaqItem>
    | string,
): ContentArticleFaqItem[] {
  if (!items) {
    return [];
  }

  return normalizeFaqEntry(items).filter(
    (item): item is ContentArticleFaqItem =>
      Boolean(item?.question?.trim()) && Boolean(item?.answer?.trim()),
  );
}
