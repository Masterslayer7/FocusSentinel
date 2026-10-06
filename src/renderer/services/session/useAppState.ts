import { useEffect, useReducer, useRef, useState } from 'react';
import { appStateReducer, DEFAULT_STATE } from './appState';

/** How long state must sit unchanged before it is saved. */
export const SAVE_DELAY_MS = 1000;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The app's persisted state (ADR-009): loaded once on mount, then saved a
 * moment after each burst of changes. Nothing is saved until the load has
 * succeeded — otherwise the first render's defaults would overwrite the file.
 */
export function useAppState() {
  const [state, dispatch] = useReducer(appStateReducer, DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const loadedState = useRef<typeof state | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api
      .loadState()
      .then((stored) => {
        if (cancelled) return;
        dispatch({ type: 'loaded', stored });
        setCanSave(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStorageError(`Could not load saved settings: ${messageOf(error)}`);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canSave) return;
    if (loadedState.current === null) {
      loadedState.current = state; // the state the load produced; nothing to save yet
      return;
    }
    if (state === loadedState.current) return;

    const timer = setTimeout(() => {
      window.api
        .saveState(state)
        .then(() => setStorageError(null))
        .catch((error: unknown) => setStorageError(`Could not save: ${messageOf(error)}`));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, canSave]);

  return { state, dispatch, isLoaded, storageError };
}
