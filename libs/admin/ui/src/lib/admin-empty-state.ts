import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AdminStateTone = 'danger' | 'empty' | 'loading';

@Component({
  selector: 'lego-admin-empty-state',
  imports: [CommonModule],
  template: `
    <section
      class="admin-state"
      [class.admin-state--danger]="tone === 'danger'"
      [class.admin-state--loading]="tone === 'loading'"
    >
      <div class="admin-state__content">
        @if (title) {
          <strong class="admin-state__title">{{ title }}</strong>
        }
        @if (description) {
          <p class="admin-state__description">{{ description }}</p>
        }
      </div>

      <div class="admin-state__actions">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEmptyStateComponent {
  @Input() description = '';
  @Input() title = '';
  @Input() tone: AdminStateTone = 'empty';
}
