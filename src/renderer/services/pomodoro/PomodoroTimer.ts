import type { PomodoroPhase, PomodoroSettings, PomodoroStatus } from './types';

/**
 * A Pomodoro state machine. Pure: every method that depends on time takes
 * `now` (ms since epoch) instead of reading a clock.
 *
 * A finished focus block starts its break automatically. A finished break
 * returns to focus *paused*, so a block never starts while the user is away.
 */
export class PomodoroTimer {
  private phase: PomodoroPhase = 'focus';
  private completed = 0;
  private endsAt: number | null = null; // set while running
  private remainingMs: number;          // authoritative while paused
  private phaseStarted = false;         // has this phase ever run?

  constructor(private settings: PomodoroSettings) {
    this.remainingMs = this.lengthOf('focus');
  }

  public start(now: number): PomodoroStatus {
    if (this.endsAt === null) {
      this.endsAt = now + this.remainingMs;
      this.phaseStarted = true;
    }
    return this.getStatus(now);
  }

  public pause(now: number): PomodoroStatus {
    if (this.endsAt !== null) {
      this.remainingMs = Math.max(0, this.endsAt - now);
      this.endsAt = null;
    }
    return this.getStatus(now);
  }

  /** Advances the phase if it has run out. Call this on an interval. */
  public tick(now: number): PomodoroStatus {
    if (this.endsAt !== null && now >= this.endsAt) {
      this.finishPhase(now, true);
    }
    return this.getStatus(now);
  }

  /** Ends the current phase early. A skipped focus block does not count. */
  public skip(now: number): PomodoroStatus {
    this.finishPhase(now, false);
    return this.getStatus(now);
  }

  public reset(): void {
    this.phase = 'focus';
    this.completed = 0;
    this.endsAt = null;
    this.remainingMs = this.lengthOf('focus');
    this.phaseStarted = false;
  }

  /** New lengths apply now to a phase that has not started, otherwise from the next phase. */
  public setSettings(settings: PomodoroSettings, now: number): PomodoroStatus {
    this.settings = settings;
    if (!this.phaseStarted) {
      this.remainingMs = this.lengthOf(this.phase);
    }
    return this.getStatus(now);
  }

  public getStatus(now: number): PomodoroStatus {
    const remainingMs = this.endsAt === null ? this.remainingMs : Math.max(0, this.endsAt - now);
    const isRunning = this.endsAt !== null;
    return {
      phase: this.phase,
      isRunning,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      completedFocusBlocks: this.completed,
      isFocusActive: isRunning && this.phase === 'focus',
    };
  }

  private finishPhase(now: number, ranToEnd: boolean): void {
    if (this.phase === 'focus') {
      if (ranToEnd) {
        this.completed += 1;
      }
      const isLong = ranToEnd && this.completed % this.settings.longBreakEvery === 0;
      this.enter(isLong ? 'longBreak' : 'shortBreak');
      this.endsAt = now + this.remainingMs; // breaks start on their own
      this.phaseStarted = true;
    } else {
      this.enter('focus'); // paused until the user starts it
    }
  }

  private enter(phase: PomodoroPhase): void {
    this.phase = phase;
    this.endsAt = null;
    this.remainingMs = this.lengthOf(phase);
    this.phaseStarted = false;
  }

  private lengthOf(phase: PomodoroPhase): number {
    const minutes =
      phase === 'focus'
        ? this.settings.focusMinutes
        : phase === 'shortBreak'
          ? this.settings.shortBreakMinutes
          : this.settings.longBreakMinutes;
    return minutes * 60_000;
  }
}
