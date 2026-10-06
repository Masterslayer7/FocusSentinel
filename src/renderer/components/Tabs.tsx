import React, { useId } from 'react';

interface TabsProps<T extends string> {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  children: React.ReactNode; // the active tab's panel
}

export function Tabs<T extends string>({ tabs, active, onChange, children }: TabsProps<T>) {
  const id = useId();

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(active) + step + tabs.length) % tabs.length];
    onChange(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };

  return (
    <section className="card tabs-card">
      <div className="tab-list" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`${id}-${tab}`}
            role="tab"
            className="tab"
            aria-selected={tab === active}
            aria-controls={`${id}-panel`}
            tabIndex={tab === active ? 0 : -1}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${active}`}>
        {children}
      </div>
    </section>
  );
}
