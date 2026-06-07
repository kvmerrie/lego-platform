'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { CheckCircle2, CirclePlus } from 'lucide-react';
import { ResponsiveDialog } from './responsive-dialog';
import styles from './shared-ui.module.css';

export interface SelectableItemDialogItem {
  description?: ReactNode;
  disabled?: boolean;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  isLoading?: boolean;
  isSelected?: boolean;
  label: ReactNode;
  meta?: ReactNode;
  searchText?: string;
  swatchColor?: string;
}

function getSelectableItemSearchText(item: SelectableItemDialogItem): string {
  return [
    typeof item.label === 'string' ? item.label : undefined,
    typeof item.description === 'string' ? item.description : undefined,
    typeof item.meta === 'string' ? item.meta : undefined,
    item.searchText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('nl-NL');
}

export function SelectableItemDialog({
  closeLabel = 'Sluiten',
  description,
  emptyLabel = 'Geen items gevonden.',
  isLoading = false,
  isOpen,
  items,
  loadingLabel = 'Laden…',
  onClose,
  onToggle,
  searchLabel = 'Zoeken',
  searchPlaceholder = 'Zoeken',
  title,
}: {
  closeLabel?: string;
  description?: ReactNode;
  emptyLabel?: ReactNode;
  isLoading?: boolean;
  isOpen: boolean;
  items: readonly SelectableItemDialogItem[];
  loadingLabel?: ReactNode;
  onClose: () => void;
  onToggle: (item: SelectableItemDialogItem) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  title: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL');
  const filteredItems = useMemo(
    () =>
      normalizedQuery
        ? items.filter((item) =>
            getSelectableItemSearchText(item).includes(normalizedQuery),
          )
        : items,
    [items, normalizedQuery],
  );

  return (
    <ResponsiveDialog
      closeLabel={closeLabel}
      description={description}
      isOpen={isOpen}
      title={title}
      onClose={onClose}
    >
      <div className={styles.selectableDialogContent}>
        <label className={styles.selectableDialogSearch}>
          <span className={styles.visuallyHidden}>{searchLabel}</span>
          <input
            className={styles.selectableDialogSearchInput}
            placeholder={searchPlaceholder}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        {isLoading ? (
          <p className={styles.selectableDialogState}>{loadingLabel}</p>
        ) : filteredItems.length ? (
          <ul className={styles.selectableDialogList}>
            {filteredItems.map((item) => (
              <li className={styles.selectableDialogListItem} key={item.id}>
                <button
                  aria-pressed={item.isSelected || undefined}
                  className={styles.selectableDialogItem}
                  data-selected={item.isSelected ? 'true' : undefined}
                  disabled={item.disabled || item.isLoading}
                  type="button"
                  onClick={() => onToggle(item)}
                >
                  <span
                    className={styles.selectableDialogItemVisual}
                    style={
                      item.swatchColor
                        ? ({
                            '--selectable-item-swatch': item.swatchColor,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {item.imageUrl ? (
                      <img
                        alt={item.imageAlt ?? ''}
                        className={styles.selectableDialogItemImage}
                        decoding="async"
                        height={44}
                        loading="lazy"
                        src={item.imageUrl}
                        width={44}
                      />
                    ) : null}
                  </span>
                  <span className={styles.selectableDialogItemCopy}>
                    <span className={styles.selectableDialogItemTitle}>
                      {item.label}
                    </span>
                    {item.description ? (
                      <span className={styles.selectableDialogItemDescription}>
                        {item.description}
                      </span>
                    ) : null}
                    {item.meta ? (
                      <span className={styles.selectableDialogItemMeta}>
                        {item.meta}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={styles.selectableDialogItemStatus}
                    data-loading={item.isLoading ? 'true' : undefined}
                  >
                    {item.isSelected ? (
                      <CheckCircle2 aria-hidden="true" size={22} />
                    ) : (
                      <CirclePlus aria-hidden="true" size={22} />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.selectableDialogState}>{emptyLabel}</p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
