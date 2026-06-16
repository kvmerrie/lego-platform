const defaultProgrammaticScrollSuppressionMs = 300;
const headerHiddenAttribute = 'data-shell-header-hidden';
const programmaticScrollAttribute = 'data-programmatic-scroll';

let programmaticScrollDepth = 0;
let suppressHeaderScrollReactionUntil = 0;
let programmaticScrollAttributeTimeout: number | undefined;
let preservedHeaderHidden: boolean | undefined;
let preservedHeaderVisibilityDepth = 0;

function getScrollSuppressionNow(): number {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function suppressHeaderScrollReaction(
  reason = 'programmatic-scroll',
  durationMs = defaultProgrammaticScrollSuppressionMs,
): () => void {
  void reason;

  let isReleased = false;
  programmaticScrollDepth += 1;
  setProgrammaticScrollAttribute(true);
  suppressHeaderScrollReactionUntil = Math.max(
    suppressHeaderScrollReactionUntil,
    getScrollSuppressionNow() + durationMs,
  );

  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    programmaticScrollDepth = Math.max(0, programmaticScrollDepth - 1);
    suppressHeaderScrollReactionUntil = Math.max(
      suppressHeaderScrollReactionUntil,
      getScrollSuppressionNow() + durationMs,
    );
    scheduleProgrammaticScrollAttributeRelease(durationMs);
  };
}

export function isHeaderScrollReactionSuppressed(
  now = getScrollSuppressionNow(),
): boolean {
  return programmaticScrollDepth > 0 || now < suppressHeaderScrollReactionUntil;
}

export function runWithProgrammaticScrollSuppression<T>(
  callback: () => T,
  {
    durationMs = defaultProgrammaticScrollSuppressionMs,
    reason = 'programmatic-scroll',
  }: {
    durationMs?: number;
    reason?: string;
  } = {},
): T {
  const releaseSuppression = suppressHeaderScrollReaction(reason, durationMs);

  try {
    return callback();
  } finally {
    releaseSuppression();
  }
}

function setProgrammaticScrollAttribute(isActive: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (programmaticScrollAttributeTimeout !== undefined) {
    window.clearTimeout(programmaticScrollAttributeTimeout);
    programmaticScrollAttributeTimeout = undefined;
  }

  if (isActive) {
    document.documentElement.setAttribute(programmaticScrollAttribute, 'true');
    return;
  }

  document.documentElement.removeAttribute(programmaticScrollAttribute);
}

function scheduleProgrammaticScrollAttributeRelease(durationMs: number): void {
  if (typeof window === 'undefined' || programmaticScrollDepth > 0) {
    return;
  }

  programmaticScrollAttributeTimeout = window.setTimeout(() => {
    programmaticScrollAttributeTimeout = undefined;

    if (!isHeaderScrollReactionSuppressed() && programmaticScrollDepth === 0) {
      setProgrammaticScrollAttribute(false);
    }
  }, durationMs);
}

export function preserveHeaderVisibility(
  reason = 'programmatic-scroll',
): () => void {
  void reason;

  if (typeof document === 'undefined') {
    return () => undefined;
  }

  if (preservedHeaderVisibilityDepth === 0) {
    preservedHeaderHidden = document.documentElement.hasAttribute(
      headerHiddenAttribute,
    );
  }

  let isReleased = false;
  preservedHeaderVisibilityDepth += 1;

  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    preservedHeaderVisibilityDepth = Math.max(
      0,
      preservedHeaderVisibilityDepth - 1,
    );

    if (preservedHeaderVisibilityDepth === 0) {
      preservedHeaderHidden = undefined;
    }
  };
}

export function getPreservedHeaderHiddenState(): boolean | undefined {
  return preservedHeaderVisibilityDepth > 0 ? preservedHeaderHidden : undefined;
}

export function applyPreservedHeaderVisibility(): void {
  if (typeof document === 'undefined' || preservedHeaderHidden === undefined) {
    return;
  }

  if (preservedHeaderHidden) {
    document.documentElement.setAttribute(headerHiddenAttribute, 'true');
    return;
  }

  document.documentElement.removeAttribute(headerHiddenAttribute);
}

export function resetProgrammaticScrollSuppressionForTests(): void {
  if (
    typeof window !== 'undefined' &&
    programmaticScrollAttributeTimeout !== undefined
  ) {
    window.clearTimeout(programmaticScrollAttributeTimeout);
  }

  programmaticScrollDepth = 0;
  suppressHeaderScrollReactionUntil = 0;
  programmaticScrollAttributeTimeout = undefined;
  preservedHeaderHidden = undefined;
  preservedHeaderVisibilityDepth = 0;

  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute(programmaticScrollAttribute);
  }
}
