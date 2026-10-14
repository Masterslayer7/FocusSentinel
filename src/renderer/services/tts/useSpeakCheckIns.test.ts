import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { useSpeakCheckIns, type SpeakSettings } from './useSpeakCheckIns';
import { VOICE_PROFILES } from './voiceProfiles';
import type { ITtsProvider, TtsVoice } from './types';
import type { CheckIn } from '../focus/useFocusCheckIn';

const voice = (name: string): TtsVoice => ({ id: name, name, provider: 'webspeech' });
const DAVID = 'Microsoft David - English (United States)';
const ZIRA = 'Microsoft Zira - English (United States)';
const WINDOWS_VOICES = [voice(DAVID), voice(ZIRA)];

/** A provider whose speech finishes only when the test says so. */
function fakeTts(voices: TtsVoice[] = WINDOWS_VOICES) {
  const voicesChanged = new Set<() => void>();
  const finishers: (() => void)[] = [];
  const failers: ((error: Error) => void)[] = [];
  const tts = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAvailableVoices: vi.fn().mockResolvedValue(voices),
    speak: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          finishers.push(resolve);
          failers.push(reject);
        }),
    ),
    stop: vi.fn(),
    onVoicesChanged: vi.fn((listener: () => void) => {
      voicesChanged.add(listener);
      return () => voicesChanged.delete(listener);
    }),
  } satisfies ITtsProvider;
  const finish = async () => act(async () => finishers.shift()?.());
  const fail = async () => act(async () => failers.shift()?.(new Error('interrupted')));
  const changeVoices = async () => act(async () => voicesChanged.forEach((listener) => listener()));
  return { tts, finish, fail, changeVoices };
}

const replied = (text: string, episode = 1): CheckIn => ({ episode, outcome: 'replied', text });
const ON: SpeakSettings = { enabled: true, voiceId: null, preset: 'Drill Sergeant' };

function setup(tts: ITtsProvider, initial: { checkIn: CheckIn | null; settings?: SpeakSettings }) {
  return renderHook(
    ({ checkIn, settings }) => useSpeakCheckIns(checkIn, tts, settings),
    { initialProps: { checkIn: initial.checkIn, settings: initial.settings ?? ON } },
  );
}

// Lets the hook's awaited voice lookup settle.
const settle = () => act(async () => {});

describe('useSpeakCheckIns', () => {
  test('warms up the engine while speech is on, so the first check-in is not kept waiting', async () => {
    const { tts } = fakeTts();
    setup(tts, { checkIn: null });
    await settle();

    expect(tts.initialize).toHaveBeenCalled();
  });

  test('does not warm up a muted engine (Kokoro would download its model)', async () => {
    const { tts } = fakeTts();
    setup(tts, { checkIn: null, settings: { ...ON, enabled: false } });
    await settle();

    expect(tts.initialize).not.toHaveBeenCalled();
  });

  test('returns the installed voices for the picker', async () => {
    const { tts } = fakeTts();
    const { result } = setup(tts, { checkIn: null });
    await settle();

    expect(result.current.voices).toEqual(WINDOWS_VOICES);
  });

  test('picks up voices the system loads late', async () => {
    const { tts, changeVoices } = fakeTts();
    tts.getAvailableVoices.mockResolvedValueOnce([]);
    const { result } = setup(tts, { checkIn: null });
    await settle();
    expect(result.current.voices).toEqual([]);

    await changeVoices();
    expect(result.current.voices).toEqual(WINDOWS_VOICES);
  });

  test("speaks a replied check-in in the persona's voice, rate and pitch", async () => {
    const { tts } = fakeTts();
    const { rerender } = setup(tts, { checkIn: null });
    rerender({ checkIn: replied('Back to work, recruit!'), settings: ON });
    await settle();

    const { rate, pitch } = VOICE_PROFILES['Drill Sergeant'];
    expect(tts.speak).toHaveBeenCalledWith('Back to work, recruit!', DAVID, { rate, pitch });
  });

  test('uses the voice the user chose', async () => {
    const { tts } = fakeTts();
    setup(tts, { checkIn: replied('Hi'), settings: { ...ON, voiceId: ZIRA } });
    await settle();

    expect(tts.speak).toHaveBeenCalledWith('Hi', ZIRA, expect.anything());
  });

  test('skipped and failed check-ins are not spoken', async () => {
    const { tts } = fakeTts();
    const { rerender } = setup(tts, { checkIn: { episode: 1, outcome: 'skipped', text: '' } });
    rerender({ checkIn: { episode: 2, outcome: 'failed', text: 'No model loaded' }, settings: ON });
    await settle();

    expect(tts.speak).not.toHaveBeenCalled();
  });

  test('nothing is spoken while muted', async () => {
    const { tts } = fakeTts();
    setup(tts, { checkIn: replied('Hi'), settings: { ...ON, enabled: false } });
    await settle();

    expect(tts.speak).not.toHaveBeenCalled();
  });

  test('changing a setting does not repeat the last check-in', async () => {
    const { tts, finish } = fakeTts();
    const checkIn = replied('Hi');
    const { rerender } = setup(tts, { checkIn });
    await settle();
    await finish();

    rerender({ checkIn, settings: { ...ON, preset: 'Supportive Mentor' } });
    await settle();

    expect(tts.speak).toHaveBeenCalledTimes(1);
  });

  test('a check-in that arrives mid-sentence is dropped, never spoken over the first', async () => {
    const { tts, finish } = fakeTts();
    const { rerender } = setup(tts, { checkIn: replied('First', 1) });
    await settle();

    rerender({ checkIn: replied('Second', 2), settings: ON });
    await settle();
    expect(tts.speak).toHaveBeenCalledTimes(1);

    await finish();
    rerender({ checkIn: replied('Third', 3), settings: ON });
    await settle();
    expect(tts.speak).toHaveBeenLastCalledWith('Third', expect.anything(), expect.anything());
  });

  test('a speech error does not block later check-ins', async () => {
    const { tts, fail } = fakeTts();
    const { rerender } = setup(tts, { checkIn: replied('First', 1) });
    await settle();
    await fail();

    rerender({ checkIn: replied('Second', 2), settings: ON });
    await settle();
    expect(tts.speak).toHaveBeenCalledTimes(2);
  });

  test('with no voices installed it stays quiet instead of failing', async () => {
    const { tts } = fakeTts([]);
    setup(tts, { checkIn: replied('Hi') });
    await settle();

    expect(tts.speak).not.toHaveBeenCalled();
  });

  test('muting cuts off speech already playing', async () => {
    const { tts } = fakeTts();
    const checkIn = replied('A long lecture');
    const { rerender } = setup(tts, { checkIn });
    await settle();

    rerender({ checkIn, settings: { ...ON, enabled: false } });
    expect(tts.stop).toHaveBeenCalled();
  });

  test('preview speaks the persona sample, even while muted', async () => {
    const { tts } = fakeTts();
    const { result } = setup(tts, { checkIn: null, settings: { ...ON, enabled: false } });
    await settle();

    act(() => result.current.preview());
    await settle();

    expect(tts.speak).toHaveBeenCalledWith(VOICE_PROFILES['Drill Sergeant'].sample, DAVID, expect.anything());
  });
});
