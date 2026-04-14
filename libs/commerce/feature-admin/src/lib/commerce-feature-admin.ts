import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-feature-admin',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './commerce-feature-admin.html',
  styleUrl: './commerce-feature-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceFeatureAdminComponent implements OnInit {
  readonly commerceAdminStore = inject(CommerceAdminStore);

  async ngOnInit(): Promise<void> {
    await this.commerceAdminStore.ensureLoaded();
  }

  async reload(): Promise<void> {
    await this.commerceAdminStore.reload();
  }
}
