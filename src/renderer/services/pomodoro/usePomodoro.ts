import { useCallback, useEffect, useRef, useState } from 'react';
import { PomodoroTimer } from './PomodoroTimer';
import type { PomodoroSettings, PomodoroStatus } from './types';

const TICK_MS = 1000;

/** Runs a PomodoroTimer against the wall clock, one tick per second. */
export function usePomodoro(settings: PomodoroSettings) {
  const timerRef = useRef<PomodoroTimer | null>(null);
  if (!timerRef.current) {
    timerRef.current = new PomodoroTimer(settings);
  }
  const timer = timerRef.current;
  const [status, setStatus] = useState<PomodoroStatus>(() => timer.getStatus(Date.now()));

  useEffect(() => {
    setStatus(timer.setSettings(settings, Date.now()));
  }, [timer, settings]);

  useEffect(() => {
    const id = setInterval(() => setStatus(timer.tick(Date.now())), TICK_MS);
    return () => clearInterval(id);
  }, [timer]);

  const start = useCallback(() => setStatus(timer.start(Date.now())), [timer]);
  const pause = useCallback(() => setStatus(timer.pause(Date.now())), [timer]);
  const skip = useCallback(() => setStatus(timer.skip(Date.now())), [timer]);
  const reset = useCallback(() => {
    timer.reset();
    setStatus(timer.getStatus(Date.now()));
  }, [timer]);

  return { status, start, pause, skip, reset };
}
