import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  @Input() isOpen = true;

  @Output() sidebarToggle = new EventEmitter<void>();

  protected readonly navItems: NavItem[] = [
    { label: 'Anasayfa', route: '/home', icon: 'dashboard' },
    { label: 'Öğrenciler', route: '/home/students', icon: 'school' },
    { label: 'Veliler', route: '/home/parents', icon: 'group' },
    { label: 'Öğretmenler', route: '/home/teachers', icon: 'badge' },
    { label: 'Servis', route: '/home/transport', icon: 'directions_bus' },
    { label: 'Etkinlikler', route: '/home/activities', icon: 'event' },
  ];
}
