import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
