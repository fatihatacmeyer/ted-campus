import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly cls = input('');
  readonly iconCls = input.required<string>();
  readonly icon = input.required<string>();
  readonly registered = input.required<number>();
  readonly inside = input.required<number>();
  readonly labelKey = input.required<string>();

  readonly selected = output<void>();
}
