import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lego-admin-batch-selection-bar',
  imports: [CommonModule],
  template: `
    <section class="admin-selection-bar">
      <div class="admin-selection-bar__summary">
        <span class="admin-selection-bar__count">{{ selectedCount }}</span>
        <div class="admin-selection-bar__text">
          <strong>{{ label }}</strong>
          @if (description) {
            <p>{{ description }}</p>
          }
        </div>
      </div>

      <div class="admin-selection-bar__actions">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBatchSelectionBarComponent {
  @Input() description = '';
  @Input({ required: true }) label = '';
  @Input() selectedCount = 0;
}
