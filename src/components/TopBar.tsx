"use client";

interface TopBarProps {
  running: boolean;
  onToggleRunning: () => void;
  onResetClock: () => void;
  onExport: () => void;
}

export function TopBar({ running, onToggleRunning, onResetClock, onExport }: TopBarProps) {
  return (
    <header className="topBar panelShell">
      <div className="brandMark">
        <span>WLED Studio</span>
      </div>
      <nav className="topBarActions" aria-label="Primary controls">
        <button type="button" className={running ? "pillButton active" : "pillButton"} onClick={onToggleRunning}>
          {running ? "Pause" : "Run"}
        </button>
        <button type="button" className="pillButton" onClick={onResetClock}>
          Reset Clock
        </button>
        <button type="button" className="pillButton" onClick={onExport}>
          Export
        </button>
      </nav>
    </header>
  );
}
