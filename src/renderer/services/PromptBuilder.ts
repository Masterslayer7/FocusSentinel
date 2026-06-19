// Define preset instruction configurations. Marked 'as const' to make properties read-only literals.
const SYSTEM_PRESETS = {
  'Drill Sergeant': "You are a loud, aggressive, no-nonsense military Drill Sergeant. The user is slacking off by using their phone during their strict focus block. Command them back to work immediately with absolute authority. Do not tolerate excuses.",
  'Sarcastic Critic': "You are a witty, dry, and highly sarcastic critic. Mock the user's lack of discipline and their phone usage in a biting but humorous way. Point out how their phone screen is more interesting than their future.",
  'Supportive Mentor': "You are a kind, empathetic, and encouraging supportive mentor. Gently remind the user of their goals, acknowledge that staying focused is hard, and gently guide them back to task with positive reinforcement.",
  'Disappointed Parent': "You are a disappointed parent. You aren't mad, just deeply disappointed. Remind them of their potential, sigh dramatically, and tell them that they are only hurting themselves by looking at their phone."
} as const;

// Single Source of Truth: Derive LlmPreset type union directly from the keys of the config object.
export type LlmPreset = keyof typeof SYSTEM_PRESETS;

export interface EvaluatorContext {
  violationCount: number;             // Count of phone distraction events in session
  distractionDuration: number;        // Consecutive seconds user has been distracted right now
  timeRemaining: number;              // Remaining Pomodoro focus time in seconds
  activeSessionGoal: string;          // User-defined session objective
  additionalMetadata?: Record<string, any>; // Arbitrary extra data for future telemetry
}

/**
 * Builds system and user prompts matching the given preset and evaluator context.
 * Features automated generic metadata serialization for future extensibility.
 */
export function buildPrompt(preset: LlmPreset, context: EvaluatorContext): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = SYSTEM_PRESETS[preset] || SYSTEM_PRESETS['Supportive Mentor'];
  const minutesRemaining = Math.ceil(context.timeRemaining / 60);
  const hasGoal = context.activeSessionGoal && context.activeSessionGoal.trim().length > 0;

  let userPrompt = "";
  if (hasGoal) {
    userPrompt += `[Active Session Goal]: ${context.activeSessionGoal.trim()}\n`;
  }
  userPrompt += `[Violation Count]: ${context.violationCount}\n` +
    `[Current Distraction Duration]: ${context.distractionDuration} seconds\n` +
    `[Time Remaining in Pomodoro]: ${minutesRemaining} minutes\n`;

  // Dynamically append extra metadata fields if provided
  if (context.additionalMetadata) {
    for (const [key, value] of Object.entries(context.additionalMetadata)) {
      const headerName = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      userPrompt += `[${headerName}]: ${value}\n`;
    }
  }

  const actionReminder = hasGoal
    ? `get the user back to their active session goal`
    : `get the user focused and back to work`;

  userPrompt += `\nGenerate a concise verbal reminder or reprimand (maximum 2 sentences) in your persona to ${actionReminder}. Output ONLY the response text and nothing else.`;

  return { systemPrompt, userPrompt };
}

/**
 * Trims off any trailing incomplete sentences resulting from early completion token cuts.
 */
export function trimTrailingIncompleteSentence(text: string): string {
  const match = text.match(/.*[.!?]['"]?\s*/s);
  return match ? match[0].trim() : text.trim();
}
