import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import App from './App';

describe('FocusSentinel App React UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the header without crashing', () => {
    render(<App />);
    expect(screen.getByText((content, element) => element?.textContent === 'FocusSentinel')).toBeDefined();
  });

  test('wires window control buttons to window.api', () => {
    render(<App />);

    fireEvent.click(screen.getByTitle('Minimize'));
    expect(window.api.minimize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Maximize'));
    expect(window.api.maximize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Close'));
    expect(window.api.close).toHaveBeenCalled();
  });
});
