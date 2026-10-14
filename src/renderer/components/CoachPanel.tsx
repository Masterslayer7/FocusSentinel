import React, { useState } from 'react';
import { LLM_PRESETS } from '../services/llm/PromptBuilder';
import { MODEL_CHOICES } from '../services/llm/useLlmModel';
import type { LlmStatusUpdate } from '../services/llm/LlmEvaluator';
import type { TtsVoice } from '../services/tts/types';
import type { SpeechSettings, TtsEngine } from '../services/session/types';

export interface CheckInEntry {
  id: number;
  time: string;
  outcome: 'replied' | 'skipped' | 'failed';
  text: string;
}

interface CoachPanelProps {
  persona: string;
  onPersonaChange: (persona: string) => void;
  modelId: string | null;
  modelStatus: LlmStatusUpdate;
  onLoadModel: (modelId: string) => void;
  speech: SpeechSettings;
  onSpeechChange: (speech: SpeechSettings) => void;
  voices: TtsVoice[];
  onPreviewVoice: () => void;
  checkIns: CheckInEntry[];
}

const PERSONA_NOTES: Record<string, string> = {
  'Supportive Mentor': 'Warm and encouraging. Reminds you of your goals.',
  'Disappointed Parent': 'Gentle sigh. Reminds you what you set out to do.',
  'Sarcastic Critic': 'Teases the distraction, never you.',
  'Drill Sergeant': 'Short, firm orders back to work.',
};

const ENGINE_NOTES: Record<TtsEngine, string> = {
  system: 'Uses the voices built into your system: instant and offline, but robotic.',
  kokoro:
    'Kokoro, a natural-sounding voice model that runs on your GPU, offline. The first use downloads it once (about 300 MB).',
};

const BUSY_STATES = new Set(['downloading', 'loading', 'generating']);

export const CoachPanel: React.FC<CoachPanelProps> = ({
  persona,
  onPersonaChange,
  modelId,
  modelStatus,
  onLoadModel,
  speech,
  onSpeechChange,
  voices,
  onPreviewVoice,
  checkIns,
}) => {
  const [selectedModel, setSelectedModel] = useState(modelId ?? MODEL_CHOICES[0].id);
  const isBusy = BUSY_STATES.has(modelStatus.state);
  // A saved voice that has since been uninstalled shows as Automatic, which is what speaks.
  const voiceValue = speech.voiceId && voices.some((voice) => voice.id === speech.voiceId) ? speech.voiceId : '';

  return (
    <div className="panel-stack">
      <div className="field">
        <label className="field-label" htmlFor="persona">Personality</label>
        <select id="persona" className="select" value={persona} onChange={(event) => onPersonaChange(event.target.value)}>
          {LLM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>{preset}</option>
          ))}
        </select>
        <span className="field-hint">{PERSONA_NOTES[persona]}</span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="voice">Voice</label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={speech.enabled}
            onChange={(event) => onSpeechChange({ ...speech, enabled: event.target.checked })}
          />
          Speak check-ins
        </label>
        <select
          className="select"
          aria-label="Voice engine"
          value={speech.engine}
          onChange={(event) => onSpeechChange({ ...speech, engine: event.target.value as TtsEngine, voiceId: null })}
        >
          <option value="system">System voices</option>
          <option value="kokoro">Kokoro (natural)</option>
        </select>
        <div className="inline-form">
          <select
            id="voice"
            className="select"
            value={voiceValue}
            disabled={voices.length === 0}
            onChange={(event) => onSpeechChange({ ...speech, voiceId: event.target.value || null })}
          >
            <option value="">Automatic (matches the personality)</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-compact" disabled={voices.length === 0} onClick={onPreviewVoice}>
            Try voice
          </button>
        </div>
        <span className="field-hint">
          {voices.length === 0
            ? 'No voices found on this system, so check-ins are shown but not spoken.'
            : `${ENGINE_NOTES[speech.engine]} Automatic gives each personality its own voice.`}
        </span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="model">Model</label>
        <div className="inline-form">
          <select id="model" className="select" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
            {MODEL_CHOICES.map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.label}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-compact" disabled={isBusy} onClick={() => onLoadModel(selectedModel)}>
            Load model
          </button>
        </div>
        <div className={`model-status ${modelStatus.state}`} role="status">
          <span>{modelStatusLabel(modelStatus)}</span>
          {isBusy && modelStatus.state !== 'generating' && (
            <progress max={100} value={modelStatus.progress} aria-label="Model loading progress" />
          )}
        </div>
        <span className="field-hint">
          Runs on your GPU, offline. The first load downloads the model once (hundreds of MB to a few GB); after that
          it loads from cache automatically.
        </span>
      </div>

      <div className="field">
        <span className="field-label">Check-ins</span>
        {checkIns.length === 0 ? (
          <p className="empty-state">During a focus block, a check-in appears here after 6 seconds on a distraction.</p>
        ) : (
          <ul className="checkin-list">
            {checkIns.map((entry) => (
              <li key={entry.id} className={`checkin ${entry.outcome}`}>
                <span className="checkin-time">{entry.time}</span>
                <span className="checkin-text">
                  {entry.outcome === 'replied' && entry.text}
                  {entry.outcome === 'skipped' && 'Skipped: the coach spoke less than 2 minutes ago.'}
                  {entry.outcome === 'failed' && `Could not check in: ${entry.text}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

function modelStatusLabel(status: LlmStatusUpdate): string {
  switch (status.state) {
    case 'uninitialized': return 'No model loaded. Check-ins cannot be written until you load one.';
    case 'downloading': return `Downloading… ${status.progress}%`;
    case 'loading': return `Loading onto the GPU… ${status.progress}%`;
    case 'ready': return 'Ready.';
    case 'generating': return 'Writing a check-in…';
    case 'error': return status.message ?? 'Something went wrong.';
  }
}
