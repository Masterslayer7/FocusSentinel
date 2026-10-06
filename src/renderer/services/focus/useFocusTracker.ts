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
 * a session-long FocusTracker.
 *
 * Distractions count only while `isTracking` (a focus block is running).
 * When tracking stops, the current episode ends; the violation count stays.
 */
export function useFocusTracker(rules: FocusRules, isTracking: boolean) {
  // A ref, not state: the tracker is mutable session-long state, and nothing
  // about it should be discarded or recreated by a re-render.
  const trackerRef = useRef<FocusTracker | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = new FocusTracker(rules);
  }
  const tracker = trackerRef.current;

  // Read inside the subscription, which is set up once.
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;

  const [status, setStatus] = useState<FocusStatus>(INITIAL_STATUS);
  const [error, setError] = useState<SamplerError | null>(null);

  useEffect(() => {
    tracker.setRules(rules);
  }, [tracker, rules]);

  useEffect(() => {
    if (!isTracking) {
      tracker.interrupt();
      setStatus(tracker.getStatus());
    }
  }, [tracker, isTracking]);

  useEffect(() => {
    // onFocusEvent returns its own unsubscribe, which doubles as the cleanup.
    return window.api.onFocusEvent((event) => {
      if (event.kind === 'error') {
        setError(event.error);
        return;
      }
      setError(null);
      if (isTrackingRef.current) {
        setStatus(tracker.accept(event.sample));
      }
    });
  }, [tracker]);

  const reset = useCallback(() => {
    tracker.reset();
    setStatus(INITIAL_STATUS);
  }, [tracker]);

  return { status, error, reset, isTracking };
}
