import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeaderComponent } from './header/header';
import { SidebarComponent } from './sidebar/sidebar';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  isSidebarOpen = true;

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  /** Aktif (en derin) child route'un data['scrollable'] değeri — true ise sayfa kayabilir */
  isContentScrollable = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.activatedRoute.firstChild;
        while (route?.firstChild) route = route.firstChild;
        return !!route?.snapshot.data['scrollable'];
      }),
    ),
    { initialValue: false },
  );

  onToggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
}
