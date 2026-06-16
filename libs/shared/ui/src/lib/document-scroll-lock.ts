'use client';

import {
  preserveHeaderVisibility,
  runWithProgrammaticScrollSuppression,
} from '@lego-platform/shared/util';

interface DocumentScrollLockSnapshot {
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPaddingRight: string;
  bodyPosition: string;
  bodyScrollBehavior: string;
  bodyTop: string;
  bodyWidth: string;
  documentOverflow: string;
  documentOverscrollBehavior: string;
  documentScrollBehavior: string;
  scrollY: number;
}

const documentScrollLock = {
  count: 0,
  releaseHeaderVisibility: undefined as (() => void) | undefined,
  snapshot: undefined as DocumentScrollLockSnapshot | undefined,
};

function restoreScrollPositionWithoutAnimation(
  snapshot: DocumentScrollLockSnapshot,
) {
  const { body, documentElement } = document;

  documentElement.style.scrollBehavior = 'auto';
  body.style.scrollBehavior = 'auto';

  if (snapshot.scrollY > 0) {
    runWithProgrammaticScrollSuppression(
      () => {
        try {
          window.scrollTo({
            behavior: 'auto',
            left: 0,
            top: snapshot.scrollY,
          });
        } catch {
          window.scrollTo(0, snapshot.scrollY);
        }
      },
      { reason: 'document-scroll-lock-restore' },
    );
  }

  documentElement.style.scrollBehavior = snapshot.documentScrollBehavior;
  body.style.scrollBehavior = snapshot.bodyScrollBehavior;
}

function releaseHeaderVisibilityAfterScrollRestore(): void {
  const releaseHeaderVisibility = documentScrollLock.releaseHeaderVisibility;
  documentScrollLock.releaseHeaderVisibility = undefined;

  if (!releaseHeaderVisibility) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(releaseHeaderVisibility);
  });
}

export function lockDocumentScroll(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  if (documentScrollLock.count === 0) {
    documentScrollLock.releaseHeaderVisibility = preserveHeaderVisibility(
      'document-scroll-lock',
    );
    const scrollY =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    const computedBodyStyle = window.getComputedStyle(document.body);
    const bodyPaddingRight =
      parseFloat(computedBodyStyle.paddingRight || '0') || 0;

    documentScrollLock.snapshot = {
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      bodyPaddingRight: document.body.style.paddingRight,
      bodyPosition: document.body.style.position,
      bodyScrollBehavior: document.body.style.scrollBehavior,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      documentOverflow: document.documentElement.style.overflow,
      documentOverscrollBehavior:
        document.documentElement.style.overscrollBehavior,
      documentScrollBehavior: document.documentElement.style.scrollBehavior,
      scrollY,
    };

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
    }
  }

  documentScrollLock.count += 1;

  return () => {
    documentScrollLock.count = Math.max(0, documentScrollLock.count - 1);

    if (documentScrollLock.count > 0) {
      return;
    }

    const snapshot = documentScrollLock.snapshot;
    documentScrollLock.snapshot = undefined;

    if (!snapshot) {
      releaseHeaderVisibilityAfterScrollRestore();
      return;
    }

    document.documentElement.style.overflow = snapshot.documentOverflow;
    document.documentElement.style.overscrollBehavior =
      snapshot.documentOverscrollBehavior;
    document.body.style.overflow = snapshot.bodyOverflow;
    document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
    document.body.style.position = snapshot.bodyPosition;
    document.body.style.top = snapshot.bodyTop;
    document.body.style.width = snapshot.bodyWidth;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;

    restoreScrollPositionWithoutAnimation(snapshot);
    releaseHeaderVisibilityAfterScrollRestore();
  };
}
