import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AdminStatusBadgeTone =
  | 'danger'
  | 'neutral'
  | 'positive'
  | 'warning';

@Component({
  selector: 'lego-admin-status-badge',
  template: `
    <span
      class="admin-status-badge"
      [class.admin-status-badge--danger]="tone === 'danger'"
      [class.admin-status-badge--neutral]="tone === 'neutral'"
      [class.admin-status-badge--positive]="tone === 'positive'"
      [class.admin-status-badge--warning]="tone === 'warning'"
    >
      <ng-content></ng-content>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatusBadgeComponent {
  @Input() tone: AdminStatusBadgeTone = 'neutral';
}
