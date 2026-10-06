import { describe, test, expect } from 'vitest';
import { formatClock, formatDuration } from './format';

describe('formatDuration', () => {
  test('uses the two largest units that matter', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45.6)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3 * 3600 + 7 * 60 + 9)).toBe('3h 7m');
  });
});

describe('formatClock', () => {
  test('formats seconds as m:ss for the timer', () => {
    expect(formatClock(25 * 60)).toBe('25:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(0)).toBe('0:00');
  });
});
