import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { timer, Subscription, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { LastPassService } from '../../services/last-pass.service';
import {
  LastPassRecord,
  TerminalGroup,
} from '../../models/last-pass.model';

@Component({
  selector: 'app-last-pass',
  standalone: true,
  imports: [
    CommonModule,
    SelectModule,
    ProgressSpinnerModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './last-pass.html',
  styleUrl: './last-pass.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LastPassComponent implements OnInit {
  private lastPassService = inject(LastPassService);
  private destroyRef = inject(DestroyRef);

  // State Signals
  terminalGroups = signal<TerminalGroup[]>([]);
  selectedGroupId = signal<number | null>(null);
  recentPasses = signal<LastPassRecord[]>([]);
  isLoading = signal<boolean>(false);

  private pollingSubscription?: Subscription;
  private readonly POLLING_INTERVAL_MS = 3000;

  ngOnInit(): void {
    this.loadTerminalGroups();
  }

  onGroupChange(groupId: number): void {
    this.selectedGroupId.set(groupId);
    this.startPolling();
  }

  private loadTerminalGroups(): void {
    this.isLoading.set(true);
    this.lastPassService
      .getTerminalGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.terminalGroups.set(groups);
          if (groups.length > 0) {
            this.selectedGroupId.set(groups[0].id);
            this.startPolling();
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load terminal groups', err);
          this.isLoading.set(false);
        },
      });
  }

  private startPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

    const source = this.pollByGroup();
    if (!source) return;

    this.pollingSubscription = timer(0, this.POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() => source()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (records) => {
          this.recentPasses.set(records);
        },
        error: (err) => console.error('Polling error', err),
      });
  }

  private pollByGroup(): (() => Observable<LastPassRecord[]>) | null {
    const groupId = this.selectedGroupId();
    if (groupId === null) return null;
    return () => this.lastPassService.getRecentPassesByGroup(groupId);
  }

  private static readonly DEFAULT_AVATAR = 'assets/images/default-avatar.png';

  // Helper for UI — only emits a data URI for plausible base64 data,
  // otherwise falls back to the default avatar so no broken image flickers.
  getPhotoUrl(base64Data: string | null | undefined): string {
    if (this.isValidBase64Photo(base64Data)) {
      return `data:image/jpeg;base64,${base64Data!.trim()}`;
    }
    return LastPassComponent.DEFAULT_AVATAR;
  }

  // Fallback when an image still fails to load (e.g. corrupt base64).
  onPhotoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = LastPassComponent.DEFAULT_AVATAR;
  }

  private isValidBase64Photo(value: string | null | undefined): boolean {
    const trimmed = (value ?? '').trim();
    // Must be non-trivial and consist only of base64 characters (allow padding '=').
    if (trimmed.length < 16) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
  }
}
