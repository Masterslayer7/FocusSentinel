// @vitest-environment node
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StateStore, STATE_FILE_NAME } from './StateStore';
import type { PersistedState } from '../shared/types';

const STATE: PersistedState = {
  goals: [{ id: 'g1', text: 'Write the ADR', done: false }],
  rules: { apps: { Discord: 'distraction' }, allowedBrowserTitles: ['MDN'] },
  persona: 'Supportive Mentor',
  pomodoro: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
  modelId: null,
  appUsage: { Discord: { seconds: 12, lastSeen: 1_700_000_000_000 } },
};

describe('StateStore', () => {
  let dir: string;
  let store: StateStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'focussentinel-test-'));
    store = new StateStore(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('loading before anything was saved gives an empty state', async () => {
    expect(await store.load()).toEqual({});
  });

  test('what is saved loads back', async () => {
    await store.save(STATE);

    expect(await store.load()).toEqual(STATE);
  });

  test('a save leaves exactly one file behind, with no temporary file', async () => {
    await store.save(STATE);

    expect(await readdir(dir)).toEqual([STATE_FILE_NAME]);
  });

  test('a save is validated, so unknown fields never reach the disk', async () => {
    await store.save({ ...STATE, windowTitles: ['secret'] } as unknown as PersistedState);

    expect(await readFile(join(dir, STATE_FILE_NAME), 'utf8')).not.toContain('secret');
  });

  test('a corrupt file is moved aside rather than overwritten, and loads as empty', async () => {
    await writeFile(join(dir, STATE_FILE_NAME), '{ not json');

    expect(await store.load()).toEqual({});
    const files = await readdir(dir);
    expect(files).not.toContain(STATE_FILE_NAME);
    expect(files.some((name) => name.startsWith(`${STATE_FILE_NAME}.corrupt-`))).toBe(true);
  });

  test('overlapping saves are written in order, so the last one wins', async () => {
    await Promise.all([
      store.save({ ...STATE, persona: 'Drill Sergeant' }),
      store.save({ ...STATE, persona: 'Sarcastic Critic' }),
      store.save({ ...STATE, persona: 'Disappointed Parent' }),
    ]);

    expect((await store.load()).persona).toBe('Disappointed Parent');
  });
});
