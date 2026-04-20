import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lego-admin-section-header',
  imports: [CommonModule],
  template: `
    <div class="admin-section-header">
      <div class="admin-section-header__content">
        @if (eyebrow) {
          <p class="admin-section-header__eyebrow">{{ eyebrow }}</p>
        }
        <div class="admin-section-header__heading">
          <h2 class="admin-section-header__title">{{ title }}</h2>
          @if (description) {
            <p class="admin-section-header__description">{{ description }}</p>
          }
        </div>
      </div>

      <div class="admin-section-header__meta">
        <ng-content select="[adminSectionMeta]"></ng-content>
      </div>

      <div class="admin-section-header__actions">
        <ng-content select="[adminSectionActions]"></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSectionHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() eyebrow = '';
}
