import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersistedState, StoredState } from '../shared/types';
import { parseStoredState } from './storedState';

export const STATE_FILE_NAME = 'focussentinel-state.json';

/**
 * Reads and writes the one persisted state file (ADR-009). Holds no rules of
 * its own: everything going in or coming out passes through parseStoredState.
 */
export class StateStore {
  private readonly filePath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(directory: string) {
    this.filePath = join(directory, STATE_FILE_NAME);
  }

  /** The valid parts of what is on disk; {} when there is nothing usable. */
  public async load(): Promise<StoredState> {
    let text: string;
    try {
      text = await readFile(this.filePath, 'utf8');
    } catch {
      return {}; // first run: no file yet
    }

    try {
      return parseStoredState(JSON.parse(text));
    } catch {
      // Keep the unreadable file for inspection rather than overwriting it.
      await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {});
      return {};
    }
  }

  /**
   * Validates, then writes to a temporary file and renames it into place, so a
   * crash mid-write never leaves a half-written state file. Saves run one at a
   * time, in the order they were called.
   */
  public save(state: PersistedState): Promise<void> {
    const text = JSON.stringify(parseStoredState(state), null, 2);
    const write = async () => {
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, text, 'utf8');
      await rename(temporary, this.filePath);
    };
    const next = this.queue.then(write, write);
    this.queue = next.catch(() => {}); // one failed save must not block later ones
    return next;
  }
}
