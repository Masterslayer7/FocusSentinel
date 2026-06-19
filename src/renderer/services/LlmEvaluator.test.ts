import { describe, test, expect, vi, beforeEach } from 'vitest';

// Define mocks for the web-llm engine
const mockUnload = vi.fn().mockResolvedValue(undefined);
const mockChatCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'Focus' } }]
});

const mockEngine = {
  unload: mockUnload,
  chat: {
    completions: {
      create: mockChatCreate
    }
  }
};

const mockHasModelInCache = vi.fn().mockResolvedValue(true);
const mockDeleteModelAllInfoInCache = vi.fn().mockResolvedValue(undefined);

// Mock the web-llm library before importing LlmEvaluator
vi.mock('@mlc-ai/web-llm', () => {
  return {
    CreateMLCEngine: vi.fn().mockImplementation((modelId, options) => {
      // Simulate progress callbacks sent from the loader
      if (options && options.initProgressCallback) {
        options.initProgressCallback({ text: 'Fetching 1/8: 50% completed' });
        options.initProgressCallback({ text: 'Loading model: 100% completed' });
      }
      return Promise.resolve(mockEngine);
    }),
    hasModelInCache: (...args: any[]) => mockHasModelInCache(...args),
    deleteModelAllInfoInCache: (...args: any[]) => mockDeleteModelAllInfoInCache(...args)
  };
});

import llmEvaluator from './LlmEvaluator';
import { buildPrompt, trimTrailingIncompleteSentence, EvaluatorContext, LlmPreset } from './PromptBuilder';

describe('LlmEvaluator Pub/Sub Service', () => {
  const mockCachesDelete = vi.fn().mockResolvedValue(true);
  const mockCachesKeys = vi.fn().mockResolvedValue(['web-llm/test-model-id']);

  beforeEach(async () => {
    // Reset llm status state to default before each test using public API first
    await llmEvaluator.unloadModel();

    // Reset call histories AFTER reset so we start clean
    mockUnload.mockClear();
    mockChatCreate.mockClear();
    mockCachesDelete.mockClear();
    mockCachesKeys.mockClear();
    mockHasModelInCache.mockClear();
    mockDeleteModelAllInfoInCache.mockClear();

    // Stub global browser caches object
    vi.stubGlobal('caches', {
      delete: mockCachesDelete,
      keys: mockCachesKeys
    });
  });

  test('should initialize with default uninitialized state', () => {
    expect(llmEvaluator.getState()).toBe('uninitialized');
    expect(llmEvaluator.getProgress()).toBe(0);
    expect(llmEvaluator.getMessage()).toContain('cleared from VRAM');
  });

  test('should notify subscriber immediately upon subscription with current status', () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      state: 'uninitialized',
      progress: 0,
      message: 'Model weights cleared from VRAM'
    });

    unsubscribe();
  });

  test('should notify all active subscribers of status updates upon initialization', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsubscribe1 = llmEvaluator.subscribe(listener1);
    const unsubscribe2 = llmEvaluator.subscribe(listener2);

    listener1.mockClear();
    listener2.mockClear();

    await llmEvaluator.initialize('test-model-id');

    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();

    // Verify both listeners received identical transitions to 'ready'
    const lastCall1 = listener1.mock.calls[listener1.mock.calls.length - 1][0];
    const lastCall2 = listener2.mock.calls[listener2.mock.calls.length - 1][0];

    expect(lastCall1.state).toBe('ready');
    expect(lastCall1.progress).toBe(100);

    expect(lastCall2.state).toBe('ready');
    expect(lastCall2.progress).toBe(100);

    unsubscribe1();
    unsubscribe2();
  });

  test('should stop notifying listener after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    listener.mockClear();
    unsubscribe();

    await llmEvaluator.initialize('test-model-id');
    expect(listener).not.toHaveBeenCalled();
  });

  test('should update status dynamically when loading model via initialize()', async () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    listener.mockClear();
    await llmEvaluator.initialize('test-model-id');

    // Assert transitions: loading starting -> downloading -> loading compile -> ready
    expect(listener.mock.calls.some(([arg]) => arg.state === 'downloading' && arg.progress === 50)).toBe(true);
    expect(listener.mock.calls.some(([arg]) => arg.state === 'loading' && arg.progress === 100)).toBe(true);
    
    expect(llmEvaluator.getState()).toBe('ready');
    expect(llmEvaluator.getProgress()).toBe(100);

    unsubscribe();
  });

  test('should release VRAM and clear references upon unloadModel()', async () => {
    // Load model first
    await llmEvaluator.initialize('test-model-id');
    expect(llmEvaluator.getState()).toBe('ready');

    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    listener.mockClear();

    await llmEvaluator.unloadModel();

    expect(mockUnload).toHaveBeenCalledTimes(1);
    expect(llmEvaluator.getState()).toBe('uninitialized');
    expect(llmEvaluator.getProgress()).toBe(0);

    unsubscribe();
  });

  test('should call deleteModelAllInfoInCache() if model is found in cache', async () => {
    mockHasModelInCache.mockResolvedValueOnce(true);
    
    // Load model
    await llmEvaluator.initialize('test-model-id');
    
    await llmEvaluator.deleteModelFromDisk('test-model-id');

    expect(mockHasModelInCache).toHaveBeenCalledWith('test-model-id');
    expect(mockDeleteModelAllInfoInCache).toHaveBeenCalledWith('test-model-id');
    expect(llmEvaluator.getState()).toBe('uninitialized');
    expect(llmEvaluator.getMessage()).toContain('Successfully purged model cache');
  });

  test('should skip deletion and report status if model is not found in cache', async () => {
    mockHasModelInCache.mockResolvedValueOnce(false);
    
    // Load model
    await llmEvaluator.initialize('test-model-id');
    
    await llmEvaluator.deleteModelFromDisk('test-model-id');

    expect(mockHasModelInCache).toHaveBeenCalledWith('test-model-id');
    expect(mockDeleteModelAllInfoInCache).not.toHaveBeenCalled();
    expect(llmEvaluator.getState()).toBe('uninitialized');
    expect(llmEvaluator.getMessage()).toContain('No local cache directory found');
  });

  describe('Context Prompt Builder & Sentence Trimming', () => {
    test('should build correct prompt structure when activeSessionGoal is provided', () => {
      const context: EvaluatorContext = {
        violationCount: 3,
        distractionDuration: 12,
        timeRemaining: 1500, // 25 mins
        activeSessionGoal: 'Finish writing Chapter 1'
      };

      const result = buildPrompt('Drill Sergeant', context);
      
      expect(result.systemPrompt).toContain('military Drill Sergeant');
      expect(result.userPrompt).toContain('[Active Session Goal]: Finish writing Chapter 1');
      expect(result.userPrompt).toContain('[Violation Count]: 3');
      expect(result.userPrompt).toContain('[Current Distraction Duration]: 12 seconds');
      expect(result.userPrompt).toContain('[Time Remaining in Pomodoro]: 25 minutes');
      expect(result.userPrompt).toContain('get the user back to their active session goal');
    });

    test('should omit Active Session Goal and adapt user prompt when goal is empty', () => {
      const context: EvaluatorContext = {
        violationCount: 1,
        distractionDuration: 5,
        timeRemaining: 600, // 10 mins
        activeSessionGoal: '' // Empty goal
      };

      const result = buildPrompt('Sarcastic Critic', context);
      
      expect(result.systemPrompt).toContain('witty, dry, and highly sarcastic');
      expect(result.userPrompt).not.toContain('[Active Session Goal]');
      expect(result.userPrompt).toContain('[Violation Count]: 1');
      expect(result.userPrompt).toContain('[Current Distraction Duration]: 5 seconds');
      expect(result.userPrompt).toContain('[Time Remaining in Pomodoro]: 10 minutes');
      expect(result.userPrompt).toContain('get the user focused and back to work');
    });

    test('should format and append additionalMetadata keys to user prompt', () => {
      const context: EvaluatorContext = {
        violationCount: 2,
        distractionDuration: 10,
        timeRemaining: 300,
        activeSessionGoal: 'Write code',
        additionalMetadata: {
          userFocusScore: 0.85,
          activeTabName: 'StackOverflow',
          browser_windows_open: 4
        }
      };

      const result = buildPrompt('Supportive Mentor', context);
      
      expect(result.userPrompt).toContain('[User Focus Score]: 0.85');
      expect(result.userPrompt).toContain('[Active Tab Name]: StackOverflow');
      expect(result.userPrompt).toContain('[Browser Windows Open]: 4');
    });

    test('should trim trailing incomplete sentences using trimTrailingIncompleteSentence()', () => {
      expect(trimTrailingIncompleteSentence('Stop looking at your phone. You should be working.')).toBe('Stop looking at your phone. You should be working.');
      expect(trimTrailingIncompleteSentence('Stop looking at your phone. You should be')).toBe('Stop looking at your phone.');
      expect(trimTrailingIncompleteSentence('Stop looking at your phone! You')).toBe('Stop looking at your phone!');
      expect(trimTrailingIncompleteSentence('Is that a phone? Put it')).toBe('Is that a phone?');
      expect(trimTrailingIncompleteSentence('No punctuation fragment')).toBe('No punctuation fragment');
    });
  });

  describe('Evaluate Logic', () => {
    test('should construct compiled prompt and return trimmed evaluation stub', async () => {
      await llmEvaluator.initialize('test-model-id');

      const context: EvaluatorContext = {
        violationCount: 1,
        distractionDuration: 8,
        timeRemaining: 1200,
        activeSessionGoal: 'Revise PRD'
      };

      const result = await llmEvaluator.evaluate('Disappointed Parent', context);
      
      expect(llmEvaluator.getState()).toBe('ready');
      expect(result).toContain('[Stub]');
      expect(result).toContain('[System: Disappointed Parent]');
      expect(result).toContain('[Active Session Goal]: Revise PRD');
      
      llmEvaluator.cancel();
      expect(llmEvaluator.getState()).toBe('ready');
    });
  });
});
