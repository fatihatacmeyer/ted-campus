import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { NotificationService } from '../../../../core/services/notification.service';
import { DashboardService } from '../../../dashboard/services/dashboard.service';
import { BusDashboardStats } from '../../models/school-bus.model';
import { SchoolBusService } from '../../services/school-bus.service';

/** Genel Bakış sekmesi: araç ve yolcu özet kartları. */
@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './overview-tab.html',
  styleUrl: './overview-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewTabComponent implements OnInit {
  private busService = inject(SchoolBusService);
  private dashboardService = inject(DashboardService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  protected readonly dashboardStats = signal<BusDashboardStats | null>(null);
  /** KVKK onaylayan servis yetkilisi sayısı (sp_KvkkOnayCampus_s.ServisOnaySayisi). */
  protected readonly kvkkServiceApproved = signal(0);

  ngOnInit(): void {
    this.loadDashboardStats();
    this.loadKvkkServiceApproved();
  }

  /** Kart ikincil bilgi: hata durumunda sayfayı bozmadan 0 kalır. */
  private loadKvkkServiceApproved(): void {
    this.dashboardService
      .getKvkkStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (k) => this.kvkkServiceApproved.set(k.serviceApproved) });
  }

  private loadDashboardStats(): void {
    this.busService
      .getDashboardStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => this.dashboardStats.set(stats),
        error: () => this.notification.error('SCHOOL_BUS.MSG_STATS_ERROR'),
      });
  }
}
