import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [FormsModule, InputTextModule, TranslatePipe],
  templateUrl: './search-box.html',
  styleUrl: './search-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
  readonly value = model('');
}
