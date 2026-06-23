import { describe, test, expect, vi, beforeEach } from 'vitest';
import { licenseManager } from './LicenseManager';

describe('LicenseManager', () => {
  beforeEach(() => {
    licenseManager.setTier('free');
  });

  test('should default to free tier', () => {
    expect(licenseManager.getTier()).toBe('free');
  });

  test('should deny access to premium features for free tier', () => {
    expect(licenseManager.canAccess('piper-tts')).toBe(false);
  });

  test('should allow access to non-premium features for free tier', () => {
    expect(licenseManager.canAccess('basic-telemetry')).toBe(true);
  });

  test('should allow access to premium features when tier is premium', () => {
    licenseManager.setTier('premium');
    expect(licenseManager.canAccess('piper-tts')).toBe(true);
    expect(licenseManager.canAccess('basic-telemetry')).toBe(true);
  });

  test('should notify subscribers on tier change', () => {
    const listener = vi.fn();
    const unsubscribe = licenseManager.subscribe(listener);

    expect(listener).toHaveBeenCalledWith({ tier: 'free' });
    listener.mockClear();

    licenseManager.setTier('premium');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ tier: 'premium' });

    unsubscribe();
  });
});
