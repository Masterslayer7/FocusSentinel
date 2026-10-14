import { useCallback, useEffect, useRef, useState } from 'react';
import type { LlmPreset } from '../llm/PromptBuilder';
import type { CheckIn } from '../focus/useFocusCheckIn';
import { VOICE_PROFILES, pickVoice } from './voiceProfiles';
import type { ITtsProvider, TtsVoice } from './types';

/** What decides whether and how a check-in is spoken. */
export interface SpeakSettings {
  enabled: boolean;
  voiceId: string | null; // null: pick per persona
  preset: LlmPreset;
}

/**
 * Speaks each replied check-in aloud in the persona's voice. One sentence at a
 * time: a check-in that arrives while another is still playing is dropped,
 * never spoken over it. With no voices installed (common on Linux) it stays
 * quiet rather than failing.
 *
 * Returns the installed voices, for a picker, and preview(), which speaks the
 * persona's sample line even while muted.
 */
export function useSpeakCheckIns(checkIn: CheckIn | null, tts: ITtsProvider, settings: SpeakSettings) {
  // Read at speak time through a ref, so a settings change never re-speaks.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const isSpeaking = useRef(false);
  const [voices, setVoices] = useState<TtsVoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      tts
        .getAvailableVoices()
        .then((found) => !cancelled && setVoices(found))
        .catch(() => {}); // no voices: the picker stays empty
    void refresh();
    const unsubscribe = tts.onVoicesChanged(() => void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tts]);

  const say = useCallback(
    async (text: string) => {
      if (isSpeaking.current) return;
      isSpeaking.current = true;
      try {
        // Asked fresh each time: some systems load voices late.
        const installed = await tts.getAvailableVoices();
        if (installed.length === 0) return;
        const { preset, voiceId } = settingsRef.current;
        const profile = VOICE_PROFILES[preset];
        await tts.speak(text, pickVoice(profile, installed, voiceId), { rate: profile.rate, pitch: profile.pitch });
      } catch {
        // A cut-off or failed sentence is not worth surfacing; the text is on screen.
      } finally {
        isSpeaking.current = false;
      }
    },
    [tts],
  );

  useEffect(() => {
    if (checkIn?.outcome !== 'replied' || !checkIn.text || !settingsRef.current.enabled) return;
    void say(checkIn.text);
  }, [checkIn, say]);

  useEffect(() => {
    if (!settings.enabled) tts.stop();
  }, [settings.enabled, tts]);

  useEffect(() => () => tts.stop(), [tts]);

  const preview = useCallback(() => {
    void say(VOICE_PROFILES[settingsRef.current.preset].sample);
  }, [say]);

  return { voices, preview };
}
