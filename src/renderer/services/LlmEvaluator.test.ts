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

describe('LlmEvaluator Pub/Sub Service', () => {
  const mockCachesDelete = vi.fn().mockResolvedValue(true);
  const mockCachesKeys = vi.fn().mockResolvedValue(['web-llm/test-model-id']);

  beforeEach(() => {
    // Reset call histories
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

    // Reset llm status state to default before each test
    llmEvaluator.updateStatus('uninitialized', 0, '');
  });

  test('should initialize with default uninitialized state', () => {
    expect(llmEvaluator.getState()).toBe('uninitialized');
    expect(llmEvaluator.getProgress()).toBe(0);
    expect(llmEvaluator.getMessage()).toBe('');
  });

  test('should notify subscriber immediately upon subscription with current status', () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      state: 'uninitialized',
      progress: 0,
      message: ''
    });

    unsubscribe();
  });

  test('should notify all active subscribers of status updates', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsubscribe1 = llmEvaluator.subscribe(listener1);
    const unsubscribe2 = llmEvaluator.subscribe(listener2);

    listener1.mockClear();
    listener2.mockClear();

    llmEvaluator.updateStatus('loading', 45, 'Downloading model shard...');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith({
      state: 'loading',
      progress: 45,
      message: 'Downloading model shard...'
    });

    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledWith({
      state: 'loading',
      progress: 45,
      message: 'Downloading model shard...'
    });

    unsubscribe1();
    unsubscribe2();
  });

  test('should stop notifying listener after unsubscribing', () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    listener.mockClear();
    unsubscribe();

    llmEvaluator.updateStatus('ready', 100, 'Ready');
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

  test('should process evaluation and cancellation stubs correctly', async () => {
    await llmEvaluator.initialize('test-model-id');

    const result = await llmEvaluator.evaluate('hello');
    expect(result).toBe('Stub response to: hello');
    expect(llmEvaluator.getState()).toBe('ready');

    llmEvaluator.cancel();
    expect(llmEvaluator.getState()).toBe('ready');
  });
});
