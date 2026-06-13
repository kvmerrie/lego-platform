import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminPageComponent,
  AdminSectionHeaderComponent,
  AdminStatusBadgeComponent,
} from '@lego-platform/admin/ui';
import type {
  PublicPageSection,
  PublicPageSectionItem,
  PublicPageSectionItemReferenceType,
} from '@lego-platform/catalog/util';
import { getAccessibleForegroundColor } from '@lego-platform/shared/util';
import {
  CommerceAdminApiService,
  type CommerceAdminCmsPromotionPreviewResult,
  type CommerceAdminCmsPromotionResult,
  type CommerceAdminCatalogCollectionPresentation,
  type CommerceAdminCatalogThemePresentation,
} from './commerce-admin-api.service';

type CmsTab = 'collections' | 'homepage' | 'themes';
type CmsPresentationPreview =
  | CommerceAdminCatalogCollectionPresentation
  | CommerceAdminCatalogThemePresentation;

const emptyHomepageSections: readonly PublicPageSection[] = [];
const emptyThemes: readonly CommerceAdminCatalogThemePresentation[] = [];
const emptyCollections: readonly CommerceAdminCatalogCollectionPresentation[] =
  [];
const CMS_PROMOTE_CONFIRMATION_PHRASE = 'PROMOTE CMS';

function createBlankTheme(): CommerceAdminCatalogThemePresentation {
  return {
    displayName: '',
    id: '',
    isPublic: true,
    slug: '',
    status: 'active',
  };
}

function createBlankCollection(): CommerceAdminCatalogCollectionPresentation {
  return {
    collectionSlug: '',
    isPublic: true,
    status: 'active',
  };
}

function createSectionItem(index: number): PublicPageSectionItem {
  return {
    enabled: true,
    referenceType: 'theme',
    sortOrder: (index + 1) * 10,
  };
}

@Component({
  selector: 'lego-commerce-admin-cms-page',
  imports: [
    CommonModule,
    FormsModule,
    AdminPageComponent,
    AdminSectionHeaderComponent,
    AdminStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lego-admin-page
      eyebrow="CMS"
      title="Homepage en themes"
      description="Beheer publieke theme-presentatie en de redactionele homepage-rails vanuit staging."
    >
      <div adminPageActions class="admin-actions-inline">
        <button
          class="admin-button admin-button--subtle"
          type="button"
          (click)="load()"
        >
          Ververs
        </button>
      </div>

      @if (errorMessage()) {
        <p class="admin-inline-alert admin-inline-alert--danger">
          {{ errorMessage() }}
        </p>
      }

      @if (successMessage()) {
        <p class="admin-inline-alert admin-inline-alert--success">
          {{ successMessage() }}
        </p>
      }

      <div class="admin-segmented-control cms-tabs" role="tablist">
        <button
          class="admin-button"
          type="button"
          [class.admin-button--primary]="activeTab() === 'homepage'"
          [class.admin-button--subtle]="activeTab() !== 'homepage'"
          (click)="activeTab.set('homepage')"
        >
          Homepage
        </button>
        <button
          class="admin-button"
          type="button"
          [class.admin-button--primary]="activeTab() === 'themes'"
          [class.admin-button--subtle]="activeTab() !== 'themes'"
          (click)="activeTab.set('themes')"
        >
          Themes
        </button>
        <button
          class="admin-button"
          type="button"
          [class.admin-button--primary]="activeTab() === 'collections'"
          [class.admin-button--subtle]="activeTab() !== 'collections'"
          (click)="activeTab.set('collections')"
        >
          Collections
        </button>
      </div>

      <section class="admin-panel admin-stack cms-promote">
        <div class="cms-promote__header">
          <lego-admin-section-header
            title="Promote CMS to production"
            description="Promoot alleen homepage sections/items, collection presentations en publieke theme-presentatievelden. Catalogus, commerce en pricing blijven erbuiten."
          ></lego-admin-section-header>
          <button
            class="admin-button admin-button--subtle"
            type="button"
            [disabled]="isLoadingCmsPromotePreview()"
            (click)="loadCmsPromotionPreview()"
          >
            Preview diff
          </button>
        </div>

        @if (cmsPromotePreview(); as preview) {
          <div class="cms-promote__summary">
            <span>
              <strong>{{ preview.pendingPromoteCount }}</strong>
              pending changes
            </span>
            <span>
              <strong>{{ preview.affectedThemeSlugs.length }}</strong>
              themes
            </span>
            <span>
              <strong>{{ preview.affectedCollectionSlugs.length }}</strong>
              collections
            </span>
            <span>Generated {{ preview.generatedAt }}</span>
          </div>
          <div class="cms-promote__tables">
            @for (
              entry of cmsPromotionTableEntries(preview);
              track entry.name
            ) {
              <article class="cms-promote-table">
                <strong>{{ entry.name }}</strong>
                <span>read {{ entry.summary.readCount }}</span>
                <span>insert {{ entry.summary.insertedCount }}</span>
                <span>update {{ entry.summary.updatedCount }}</span>
                @if (entry.summary.replacedCount) {
                  <span>replace {{ entry.summary.replacedCount }}</span>
                }
                @if (entry.summary.skippedMissingProductionCount) {
                  <span>
                    skipped missing prod
                    {{ entry.summary.skippedMissingProductionCount }}
                  </span>
                }
              </article>
            }
          </div>
          @if (preview.samples.length) {
            <details class="cms-promote__samples">
              <summary>Preview samples</summary>
              <ul>
                @for (sample of preview.samples.slice(0, 10); track $index) {
                  <li>
                    {{ sample.table }} · {{ sample.changeType }} ·
                    {{ sample.key }} ·
                    {{ sample.changedFields.join(', ') }}
                  </li>
                }
              </ul>
            </details>
          }
        }

        <div class="admin-form-grid">
          <label class="admin-field">
            <span>Admin promote secret</span>
            <input
              class="admin-input"
              name="cmsPromoteSecret"
              type="password"
              autocomplete="off"
              [ngModel]="cmsPromoteSecret()"
              (ngModelChange)="cmsPromoteSecret.set($event)"
            />
          </label>
          <label class="admin-field">
            <span>Confirmation</span>
            <input
              class="admin-input"
              name="cmsPromoteConfirmation"
              placeholder="PROMOTE CMS"
              [ngModel]="cmsPromoteConfirmation()"
              (ngModelChange)="cmsPromoteConfirmation.set($event)"
            />
          </label>
        </div>
        <div class="admin-actions-inline">
          <button
            class="admin-button admin-button--danger"
            type="button"
            [disabled]="cmsPromoteDisabledReason() !== null || isPromotingCms()"
            [title]="cmsPromoteDisabledReason() ?? 'Promote CMS to production'"
            (click)="promoteCms()"
          >
            Promote CMS to production
          </button>
          @if (cmsPromoteDisabledReason(); as disabledReason) {
            <span class="admin-muted">{{ disabledReason }}</span>
          }
        </div>

        @if (cmsPromoteResult(); as result) {
          <p class="admin-inline-alert admin-inline-alert--success">
            CMS promoted. Revalidated
            {{ result.revalidation?.pathCount ?? 0 }} paths and
            {{ result.revalidation?.tagCount ?? 0 }} tags.
          </p>
        }
      </section>

      <ng-template
        #presentationPreview
        let-countLabel="countLabel"
        let-ctaLabel="ctaLabel"
        let-heading="heading"
        let-presentation
        let-representativeTitle="representativeTitle"
      >
        <div class="cms-preview-stack">
          <article
            class="cms-preview cms-preview--hero"
            [style.background]="getPresentationSurfaceColor(presentation)"
            [style.color]="getPresentationTextColor(presentation)"
          >
            @if (getPresentationHeroImageUrl(presentation)) {
              <img
                [src]="getPresentationHeroImageUrl(presentation) || ''"
                alt=""
              />
            }
            @if (presentation.publicLogoUrl) {
              <img
                class="cms-preview__logo"
                [src]="presentation.publicLogoUrl || ''"
                alt=""
              />
            }
            <span class="cms-preview__eyebrow">Hero preview</span>
            <strong>{{ heading }}</strong>
            <span>{{
              presentation.publicDescription ||
                'Nieuw binnen en meteen het bekijken waard.'
            }}</span>
            <small>{{ countLabel }}</small>
          </article>
          <div class="cms-preview-pair">
            <article
              class="cms-preview-card"
              [style.background]="getPresentationSurfaceColor(presentation)"
              [style.color]="getPresentationTextColor(presentation)"
            >
              @if (getPresentationTileImageUrl(presentation)) {
                <img
                  [src]="getPresentationTileImageUrl(presentation) || ''"
                  alt=""
                />
              }
              @if (presentation.publicLogoUrl) {
                <img
                  class="cms-preview-card__logo"
                  [src]="presentation.publicLogoUrl || ''"
                  alt=""
                />
              }
              <span>Tile/card preview</span>
              <strong>{{ heading }}</strong>
              <small>{{ ctaLabel }}</small>
            </article>
            <article class="cms-preview-rail">
              @if (getPresentationTileImageUrl(presentation)) {
                <img
                  [src]="getPresentationTileImageUrl(presentation) || ''"
                  alt=""
                />
              }
              <span>Homepage rail</span>
              <strong>{{ heading }}</strong>
              <small>Representative set: {{ representativeTitle }}</small>
            </article>
          </div>
        </div>
      </ng-template>

      @if (activeTab() === 'homepage') {
        <section class="admin-panel admin-stack cms-homepage">
          <lego-admin-section-header
            title="Homepage sections"
            description="Secties zijn generiek; items verwijzen naar theme, set, collection of custom."
          ></lego-admin-section-header>

          <div class="admin-data-table-shell">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Section key</th>
                  <th>Title</th>
                  <th>Layout</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Sort order</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (section of homepageSections(); track section.sectionKey) {
                  <tr
                    class="cms-row"
                    [class.is-selected]="
                      editingSection()?.sectionKey === section.sectionKey &&
                      isSectionDrawerOpen()
                    "
                  >
                    <td>{{ section.sectionKey }}</td>
                    <td>{{ section.title }}</td>
                    <td>{{ section.layout }}</td>
                    <td>{{ section.items.length }}</td>
                    <td>
                      <lego-admin-status-badge
                        [tone]="section.enabled ? 'positive' : 'neutral'"
                      >
                        {{ section.enabled ? 'enabled' : 'disabled' }}
                      </lego-admin-status-badge>
                    </td>
                    <td>{{ section.sortOrder }}</td>
                    <td>
                      <button
                        class="admin-button admin-button--subtle"
                        type="button"
                        (click)="editSection(section, $event)"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (isSectionDrawerOpen() && editingSection(); as section) {
          <div class="cms-drawer-shell">
            <button
              class="cms-drawer-backdrop"
              type="button"
              aria-label="Close section editor"
              (click)="cancelSectionEdit()"
            ></button>
            <aside
              #sectionDrawer
              class="admin-panel admin-stack cms-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cms-section-editor-title"
              tabindex="-1"
            >
              <form class="admin-stack" (ngSubmit)="saveSection()">
                <div class="cms-drawer__header">
                  <lego-admin-section-header
                    title="Section editor"
                    description="Opslaan revalideert de homepage."
                  ></lego-admin-section-header>
                  <button
                    class="admin-button admin-button--subtle"
                    type="button"
                    aria-label="Close section editor"
                    (click)="cancelSectionEdit()"
                  >
                    Sluiten
                  </button>
                </div>

                <h2 id="cms-section-editor-title" class="cms-sr-only">
                  Section editor
                </h2>

                <label class="admin-field">
                  <span>Section key</span>
                  <input
                    class="admin-input"
                    name="sectionKey"
                    [(ngModel)]="section.sectionKey"
                  />
                </label>
                <label class="admin-field">
                  <span>Heading</span>
                  <input
                    class="admin-input"
                    name="title"
                    [(ngModel)]="section.title"
                  />
                </label>
                <label class="admin-field">
                  <span>Subheading</span>
                  <textarea
                    class="admin-textarea"
                    name="subtitle"
                    [(ngModel)]="section.subtitle"
                  ></textarea>
                </label>
                <div class="admin-form-grid">
                  <label class="admin-field">
                    <span>Layout</span>
                    <input
                      class="admin-input"
                      name="layout"
                      [(ngModel)]="section.layout"
                    />
                  </label>
                  <label class="admin-field">
                    <span>Sort order</span>
                    <input
                      class="admin-input"
                      name="sortOrder"
                      type="number"
                      [(ngModel)]="section.sortOrder"
                    />
                  </label>
                </div>
                <label class="admin-checkbox">
                  <input
                    name="enabled"
                    type="checkbox"
                    [(ngModel)]="section.enabled"
                  />
                  Enabled
                </label>

                <div class="cms-items">
                  <div class="cms-items__header">
                    <div>
                      <strong>Items</strong>
                      <p class="admin-muted">
                        Gebruik custom image alleen wanneer dit homepage-item
                        bewust afwijkt van de gekoppelde tile.
                      </p>
                    </div>
                    <button
                      class="admin-button admin-button--subtle"
                      type="button"
                      (click)="addSectionItem(section)"
                    >
                      Add item
                    </button>
                  </div>
                  @for (item of section.items; track $index) {
                    <article class="cms-item-card">
                      <div class="cms-item-card__header">
                        <strong>Item {{ $index + 1 }}</strong>
                        <button
                          class="admin-button admin-button--danger"
                          type="button"
                          (click)="removeSectionItem(section, $index)"
                        >
                          Remove
                        </button>
                      </div>

                      <div class="admin-form-grid">
                        <label class="admin-field">
                          <span>Reference type</span>
                          <select
                            class="admin-select"
                            name="referenceType-{{ $index }}"
                            [(ngModel)]="item.referenceType"
                          >
                            @for (
                              referenceType of referenceTypes;
                              track referenceType
                            ) {
                              <option [value]="referenceType">
                                {{ referenceType }}
                              </option>
                            }
                          </select>
                        </label>
                        <label class="admin-field">
                          <span>Reference id</span>
                          <input
                            class="admin-input"
                            name="referenceId-{{ $index }}"
                            placeholder="theme slug / set id"
                            [(ngModel)]="item.referenceId"
                          />
                        </label>
                        <label class="admin-field">
                          <span>Image set id</span>
                          <input
                            class="admin-input"
                            name="imageSetId-{{ $index }}"
                            placeholder="representative set id"
                            [(ngModel)]="item.imageSetId"
                          />
                        </label>
                        <label class="admin-field">
                          <span>Sort order</span>
                          <input
                            class="admin-input"
                            name="itemSort-{{ $index }}"
                            type="number"
                            [(ngModel)]="item.sortOrder"
                          />
                        </label>
                      </div>

                      <label class="admin-checkbox">
                        <input
                          name="useCustomImage-{{ $index }}"
                          type="checkbox"
                          [(ngModel)]="item.useCustomImage"
                        />
                        Use custom image for this homepage item
                      </label>
                      @if (showHomepageItemImageField(item)) {
                        <label class="admin-field">
                          <span>Custom image URL</span>
                          <input
                            class="admin-input"
                            name="imageUrl-{{ $index }}"
                            placeholder="custom item image URL"
                            [(ngModel)]="item.imageUrl"
                          />
                        </label>
                      } @else {
                        <span class="admin-muted cms-item-row__hint">
                          {{ getHomepageItemImageSourceLabel(item) }}
                        </span>
                      }

                      @if (item.referenceType === 'custom') {
                        <div class="cms-color-controls">
                          <label class="admin-field">
                            <span>Tile background / Surface</span>
                            <div class="cms-color-field">
                              <input
                                class="cms-color-picker"
                                name="surfaceColorPicker-{{ $index }}"
                                type="color"
                                [ngModel]="
                                  getSectionItemMetadataColorInputValue(
                                    item,
                                    'surfaceColor'
                                  )
                                "
                                (ngModelChange)="
                                  updateSectionItemMetadataString(
                                    item,
                                    'surfaceColor',
                                    $event
                                  )
                                "
                              />
                              <input
                                class="admin-input"
                                name="surfaceColor-{{ $index }}"
                                placeholder="#00a99d"
                                [ngModel]="
                                  getSectionItemMetadataString(
                                    item,
                                    'surfaceColor'
                                  )
                                "
                                (ngModelChange)="
                                  updateSectionItemMetadataString(
                                    item,
                                    'surfaceColor',
                                    $event
                                  )
                                "
                              />
                            </div>
                          </label>
                        </div>
                      }

                      <div class="admin-form-grid">
                        <label class="admin-field">
                          <span>Title override</span>
                          <input
                            class="admin-input"
                            name="titleOverride-{{ $index }}"
                            [(ngModel)]="item.titleOverride"
                          />
                        </label>
                        <label class="admin-field">
                          <span>Description</span>
                          <textarea
                            class="admin-textarea"
                            name="itemDescription-{{ $index }}"
                            [ngModel]="
                              getSectionItemMetadataString(item, 'description')
                            "
                            (ngModelChange)="
                              updateSectionItemMetadataString(
                                item,
                                'description',
                                $event
                              )
                            "
                          ></textarea>
                          <small>Stored as metadata_json.description.</small>
                        </label>
                        <label class="admin-field">
                          <span>Alt override</span>
                          <input
                            class="admin-input"
                            name="altOverride-{{ $index }}"
                            [(ngModel)]="item.altOverride"
                          />
                        </label>
                        <label class="admin-field">
                          <span>CTA label</span>
                          <input
                            class="admin-input"
                            name="ctaLabel-{{ $index }}"
                            [(ngModel)]="item.ctaLabel"
                          />
                        </label>
                        <label class="admin-field">
                          <span>CTA URL</span>
                          <input
                            class="admin-input"
                            name="ctaUrl-{{ $index }}"
                            [(ngModel)]="item.ctaUrl"
                          />
                        </label>
                      </div>

                      @if (getSectionItemMetadataSummary(item)) {
                        <p class="admin-muted cms-item-row__hint">
                          metadata_json:
                          {{ getSectionItemMetadataSummary(item) }}
                        </p>
                      }

                      <label class="admin-checkbox">
                        <input
                          name="itemEnabled-{{ $index }}"
                          type="checkbox"
                          [(ngModel)]="item.enabled"
                        />
                        Enabled
                      </label>
                    </article>
                  }
                </div>

                <section class="cms-section-preview">
                  <strong>Preview</strong>
                  <div class="cms-section-preview__items">
                    @for (item of section.items; track $index) {
                      <article
                        class="cms-section-preview__item"
                        [style.background]="
                          getSectionItemPreviewSurfaceColor(item)
                        "
                        [style.color]="getSectionItemPreviewTextColor(item)"
                      >
                        <span>{{ item.referenceType }}</span>
                        <strong>
                          {{
                            item.titleOverride || item.referenceId || 'New item'
                          }}
                        </strong>
                        <small>
                          Image source:
                          {{ getHomepageItemImageSourceLabel(item) }}
                        </small>
                      </article>
                    }
                  </div>
                </section>

                <div class="admin-actions-inline cms-drawer__actions">
                  <button
                    class="admin-button admin-button--primary"
                    type="submit"
                    [disabled]="isSaving()"
                  >
                    Opslaan
                  </button>
                  <button
                    class="admin-button admin-button--subtle"
                    type="button"
                    (click)="cancelSectionEdit()"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </aside>
          </div>
        }
      } @else if (activeTab() === 'themes') {
        <section class="admin-panel admin-stack cms-grid">
          <div class="admin-stack">
            <lego-admin-section-header
              title="Theme presentation"
              description="Publieke velden op catalog_themes. Opslaan revalideert /, /themes en de themepagina."
            ></lego-admin-section-header>
            <label class="admin-field">
              <span>Zoeken</span>
              <input
                class="admin-input"
                [ngModel]="themeQuery()"
                (ngModelChange)="updateThemeQuery($event)"
              />
            </label>
            <div class="admin-data-table-shell">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>Slug</th>
                    <th>Public</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  @for (theme of filteredThemes(); track theme.slug) {
                    <tr
                      class="cms-row"
                      [class.is-selected]="editingTheme().slug === theme.slug"
                      (click)="editTheme(theme)"
                    >
                      <td>
                        {{ theme.publicDisplayName || theme.displayName }}
                      </td>
                      <td>{{ theme.slug }}</td>
                      <td>{{ theme.isPublic ? 'yes' : 'no' }}</td>
                      <td>{{ theme.publicOrder ?? 'n/a' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (editingTheme().slug) {
            <form
              class="admin-panel admin-stack cms-editor"
              (ngSubmit)="saveTheme()"
            >
              <lego-admin-section-header
                title="Theme editor"
                [description]="editingTheme().slug"
              ></lego-admin-section-header>

              <ng-container
                [ngTemplateOutlet]="presentationPreview"
                [ngTemplateOutletContext]="{
                  $implicit: editingTheme(),
                  countLabel: '38 sets',
                  ctaLabel: 'Bekijk theme',
                  heading:
                    editingTheme().publicDisplayName ||
                    editingTheme().displayName,
                  representativeTitle: 'Death Star',
                }"
              ></ng-container>

              <label class="admin-field">
                <span>Public display name</span>
                <input
                  class="admin-input"
                  name="publicDisplayName"
                  [(ngModel)]="editingTheme().publicDisplayName"
                />
              </label>
              <label class="admin-field">
                <span>Public description / hero copy</span>
                <textarea
                  class="admin-textarea"
                  name="publicDescription"
                  [(ngModel)]="editingTheme().publicDescription"
                ></textarea>
                <small>Used as the theme detail hero description.</small>
              </label>
              <label class="admin-field">
                <span>Hero image URL</span>
                <input
                  class="admin-input"
                  name="publicImageUrl"
                  [(ngModel)]="editingTheme().publicImageUrl"
                />
                <small>Used for the theme page hero.</small>
              </label>
              <label class="admin-field">
                <span>Tile image URL</span>
                <input
                  class="admin-input"
                  name="publicTileImageUrl"
                  [(ngModel)]="editingTheme().publicTileImageUrl"
                />
                <small>
                  Used by homepage/editorial tiles before the hero image
                  fallback.
                </small>
              </label>
              <label class="admin-field">
                <span>Logo URL</span>
                <input
                  class="admin-input"
                  name="publicLogoUrl"
                  [(ngModel)]="editingTheme().publicLogoUrl"
                />
                <small>Logo/brand mark, not the tile image.</small>
              </label>
              <div class="admin-form-grid">
                <label class="admin-field">
                  <span>Accent</span>
                  <input
                    class="admin-input"
                    name="publicAccentColor"
                    [(ngModel)]="editingTheme().publicAccentColor"
                  />
                </label>
                <label class="admin-field">
                  <span>Surface</span>
                  <input
                    class="admin-input"
                    name="publicSurfaceColor"
                    [(ngModel)]="editingTheme().publicSurfaceColor"
                  />
                </label>
                <label class="admin-field">
                  <span>Public order</span>
                  <input
                    class="admin-input"
                    name="publicOrder"
                    type="number"
                    [(ngModel)]="editingTheme().publicOrder"
                  />
                </label>
                <label class="admin-field">
                  <span>Homepage order</span>
                  <input
                    class="admin-input"
                    name="publicHomepageOrder"
                    type="number"
                    [(ngModel)]="editingTheme().publicHomepageOrder"
                  />
                </label>
              </div>
              <div class="admin-form-grid">
                <label class="admin-checkbox">
                  <input
                    name="isPublic"
                    type="checkbox"
                    [(ngModel)]="editingTheme().isPublic"
                  />
                  Public
                </label>
                <label class="admin-field">
                  <span>Status</span>
                  <select
                    class="admin-select"
                    name="status"
                    [(ngModel)]="editingTheme().status"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </label>
              </div>

              <div class="admin-actions-inline">
                <button
                  class="admin-button admin-button--primary"
                  type="submit"
                  [disabled]="isSaving()"
                >
                  Opslaan
                </button>
              </div>
            </form>
          }
        </section>
      } @else {
        <section class="admin-panel admin-stack cms-grid">
          <div class="admin-stack">
            <lego-admin-section-header
              title="Collection presentation"
              description="Publieke velden op catalog_collection_presentations. Opslaan revalideert / en de collectiepagina."
            ></lego-admin-section-header>
            <label class="admin-field">
              <span>Zoeken</span>
              <input
                class="admin-input"
                [ngModel]="collectionQuery()"
                (ngModelChange)="updateCollectionQuery($event)"
              />
            </label>
            <div class="admin-data-table-shell">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th>Slug</th>
                    <th>Public</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    collection of filteredCollections();
                    track collection.collectionSlug
                  ) {
                    <tr
                      class="cms-row"
                      [class.is-selected]="
                        editingCollection().collectionSlug ===
                        collection.collectionSlug
                      "
                      (click)="editCollection(collection)"
                    >
                      <td>
                        {{
                          collection.publicDisplayName ||
                            collection.collectionSlug
                        }}
                      </td>
                      <td>{{ collection.collectionSlug }}</td>
                      <td>{{ collection.isPublic ? 'yes' : 'no' }}</td>
                      <td>{{ collection.publicOrder ?? 'n/a' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (editingCollection().collectionSlug) {
            <form
              class="admin-panel admin-stack cms-editor"
              (ngSubmit)="saveCollection()"
            >
              <lego-admin-section-header
                title="Collection editor"
                [description]="editingCollection().collectionSlug"
              ></lego-admin-section-header>

              <ng-container
                [ngTemplateOutlet]="presentationPreview"
                [ngTemplateOutletContext]="{
                  $implicit: editingCollection(),
                  countLabel: '38 items',
                  ctaLabel: 'Bekijk collectie',
                  heading:
                    editingCollection().publicDisplayName ||
                    editingCollection().collectionSlug,
                  representativeTitle: 'Death Star',
                }"
              ></ng-container>

              <label class="admin-field">
                <span>Public display name</span>
                <input
                  class="admin-input"
                  name="collectionPublicDisplayName"
                  [(ngModel)]="editingCollection().publicDisplayName"
                />
              </label>
              <label class="admin-field">
                <span>Description</span>
                <textarea
                  class="admin-textarea"
                  name="collectionPublicDescription"
                  [(ngModel)]="editingCollection().publicDescription"
                ></textarea>
              </label>
              <label class="admin-field">
                <span>Hero image URL</span>
                <input
                  class="admin-input"
                  name="collectionPublicImageUrl"
                  [(ngModel)]="editingCollection().publicImageUrl"
                />
                <small>Used for the collection page hero.</small>
              </label>
              <label class="admin-field">
                <span>Tile image URL</span>
                <input
                  class="admin-input"
                  name="collectionPublicTileImageUrl"
                  [(ngModel)]="editingCollection().publicTileImageUrl"
                />
                <small>
                  Used by homepage/editorial tiles before the hero image
                  fallback.
                </small>
              </label>
              <label class="admin-field">
                <span>Logo URL</span>
                <input
                  class="admin-input"
                  name="collectionPublicLogoUrl"
                  [(ngModel)]="editingCollection().publicLogoUrl"
                />
                <small>Logo/brand mark, not the tile image.</small>
              </label>
              <div class="admin-form-grid">
                <label class="admin-field">
                  <span>Accent</span>
                  <input
                    class="admin-input"
                    name="collectionPublicAccentColor"
                    [(ngModel)]="editingCollection().publicAccentColor"
                  />
                </label>
                <label class="admin-field">
                  <span>Surface</span>
                  <input
                    class="admin-input"
                    name="collectionPublicSurfaceColor"
                    [(ngModel)]="editingCollection().publicSurfaceColor"
                  />
                </label>
                <label class="admin-field">
                  <span>Public order</span>
                  <input
                    class="admin-input"
                    name="collectionPublicOrder"
                    type="number"
                    [(ngModel)]="editingCollection().publicOrder"
                  />
                </label>
                <label class="admin-field">
                  <span>Homepage order</span>
                  <input
                    class="admin-input"
                    name="collectionPublicHomepageOrder"
                    type="number"
                    [(ngModel)]="editingCollection().publicHomepageOrder"
                  />
                </label>
              </div>
              <div class="admin-form-grid">
                <label class="admin-checkbox">
                  <input
                    name="collectionIsPublic"
                    type="checkbox"
                    [(ngModel)]="editingCollection().isPublic"
                  />
                  Public
                </label>
                <label class="admin-field">
                  <span>Status</span>
                  <select
                    class="admin-select"
                    name="collectionStatus"
                    [(ngModel)]="editingCollection().status"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </label>
              </div>

              <div class="admin-actions-inline">
                <button
                  class="admin-button admin-button--primary"
                  type="submit"
                  [disabled]="isSaving()"
                >
                  Opslaan
                </button>
              </div>
            </form>
          }
        </section>
      }
    </lego-admin-page>
  `,
  styles: [
    `
      .cms-tabs {
        display: flex;
        gap: 0.5rem;
        margin-block-end: 1rem;
      }

      .cms-promote {
        margin-block-end: 1rem;
      }

      .cms-promote__header {
        align-items: start;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .cms-promote__summary,
      .cms-promote__tables {
        display: grid;
        gap: 0.5rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }

      .cms-promote__summary span,
      .cms-promote-table {
        border: 1px solid var(--admin-border-subtle, #dde3ea);
        border-radius: 8px;
        display: grid;
        gap: 0.25rem;
        padding: 0.65rem;
      }

      .cms-promote-table span,
      .cms-promote__samples li {
        color: var(--admin-text-muted, #64748b);
        font-size: 0.82rem;
      }

      .cms-promote__samples ul {
        margin-block: 0.5rem 0;
        padding-inline-start: 1.25rem;
      }

      .cms-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.86fr);
      }

      .cms-homepage {
        inline-size: 100%;
      }

      .cms-row {
        cursor: default;
      }

      .cms-row.is-selected {
        background: var(--admin-surface-muted, #f3f5f8);
      }

      .cms-drawer-shell {
        inset: 0;
        position: fixed;
        z-index: 40;
      }

      .cms-drawer-backdrop {
        background: rgb(15 23 42 / 42%);
        border: 0;
        cursor: default;
        inset: 0;
        padding: 0;
        position: absolute;
      }

      .cms-drawer {
        block-size: 100%;
        border-radius: 0;
        box-shadow: -12px 0 30px rgb(15 23 42 / 18%);
        inline-size: min(42rem, 100vw);
        inset-block: 0;
        inset-inline-end: 0;
        overflow-y: auto;
        padding: 1rem;
        position: absolute;
      }

      .cms-drawer:focus {
        outline: 2px solid var(--admin-focus-ring, #2563eb);
        outline-offset: -2px;
      }

      .cms-drawer__header,
      .cms-drawer__actions,
      .cms-item-card__header,
      .cms-items__header {
        align-items: start;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .cms-drawer__actions {
        background: var(--admin-surface, #fff);
        border-block-start: 1px solid var(--admin-border-subtle, #dde3ea);
        bottom: 0;
        padding-block-start: 0.75rem;
        position: sticky;
      }

      .cms-sr-only {
        block-size: 1px;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        inline-size: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
      }

      .cms-editor {
        align-self: start;
        position: sticky;
        top: 1rem;
      }

      .cms-items {
        display: grid;
        gap: 0.75rem;
      }

      .cms-items__header {
        background: var(--admin-surface, #fff);
        padding-block: 0.25rem;
        position: sticky;
        top: -1rem;
        z-index: 1;
      }

      .cms-item-card {
        border: 1px solid var(--admin-border-subtle, #dde3ea);
        border-radius: 8px;
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .cms-color-controls {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cms-color-field {
        align-items: center;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: 2.5rem minmax(0, 1fr);
      }

      .cms-color-picker {
        block-size: 2.25rem;
        border: 1px solid var(--admin-border-subtle, #dde3ea);
        border-radius: 6px;
        inline-size: 2.5rem;
        padding: 0.15rem;
      }

      .cms-sort {
        min-width: 0;
      }

      .cms-item-row__checkbox {
        white-space: nowrap;
      }

      .cms-item-row__hint {
        font-size: 0.78rem;
        line-height: 1.25;
      }

      .cms-preview-stack {
        display: grid;
        gap: 0.75rem;
      }

      .cms-preview-pair {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cms-preview {
        border-radius: 8px;
        display: grid;
        gap: 0.5rem;
        min-height: 12rem;
        overflow: hidden;
        padding: 1rem;
      }

      .cms-preview--hero {
        align-content: end;
        min-height: 15rem;
      }

      .cms-preview img,
      .cms-preview-card img,
      .cms-preview-rail img {
        aspect-ratio: 16 / 9;
        border-radius: 6px;
        inline-size: 100%;
        object-fit: cover;
      }

      .cms-preview__eyebrow,
      .cms-preview-card span,
      .cms-preview-rail span {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .cms-preview__logo {
        aspect-ratio: auto;
        background: rgb(255 255 255 / 78%);
        max-inline-size: 7rem;
        object-fit: contain;
        padding: 0.35rem;
      }

      .cms-preview-card,
      .cms-preview-rail {
        border: 1px solid var(--admin-border-subtle, #dde3ea);
        border-radius: 8px;
        display: grid;
        gap: 0.45rem;
        min-height: 12rem;
        padding: 0.75rem;
      }

      .cms-preview-card__logo {
        aspect-ratio: auto;
        max-block-size: 1.75rem;
        max-inline-size: 5rem;
        object-fit: contain;
      }

      .cms-preview-rail {
        background: var(--admin-surface, #fff);
      }

      .cms-section-preview {
        border: 1px solid var(--admin-border-subtle, #dde3ea);
        border-radius: 8px;
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .cms-section-preview__items {
        display: grid;
        gap: 0.5rem;
      }

      .cms-section-preview__item {
        background: var(--admin-surface-muted, #f3f5f8);
        border-radius: 8px;
        display: grid;
        gap: 0.25rem;
        padding: 0.65rem;
      }

      .cms-section-preview__item span {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      @media (max-width: 1100px) {
        .cms-grid,
        .cms-preview-pair {
          grid-template-columns: 1fr;
        }

        .cms-editor {
          position: static;
        }
      }

      @media (max-width: 720px) {
        .cms-drawer {
          inline-size: 100vw;
        }

        .cms-drawer__header,
        .cms-drawer__actions,
        .cms-promote__header,
        .cms-item-card__header,
        .cms-items__header {
          align-items: stretch;
          flex-direction: column;
        }

        .cms-color-controls {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CommerceAdminCmsPageComponent implements OnInit {
  private readonly adminApi = inject(CommerceAdminApiService);
  @ViewChild('sectionDrawer') private sectionDrawer?: ElementRef<HTMLElement>;
  readonly activeTab = signal<CmsTab>('homepage');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly homepageSections = signal<readonly PublicPageSection[]>(
    emptyHomepageSections,
  );
  readonly themes =
    signal<readonly CommerceAdminCatalogThemePresentation[]>(emptyThemes);
  readonly collections =
    signal<readonly CommerceAdminCatalogCollectionPresentation[]>(
      emptyCollections,
    );
  readonly editingSection = signal<PublicPageSection | null>(null);
  readonly isSectionDrawerOpen = signal(false);
  readonly editingTheme =
    signal<CommerceAdminCatalogThemePresentation>(createBlankTheme());
  readonly editingCollection =
    signal<CommerceAdminCatalogCollectionPresentation>(createBlankCollection());
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingCmsPromotePreview = signal(false);
  readonly isPromotingCms = signal(false);
  readonly cmsPromoteConfirmation = signal('');
  readonly cmsPromotePreview =
    signal<CommerceAdminCmsPromotionPreviewResult | null>(null);
  readonly cmsPromoteResult = signal<CommerceAdminCmsPromotionResult | null>(
    null,
  );
  readonly cmsPromoteSecret = signal('');
  readonly themeQuery = signal('');
  readonly collectionQuery = signal('');
  readonly referenceTypes: readonly PublicPageSectionItemReferenceType[] = [
    'theme',
    'set',
    'collection',
    'custom',
  ];
  private sectionEditSnapshot = '';
  private sectionReturnFocus: HTMLElement | null = null;
  readonly filteredThemes = computed(() => {
    const query = this.themeQuery().trim().toLowerCase();

    if (!query) {
      return this.themes();
    }

    return this.themes().filter((theme) =>
      [
        theme.displayName,
        theme.publicDisplayName ?? '',
        theme.slug,
        theme.status,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly filteredCollections = computed(() => {
    const query = this.collectionQuery().trim().toLowerCase();

    if (!query) {
      return this.collections();
    }

    return this.collections().filter((collection) =>
      [
        collection.collectionSlug,
        collection.publicDisplayName ?? '',
        collection.status,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly cmsPromoteDisabledReason = computed(() => {
    if (!this.cmsPromotePreview()) {
      return 'Laad eerst een preview.';
    }

    if (!this.cmsPromoteSecret().trim()) {
      return 'Admin promote secret ontbreekt.';
    }

    if (
      this.cmsPromoteConfirmation().trim() !== CMS_PROMOTE_CONFIRMATION_PHRASE
    ) {
      return 'Typ PROMOTE CMS om productie te bevestigen.';
    }

    return null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isSectionDrawerOpen()) {
      this.cancelSectionEdit();
    }
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const [sections, themes, collections] = await Promise.all([
        this.adminApi.listHomepageSections(),
        this.adminApi.listCatalogThemes(),
        this.adminApi.listCatalogCollections(),
      ]);
      this.homepageSections.set(sections);
      this.themes.set(themes);
      this.collections.set(collections);
      this.closeSectionDrawer({ restoreFocus: false });
      this.editingTheme.set(themes[0] ? { ...themes[0] } : createBlankTheme());
      this.editingCollection.set(
        collections[0] ? { ...collections[0] } : createBlankCollection(),
      );
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  editSection(section: PublicPageSection, event?: Event): void {
    if (
      this.isSectionDrawerOpen() &&
      this.isSectionDirty() &&
      !globalThis.confirm('Niet-opgeslagen wijzigingen weggooien?')
    ) {
      return;
    }

    this.sectionReturnFocus =
      event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;

    const clonedSection = this.cloneSection(section);
    this.editingSection.set(clonedSection);
    this.sectionEditSnapshot = this.createSectionSnapshot(clonedSection);
    this.isSectionDrawerOpen.set(true);
    setTimeout(() => this.sectionDrawer?.nativeElement.focus());
  }

  cancelSectionEdit(): void {
    this.closeSectionDrawer();
  }

  editTheme(theme: CommerceAdminCatalogThemePresentation): void {
    this.editingTheme.set({ ...theme });
  }

  editCollection(collection: CommerceAdminCatalogCollectionPresentation): void {
    this.editingCollection.set({ ...collection });
  }

  updateThemeQuery(value: string): void {
    this.themeQuery.set(value);
  }

  updateCollectionQuery(value: string): void {
    this.collectionQuery.set(value);
  }

  async loadCmsPromotionPreview({
    clearResult = true,
  }: { clearResult?: boolean } = {}): Promise<void> {
    this.isLoadingCmsPromotePreview.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    if (clearResult) {
      this.cmsPromoteResult.set(null);
    }

    try {
      this.cmsPromotePreview.set(await this.adminApi.getCmsPromotionPreview());
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isLoadingCmsPromotePreview.set(false);
    }
  }

  cmsPromotionTableEntries(preview: CommerceAdminCmsPromotionPreviewResult): {
    name: string;
    summary: CommerceAdminCmsPromotionPreviewResult['tables'][string];
  }[] {
    return Object.entries(preview.tables).map(([name, summary]) => ({
      name,
      summary,
    }));
  }

  async promoteCms(): Promise<void> {
    const disabledReason = this.cmsPromoteDisabledReason();

    if (disabledReason) {
      this.errorMessage.set(
        `CMS promote kan niet worden gestart: ${disabledReason}`,
      );

      return;
    }

    this.isPromotingCms.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.cmsPromoteResult.set(null);

    try {
      const result = await this.adminApi.promoteCms({
        adminSecret: this.cmsPromoteSecret().trim(),
        confirmationPhrase: this.cmsPromoteConfirmation().trim(),
      });
      this.cmsPromoteResult.set(result);
      this.cmsPromoteConfirmation.set('');
      this.successMessage.set('CMS is gepromoot naar productie.');
      await this.loadCmsPromotionPreview({ clearResult: false });
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isPromotingCms.set(false);
    }
  }

  addSectionItem(section: PublicPageSection): void {
    section.items = [...section.items, createSectionItem(section.items.length)];
  }

  removeSectionItem(section: PublicPageSection, index: number): void {
    section.items = section.items.filter((_, itemIndex) => itemIndex !== index);
  }

  showHomepageItemImageField(item: PublicPageSectionItem): boolean {
    return item.referenceType === 'custom' || item.useCustomImage === true;
  }

  getHomepageItemImageSourceLabel(item: PublicPageSectionItem): string {
    if (this.showHomepageItemImageField(item)) {
      return 'custom';
    }

    if (item.referenceType === 'set') {
      return 'set image';
    }

    if (item.referenceType === 'theme') {
      const theme = this.themes().find(
        (candidate) => candidate.slug === item.referenceId,
      );

      if (theme?.publicTileImageUrl) {
        return 'tile image';
      }

      if (theme?.publicImageUrl) {
        return 'hero fallback';
      }

      return item.imageSetId
        ? 'representative set'
        : 'tile image / hero fallback / representative set';
    }

    if (item.referenceType === 'collection') {
      const collection = this.collections().find(
        (candidate) => candidate.collectionSlug === item.referenceId,
      );

      if (collection?.publicTileImageUrl) {
        return 'tile image';
      }

      if (collection?.publicImageUrl) {
        return 'hero fallback';
      }

      return item.imageSetId
        ? 'representative set'
        : 'tile image / hero fallback / representative set';
    }

    return 'custom image URL';
  }

  getSectionItemMetadataSummary(item: PublicPageSectionItem): string {
    if (!item.metadata || Object.keys(item.metadata).length === 0) {
      return '';
    }

    const hiddenMetadataKeys = new Set([
      'accentColor',
      'description',
      'surfaceColor',
    ]);
    const visibleMetadata = Object.fromEntries(
      Object.entries(item.metadata).filter(
        ([key]) => !hiddenMetadataKeys.has(key),
      ),
    );

    return Object.keys(visibleMetadata).length
      ? JSON.stringify(visibleMetadata)
      : '';
  }

  getSectionItemMetadataString(
    item: PublicPageSectionItem,
    key: string,
  ): string {
    const value = item.metadata?.[key];

    return typeof value === 'string' ? value : '';
  }

  getSectionItemMetadataColorInputValue(
    item: PublicPageSectionItem,
    key: string,
  ): string {
    const value = this.getSectionItemMetadataString(item, key);

    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  }

  getSectionItemPreviewSurfaceColor(
    item: PublicPageSectionItem,
  ): string | null {
    if (item.referenceType !== 'custom') {
      return null;
    }

    return (
      this.getSectionItemMetadataString(item, 'surfaceColor') ||
      this.getSectionItemMetadataString(item, 'accentColor') ||
      null
    );
  }

  getSectionItemPreviewTextColor(item: PublicPageSectionItem): string | null {
    const surfaceColor = this.getSectionItemPreviewSurfaceColor(item);

    return surfaceColor
      ? (getAccessibleForegroundColor(surfaceColor) ?? null)
      : null;
  }

  updateSectionItemMetadataString(
    item: PublicPageSectionItem,
    key: string,
    value: string,
  ): void {
    const trimmedValue = value.trim();
    const metadata: Record<string, unknown> = {
      ...(item.metadata ?? {}),
    };

    if (trimmedValue) {
      metadata[key] = trimmedValue;
    } else {
      delete metadata[key];
    }

    item.metadata = metadata;
  }

  getPresentationHeroImageUrl(
    presentation: CmsPresentationPreview,
  ): string | null | undefined {
    return presentation.publicImageUrl;
  }

  getPresentationTileImageUrl(
    presentation: CmsPresentationPreview,
  ): string | null | undefined {
    return presentation.publicTileImageUrl || presentation.publicImageUrl;
  }

  getPresentationSurfaceColor(presentation: CmsPresentationPreview): string {
    return (
      presentation.publicSurfaceColor ||
      presentation.publicAccentColor ||
      '#f2f4f7'
    );
  }

  getPresentationTextColor(presentation: CmsPresentationPreview): string {
    return (
      getAccessibleForegroundColor(
        this.getPresentationSurfaceColor(presentation),
      ) ?? '#05070d'
    );
  }

  async saveSection(): Promise<void> {
    const section = this.editingSection();

    if (!section) {
      return;
    }

    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    try {
      const savedSection = await this.adminApi.saveHomepageSection(section);
      this.homepageSections.set(
        this.homepageSections()
          .filter((item) => item.sectionKey !== savedSection.sectionKey)
          .concat(savedSection)
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.sectionKey.localeCompare(right.sectionKey),
          ),
      );
      this.editingSection.set(this.cloneSection(savedSection));
      this.sectionEditSnapshot = this.createSectionSnapshot(savedSection);
      this.closeSectionDrawer();
      this.successMessage.set(
        'Homepage section opgeslagen en / is gerevalideerd.',
      );
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  async saveTheme(): Promise<void> {
    const theme = this.editingTheme();

    if (!theme.slug) {
      return;
    }

    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    try {
      const savedTheme = await this.adminApi.updateCatalogThemePresentation({
        slug: theme.slug,
        theme,
      });
      this.themes.set(
        this.themes().map((item) =>
          item.slug === savedTheme.slug ? savedTheme : item,
        ),
      );
      this.editingTheme.set({ ...savedTheme });
      this.successMessage.set(
        'Theme presentation opgeslagen en homepage/themepagina’s zijn gerevalideerd.',
      );
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  async saveCollection(): Promise<void> {
    const collection = this.editingCollection();

    if (!collection.collectionSlug) {
      return;
    }

    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    try {
      const savedCollection =
        await this.adminApi.updateCatalogCollectionPresentation({
          collection,
          slug: collection.collectionSlug,
        });
      this.collections.set(
        this.collections().map((item) =>
          item.collectionSlug === savedCollection.collectionSlug
            ? savedCollection
            : item,
        ),
      );
      this.editingCollection.set({ ...savedCollection });
      this.successMessage.set(
        'Collection presentation opgeslagen en homepage/collectiepagina zijn gerevalideerd.',
      );
    } catch (error) {
      this.errorMessage.set(this.readErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  private cloneSection(
    section: PublicPageSection | null,
  ): PublicPageSection | null {
    return section
      ? {
          ...section,
          items: section.items.map((item) => ({ ...item })),
        }
      : null;
  }

  private closeSectionDrawer(options: { restoreFocus?: boolean } = {}): void {
    const shouldRestoreFocus = options.restoreFocus ?? true;

    this.isSectionDrawerOpen.set(false);
    this.editingSection.set(null);
    this.sectionEditSnapshot = '';

    if (shouldRestoreFocus) {
      setTimeout(() => this.sectionReturnFocus?.focus());
    }
  }

  private createSectionSnapshot(section: PublicPageSection | null): string {
    return JSON.stringify(section ?? null);
  }

  private isSectionDirty(): boolean {
    return (
      this.createSectionSnapshot(this.editingSection()) !==
      this.sectionEditSnapshot
    );
  }

  private readErrorMessage(error: unknown): string {
    if (
      error &&
      typeof error === 'object' &&
      'error' in error &&
      error.error &&
      typeof error.error === 'object' &&
      'message' in error.error &&
      typeof error.error.message === 'string'
    ) {
      return error.error.message;
    }

    return error instanceof Error ? error.message : 'CMS actie mislukt.';
  }
}
