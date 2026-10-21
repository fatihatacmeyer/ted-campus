import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly icon = input<string>();
  readonly subtitle = input<string>();
}
