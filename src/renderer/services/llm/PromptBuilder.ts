// Define preset instruction configurations. Marked 'as const' to make properties read-only literals.
const SYSTEM_PRESETS = {
  'Drill Sergeant': "You are a tough, no-nonsense Drill Sergeant coaching someone through a timed focus block at their computer. They have drifted to a distracting app or website. Order them back to their task in short, direct commands. Be firm and demanding, never cruel or insulting.",
  'Sarcastic Critic': "You are a witty, dry, sarcastic coach watching someone's focus block at their computer. They have wandered off to a distracting app or website. Tease them about it with good-humoured sarcasm, then point them back at what they said they would do. Mock the distraction, never the person.",
  'Supportive Mentor': "You are a kind, encouraging mentor. The user is in a focus block at their computer and has drifted to a distracting app or website. Acknowledge that staying focused is hard, remind them of their goals, and guide them back to the task with warmth.",
  'Disappointed Parent': "You are a loving but disappointed parent. You aren't angry, just disappointed that they slipped away from their work to a distracting app or website. Remind them of what they set out to do and that they are capable of it, with a gentle sigh."
} as const;

// Single Source of Truth: Derive LlmPreset type union directly from the keys of the config object.
export type LlmPreset = keyof typeof SYSTEM_PRESETS;

/** Every preset, in display order, for pickers. */
export const LLM_PRESETS = Object.keys(SYSTEM_PRESETS) as LlmPreset[];

export interface EvaluatorContext {
  violationCount: number;             // Distraction episodes so far this session
  distractionDuration: number;        // Consecutive seconds distracted right now
  timeRemaining: number;              // Seconds left in the current Pomodoro focus block
  sessionGoals: string[];             // The user's unfinished goals, in their order
  distractingApp?: string;            // App display name only — never a window title
  additionalMetadata?: Record<string, any>; // Arbitrary extra data for future telemetry
}

/**
 * Builds system and user prompts matching the given preset and evaluator context.
 * Features automated generic metadata serialization for future extensibility.
 */
export function buildPrompt(preset: LlmPreset, context: EvaluatorContext): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = SYSTEM_PRESETS[preset] || SYSTEM_PRESETS['Supportive Mentor'];
  const minutesRemaining = Math.ceil(context.timeRemaining / 60);
  const goals = context.sessionGoals.map((goal) => goal.trim()).filter((goal) => goal.length > 0);
  const hasGoal = goals.length > 0;

  let userPrompt = "";
  if (hasGoal) {
    userPrompt += `[Session Goals]:\n${goals.map((goal) => `- ${goal}`).join('\n')}\n`;
  }
  if (context.distractingApp) {
    userPrompt += `[Distracting App]: ${context.distractingApp}\n`;
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
    ? `get the user back to their session goals, naming the one that fits best`
    : `get the user focused and back to work`;

  userPrompt += `\nGenerate a short spoken check-in (maximum 2 sentences) in your persona to ${actionReminder}. Output ONLY the response text and nothing else.`;

  return { systemPrompt, userPrompt };
}

/**
 * Trims off any trailing incomplete sentences resulting from early completion token cuts.
 */
export function trimTrailingIncompleteSentence(text: string): string {
  const match = text.match(/.*[.!?]['"]?\s*/s);
  return match ? match[0].trim() : text.trim();
}
