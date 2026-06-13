'use client';

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockDocumentScroll } from './document-scroll-lock';
import { Button } from './shared-ui';
import styles from './shared-ui.module.css';

function joinClassNames(
  ...classNames: Array<string | false | null | undefined>
): string | undefined {
  const nextClassName = classNames.filter(Boolean).join(' ');

  return nextClassName || undefined;
}

type DataAttributes = Record<`data-${string}`, string | undefined>;
type DialogAttributes = HTMLAttributes<HTMLElement> & DataAttributes;
type DialogBackdropAttributes = ButtonHTMLAttributes<HTMLButtonElement> &
  DataAttributes;
type ResponsiveDialogState = 'closing' | 'opening' | 'open';

const RESPONSIVE_DIALOG_CLOSE_TIMEOUT_MS = 340;
const RESPONSIVE_DIALOG_REDUCED_MOTION_CLOSE_TIMEOUT_MS = 40;

function getResponsiveDialogCloseTimeoutMs(): number {
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return RESPONSIVE_DIALOG_REDUCED_MOTION_CLOSE_TIMEOUT_MS;
  }

  return RESPONSIVE_DIALOG_CLOSE_TIMEOUT_MS;
}

function getFocusableDialogElements(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) {
    return [];
  }

  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true',
  );
}

function handleDialogKeyDown({
  dialog,
  event,
  onClose,
}: {
  dialog: HTMLElement | null;
  event: KeyboardEvent<HTMLElement>;
  onClose: () => void;
}) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableDialogElements(dialog);

  if (!focusableElements.length) {
    event.preventDefault();
    dialog?.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}

export function ResponsiveDialog({
  backdropClassName,
  backdropProps,
  bodyClassName,
  children,
  closeButtonClassName,
  closeLabel = 'Sluiten',
  description,
  descriptionClassName,
  dialogProps,
  footer,
  footerClassName,
  headerClassName,
  headingClassName,
  isOpen,
  onClose,
  panelClassName,
  title,
  titleClassName,
}: {
  backdropClassName?: string;
  backdropProps?: DialogBackdropAttributes;
  bodyClassName?: string;
  children: ReactNode;
  closeButtonClassName?: string;
  closeLabel?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  dialogProps?: DialogAttributes;
  footer?: ReactNode;
  footerClassName?: string;
  headerClassName?: string;
  headingClassName?: string;
  isOpen: boolean;
  onClose: () => void;
  panelClassName?: string;
  title: ReactNode;
  titleClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const triggerElementRef = useRef<Element | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [dialogState, setDialogState] = useState<ResponsiveDialogState>(
    isOpen ? 'opening' : 'closing',
  );
  const { onTransitionEnd: onDialogTransitionEnd, ...resolvedDialogProps } =
    dialogProps ?? {};

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current === undefined) {
      return;
    }

    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = undefined;
  }, []);

  const finishClosing = useCallback(() => {
    if (isOpen) {
      return;
    }

    clearCloseTimeout();
    setShouldRender(false);
  }, [clearCloseTimeout, isOpen]);

  useEffect(() => {
    if (isOpen) {
      clearCloseTimeout();
      setShouldRender(true);
      return undefined;
    }

    if (!shouldRender) {
      return undefined;
    }

    setDialogState('closing');
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(
      finishClosing,
      getResponsiveDialogCloseTimeoutMs(),
    );

    return clearCloseTimeout;
  }, [clearCloseTimeout, finishClosing, isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender || !isOpen) {
      return undefined;
    }

    setDialogState('opening');

    const animationFrame = window.requestAnimationFrame(() => {
      setDialogState('open');
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    triggerElementRef.current = document.activeElement;
    const unlockDocumentScroll = lockDocumentScroll();

    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      unlockDocumentScroll();

      window.requestAnimationFrame(() => {
        if (triggerElementRef.current instanceof HTMLElement) {
          triggerElementRef.current.focus({ preventScroll: true });
        }
      });
    };
  }, [shouldRender]);

  useEffect(() => () => clearCloseTimeout(), [clearCloseTimeout]);

  if (!shouldRender || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={styles.responsiveDialogLayer}
      data-responsive-dialog-layer="true"
      data-responsive-dialog-state={dialogState}
    >
      <button
        aria-label={closeLabel}
        className={joinClassNames(
          styles.responsiveDialogBackdrop,
          backdropClassName,
        )}
        data-responsive-dialog-backdrop="true"
        data-responsive-dialog-state={dialogState}
        type="button"
        onClick={onClose}
        {...backdropProps}
      />
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={joinClassNames(styles.responsiveDialogPanel, panelClassName)}
        data-responsive-dialog-panel="true"
        data-responsive-dialog-state={dialogState}
        onKeyDown={(event) =>
          handleDialogKeyDown({
            dialog: dialogRef.current,
            event,
            onClose,
          })
        }
        onTransitionEnd={(event) => {
          onDialogTransitionEnd?.(event);

          if (event.target === event.currentTarget) {
            finishClosing();
          }
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        {...resolvedDialogProps}
      >
        <header
          className={joinClassNames(
            styles.responsiveDialogHeader,
            headerClassName,
          )}
        >
          <div
            className={joinClassNames(
              styles.responsiveDialogHeading,
              headingClassName,
            )}
          >
            <h2
              className={joinClassNames(
                styles.responsiveDialogTitle,
                titleClassName,
              )}
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className={joinClassNames(
                  styles.responsiveDialogDescription,
                  descriptionClassName,
                )}
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label={closeLabel}
            className={joinClassNames(
              styles.responsiveDialogClose,
              closeButtonClassName,
            )}
            ref={closeButtonRef}
            size="compact"
            tone="ghost"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} strokeWidth={2.2} />
          </Button>
        </header>
        <div
          className={joinClassNames(styles.responsiveDialogBody, bodyClassName)}
        >
          {children}
        </div>
        {footer ? (
          <footer
            className={joinClassNames(
              styles.responsiveDialogFooter,
              footerClassName,
            )}
          >
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
