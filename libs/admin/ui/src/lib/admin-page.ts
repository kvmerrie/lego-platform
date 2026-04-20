import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'lego-admin-page',
  imports: [CommonModule],
  template: `
    <section class="admin-page">
      <header class="admin-page__header">
        <div class="admin-page__intro">
          <div class="admin-page__heading">
            @if (eyebrow) {
              <p class="admin-page__eyebrow">{{ eyebrow }}</p>
            }
            <h1 class="admin-page__title">{{ title }}</h1>
            @if (description) {
              <p class="admin-page__description">{{ description }}</p>
            }
          </div>

          <div class="admin-page__actions">
            <ng-content select="[adminPageActions]"></ng-content>
          </div>
        </div>

        <ng-content select="[adminPageMeta]"></ng-content>
      </header>

      <div class="admin-page__body">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPageComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() eyebrow = '';
}
