'use client';

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';
import { useEffect, useId, useRef } from 'react';
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
  const triggerElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    triggerElementRef.current = document.activeElement;
    const unlockDocumentScroll = lockDocumentScroll();

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      unlockDocumentScroll();

      window.requestAnimationFrame(() => {
        if (triggerElementRef.current instanceof HTMLElement) {
          triggerElementRef.current.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={styles.responsiveDialogLayer}
      data-responsive-dialog-layer="true"
    >
      <button
        aria-label={closeLabel}
        className={joinClassNames(
          styles.responsiveDialogBackdrop,
          backdropClassName,
        )}
        data-responsive-dialog-backdrop="true"
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
        onKeyDown={(event) =>
          handleDialogKeyDown({
            dialog: dialogRef.current,
            event,
            onClose,
          })
        }
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        {...dialogProps}
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
