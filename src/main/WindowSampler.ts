import type { SamplerError, SamplerEvent, WindowSample } from '../shared/types';

// get-windows is ESM-only; a CommonJS file must say so when importing its types.
type GetWindows = typeof import('get-windows', { with: { 'resolution-mode': 'import' } });

/**
 * Asks the OS which window has focus, on an interval, and reports what it
 * finds. Deliberately dumb: no allowlist, no timing rules, no decisions —
 * those all live in FocusTracker in the renderer.
 *
 * Never logs a sample: windowTitle is personal activity data.
 */
export class WindowSampler {
  private timer: NodeJS.Timeout | null = null;
  private module: GetWindows | null = null;
  private inFlight = false;

  constructor(
    private readonly intervalMs: number,
    private readonly onEvent: (event: SamplerEvent) => void,
  ) {}

  public async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    try {
      // Kept as a dynamic import on purpose: get-windows is ESM-only and this
      // file compiles to CommonJS. Only survives compilation as a real import()
      // because tsconfig sets module: node16.
      this.module = await import('get-windows');
    } catch (error) {
      this.fail('addon-unavailable', `Could not load get-windows: ${errorMessage(error)}`);
      return;
    }

    await this.tick(); // report immediately rather than after one full interval
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.module = null;
  }

  private async tick(): Promise<void> {
    // A slow query must not stack up behind the interval.
    if (!this.module || this.inFlight) {
      return;
    }
    this.inFlight = true;

    try {
      const result = await this.module.activeWindow();

      // A failed native install does not throw — get-windows returns undefined.
      // Say so out loud instead of looking like a perfectly focused user.
      if (!result) {
        this.fail('addon-unavailable', 'activeWindow() returned undefined; the native addon is not loaded.');
        return;
      }

      const sample: WindowSample = {
        appName: result.owner.name,
        windowTitle: result.title,
        timestamp: Date.now(),
      };

      this.onEvent({ kind: 'sample', sample });
    } catch (error) {
      this.fail('query-failed', errorMessage(error));
    } finally {
      this.inFlight = false;
    }
  }

  private fail(reason: SamplerError['reason'], message: string): void {
    this.onEvent({ kind: 'error', error: { reason, message } });
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
