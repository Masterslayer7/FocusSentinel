import { useCallback, useEffect, useRef, useState } from 'react';
import { FocusTracker } from './FocusTracker';
import type { FocusRules, FocusStatus, SamplerError } from './types';

const INITIAL_STATUS: FocusStatus = {
  isDistracted: false,
  distractionDuration: 0,
  violationCount: 0,
  currentApp: '',
};

/**
 * Subscribes to the main-process window sampler and runs every sample through
 * a session-long FocusTracker. Rules are read once, on first render.
 */
export function useFocusTracker(rules: FocusRules) {
  // A ref, not state: the tracker is mutable session-long state, and nothing
  // about it should be discarded or recreated by a re-render.
  const trackerRef = useRef<FocusTracker | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = new FocusTracker(rules);
  }

  const [status, setStatus] = useState<FocusStatus>(INITIAL_STATUS);
  const [error, setError] = useState<SamplerError | null>(null);

  useEffect(() => {
    // onFocusEvent returns its own unsubscribe, which doubles as the cleanup.
    return window.api.onFocusEvent((event) => {
      if (event.kind === 'error') {
        setError(event.error);
        return;
      }
      setError(null);
      setStatus(trackerRef.current!.accept(event.sample));
    });
  }, []);

  const reset = useCallback(() => {
    trackerRef.current?.reset();
    setStatus(INITIAL_STATUS);
  }, []);

  return { status, error, reset };
}
