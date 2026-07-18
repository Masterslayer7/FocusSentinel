import React from 'react';
import { Header } from './components/Header';

interface Window {
  api: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}

declare const window: Window;

export default function App() {
  return (
    <div className="app-container">
      <Header
        onMinimize={() => window.api.minimize()}
        onMaximize={() => window.api.maximize()}
        onClose={() => window.api.close()}
      />

      <main className="app-main">
        {/* Next up: goal input, desktop-usage tracking, and supportive LLM guidance land here. */}
      </main>
    </div>
  );
}
