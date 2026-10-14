import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';
import { AssignmentsTabComponent } from '../../components/assignments-tab/assignments-tab';
import { AuthoritiesTabComponent } from '../../components/authorities-tab/authorities-tab';
import { BusesTabComponent } from '../../components/buses-tab/buses-tab';
import { OverviewTabComponent } from '../../components/overview-tab/overview-tab';
import { PlansTabComponent } from '../../components/plans-tab/plans-tab';
import { BusStoreService } from '../../services/bus-store.service';

type TabKey = 'dashboard' | 'buses' | 'assignments' | 'plans' | 'authorities';

/**
 * Servis sayfası kabuğu: başlık ve sekme çubuğu. Her sekme kendi bileşeninde yaşar;
 * seçili olmayan sekmeler yok edilir ve açılırken verisini kendisi yükler.
 */
@Component({
  selector: 'app-school-bus',
  standalone: true,
  imports: [
    PageHeaderComponent,
    TranslatePipe,
    OverviewTabComponent,
    BusesTabComponent,
    AssignmentsTabComponent,
    PlansTabComponent,
    AuthoritiesTabComponent,
  ],
  providers: [BusStoreService],
  templateUrl: './school-bus.html',
  styleUrl: './school-bus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolBusComponent {
  protected readonly activeTab = signal<TabKey>('dashboard');
  protected readonly tabs: { key: TabKey; labelKey: string; icon: string }[] = [
    { key: 'dashboard', labelKey: 'SCHOOL_BUS.TAB_DASHBOARD', icon: 'dashboard' },
    { key: 'buses', labelKey: 'SCHOOL_BUS.TAB_BUSES', icon: 'directions_bus' },
    { key: 'assignments', labelKey: 'SCHOOL_BUS.TAB_ASSIGNMENTS', icon: 'assignment' },
    { key: 'plans', labelKey: 'SCHOOL_BUS.TAB_PLANS', icon: 'event_repeat' },
    { key: 'authorities', labelKey: 'SCHOOL_BUS.TAB_AUTHORITIES', icon: 'admin_panel_settings' },
  ];

  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
