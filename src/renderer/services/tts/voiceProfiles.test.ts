import { describe, test, expect } from 'vitest';
import { LLM_PRESETS } from '../llm/PromptBuilder';
import { VOICE_PROFILES, pickVoice } from './voiceProfiles';
import { KOKORO_VOICES } from './KokoroProvider';
import type { TtsVoice } from './types';

const voice = (name: string): TtsVoice => ({ id: name, name, provider: 'webspeech' });

// What Windows 11 ships with by default.
const WINDOWS_VOICES = [
  voice('Microsoft David - English (United States)'),
  voice('Microsoft Mark - English (United States)'),
  voice('Microsoft Zira - English (United States)'),
];

describe('VOICE_PROFILES', () => {
  test('every persona has a profile with a sample line for the voice preview', () => {
    for (const preset of LLM_PRESETS) {
      expect(VOICE_PROFILES[preset].sample.length).toBeGreaterThan(0);
    }
  });

  test('the Drill Sergeant is faster and lower than the Supportive Mentor', () => {
    const sergeant = VOICE_PROFILES['Drill Sergeant'];
    const mentor = VOICE_PROFILES['Supportive Mentor'];

    expect(sergeant.rate).toBeGreaterThan(mentor.rate);
    expect(sergeant.pitch).toBeLessThan(mentor.pitch);
  });

  test('rates and pitches stay inside what the Web Speech API accepts', () => {
    for (const profile of Object.values(VOICE_PROFILES)) {
      expect(profile.rate).toBeGreaterThanOrEqual(0.1);
      expect(profile.rate).toBeLessThanOrEqual(10);
      expect(profile.pitch).toBeGreaterThanOrEqual(0);
      expect(profile.pitch).toBeLessThanOrEqual(2);
    }
  });

  test('no two personas sound the same', () => {
    const sounds = Object.values(VOICE_PROFILES).map(
      (profile) => `${pickVoice(profile, WINDOWS_VOICES, null)}|${profile.rate}|${profile.pitch}`,
    );
    expect(new Set(sounds).size).toBe(sounds.length);
  });
});

describe('pickVoice', () => {
  test('the Drill Sergeant gets a deep voice on Windows', () => {
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], WINDOWS_VOICES, null)).toBe(
      'Microsoft David - English (United States)',
    );
  });

  test('the Supportive Mentor gets a different voice from the Drill Sergeant', () => {
    expect(pickVoice(VOICE_PROFILES['Supportive Mentor'], WINDOWS_VOICES, null)).not.toBe(
      pickVoice(VOICE_PROFILES['Drill Sergeant'], WINDOWS_VOICES, null),
    );
  });

  test('with Kokoro every persona gets its own voice, the Drill Sergeant a deep male one', () => {
    const picks = LLM_PRESETS.map((preset) => pickVoice(VOICE_PROFILES[preset], KOKORO_VOICES, null));

    expect(picks).not.toContain('');
    expect(new Set(picks).size).toBe(picks.length);
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], KOKORO_VOICES, null)).toBe('am_fenrir');
  });

  test('hints match voice ids as well as names', () => {
    const profile = { rate: 1, pitch: 1, voiceHints: ['bm_fable'], sample: 'Hi.' };
    expect(pickVoice(profile, [{ id: 'bm_fable', name: 'Fable (British male)', provider: 'kokoro' }], null)).toBe('bm_fable');
  });

  test('a voice the user chose wins over the persona hint', () => {
    const chosen = 'Microsoft Zira - English (United States)';
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], WINDOWS_VOICES, chosen)).toBe(chosen);
  });

  test('a chosen voice that is no longer installed falls back to the persona hint', () => {
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], WINDOWS_VOICES, 'Gone Voice')).toBe(
      'Microsoft David - English (United States)',
    );
  });

  test('hints match case-insensitively, in the order the profile lists them', () => {
    const profile = { rate: 1, pitch: 1, voiceHints: ['george', 'david'], sample: 'Hi.' };
    const voices = [voice('Microsoft David'), voice('Microsoft George')];

    expect(pickVoice(profile, voices, null)).toBe('Microsoft George');
  });

  test('with no matching hint it returns an empty id, meaning the system default', () => {
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], [voice('Some Other Voice')], null)).toBe('');
    expect(pickVoice(VOICE_PROFILES['Drill Sergeant'], [], null)).toBe('');
  });
});
