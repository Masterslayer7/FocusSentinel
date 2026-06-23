import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSpeechProvider } from './WebSpeechProvider';

describe('WebSpeechProvider', () => {
  let mockSpeechSynthesis: any;
  let mockUtteranceInstance: any;

  beforeEach(() => {
    mockSpeechSynthesis = {
      getVoices: vi.fn().mockReturnValue([]),
      cancel: vi.fn(),
      speak: vi.fn().mockImplementation((utterance) => {
        // Trigger onend asynchronously to simulate playback completion
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      }),
      onvoiceschanged: null,
    };

    class MockSpeechSynthesisUtterance {
      text: string;
      voice: any;
      pitch: number = 1;
      rate: number = 1;
      onend: () => void = () => {};
      onerror: (event: any) => void = () => {};

      constructor(text: string) {
        this.text = text;
        mockUtteranceInstance = this;
      }
    }

    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('should return empty list if window.speechSynthesis is not defined', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const provider = new WebSpeechProvider();
    const voices = await provider.getAvailableVoices();
    expect(voices).toEqual([]);
  });

  test('should retrieve and filter English voices immediately if already loaded', async () => {
    const mockVoices = [
      { name: 'Alex', lang: 'en-US' } as any,
      { name: 'Amelie', lang: 'fr-FR' } as any,
      { name: 'Daniel', lang: 'en-GB' } as any,
    ];
    mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);

    const provider = new WebSpeechProvider();
    const voices = await provider.getAvailableVoices();

    expect(voices).toHaveLength(2);
    expect(voices[0]).toEqual({
      id: 'Alex',
      name: 'Alex',
      provider: 'webspeech',
      isPremium: false,
    });
    expect(voices[1].name).toBe('Daniel');
  });

  test('should wait for onvoiceschanged if voices are initially empty', async () => {
    const mockVoices = [{ name: 'Alex', lang: 'en-US' } as any];
    
    const provider = new WebSpeechProvider();
    const getVoicesPromise = provider.getAvailableVoices();

    // Trigger onvoiceschanged callback
    mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);
    if (mockSpeechSynthesis.onvoiceschanged) {
      mockSpeechSynthesis.onvoiceschanged();
    }

    const voices = await getVoicesPromise;
    expect(voices).toHaveLength(1);
    expect(voices[0].name).toBe('Alex');
    expect(mockSpeechSynthesis.onvoiceschanged).toBeNull();
  });

  test('should timeout and return fallback if onvoiceschanged doesn\'t fire', async () => {
    vi.useFakeTimers();
    const provider = new WebSpeechProvider();
    const getVoicesPromise = provider.getAvailableVoices();

    // Fast-forward time to trigger timeout using async helper
    await vi.advanceTimersByTimeAsync(1600);

    const voices = await getVoicesPromise;
    expect(voices).toEqual([]);
  });

  test('should speak correctly and call cancel before speak', async () => {
    const mockVoices = [{ name: 'Alex', lang: 'en-US' } as any];
    mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);

    const provider = new WebSpeechProvider();
    await provider.initialize();

    const speakPromise = provider.speak('Hello world', 'Alex', { pitch: 1.2, rate: 1.5 });
    
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(mockUtteranceInstance).toBeDefined();
    expect(mockUtteranceInstance.text).toBe('Hello world');
    expect(mockUtteranceInstance.pitch).toBe(1.2);
    expect(mockUtteranceInstance.rate).toBe(1.5);
    expect(mockUtteranceInstance.voice).toEqual({ name: 'Alex', lang: 'en-US' });

    await speakPromise;
  });

  test('should reject speak on error', async () => {
    mockSpeechSynthesis.speak.mockImplementation((utterance) => {
      setTimeout(() => {
        if (utterance.onerror) {
          utterance.onerror({ error: 'failed' });
        }
      }, 10);
    });

    const provider = new WebSpeechProvider();
    await expect(provider.speak('Hello', '')).rejects.toThrow('Speech synthesis error: failed');
  });
});

