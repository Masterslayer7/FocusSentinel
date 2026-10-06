import type { AppCategory, FocusRules, FocusStatus, WindowSample } from './types';

/**
 * How the rules classify an app: an exact (case-insensitive) name match wins,
 * then the longest rule key contained in the name, else 'distraction'.
 */
export const classifyApp = (appName: string, rules: FocusRules): AppCategory => {
  const name = appName.toLowerCase();
  let partial: { key: string; category: AppCategory } | null = null;

  for (const [key, category] of Object.entries(rules.apps)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === name) {
      return category;
    }
    if (lowerKey && name.includes(lowerKey) && (!partial || lowerKey.length > partial.key.length)) {
      partial = { key: lowerKey, category };
    }
  }
  return partial?.category ?? 'distraction';
};

const matchesAny = (haystack: string, needles: string[]): boolean => {
  const value = haystack.toLowerCase();
  return needles.some((needle) => value.includes(needle.toLowerCase()));
};

export class FocusTracker {
  private isDistracted = false;
  private violationCount = 0;
  private distractionStart: number | null = null;
  private distractionDuration = 0;
  private currentApp = '';

  constructor(private rules: FocusRules) {}

  /** Replaces the rules; they apply from the next sample. */
  public setRules(rules: FocusRules): void {
    this.rules = rules;
  }

  /** Feeds one observation in and returns the resulting status. */
  public accept(sample: WindowSample): FocusStatus {
    this.currentApp = sample.appName;

    if (this.isAllowed(sample)) {
      this.isDistracted = false;
      this.distractionStart = null;
      this.distractionDuration = 0;
    } else if (!this.isDistracted) {
      // Transition into a new distraction episode.
      this.isDistracted = true;
      this.violationCount += 1;
      this.distractionStart = sample.timestamp;
      this.distractionDuration = 0;
    } else {
      // Still distracted: grow the duration from the episode's start.
      const elapsedMs = sample.timestamp - (this.distractionStart ?? sample.timestamp);
      this.distractionDuration = Math.max(0, Math.floor(elapsedMs / 1000));
    }

    return this.getStatus();
  }

  /** Returns a fresh object, so a consumer holding an earlier status never sees it change. */
  public getStatus(): FocusStatus {
    return {
      isDistracted: this.isDistracted,
      distractionDuration: this.distractionDuration,
      violationCount: this.violationCount,
      currentApp: this.currentApp,
    };
  }

  /**
   * Ends the current distraction episode without counting or timing anything,
   * e.g. when a focus block ends. A later distraction starts a new episode.
   */
  public interrupt(): void {
    this.isDistracted = false;
    this.distractionStart = null;
    this.distractionDuration = 0;
  }

  public reset(): void {
    this.isDistracted = false;
    this.violationCount = 0;
    this.distractionStart = null;
    this.distractionDuration = 0;
    this.currentApp = '';
  }

  /** Browsers are judged on window title, because the tab is the activity; everything else on app name. */
  private isAllowed(sample: WindowSample): boolean {
    const category = classifyApp(sample.appName, this.rules);
    if (category === 'browser') {
      return matchesAny(sample.windowTitle, this.rules.allowedBrowserTitles);
    }
    return category === 'focus';
  }
}
