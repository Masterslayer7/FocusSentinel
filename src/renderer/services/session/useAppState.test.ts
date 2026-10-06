import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState, SAVE_DELAY_MS } from './useAppState';
import { DEFAULT_STATE } from './appState';
import type { StoredState } from './types';

describe('useAppState', () => {
  let resolveLoad: (stored: StoredState) => void;
  let rejectLoad: (error: Error) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(window.api.saveState).mockReset().mockResolvedValue(undefined);
    vi.mocked(window.api.loadState).mockReset().mockImplementation(
      () =>
        new Promise<StoredState>((resolve, reject) => {
          resolveLoad = resolve;
          rejectLoad = reject;
        }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const finishLoad = async (stored: StoredState) => {
    await act(async () => resolveLoad(stored));
  };

  test('starts from defaults, then takes on what was saved', async () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.state).toEqual(DEFAULT_STATE);

    await finishLoad({ persona: 'Drill Sergeant' });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.state.persona).toBe('Drill Sergeant');
  });

  test('never saves before the saved state has loaded, so defaults cannot overwrite it', async () => {
    const { result } = renderHook(() => useAppState());

    act(() => result.current.dispatch({ type: 'setPersona', persona: 'Sarcastic Critic' }));
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS * 3));

    expect(window.api.saveState).not.toHaveBeenCalled();
  });

  test('saves once, a moment after a burst of changes', async () => {
    const { result } = renderHook(() => useAppState());
    await finishLoad({});

    act(() => result.current.dispatch({ type: 'addGoal', id: 'g1', text: 'One' }));
    act(() => result.current.dispatch({ type: 'addGoal', id: 'g2', text: 'Two' }));
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
    expect(window.api.saveState).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(window.api.saveState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(window.api.saveState).mock.calls[0][0].goals.map((goal) => goal.text)).toEqual(['One', 'Two']);
  });

  test('the load itself does not trigger a save', async () => {
    renderHook(() => useAppState());
    await finishLoad({ persona: 'Drill Sergeant' });
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS * 3));

    expect(window.api.saveState).not.toHaveBeenCalled();
  });

  test('if loading fails, it reports the error and never saves over the file', async () => {
    const { result } = renderHook(() => useAppState());
    await act(async () => rejectLoad(new Error('ipc down')));

    act(() => result.current.dispatch({ type: 'setPersona', persona: 'Sarcastic Critic' }));
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS * 3));

    expect(result.current.storageError).toMatch(/ipc down/);
    expect(window.api.saveState).not.toHaveBeenCalled();
  });

  test('a failed save is reported', async () => {
    vi.mocked(window.api.saveState).mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useAppState());
    await finishLoad({});

    act(() => result.current.dispatch({ type: 'setPersona', persona: 'Sarcastic Critic' }));
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS));

    expect(result.current.storageError).toMatch(/disk full/);
  });
});
