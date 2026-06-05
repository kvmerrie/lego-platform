import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';
import {
  CommerceAdminApiService,
  CommerceAdminSyncPromotePageComponent,
} from '@lego-platform/commerce/feature-admin';

describe('CommerceAdminSyncPromotePageComponent', () => {
  it('shows the promote preview diff and requires explicit confirmation', async () => {
    const promoteCatalog = vi.fn(async () => ({
      changedThemeSlugs: [],
      durationMs: 10,
      startedAt: '2026-04-19T08:10:00.000Z',
      status: 'ok' as const,
      tables: {},
    }));

    await TestBed.configureTestingModule({
      imports: [CommerceAdminSyncPromotePageComponent, FormsModule],
      providers: [
        {
          provide: CommerceAdminApiService,
          useValue: {
            getCatalogPromotionPreview: async () => ({
              generatedAt: '2026-04-19T08:00:00.000Z',
              meaningfulPendingPromoteCount: 2,
              operatorSummary: {
                mappings: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
                sets: {
                  insertedCount: 1,
                  readCount: 10,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 1,
                },
                themes: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
              },
              pendingPromoteCount: 2,
              samples: [
                {
                  changeType: 'insert',
                  changedFields: ['set_id'],
                  key: 'set_id:10316',
                  table: 'catalog_sets',
                },
              ],
              skippedHeavyTables: ['collection_page_snapshots'],
              sourceEnvironment: 'staging',
              status: 'ok',
              tables: {
                catalog_sets: {
                  insertedCount: 1,
                  readCount: 10,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 1,
                },
                collection_page_snapshots: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: true,
                  strategy: 'heavy_skipped',
                  updatedCount: 0,
                  warning: 'Skipped in lightweight preview.',
                },
              },
              targetEnvironment: 'production',
            }),
            getAdminRuntimeConfig: async () => ({
              articlePreviewEnabled: false,
              hasAdminPromotionSecret: true,
            }),
            promoteCatalog,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminSyncPromotePageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const promoteButton = Array.from(
      fixture.nativeElement.querySelectorAll(
        'button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Promote staging'));

    expect(text).toContain('catalog_sets');
    expect(text).toContain('Snapshot tables skipped in lightweight preview');
    expect(text).toContain('2 meaningful pending');
    expect(promoteButton?.disabled).toBe(true);

    fixture.componentInstance.promoteSecret.set('secret');
    fixture.componentInstance.promoteConfirmation.set('PROMOTE CATALOG');
    fixture.detectChanges();

    expect(promoteButton?.disabled).toBe(false);

    await fixture.componentInstance.promoteCatalog();

    expect(promoteCatalog).toHaveBeenCalledWith({
      adminSecret: 'secret',
      confirmationPhrase: 'PROMOTE CATALOG',
    });
  });
});
