import { render, screen, act } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import { PremiumGuard } from './PremiumGuard';
import { licenseManager } from '../services/license/LicenseManager';

describe('PremiumGuard Component', () => {
  beforeEach(() => {
    licenseManager.setTier('free');
  });

  test('should render fallback if feature is premium and user is free', () => {
    render(
      <PremiumGuard feature="piper-tts" fallback={<div data-testid="fallback">Upsell</div>}>
        <div data-testid="content">Secret Feature</div>
      </PremiumGuard>
    );

    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback').textContent).toBe('Upsell');
  });

  test('should render content if feature is premium and user is premium', async () => {
    licenseManager.setTier('premium');

    render(
      <PremiumGuard feature="piper-tts" fallback={<div data-testid="fallback">Upsell</div>}>
        <div data-testid="content">Secret Feature</div>
      </PremiumGuard>
    );

    expect(screen.queryByTestId('fallback')).toBeNull();
    expect(screen.getByTestId('content').textContent).toBe('Secret Feature');
  });

  test('should update render dynamically when tier changes', async () => {
    const { unmount } = render(
      <PremiumGuard feature="piper-tts" fallback={<div data-testid="fallback">Upsell</div>}>
        <div data-testid="content">Secret Feature</div>
      </PremiumGuard>
    );

    expect(screen.getByTestId('fallback')).toBeDefined();
    expect(screen.queryByTestId('content')).toBeNull();

    await act(async () => {
      licenseManager.setTier('premium');
    });

    expect(screen.queryByTestId('fallback')).toBeNull();
    expect(screen.getByTestId('content')).toBeDefined();
    
    unmount();
  });
});
