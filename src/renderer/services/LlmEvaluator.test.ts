import { describe, test, expect, vi, beforeEach } from 'vitest';
import llmEvaluator from './LlmEvaluator';

describe('LlmEvaluator Pub/Sub Service', () => {
  beforeEach(() => {
    // Reset state to default before each test
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

    // Clear call history from the immediate subscription callback
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

  test('should process stub methods and trigger state transformations correctly', async () => {
    const listener = vi.fn();
    const unsubscribe = llmEvaluator.subscribe(listener);
    
    listener.mockClear();
    await llmEvaluator.initialize('test-model-id');
    expect(llmEvaluator.getState()).toBe('ready');

    listener.mockClear();
    const result = await llmEvaluator.evaluate('hello');
    expect(result).toBe('Stub response to: hello');
    expect(llmEvaluator.getState()).toBe('ready');

    listener.mockClear();
    llmEvaluator.cancel();
    expect(llmEvaluator.getState()).toBe('ready');

    unsubscribe();
  });
});
