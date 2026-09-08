import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../../core/services/auth.service';

interface NavItem {
  labelKey: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = true;

  @Output() sidebarToggle = new EventEmitter<void>();

  private authService = inject(AuthService);

  private readonly allNavItems: NavItem[] = [
    { labelKey: 'MENU.HOME', route: '/home', icon: 'dashboard' },
    { labelKey: 'MENU.STUDENTS', route: '/home/students', icon: 'school' },
    { labelKey: 'MENU.PARENTS', route: '/home/parents', icon: 'group' },
    // { labelKey: 'MENU.TEACHERS', route: '/home/teachers', icon: 'badge' },
    { labelKey: 'MENU.PROXIES', route: '/home/proxies', icon: 'supervisor_account' },
    { labelKey: 'MENU.TRANSPORT', route: '/home/transport', icon: 'directions_bus' },
    { labelKey: 'MENU.ACTIVITIES', route: '/home/activities', icon: 'event' },
    { labelKey: 'MENU.ATTENDANCE', route: '/home/attendance', icon: 'schedule' },
    { labelKey: 'MENU.PHOTO_APPROVAL', route: '/home/photo-approval', icon: 'photo_camera' },
    { labelKey: 'MENU.SCHOOL_HOURS', route: '/home/school-hours', icon: 'alarm' },
  ];

  protected navItems: NavItem[] = [];

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    const isAdmin = user?.admin === true; //|| user?.admin === 1;

    // Adminse hepsini göster, değilse sadece /home rotasını (Anasayfa) göster
    this.navItems = isAdmin
      ? this.allNavItems
      : this.allNavItems.filter((item) => item.route === '/home');
  }
}
