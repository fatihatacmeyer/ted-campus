import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

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
export class SidebarComponent {
  @Input() isOpen = true;

  @Output() sidebarToggle = new EventEmitter<void>();

  protected readonly navItems: NavItem[] = [
    { labelKey: 'MENU.HOME', route: '/home', icon: 'dashboard' },
    { labelKey: 'MENU.STUDENTS', route: '/home/students', icon: 'school' },
    { labelKey: 'MENU.PARENTS', route: '/home/parents', icon: 'group' },
    { labelKey: 'MENU.TEACHERS', route: '/home/teachers', icon: 'badge' },
    { labelKey: 'MENU.TRANSPORT', route: '/home/transport', icon: 'directions_bus' },
    { labelKey: 'MENU.ACTIVITIES', route: '/home/activities', icon: 'event' },
    { labelKey: 'MENU.ATTENDANCE', route: '/home/attendance', icon: 'schedule' },
  ];
}
