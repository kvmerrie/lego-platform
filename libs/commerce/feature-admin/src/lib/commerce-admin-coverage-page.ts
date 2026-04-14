import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-coverage-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './commerce-admin-coverage-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCoveragePageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
}
