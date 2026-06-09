import React, { useEffect, useRef } from 'react';

interface LogConsoleProps {
  streamLogs: string[];
  onClearLogs: () => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({ streamLogs, onClearLogs }) => {
  const logConsoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom whenever logs are added
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
    }
  }, [streamLogs]);

  return (
    <div className="log-console">
      <div className="console-header">
        <span>Raw JSON Stream Packet Console</span>
        <button id="btn-clear" className="btn-clear" onClick={onClearLogs}>Clear Logs</button>
      </div>
      <div className="console-body" id="log-body" ref={logConsoleRef}>
        {streamLogs.map((log, idx) => {
          const parts = log.split('|');
          const hasType = parts.length > 1;
          const typeClass = hasType ? parts[0] : '';
          const message = hasType ? parts.slice(1).join('|') : parts[0];
          return (
            <div key={idx} className={`log-line ${typeClass}`}>
              {message}
            </div>
          );
        })}
      </div>
    </div>
  );
};
