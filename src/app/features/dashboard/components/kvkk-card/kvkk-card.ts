import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { tap } from 'rxjs';

import { DashboardService, KvkkStats } from '../../services/dashboard.service';

const EMPTY_KVKK: KvkkStats = {
  studentApproved: 0,
  parentApproved: 0,
  proxyApproved: 0,
  serviceApproved: 0,
  totalApproved: 0,
};

/** Onay oranı (%): kayıtlı yoksa 0; 100'ü aşmaz. */
const percentOf = (approved: number, registered: number): number =>
  registered > 0 ? Math.min(100, Math.round((approved / registered) * 100)) : 0;

interface KvkkBlock {
  cls: string;
  icon: string;
  labelKey: string;
  approved: number;
  /** null → oransız blok (yalnızca sayı). */
  registered: number | null;
  percent: number | null;
}

/**
 * KVKK onay şeridi (sp_KvkkOnayCampus_s). Kendi verisini yükler; hata verirse yalnızca
 * bu kart hata gösterir, tüm pano hata ekranına düşmez.
 */
@Component({
  selector: 'app-kvkk-card',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, ProgressSpinnerModule],
  templateUrl: './kvkk-card.html',
  styleUrl: './kvkk-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KvkkCardComponent {
  private readonly dashboardService = inject(DashboardService);

  /** Yüzdeler için kayıtlı öğrenci / veli sayıları. */
  readonly studentCount = input.required<number>();
  readonly parentCount = input.required<number>();

  private readonly resource = rxResource<KvkkStats, void>({
    stream: () =>
      this.dashboardService
        .getKvkkStats()
        .pipe(tap({ error: (err) => console.error('Dashboard veri yükleme hatası:', err) })),
    defaultValue: EMPTY_KVKK,
  });

  protected readonly loading = this.resource.isLoading;
  protected readonly error = computed(() => !!this.resource.error());

  protected readonly blocks = computed<KvkkBlock[]>(() => {
    const k = this.resource.value();
    const students = this.studentCount();
    const parents = this.parentCount();
    return [
      {
        cls: 'kvkk-student',
        icon: 'school',
        labelKey: 'USERDEF.STUDENT',
        approved: k.studentApproved,
        registered: students,
        percent: percentOf(k.studentApproved, students),
      },
      {
        cls: 'kvkk-parent',
        icon: 'groups',
        labelKey: 'USERDEF.PARENT',
        approved: k.parentApproved,
        registered: parents,
        percent: percentOf(k.parentApproved, parents),
      },
      {
        cls: 'kvkk-proxy',
        icon: 'supervisor_account',
        labelKey: 'DASHBOARD.KVKK_PROXY',
        approved: k.proxyApproved,
        registered: null,
        percent: null,
      },
      {
        cls: 'kvkk-service',
        icon: 'directions_bus',
        labelKey: 'DASHBOARD.KVKK_SERVICE',
        approved: k.serviceApproved,
        registered: null,
        percent: null,
      },
      {
        cls: 'kvkk-total',
        icon: 'badge',
        labelKey: 'DASHBOARD.TOTAL',
        approved: k.totalApproved,
        registered: null,
        percent: null,
      },
    ];
  });

  protected reload(): void {
    this.resource.reload();
  }
}
