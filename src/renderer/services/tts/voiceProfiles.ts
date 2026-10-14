import type { LlmPreset } from '../llm/PromptBuilder';
import type { TtsVoice } from './types';

/** How one persona sounds. rate and pitch are Web Speech values (1 = normal). */
export interface VoiceProfile {
  rate: number;
  pitch: number;
  /**
   * Voice id or name fragments to look for, best first, matched
   * case-insensitively. First a Kokoro voice id, then Windows' built-in
   * voices, then macOS and extra Windows language packs.
   */
  voiceHints: string[];
  /** One line in character, for the voice preview. */
  sample: string;
}

export const VOICE_PROFILES: Record<LlmPreset, VoiceProfile> = {
  // Clipped and deep: fast, low, a male voice.
  'Drill Sergeant': {
    rate: 1.2,
    pitch: 0.6,
    voiceHints: ['am_fenrir', 'David', 'George', 'Guy', 'Daniel', 'Fred'],
    sample: 'Eyes front, recruit! Back to work, now!',
  },
  // Dry and quick, a touch higher than normal.
  'Sarcastic Critic': {
    rate: 1.05,
    pitch: 1.1,
    voiceHints: ['bm_fable', 'Mark', 'Ryan', 'Alex', 'Daniel'],
    sample: 'Oh, a quick break? How original. Back to it.',
  },
  // Slow and warm.
  'Supportive Mentor': {
    rate: 0.9,
    pitch: 1.05,
    voiceHints: ['af_heart', 'Zira', 'Aria', 'Jenny', 'Hazel', 'Samantha'],
    sample: "Staying focused is hard. You're doing well, so let's get back to it.",
  },
  // Slowest of all, a little low: the sigh.
  'Disappointed Parent': {
    rate: 0.85,
    pitch: 0.9,
    voiceHints: ['bf_emma', 'Hazel', 'Susan', 'Zira', 'Karen', 'Moira'],
    sample: "I'm not angry. I just know you can do better than this.",
  },
};

/**
 * The voice id to speak with: the user's chosen voice if it is still
 * installed, else the first voice matching the profile's hints, else '' —
 * which tells the provider to use the system default.
 */
export function pickVoice(profile: VoiceProfile, voices: TtsVoice[], chosenVoiceId: string | null): string {
  if (chosenVoiceId && voices.some((voice) => voice.id === chosenVoiceId)) {
    return chosenVoiceId;
  }
  for (const hint of profile.voiceHints.map((hint) => hint.toLowerCase())) {
    const match = voices.find(
      (voice) => voice.id.toLowerCase().includes(hint) || voice.name.toLowerCase().includes(hint),
    );
    if (match) return match.id;
  }
  return '';
}
