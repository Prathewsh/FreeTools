import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type TimeSubtool = 'epoch' | 'world' | 'stopwatch' | 'timer' | 'diff';

interface WorldClock {
  city: string;
  region: string;
  tz: string;
  aliases?: string[];
  offset: string;
  time: string;
  date: string;
  isPinned: boolean;
}

@Component({
  selector: 'app-time-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './time-tools.component.html',
  styleUrl: './time-tools.component.scss'
})
export class TimeToolsComponent implements OnInit, OnDestroy {
  activeSubtool = signal<TimeSubtool>('epoch');

  // Epoch
  currentEpoch = signal(Math.floor(Date.now() / 1000));
  inputEpoch = signal(String(Math.floor(Date.now() / 1000)));
  inputIso = signal(new Date().toISOString());

  epochToDateResult = computed(() => {
    try {
      const sec = parseInt(this.inputEpoch(), 10);
      if (isNaN(sec)) return null;
      const d = new Date(sec > 9999999999 ? sec : sec * 1000);
      if (isNaN(d.getTime())) return null;
      return {
        utc: d.toUTCString(),
        local: d.toString(),
        iso: d.toISOString()
      };
    } catch {
      return null;
    }
  });

  dateToEpochResult = computed(() => {
    try {
      const d = new Date(this.inputIso());
      if (isNaN(d.getTime())) return null;
      return {
        seconds: Math.floor(d.getTime() / 1000),
        millis: d.getTime()
      };
    } catch {
      return null;
    }
  });

  // World Clocks: Complete IANA Timezone Support
  allSupportedTimezones: string[] = [];
  selectedRegion = signal<string>('All');
  clockSearchQuery = signal<string>('');
  onlyPinned = signal<boolean>(false);
  pinnedZones = signal<Set<string>>(new Set([
    'UTC',
    'Asia/Kolkata',
    'Asia/Calcutta',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney'
  ]));

  // Cached formatters map to maximize rendering performance across 400+ zones
  private formatters = new Map<string, { timeFmt: Intl.DateTimeFormat; dateFmt: Intl.DateTimeFormat; offsetFmt: Intl.DateTimeFormat }>();

  availableRegions = signal<string[]>(['All']);
  worldClocks = signal<WorldClock[]>([]);

  // Filtered view computed
  displayedClocks = computed(() => {
    const list = this.worldClocks();
    const q = this.clockSearchQuery().trim().toLowerCase();
    const reg = this.selectedRegion();
    const pinnedOnly = this.onlyPinned();

    return list.filter(clock => {
      if (pinnedOnly && !clock.isPinned) return false;
      if (reg !== 'All' && clock.region !== reg) return false;
      if (q) {
        const matchesAlias = clock.aliases?.some(a => a.toLowerCase().includes(q));
        return (
          clock.city.toLowerCase().includes(q) ||
          clock.tz.toLowerCase().includes(q) ||
          clock.region.toLowerCase().includes(q) ||
          clock.offset.toLowerCase().includes(q) ||
          Boolean(matchesAlias)
        );
      }
      return true;
    });
  });

  // Stopwatch & Timer
  stopwatchRunning = signal(false);
  stopwatchTime = signal(0);
  laps = signal<number[]>([]);
  private stopwatchInterval: any = null;

  timerHours = signal(0);
  timerMinutes = signal(5);
  timerSeconds = signal(0);
  timerRunning = signal(false);
  timerStarted = signal(false);
  timerFinished = signal(false);
  timerRemaining = signal(0);
  timerDuration = computed(() => {
    const values = [this.timerHours(), this.timerMinutes(), this.timerSeconds()];
    if (values.some(value => !Number.isInteger(value) || value < 0) ||
        values[0] > 99 || values[1] > 59 || values[2] > 59) return 0;
    return (values[0] * 3600 + values[1] * 60 + values[2]) * 1000;
  });
  timerDisplay = computed(() => {
    const seconds = Math.ceil((this.timerStarted() ? this.timerRemaining() : this.timerDuration()) / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':');
  });
  private timerDeadline = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Date Diff
  startDate = signal(new Date().toISOString().slice(0, 10));
  endDate = signal(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10));
  dateDiffResult = computed(() => {
    try {
      const d1 = new Date(this.startDate());
      const d2 = new Date(this.endDate());
      const diffMs = Math.abs(d2.getTime() - d1.getTime());
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const weeks = (days / 7).toFixed(1);
      return { days, hours, weeks };
    } catch {
      return null;
    }
  });

  private clockInterval: any = null;

  ngOnInit() {
    this.initAllTimezones();
    this.updateWorldClocks();
    this.clockInterval = setInterval(() => {
      this.currentEpoch.set(Math.floor(Date.now() / 1000));
      this.updateWorldClocks();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
    this.clearTimerInterval();
  }

  private initAllTimezones() {
    let zones: string[] = [];
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      try {
        zones = (Intl as any).supportedValuesOf('timeZone');
      } catch {
        zones = [];
      }
    }

    if (!zones || zones.length === 0) {
      zones = [
        'UTC',
        'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
        'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Chicago',
        'America/Denver', 'America/Los_Angeles', 'America/New_York', 'America/Sao_Paulo', 'America/Toronto',
        'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Seoul',
        'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
        'Atlantic/Reykjavik',
        'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
        'Europe/Amsterdam', 'Europe/Berlin', 'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Europe/Rome',
        'Pacific/Auckland', 'Pacific/Honolulu', 'Pacific/Fiji'
      ];
    }

    if (!zones.includes('UTC')) {
      zones.unshift('UTC');
    }
    if (!zones.includes('Asia/Kolkata')) {
      zones.push('Asia/Kolkata');
    }

    this.allSupportedTimezones = zones;

    const regionsSet = new Set<string>();
    for (const tz of zones) {
      const parts = tz.split('/');
      regionsSet.add(parts[0]);

      // Pre-compile formatters
      try {
        const timeFmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        const dateFmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        const offsetFmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'shortOffset'
        });
        this.formatters.set(tz, { timeFmt, dateFmt, offsetFmt });
      } catch {
        // Ignore unparseable fallback
      }
    }

    const sortedRegions = Array.from(regionsSet).sort();
    this.availableRegions.set(['All', ...sortedRegions]);
  }

  updateWorldClocks() {
    const now = new Date();
    const pinned = this.pinnedZones();

    const clocks: WorldClock[] = [];

    for (const tz of this.allSupportedTimezones) {
      const parts = tz.split('/');
      const region = parts[0];
      let city = parts.length > 1 ? parts.slice(1).join(' - ').replace(/_/g, ' ') : region;
      let aliases: string[] = [];

      // Add common city aliases for regional hubs (e.g. India / IST covering Mumbai, Delhi, Bengaluru, etc.)
      if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') {
        city = 'India (Mumbai / Delhi / Kolkata)';
        aliases = ['Mumbai', 'Delhi', 'New Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Calcutta', 'India', 'IST'];
      }

      const isPinned = pinned.has(tz);

      const f = this.formatters.get(tz);
      let time = '--:--:--';
      let date = '---';
      let offset = '';

      if (f) {
        try {
          time = f.timeFmt.format(now);
          date = f.dateFmt.format(now);
          const p = f.offsetFmt.formatToParts(now);
          const found = p.find(item => item.type === 'timeZoneName');
          offset = found ? found.value : '';
        } catch {
          time = '--:--:--';
        }
      }

      clocks.push({
        city,
        region,
        tz,
        aliases,
        offset,
        time,
        date,
        isPinned
      });
    }

    // Sort: pinned items first, then alphabetical by city
    clocks.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.city.localeCompare(b.city);
    });

    this.worldClocks.set(clocks);
  }

  togglePin(tz: string, event: Event) {
    event.stopPropagation();
    this.pinnedZones.update(set => {
      const next = new Set(set);
      if (next.has(tz)) {
        next.delete(tz);
      } else {
        next.add(tz);
      }
      return next;
    });
    this.updateWorldClocks();
  }

  // Stopwatch actions
  startTimer() {
    if (this.timerRunning() || this.timerDuration() <= 0) return;
    if (!this.timerStarted() || this.timerFinished()) {
      this.timerRemaining.set(this.timerDuration());
    }
    this.timerStarted.set(true);
    this.timerFinished.set(false);
    this.timerRunning.set(true);
    this.timerDeadline = Date.now() + this.timerRemaining();
    // Recalculate from the deadline so delayed background callbacks do not accumulate drift.
    this.timerInterval = setInterval(() => this.updateTimer(), 100);
  }

  pauseTimer() {
    if (!this.timerRunning()) return;
    this.updateTimer();
    this.clearTimerInterval();
    this.timerRunning.set(false);
  }

  resetTimer() {
    this.clearTimerInterval();
    this.timerRunning.set(false);
    this.timerStarted.set(false);
    this.timerFinished.set(false);
    this.timerRemaining.set(0);
  }

  private updateTimer() {
    const remaining = Math.max(0, this.timerDeadline - Date.now());
    this.timerRemaining.set(remaining);
    if (remaining === 0) {
      this.clearTimerInterval();
      this.timerRunning.set(false);
      this.timerFinished.set(true);
    }
  }

  private clearTimerInterval() {
    if (this.timerInterval !== null) clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  startStopwatch() {
    if (this.stopwatchRunning()) return;
    this.stopwatchRunning.set(true);
    const start = Date.now() - this.stopwatchTime();
    this.stopwatchInterval = setInterval(() => {
      this.stopwatchTime.set(Date.now() - start);
    }, 10);
  }

  pauseStopwatch() {
    this.stopwatchRunning.set(false);
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
  }

  resetStopwatch() {
    this.pauseStopwatch();
    this.stopwatchTime.set(0);
    this.laps.set([]);
  }

  recordLap() {
    this.laps.update(l => [this.stopwatchTime(), ...l]);
  }

  formatTime(ms: number): string {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  }

  setCurrentEpoch() {
    this.inputEpoch.set(String(this.currentEpoch()));
  }

  copy(val: any) {
    navigator.clipboard.writeText(String(val));
  }
}
